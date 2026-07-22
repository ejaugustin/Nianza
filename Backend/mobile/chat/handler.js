const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const chatContext = require("./context");
const gateway = require("./gateway");
const { safetyGate } = require("./safety");
const vaccineLibrary = require("../vaccines/library");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const USERS_TABLE = process.env.USERS_TABLE;
const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const MILESTONES_TABLE = process.env.MILESTONES_TABLE;
const SICK_ENCOUNTERS_TABLE = process.env.SICK_ENCOUNTERS_TABLE;
const VACCINES_TABLE = process.env.VACCINES_TABLE;
const VITALS_TABLE = process.env.VITALS_TABLE;
const CONTENT_TABLE = process.env.CONTENT_TABLE;
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE;

const sessionContextCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000;

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function claimsFromEvent(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims || {};
  return {
    userId: claims.sub || "local-acceptance-user",
    email: claims.email || null
  };
}

function truncate(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

async function tryRead(label, read) {
  try {
    return await read();
  } catch (err) {
    console.warn(`chat enrichment skipped: ${label}`, err?.name || err);
    return null;
  }
}

async function getChildSnapshot(userId, childId) {
  const child = await getChildRecord(userId, childId);
  if (!child) return null;
  return {
    name: child.name || child.childName || null,
    ageMonths: child.ageMonths ?? child.ageWindowMonths ?? null,
    correctedAgeMonths: child.correctedAgeMonths ?? null,
    sexAtBirth: child.sexAtBirth || null
  };
}

async function getChildRecord(userId, childId) {
  if (!CHILDREN_TABLE || !childId) return null;
  const result = await documentClient.send(new GetCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId }
  }));
  return result.Item || null;
}

async function getParentContext(userId) {
  if (!USERS_TABLE) return null;
  const result = await documentClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId }
  }));
  const user = result.Item;
  if (!user) return null;
  return {
    firstTimeParent: user.firstTimeParent ?? null,
    parentRole: user.parentRole ?? null,
    parentingSolo: user.parentingSolo ?? null,
    multilingualHome: user.multilingualHome ?? null
  };
}

async function getRecentMilestones(childId) {
  if (!MILESTONES_TABLE || !childId) return [];
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const result = await documentClient.send(new QueryCommand({
    TableName: MILESTONES_TABLE,
    KeyConditionExpression: "childId = :childId AND observedAt >= :since",
    ExpressionAttributeValues: {
      ":childId": childId,
      ":since": since
    },
    Limit: 10,
    ScanIndexForward: false
  }));
  return (result.Items || []).filter((item) => !String(item.milestoneId || "").startsWith("AE-")).map((item) => ({
    name: item.customName || item.milestoneName || item.milestoneId,
    observedAt: item.observedAt,
    isCustomFirst: String(item.milestoneId || "").startsWith("custom#")
  })).filter((item) => item.name && item.observedAt);
}

async function getCheckedWatchForNames(childId) {
  if (!MILESTONES_TABLE || !childId) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: MILESTONES_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    Limit: 80,
    ScanIndexForward: false
  }));
  return (result.Items || [])
    .filter((item) => item.progressType === "watch-for" && item.cleared !== true)
    .map((item) => item.milestoneName || item.actEarlyId || item.milestoneId)
    .filter(Boolean)
    .slice(0, 8);
}

async function getActiveEncounter(childId) {
  if (!SICK_ENCOUNTERS_TABLE || !childId) return null;
  const result = await documentClient.send(new QueryCommand({
    TableName: SICK_ENCOUNTERS_TABLE,
    KeyConditionExpression: "childId = :childId",
    FilterExpression: "#status = :activeStatus OR active = :activeBool",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":childId": childId,
      ":activeStatus": "active",
      ":activeBool": true
    },
    Limit: 5
  }));
  const item = (result.Items || [])[0];
  if (!item) return null;
  const entryTypes = await tryRead("encounterEntryTypes", () => getEncounterEntryTypeCounts(childId, item.encounterId));
  return {
    name: item.name || item.encounterName || null,
    startDate: item.startDate || item.startedAt || null,
    entryTypeCounts: entryTypes || {}
  };
}

async function getEncounterEntryTypeCounts(childId, encounterId) {
  if (!VITALS_TABLE || !childId || !encounterId) return {};
  const result = await documentClient.send(new QueryCommand({
    TableName: VITALS_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    Limit: 80,
    ScanIndexForward: false
  }));
  const counts = {};
  for (const item of result.Items || []) {
    if (item.encounterId !== encounterId) continue;
    const type = item.type || item.entryType || "note";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

async function getVaccinePosition(childId, child) {
  if (!VACCINES_TABLE || !childId || !child) return null;
  const result = await documentClient.send(new QueryCommand({
    TableName: VACCINES_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    Limit: 80
  }));
  const records = result.Items || [];
  const progress = vaccineLibrary.buildVaccineProgress({ child, records });
  const dueDoseNames = (progress.groups || [])
    .flatMap((group) => group.doses || [])
    .filter((dose) => dose.status === "due")
    .map((dose) => dose.name || dose.fullName || dose.doseId)
    .filter(Boolean)
    .slice(0, 5);
  const latest = records
    .filter((item) => item.givenOn)
    .sort((a, b) => String(b.givenOn).localeCompare(String(a.givenOn)))[0];
  return {
    dueDoseNames,
    mostRecentRecorded: latest ? {
      name: latest.vaccineName || latest.fullName || latest.doseId,
      givenOn: latest.givenOn
    } : null
  };
}

async function getTodaysNote(language) {
  if (!CONTENT_TABLE) return null;
  const result = await documentClient.send(new QueryCommand({
    TableName: CONTENT_TABLE,
    IndexName: "language-contentType-index",
    KeyConditionExpression: "#language = :language AND contentType = :contentType",
    FilterExpression: "clinicallyReviewed = :trueValue AND ejApproved = :trueValue AND (attribute_not_exists(deleted) OR deleted = :deletedFalse)",
    ExpressionAttributeNames: { "#language": "language" },
    ExpressionAttributeValues: {
      ":language": language || "en",
      ":contentType": "daily-note",
      ":trueValue": true,
      ":deletedFalse": false
    },
    Limit: 10,
    ScanIndexForward: false
  }));
  const item = (result.Items || [])[0];
  return item ? { tipId: item.contentId, bodyText: item.bodyText } : null;
}

async function getRecentTopics(userId) {
  if (!CONVERSATIONS_TABLE || !userId) return [];
  const result = await documentClient.send(new QueryCommand({
    TableName: CONVERSATIONS_TABLE,
    IndexName: "user-updatedAt-index",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": userId },
    Limit: 5,
    ScanIndexForward: false
  }));
  return (result.Items || []).flatMap((item) => Array.isArray(item.topicTags) ? item.topicTags : []).slice(0, 5);
}

async function enrichContext({ sessionId, userId, childId, language, ambientContext, contextSeed }) {
  const cached = sessionContextCache.get(sessionId);
  const now = Date.now();
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return {
      ...cached.bundle,
      ambientContext: ambientContext || cached.bundle.ambientContext,
      contextSeed: contextSeed || cached.bundle.contextSeed,
      cachedAt: cached.cachedAt
    };
  }

  const child = await tryRead("childRecord", () => getChildRecord(userId, childId));
  const childSnapshot = child ? {
    name: child.name || child.childName || null,
    ageMonths: child.ageMonths ?? child.ageWindowMonths ?? null,
    correctedAgeMonths: child.correctedAgeMonths ?? null,
    sexAtBirth: child.sexAtBirth || null
  } : null;

  const [parentContext, recentMilestones, checkedWatchForNames, activeEncounter, vaccinePosition, todaysNote, recentTopics] = await Promise.all([
    tryRead("parentContext", () => getParentContext(userId)),
    tryRead("recentMilestones", () => getRecentMilestones(childId)),
    tryRead("checkedWatchForNames", () => getCheckedWatchForNames(childId)),
    tryRead("activeEncounter", () => getActiveEncounter(childId)),
    tryRead("vaccinePosition", () => getVaccinePosition(childId, child)),
    tryRead("todaysNote", () => getTodaysNote(language)),
    tryRead("recentTopics", () => getRecentTopics(userId))
  ]);

  const bundle = {
    ambientContext,
    contextSeed,
    childSnapshot,
    parentContext,
    todaysNote,
    recentEvents: {
      milestones: recentMilestones || [],
      watchForNames: checkedWatchForNames || [],
      encounter: activeEncounter,
      vaccines: vaccinePosition,
      daysUntilVisit: null
    },
    recentTopics: [...(ambientContext?.topics || []), ...(recentTopics || [])].filter(Boolean).slice(0, 5)
  };
  sessionContextCache.set(sessionId, { cachedAt: now, bundle });
  return { ...bundle, cachedAt: now };
}

async function rememberConversation(sessionId, userId, childId, message, reply) {
  if (!CONVERSATIONS_TABLE) return;
  await tryRead("rememberConversation", () => documentClient.send(new PutCommand({
    TableName: CONVERSATIONS_TABLE,
    Item: {
      sessionId,
      userId,
      childId: childId || null,
      updatedAt: new Date().toISOString(),
      lastParentMessage: String(message || "").slice(0, 240),
      lastPatriciaMessage: String(reply || "").slice(0, 240),
      topicTags: extractTopicTags(message, reply),
      expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
    }
  })));
}

function extractTopicTags(message, reply) {
  const text = `${message || ""} ${reply || ""}`.toLowerCase();
  const tags = [];
  for (const [tag, pattern] of [
    ["vaccines", /vaccine|shot|immunization|dtap|mmr/],
    ["milestones", /milestone|rolled|crawl|walk|talk|words/],
    ["sick-day", /fever|cough|crying|sick|symptom|doctor|pediatrician/],
    ["sleep", /sleep|nap|night/],
    ["feeding", /feeding|milk|bottle|breast|diaper/]
  ]) {
    if (pattern.test(text)) tags.push(tag);
  }
  return tags.slice(0, 5);
}

async function handleChat(event) {
  const body = parseBody(event);
  const sessionId = truncate(body.sessionId, 120);
  const message = truncate(body.message, 4000);
  const language = truncate(body.language, 8) || "en";
  const childId = truncate(body.childId, 120);
  if (!sessionId) return error(400, "INVALID_FIELD", "sessionId is required.");
  if (!message) return error(400, "INVALID_FIELD", "message is required.");

  const { userId } = claimsFromEvent(event);
  const ambientContext = chatContext.sanitizeAmbientContext(body.ambientContext);
  const contextSeed = chatContext.sanitizeContextSeed(body.contextSeed);
  const bundle = await enrichContext({ sessionId, userId, childId, language, ambientContext, contextSeed });
  const safety = await safetyGate({
    message,
    bundle,
    language,
    documentClient,
    contentTable: CONTENT_TABLE,
    classifier: gateway.classifyMessage
  });
  const modelResult = safety || await gateway.callPatriciaModel({
    message,
    messages: body.messages,
    bundle
  });
  const reply = modelResult.text;

  await rememberConversation(sessionId, userId, childId, message, reply);

  return json(200, {
    sessionId,
    message: {
      sender: "patricia",
      text: reply,
      eventType: modelResult.eventType || "message",
      safetyType: modelResult.type || null
    },
    context: {
      usedAmbientContext: Boolean(ambientContext),
      usedContextSeed: Boolean(contextSeed),
      enrichment: {
        childSnapshot: Boolean(bundle.childSnapshot),
        parentContext: Boolean(bundle.parentContext),
        todaysNote: Boolean(bundle.todaysNote),
        activeEncounter: Boolean(bundle.recentEvents?.encounter),
        recentMilestones: Boolean(bundle.recentEvents?.milestones?.length),
        checkedWatchForNames: Boolean(bundle.recentEvents?.watchForNames?.length),
        vaccinePosition: Boolean(bundle.recentEvents?.vaccines)
      },
      source: modelResult.source || "template"
    }
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "POST" && path.endsWith("/chat")) return handleChat(event);
    return error(404, "NOT_FOUND", "Mobile chat route not found.");
  } catch (err) {
    console.error("mobile chat route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile chat service.");
  }
};

exports._private = chatContext;
