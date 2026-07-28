const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { json, noContent, error } = require("../../shared/response");
const { assembleBirthdayLetter } = require("./assemble-birthday-letter");
const { selectAnniversaryNote } = require("./assemble-anniversary-note");
const milestonesLibrary = require("../milestones/library");
const voiceStorage = require("./voice-storage");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const MILESTONES_TABLE = process.env.MILESTONES_TABLE;
const VOICE_MEMORIES_TABLE = process.env.VOICE_MEMORIES_TABLE;

// Product hasn't specified an exact "graduation" age anywhere in the spec
// docs (GRAD-04 isn't otherwise built yet) -- 18 years is a placeholder so
// the server-side lock the brief requires ("parent-capsule type returns
// metadata only, no URLs, until child age >= graduation threshold") is real
// and enforced now, not deferred. Flag to product if a different age is
// intended; this is a one-line change once that's decided.
const GRADUATION_AGE_MONTHS = 216;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_CAPSULE_SECONDS = 90;
const VALID_VOICE_TYPES = new Set(["parent-capsule", "child-voice"]);

function claimsFromEvent(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims || {};
  return { userId: claims.sub || "local-acceptance-user" };
}

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function childIdFromPath(event) {
  if (event.pathParameters?.childId) return event.pathParameters.childId;
  const path = event.rawPath || event.path || "";
  const match = path.match(/\/memories\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function memoryIdFromPath(event) {
  if (event.pathParameters?.memoryId) return event.pathParameters.memoryId;
  const path = event.rawPath || event.path || "";
  const match = path.match(/\/voice\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function truncate(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

async function getChild(userId, childId) {
  const result = await documentClient.send(new GetCommand({ TableName: CHILDREN_TABLE, Key: { userId, childId } }));
  return result.Item || null;
}

function ageMonthsFor(child, now = new Date()) {
  const birthDate = child?.birthDate || child?.childBirthDate;
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return 0;
  return Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
}

async function fetchVoiceMemories(userId, childId, type) {
  if (!VOICE_MEMORIES_TABLE) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: VOICE_MEMORIES_TABLE,
    KeyConditionExpression: "userId = :userId AND begins_with(childMemoryId, :prefix)",
    ExpressionAttributeValues: { ":userId": userId, ":prefix": `${childId}#` }
  }));
  const items = result.Items || [];
  return type ? items.filter((item) => item.type === type) : items;
}

async function fetchAllMilestones(childId) {
  if (!MILESTONES_TABLE) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: MILESTONES_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId }
  }));
  return (result.Items || []).filter((item) => !item.cleared && item.progressType !== "watch-for");
}

async function fetchMilestonesInRange(childId, startDate, endDate) {
  if (!MILESTONES_TABLE) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: MILESTONES_TABLE,
    KeyConditionExpression: "childId = :childId AND observedAt BETWEEN :start AND :end",
    ExpressionAttributeValues: { ":childId": childId, ":start": startDate, ":end": endDate }
  }));
  return (result.Items || []).filter((item) => !item.cleared && item.progressType !== "watch-for");
}

// N7 (Birthday Letter): generated on-demand when the parent opens it, never
// proactively pushed. "Year N" is the 12 months ending on this birthday --
// year 1 is birth to first birthday, year 2 is first to second, and so on.
// Pulls only what's actually on record (milestones, D7 custom firsts,
// N2/N3 voice memories if that table exists) -- a quiet year still gets a
// real, honest letter rather than a fabricated one.
async function handleGetBirthdayLetter(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "That child was not found on this account.");

  const birthDate = child.birthDate || child.childBirthDate;
  if (!birthDate) return error(400, "MISSING_BIRTH_DATE", "This child's birth date isn't on file yet.");

  const now = new Date();
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return error(400, "INVALID_FIELD", "This child's birth date could not be read.");

  const monthsOld = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  const ageYears = Math.floor(monthsOld / 12);
  if (ageYears < 1) {
    return error(409, "TOO_YOUNG", "The birthday letter starts at the first birthday.");
  }

  const windowEnd = new Date(birth);
  windowEnd.setFullYear(birth.getFullYear() + ageYears);
  const windowStart = new Date(birth);
  windowStart.setFullYear(birth.getFullYear() + ageYears - 1);

  const childName = child.childName || child.name || "your child";
  const allObservations = await fetchMilestonesInRange(childId, windowStart.toISOString(), windowEnd.toISOString());
  const milestones = allObservations
    .filter((o) => !String(o.milestoneId || "").startsWith("custom#"))
    .map((o) => {
      const found = milestonesLibrary.findMilestone(o.milestoneId);
      return { text: found?.milestone?.text || o.milestoneName || "reached a new milestone", observedAt: o.observedAt };
    });
  const customFirsts = allObservations
    .filter((o) => String(o.milestoneId || "").startsWith("custom#"))
    .map((o) => ({ customName: o.customName || o.milestoneName, observedAt: o.observedAt }));

  const voiceMemories = await fetchVoiceMemories(userId, childId, "child-voice");
  const voiceMemoryCount = voiceMemories.filter((memory) => {
    if (!memory.recordedAt) return false;
    return memory.recordedAt >= windowStart.toISOString() && memory.recordedAt <= windowEnd.toISOString();
  }).length;

  const letter = assembleBirthdayLetter({ childName, ageYears, milestones, customFirsts, voiceMemoryCount });

  return json(200, {
    letter: {
      childId,
      childName,
      ageYears,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      title: letter.title,
      bodyText: letter.bodyText,
      milestoneCount: milestones.length,
      customFirstsCount: customFirsts.length,
      generatedAt: now.toISOString()
    }
  });
}

// N1 (Milestone anniversaries): folds into the same daily-note slot Home
// already renders -- this just tells the client whether today happens to be
// a recognized anniversary of a real recorded milestone/first, and if so,
// hands back a deterministically assembled note to show instead of the
// generic daily note. Returns { note: null } on an ordinary day rather than
// an error, since "nothing to say today" is the expected common case.
async function handleGetAnniversaryNote(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "That child was not found on this account.");

  const childName = child.childName || child.name || "your child";
  const allObservations = await fetchAllMilestones(childId);
  const observations = allObservations.map((o) => {
    if (String(o.milestoneId || "").startsWith("custom#")) {
      return { milestoneText: o.customName || o.milestoneName || "a first", observedAt: o.observedAt, kind: "first" };
    }
    const found = milestonesLibrary.findMilestone(o.milestoneId);
    return { milestoneText: found?.milestone?.text || o.milestoneName || "reached a new milestone", observedAt: o.observedAt, kind: "milestone" };
  });

  const selected = selectAnniversaryNote({ observations, childName, sexAtBirth: child.sexAtBirth });
  if (!selected) return json(200, { note: null });

  return json(200, {
    note: {
      childId,
      bodyText: selected.bodyText,
      milestoneText: selected.milestoneText,
      observedAt: selected.observedAt,
      tierLabel: selected.tierLabel
    }
  });
}

// N3 (Child voice recordings) / N2 (Parent voice capsules): share one table
// and one Lambda per the brief -- "build together, ship N3's browsable
// voices first, N2's capsule lock is one server-side visibility rule on
// top." type=child-voice is always browsable to the parent; type=parent-capsule
// is locked server-side (metadata only, no playback URL) until the child
// reaches GRADUATION_AGE_MONTHS.
async function handlePostVoiceMemory(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "That child was not found on this account.");

  let body;
  try {
    body = parseBody(event);
  } catch {
    return error(400, "INVALID_BODY", "Request body could not be read.");
  }

  const type = body.type;
  if (!VALID_VOICE_TYPES.has(type)) {
    return error(400, "INVALID_FIELD", "type must be one of: parent-capsule, child-voice.");
  }
  const label = truncate(body.label, 200);
  if (!body.audioBase64 || typeof body.audioBase64 !== "string") {
    return error(400, "INVALID_FIELD", "audioBase64 is required.");
  }

  let buffer;
  try {
    buffer = Buffer.from(body.audioBase64, "base64");
  } catch {
    return error(400, "INVALID_FIELD", "audioBase64 could not be decoded.");
  }
  if (buffer.length === 0) return error(400, "INVALID_FIELD", "audioBase64 was empty.");
  if (buffer.length > MAX_AUDIO_BYTES) return error(400, "AUDIO_TOO_LARGE", "That recording is too large.");
  if (type === "parent-capsule" && body.durationSeconds && body.durationSeconds > MAX_CAPSULE_SECONDS) {
    return error(400, "CAPSULE_TOO_LONG", `Parent capsules are capped at ${MAX_CAPSULE_SECONDS} seconds.`);
  }

  const memoryId = crypto.randomUUID();
  const recordedAt = new Date().toISOString();
  const contentType = truncate(body.contentType, 100) || "audio/m4a";
  const audioKey = `voice-memories/${userId}/${childId}/${memoryId}`;

  await voiceStorage.putAudioObject(audioKey, buffer, contentType);

  const item = {
    userId,
    childMemoryId: `${childId}#${memoryId}`,
    childId,
    memoryId,
    type,
    label,
    audioKey,
    contentType,
    durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : null,
    recordedAt,
    recordedBy: truncate(body.recordedBy, 100)
  };

  await documentClient.send(new PutCommand({ TableName: VOICE_MEMORIES_TABLE, Item: item }));

  return json(201, {
    memory: { memoryId, childId, type, label, durationSeconds: item.durationSeconds, recordedAt }
  });
}

async function handleGetVoiceMemories(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "That child was not found on this account.");

  const query = event.queryStringParameters || {};
  const type = query.type && VALID_VOICE_TYPES.has(query.type) ? query.type : undefined;
  const items = await fetchVoiceMemories(userId, childId, type);
  const childAgeMonths = ageMonthsFor(child);
  const graduated = childAgeMonths >= GRADUATION_AGE_MONTHS;

  const memories = await Promise.all(items
    .sort((a, b) => String(b.recordedAt || "").localeCompare(String(a.recordedAt || "")))
    .map(async (item) => {
      const base = {
        memoryId: item.memoryId,
        childId: item.childId,
        type: item.type,
        label: item.label || null,
        durationSeconds: item.durationSeconds ?? null,
        recordedAt: item.recordedAt
      };
      // The lock: parent-capsule audio never leaves the server as a playable
      // URL until the child has graduated. Metadata (that it exists, when it
      // was recorded, its label) is always visible so the memory book can
      // show it's there and waiting.
      if (item.type === "parent-capsule" && !graduated) {
        return { ...base, playbackUrl: null, locked: true };
      }
      const playbackUrl = await voiceStorage.presignedPlaybackUrl(item.audioKey);
      return { ...base, playbackUrl, locked: false };
    }));

  return json(200, { memories, childAgeMonths, graduationAgeMonths: GRADUATION_AGE_MONTHS });
}

async function handleDeleteVoiceMemory(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  const memoryId = memoryIdFromPath(event);
  if (!childId || !memoryId) return error(400, "INVALID_FIELD", "childId and memoryId are required.");

  const existing = await documentClient.send(new GetCommand({
    TableName: VOICE_MEMORIES_TABLE,
    Key: { userId, childMemoryId: `${childId}#${memoryId}` }
  }));
  if (!existing.Item) return error(404, "MEMORY_NOT_FOUND", "That voice memory was not found.");

  await voiceStorage.deleteAudioObject(existing.Item.audioKey);
  await documentClient.send(new DeleteCommand({
    TableName: VOICE_MEMORIES_TABLE,
    Key: { userId, childMemoryId: `${childId}#${memoryId}` }
  }));

  return noContent();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CHILDREN_TABLE) return error(500, "CONFIGURATION_ERROR", "Memory tables are not configured.");

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.endsWith("/birthday-letter")) return handleGetBirthdayLetter(event);
    if (event.httpMethod === "GET" && path.endsWith("/anniversary-note")) return handleGetAnniversaryNote(event);
    if (event.httpMethod === "POST" && path.endsWith("/voice")) {
      if (!VOICE_MEMORIES_TABLE) return error(500, "CONFIGURATION_ERROR", "Voice memories are not configured.");
      return handlePostVoiceMemory(event);
    }
    if (event.httpMethod === "GET" && path.endsWith("/voice")) {
      if (!VOICE_MEMORIES_TABLE) return error(500, "CONFIGURATION_ERROR", "Voice memories are not configured.");
      return handleGetVoiceMemories(event);
    }
    if (event.httpMethod === "DELETE" && path.includes("/voice/")) {
      if (!VOICE_MEMORIES_TABLE) return error(500, "CONFIGURATION_ERROR", "Voice memories are not configured.");
      return handleDeleteVoiceMemory(event);
    }
    return error(404, "NOT_FOUND", "Mobile memories route not found.");
  } catch (err) {
    console.error("mobile memories route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile memories service.");
  }
};

exports._private = { assembleBirthdayLetter, selectAnniversaryNote, ageMonthsFor, GRADUATION_AGE_MONTHS };
