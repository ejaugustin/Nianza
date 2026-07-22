const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { json, noContent, error } = require("../../shared/response");
const vitals = require("./library");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const VITALS_TABLE = process.env.VITALS_TABLE;
const SICK_ENCOUNTERS_TABLE = process.env.SICK_ENCOUNTERS_TABLE;

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

function pathParts(event) {
  const path = event.rawPath || event.path || "";
  const parts = path.split("/").filter(Boolean);
  const vitalsIndex = parts.indexOf("vitals");
  return {
    childId: event.pathParameters?.childId || (vitalsIndex >= 0 ? decodeURIComponent(parts[vitalsIndex + 1] || "") : ""),
    collection: event.pathParameters?.proxy || (vitalsIndex >= 0 ? parts[vitalsIndex + 2] : ""),
    id: event.pathParameters?.entryId || event.pathParameters?.encounterId || (vitalsIndex >= 0 ? decodeURIComponent(parts[vitalsIndex + 3] || "") : ""),
    action: vitalsIndex >= 0 ? parts[vitalsIndex + 4] : ""
  };
}

async function getChild(userId, childId) {
  const result = await documentClient.send(new GetCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId }
  }));
  return result.Item || null;
}

async function ensureChild(userId, childId) {
  if (!childId) throw Object.assign(new Error("childId is required."), { statusCode: 400, code: "INVALID_FIELD" });
  const child = await getChild(userId, childId);
  if (!child) throw Object.assign(new Error("Create the child profile before using Vitals."), { statusCode: 404, code: "CHILD_NOT_FOUND" });
  return child;
}

async function listEntries(childId) {
  const result = await documentClient.send(new QueryCommand({
    TableName: VITALS_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    ScanIndexForward: false,
    Limit: 80
  }));
  return result.Items || [];
}

async function listEncounters(childId) {
  const result = await documentClient.send(new QueryCommand({
    TableName: SICK_ENCOUNTERS_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId },
    ScanIndexForward: false
  }));
  return result.Items || [];
}

async function handleList(event) {
  const { userId } = claimsFromEvent(event);
  const { childId } = pathParts(event);
  await ensureChild(userId, childId);
  const [entries, encounters] = await Promise.all([listEntries(childId), listEncounters(childId)]);
  return json(200, vitals.buildVitalsResponse({ entries, encounters }));
}

async function handleCreateEntry(event) {
  const { userId, email } = claimsFromEvent(event);
  const { childId } = pathParts(event);
  await ensureChild(userId, childId);
  const encounters = await listEncounters(childId);
  const activeEncounter = vitals.buildVitalsResponse({ encounters }).activeEncounter;
  const entry = vitals.normalizeEntry(parseBody(event), {
    childId,
    recordedBy: email || userId,
    activeEncounter
  });

  await documentClient.send(new PutCommand({
    TableName: VITALS_TABLE,
    Item: entry
  }));

  return json(201, { entry: vitals.serializeEntry(entry) });
}

async function handleDeleteEntry(event) {
  const { userId } = claimsFromEvent(event);
  const { childId, id } = pathParts(event);
  await ensureChild(userId, childId);
  if (!id) return error(400, "INVALID_FIELD", "entryId is required.");

  await documentClient.send(new DeleteCommand({
    TableName: VITALS_TABLE,
    Key: { childId, entryId: id }
  }));

  return noContent();
}

async function handleCreateEncounter(event) {
  const { userId } = claimsFromEvent(event);
  const { childId } = pathParts(event);
  await ensureChild(userId, childId);
  const body = parseBody(event);
  const now = new Date().toISOString();
  const encounter = {
    childId,
    encounterId: body.encounterId || `encounter#${now}`,
    name: String(body.name || "Sick-day notes").trim().slice(0, 120),
    status: "active",
    startedAt: body.startedAt || now,
    endedAt: null,
    userId,
    createdAt: now,
    updatedAt: now
  };

  await documentClient.send(new PutCommand({
    TableName: SICK_ENCOUNTERS_TABLE,
    Item: encounter
  }));

  return json(201, { encounter });
}

async function handleEndEncounter(event) {
  const { userId } = claimsFromEvent(event);
  const { childId, id } = pathParts(event);
  await ensureChild(userId, childId);
  if (!id) return error(400, "INVALID_FIELD", "encounterId is required.");

  const now = new Date().toISOString();
  const result = await documentClient.send(new UpdateCommand({
    TableName: SICK_ENCOUNTERS_TABLE,
    Key: { childId, encounterId: id },
    UpdateExpression: "SET #status = :ended, endedAt = :now, updatedAt = :now",
    ConditionExpression: "attribute_exists(childId) AND attribute_exists(encounterId)",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":ended": "ended",
      ":now": now
    },
    ReturnValues: "ALL_NEW"
  }));

  return json(200, { encounter: result.Attributes });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CHILDREN_TABLE || !VITALS_TABLE || !SICK_ENCOUNTERS_TABLE) {
    return error(500, "CONFIGURATION_ERROR", "Vitals tables are not configured.");
  }

  const { collection, action } = pathParts(event);

  try {
    if (event.httpMethod === "GET" && collection === "encounters") {
      const { userId } = claimsFromEvent(event);
      const { childId } = pathParts(event);
      await ensureChild(userId, childId);
      return json(200, { encounters: await listEncounters(childId) });
    }
    if (event.httpMethod === "POST" && collection === "encounters" && !action) return handleCreateEncounter(event);
    if (event.httpMethod === "POST" && collection === "encounters" && action === "end") return handleEndEncounter(event);
    if (event.httpMethod === "GET" && !collection) return handleList(event);
    if (event.httpMethod === "POST" && !collection) return handleCreateEntry(event);
    if (event.httpMethod === "DELETE" && collection) return handleDeleteEntry(event);
    return error(404, "NOT_FOUND", "Mobile vitals route not found.");
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      return error(404, "ENCOUNTER_NOT_FOUND", "Sick encounter not found.");
    }
    if (err?.statusCode) return error(err.statusCode, err.code || "INVALID_FIELD", err.message);
    if (err instanceof SyntaxError) return error(400, "INVALID_JSON", "Request body must be valid JSON.");
    console.error("mobile vitals route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile vitals service.");
  }
};

exports._private = vitals;
