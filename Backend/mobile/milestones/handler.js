const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { json, noContent, error } = require("../../shared/response");
const milestones = require("./library");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const MILESTONES_TABLE = process.env.MILESTONES_TABLE;

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

function childIdFromPath(event) {
  if (event.pathParameters?.childId) return event.pathParameters.childId;
  const path = event.rawPath || event.path || "";
  const match = path.match(/\/(?:children|milestones)\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function truncate(value, maxLength) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function boolOrNull(value) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function cleanChildPayload(body, existingChild, now) {
  const bornEarly = boolOrNull(body.bornEarly);
  const valueOrExisting = (value, existing) => value == null || value === "" ? existing : value;
  return {
    name: truncate(valueOrExisting(body.name || body.childName, existingChild?.name), 120),
    childName: truncate(valueOrExisting(body.childName || body.name, existingChild?.childName), 120),
    birthDate: truncate(valueOrExisting(body.birthDate || body.childBirthDate, existingChild?.birthDate), 20),
    childBirthDate: truncate(valueOrExisting(body.childBirthDate || body.birthDate, existingChild?.childBirthDate), 20),
    sexAtBirth: truncate(valueOrExisting(body.sexAtBirth, existingChild?.sexAtBirth), 40),
    language: truncate(valueOrExisting(body.language || body.locale, existingChild?.language), 8),
    bornEarly: bornEarly ?? existingChild?.bornEarly,
    weeksEarly: body.weeksEarly == null ? existingChild?.weeksEarly : Number(body.weeksEarly),
    photoUrl: truncate(valueOrExisting(body.photoUrl, existingChild?.photoUrl), 2048),
    // N5 (Parking-Lot Debrief) needs a real, server-side nextVisitDate so the
    // post-visit prompt can fire and then clear it -- previously this only
    // lived on the mobile client (pediatrician settings screen) and was
    // silently dropped here. null is a valid, explicit value (used to clear
    // the date), so it's only left alone when the field is truly absent from
    // the request body.
    nextVisitDate: body.nextVisitDate === undefined ? existingChild?.nextVisitDate ?? null : truncate(body.nextVisitDate, 20),
    // M16 (Family postcards): server-side throttle so the postcard offer is
    // genuinely occasional, not a nag -- the client only shows the offer
    // when this is null or old enough (see postcard-offer logic on mobile).
    // Same explicit-null pattern as nextVisitDate above.
    lastPostcardOfferAt: body.lastPostcardOfferAt === undefined ? existingChild?.lastPostcardOfferAt ?? null : truncate(body.lastPostcardOfferAt, 30),
    createdAt: existingChild?.createdAt || body.createdAt || now,
    updatedAt: now,
    backfillOffered: existingChild?.backfillOffered || false
  };
}

async function getChild(userId, childId) {
  const result = await documentClient.send(new GetCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId }
  }));
  return result.Item || null;
}

async function listChildrenForUser(userId) {
  const result = await documentClient.send(new QueryCommand({
    TableName: CHILDREN_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": userId }
  }));
  return (result.Items || []).filter((item) => !item.removedAt);
}

async function handleListChildren(event) {
  const { userId } = claimsFromEvent(event);
  const children = await listChildrenForUser(userId);
  children.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  return json(200, { children });
}

async function handleCreateChild(event) {
  const { userId, email } = claimsFromEvent(event);
  const body = parseBody(event);
  const childName = truncate(body.childName || body.name, 120);
  const childBirthDate = truncate(body.childBirthDate || body.birthDate, 20);
  if (!childName || !childBirthDate) {
    return error(400, "INVALID_FIELD", "childName and childBirthDate are required.");
  }

  const childId = body.childId ? truncate(body.childId, 120) : crypto.randomUUID();
  const existingChild = await getChild(userId, childId);
  if (existingChild) {
    return error(409, "CHILD_ALREADY_EXISTS", "A child with that id already exists.");
  }

  const now = new Date().toISOString();
  const child = {
    userId,
    childId,
    parentEmail: email,
    ...cleanChildPayload(body, null, now)
  };

  await documentClient.send(new PutCommand({
    TableName: CHILDREN_TABLE,
    Item: child
  }));

  return json(201, { child });
}

async function handleUpsertChild(event) {
  const { userId, email } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const body = parseBody(event);
  const now = new Date().toISOString();
  const existingChild = await getChild(userId, childId);
  const child = {
    userId,
    childId,
    parentEmail: email,
    ...cleanChildPayload(body, existingChild, now)
  };

  await documentClient.send(new PutCommand({
    TableName: CHILDREN_TABLE,
    Item: child
  }));

  return json(200, { child });
}

async function handleDeleteChild(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const existingChild = await getChild(userId, childId);
  if (!existingChild) return error(404, "CHILD_NOT_FOUND", "That child was not found on this account.");
  if (existingChild.removedAt) return noContent();

  // Soft delete: mark removedAt instead of deleting the row so vitals,
  // milestones, vaccine, and report history tied to this childId aren't
  // orphaned or silently lost. listChildrenForUser filters these out, so
  // the child immediately disappears from the account everywhere in the
  // app, but the underlying data is still there if a parent needs it back.
  const now = new Date().toISOString();
  await documentClient.send(new UpdateCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId },
    UpdateExpression: "SET removedAt = :now, updatedAt = :now",
    ConditionExpression: "attribute_exists(userId) AND attribute_exists(childId)",
    ExpressionAttributeValues: { ":now": now }
  }));

  return noContent();
}

async function listProgress(childId) {
  const result = await documentClient.send(new QueryCommand({
    TableName: MILESTONES_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId }
  }));
  return result.Items || [];
}

// D7 (Custom firsts): buildMilestoneProgress only ever looks up progress
// records that match a library milestoneId, so custom# entries never appear
// in GET /milestones/{childId} at all -- which is exactly what keeps
// milestonesThisMonth and D4 escalation logic developmental-only, per the
// spec's hard boundaries. That also means firsts need their own read path.
async function handleGetCustomFirsts(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before requesting firsts.");

  const items = await listProgress(childId);
  const firsts = items
    .filter((item) => String(item.milestoneId || "").startsWith("custom#") && !item.cleared)
    .sort((a, b) => String(b.observedAt || "").localeCompare(String(a.observedAt || "")))
    .map((item) => ({
      milestoneId: item.milestoneId,
      customName: item.customName || item.milestoneName,
      observedAt: item.observedAt,
      photoUrls: item.photoUrls || []
    }));

  return json(200, { firsts });
}

async function handleGetMilestones(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before requesting milestone progress.");

  const progressItems = await listProgress(childId);
  return json(200, milestones.buildMilestoneProgress({ child, progressItems }));
}

async function handleObserveMilestone(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before recording milestone progress.");

  const body = parseBody(event);
  const milestoneId = truncate(body.milestoneId || body.actEarlyId, 120);
  if (!milestoneId) return error(400, "INVALID_FIELD", "milestoneId is required.");

  const isWatchFor = milestoneId.startsWith("AE-");
  const found = isWatchFor ? milestones.findActEarly(milestoneId) : milestones.findMilestone(milestoneId);
  if (!found && !milestoneId.startsWith("custom#")) {
    return error(400, "UNKNOWN_PROGRESS_ITEM", "milestoneId is not in the milestone library.");
  }

  const isCustomFirst = milestoneId.startsWith("custom#");
  const now = new Date().toISOString();
  const observedAt = truncate(body.observedAt, 40) || now;
  const checked = body.checked !== false;
  const item = {
    childId,
    observedAt,
    milestoneId,
    ...(isWatchFor ? { actEarlyId: milestoneId } : {}),
    progressType: isWatchFor ? "watch-for" : "milestone",
    milestoneName: truncate(body.milestoneName || found?.milestone?.text || found?.actEarly?.text, 500),
    // D7 (Custom firsts): parent-authored, so there's no library entry to
    // pull a name from -- customName is the source of truth for these, kept
    // alongside milestoneName since some readers (chat context) look for
    // either. Never touched for real CDC milestones.
    ...(isCustomFirst ? { customName: truncate(body.milestoneName || body.customName, 200) } : {}),
    originWindow: found?.window.ageKey || null,
    originLabel: found?.window.label || null,
    cleared: !checked,
    backfilled: Boolean(body.backfilled),
    photoUrls: Array.isArray(body.photoUrls) ? body.photoUrls.filter(Boolean).slice(0, 8) : [],
    recordedBy: userId,
    createdAt: now
  };

  await documentClient.send(new PutCommand({
    TableName: MILESTONES_TABLE,
    Item: item
  }));

  return json(checked ? 201 : 200, { observation: item });
}

async function handleBackfillOffered(event) {
  const { userId } = claimsFromEvent(event);
  const childId = childIdFromPath(event);
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const now = new Date().toISOString();
  const result = await documentClient.send(new UpdateCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId },
    UpdateExpression: "SET backfillOffered = :trueValue, backfillOfferedAt = :now, updatedAt = :now",
    ConditionExpression: "attribute_exists(userId) AND attribute_exists(childId)",
    ExpressionAttributeValues: {
      ":trueValue": true,
      ":now": now
    },
    ReturnValues: "ALL_NEW"
  }));

  return json(200, { child: result.Attributes });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CHILDREN_TABLE || !MILESTONES_TABLE) {
    return error(500, "CONFIGURATION_ERROR", "Milestone tables are not configured.");
  }

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && /\/children$/.test(path)) return handleListChildren(event);
    if (event.httpMethod === "POST" && /\/children$/.test(path)) return handleCreateChild(event);
    if (event.httpMethod === "PUT" && path.includes("/children/")) return handleUpsertChild(event);
    if (event.httpMethod === "DELETE" && path.includes("/children/")) return handleDeleteChild(event);
    if (event.httpMethod === "GET" && path.endsWith("/firsts")) return handleGetCustomFirsts(event);
    if (event.httpMethod === "GET" && path.includes("/milestones/")) return handleGetMilestones(event);
    if (event.httpMethod === "POST" && path.endsWith("/observations")) return handleObserveMilestone(event);
    if (event.httpMethod === "POST" && path.endsWith("/backfill-offered")) return handleBackfillOffered(event);
    return error(404, "NOT_FOUND", "Mobile milestones route not found.");
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      return error(404, "CHILD_NOT_FOUND", "That child profile could not be found.");
    }
    console.error("mobile milestones route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile milestones service.");
  }
};

exports._private = milestones;
