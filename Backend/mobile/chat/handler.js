const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const chatContext = require("./context");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const USERS_TABLE = process.env.USERS_TABLE;
const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const MILESTONES_TABLE = process.env.MILESTONES_TABLE;
const SICK_ENCOUNTERS_TABLE = process.env.SICK_ENCOUNTERS_TABLE;
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
  if (!CHILDREN_TABLE || !childId) return null;
  const result = await documentClient.send(new GetCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId }
  }));
  const child = result.Item;
  if (!child) return null;
  return {
    name: child.name || child.childName || null,
    ageMonths: child.ageMonths ?? child.ageWindowMonths ?? null,
    correctedAgeMonths: child.correctedAgeMonths ?? null,
    sexAtBirth: child.sexAtBirth || null
  };
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

async function getActiveEncounter(childId) {
  if (!SICK_ENCOUNTERS_TABLE || !childId) return null;
  const result = await documentClient.send(new QueryCommand({
    TableName: SICK_ENCOUNTERS_TABLE,
    KeyConditionExpression: "childId = :childId",
    FilterExpression: "active = :active",
    ExpressionAttributeValues: {
      ":childId": childId,
      ":active": true
    },
    Limit: 5
  }));
  const item = (result.Items || [])[0];
  if (!item) return null;
  return {
    name: item.name || item.encounterName || null,
    startDate: item.startDate || item.startedAt || null
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

  const [childSnapshot, parentContext, recentMilestones, activeEncounter, todaysNote, recentTopics] = await Promise.all([
    tryRead("childSnapshot", () => getChildSnapshot(userId, childId)),
    tryRead("parentContext", () => getParentContext(userId)),
    tryRead("recentMilestones", () => getRecentMilestones(childId)),
    tryRead("activeEncounter", () => getActiveEncounter(childId)),
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
      encounter: activeEncounter,
      daysUntilVisit: null
    },
    recentTopics: recentTopics || []
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
      topicTags: [],
      expiresAt: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
    }
  })));
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
  const reply = chatContext.generatePatriciaReply(message, bundle);

  await rememberConversation(sessionId, userId, childId, message, reply);

  return json(200, {
    sessionId,
    message: {
      sender: "patricia",
      text: reply
    },
    context: {
      usedAmbientContext: Boolean(ambientContext),
      usedContextSeed: Boolean(contextSeed),
      enrichment: {
        childSnapshot: Boolean(bundle.childSnapshot),
        parentContext: Boolean(bundle.parentContext),
        todaysNote: Boolean(bundle.todaysNote),
        activeEncounter: Boolean(bundle.recentEvents?.encounter),
        recentMilestones: Boolean(bundle.recentEvents?.milestones?.length)
      }
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
