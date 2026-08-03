// NZA-WEEKLY-LETTER-v1.0 (+ Addenda A/B/C, tier-gating overridden 2026-08-01
// to lock like the rest of mobile/reports/). Phase 1 only: real generation,
// storage, and tier-gated in-app viewing. No email send yet -- that's Phase
// 2, blocked on the nianza.com SES identity verifying and cross-account
// dispatcher access (see docs/NZA-WEEKLY-LETTER-v1.0-spec.md).
//
// Two entry shapes into the same handler: an EventBridge Schedule event (no
// httpMethod) runs the weekly fan-out across every child; an API Gateway
// event serves the three mobile routes.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { json, noContent, error } = require("../../shared/response");
const { getEntitlements } = require("../../shared/entitlements");
const periods = require("./periods");
const weeklyData = require("./data");
const { generateWeeklyLetter } = require("./generate");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const LETTERS_TABLE = process.env.LETTERS_TABLE;
const LETTERS_TABLE_CHILD_INDEX = process.env.LETTERS_TABLE_CHILD_INDEX || "childId-index";
const tables = {
  VITALS_TABLE: process.env.VITALS_TABLE,
  MILESTONES_TABLE: process.env.MILESTONES_TABLE,
  SICK_ENCOUNTERS_TABLE: process.env.SICK_ENCOUNTERS_TABLE,
  VACCINES_TABLE: process.env.VACCINES_TABLE
};

function claimsFromEvent(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims || {};
  return { userId: claims.sub || "local-acceptance-user" };
}

function pathPart(event, name) {
  if (event.pathParameters?.[name]) return decodeURIComponent(event.pathParameters[name]);
  const path = event.rawPath || event.path || "";
  if (name === "childId") return path.match(/\/weekly-letters\/by-child\/([^/]+)/)?.[1] ? decodeURIComponent(path.match(/\/weekly-letters\/by-child\/([^/]+)/)[1]) : null;
  if (name === "letterId") return path.match(/\/weekly-letters\/([^/]+)(?:\/read)?$/)?.[1] ? decodeURIComponent(path.match(/\/weekly-letters\/([^/]+)(?:\/read)?$/)[1]) : null;
  return null;
}

// NZA-SUB-v1.0 Section 5 pattern, mirrored from mobile/reports/handler.js's
// capabilityForReportType -- tier gating overridden per product decision
// 2026-08-01 (see spec's "Open questions" section) to lock like Progress
// Reports rather than Addendum A's free-for-everyone recommendation.
function lockedFeatureText(parentFirstName) {
  const address = parentFirstName ? `, ${parentFirstName}` : "";
  return `This one needs the full plan${address}. I can put it together the moment you're ready.`;
}

async function getChild(userId, childId) {
  const result = await documentClient.send(new GetCommand({ TableName: CHILDREN_TABLE, Key: { userId, childId } }));
  return result.Item || null;
}

async function handleListLetters(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before requesting weekly letters.");

  const entitlements = await getEntitlements(userId);
  if (!entitlements.capabilities.canAccessWeeklyLetter) return json(200, { letters: [] });

  const result = await documentClient.send(new QueryCommand({
    TableName: LETTERS_TABLE,
    IndexName: LETTERS_TABLE_CHILD_INDEX,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    ScanIndexForward: false
  }));

  return json(200, { letters: result.Items || [] });
}

async function handleGetLetter(event) {
  const { userId } = claimsFromEvent(event);
  const letterId = pathPart(event, "letterId");
  if (!letterId) return error(400, "INVALID_FIELD", "letterId is required.");

  const result = await documentClient.send(new GetCommand({ TableName: LETTERS_TABLE, Key: { letterId } }));
  if (!result.Item) return error(404, "LETTER_NOT_FOUND", "Weekly letter not found.");

  const child = await getChild(userId, result.Item.childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Weekly letter not found.");

  const entitlements = await getEntitlements(userId);
  if (!entitlements.capabilities.canAccessWeeklyLetter) {
    return error(403, "SUBSCRIPTION_REQUIRED", lockedFeatureText((event.queryStringParameters || {}).parentFirstName));
  }

  return json(200, { letter: result.Item });
}

async function handleMarkRead(event) {
  const { userId } = claimsFromEvent(event);
  const letterId = pathPart(event, "letterId");
  if (!letterId) return error(400, "INVALID_FIELD", "letterId is required.");

  const result = await documentClient.send(new GetCommand({ TableName: LETTERS_TABLE, Key: { letterId } }));
  if (!result.Item) return error(404, "LETTER_NOT_FOUND", "Weekly letter not found.");

  const child = await getChild(userId, result.Item.childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Weekly letter not found.");

  const now = new Date().toISOString();
  await documentClient.send(new UpdateCommand({
    TableName: LETTERS_TABLE,
    Key: { letterId },
    UpdateExpression: "SET #status = :read, readAt = :now",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":read": "read", ":now": now }
  }));

  return json(200, { letterId, readAt: now });
}

// --- Scheduled fan-out -----------------------------------------------------

async function scanAllChildren() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await documentClient.send(new ScanCommand({ TableName: CHILDREN_TABLE, ExclusiveStartKey }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function generateLetterForChild(child, window, now) {
  const childId = child.childId;
  const letterId = periods.letterIdFor(childId, window.weekStartDateKey);

  // Deterministic prior-week letterId -- a direct GetItem, not a query. A
  // gap week (app reinstall, long dormancy) simply won't have an item under
  // that id, which is exactly "no prior letter" per Addendum A SS4.
  const prevWeekStart = new Date(new Date(window.weekStartDate).getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevLetterId = periods.letterIdFor(childId, prevWeekStart.toISOString().slice(0, 10));
  const priorResult = await documentClient.send(new GetCommand({ TableName: LETTERS_TABLE, Key: { letterId: prevLetterId } }));
  const priorLetter = priorResult.Item || null;

  const childName = child.childName || child.name || "your child";
  const isFirstLetter = Boolean(child.createdAt) && child.createdAt >= window.weekStartDate;

  const week = await weeklyData.fetchWeekData({ documentClient, tables, childId, weekStartDate: window.weekStartDate, weekEndDate: window.weekEndDate });
  const items = weeklyData.buildWeekItems(week);

  const generated = await generateWeeklyLetter({ childName, window, items, priorLetter, isFirstLetter });

  const item = {
    letterId,
    childId,
    userId: child.userId,
    weekStartDate: window.weekStartDate,
    weekEndDate: window.weekEndDate,
    status: "ready",
    title: generated.title,
    preview: generated.preview,
    greeting: generated.greeting,
    bodyText: generated.bodyText,
    closing: generated.closing,
    themeLabel: generated.themeLabel,
    priorLetterThemeLabel: priorLetter?.themeLabel || null,
    priorLetterKeyBeat: generated.priorLetterKeyBeat || null,
    emailStatus: "not_sent",
    emailSentAt: null,
    emailMessageId: null,
    generatedAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  try {
    await documentClient.send(new PutCommand({
      TableName: LETTERS_TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(letterId)"
    }));
    return { childId, status: "created" };
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") return { childId, status: "already-exists" };
    throw err;
  }
}

async function runWeeklyFanOut() {
  const now = new Date();
  const window = periods.resolveWeekWindow(now);
  const children = await scanAllChildren();

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const child of children) {
    if (child.createdAt && child.createdAt > window.weekEndDate) {
      skipped += 1;
      continue;
    }
    try {
      const result = await generateLetterForChild(child, window, now);
      if (result.status === "created") created += 1;
      else skipped += 1;
    } catch (err) {
      failed += 1;
      console.error("weekly letter generation failed", child.userId, child.childId, err);
    }
  }

  console.log(`weekly letter fan-out: ${children.length} children, ${created} created, ${skipped} skipped, ${failed} failed`);
  return { ok: true, checked: children.length, created, skipped, failed };
}

exports.handler = async (event) => {
  if (!event || !event.httpMethod) {
    return runWeeklyFanOut();
  }

  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CHILDREN_TABLE || !LETTERS_TABLE) return error(500, "CONFIGURATION_ERROR", "Weekly letter tables are not configured.");

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.includes("/weekly-letters/by-child/")) return handleListLetters(event);
    if (event.httpMethod === "POST" && path.endsWith("/read")) return handleMarkRead(event);
    if (event.httpMethod === "GET" && path.includes("/weekly-letters/")) return handleGetLetter(event);
    return error(404, "NOT_FOUND", "Mobile weekly letters route not found.");
  } catch (err) {
    console.error("mobile weekly letters route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the weekly letters service.");
  }
};

exports._private = { periods, weeklyData, generateLetterForChild, runWeeklyFanOut };
