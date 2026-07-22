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
const vaccines = require("./library");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const VACCINES_TABLE = process.env.VACCINES_TABLE;

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

function pathPart(event, name) {
  if (event.pathParameters?.[name]) return decodeURIComponent(event.pathParameters[name]);
  const path = event.rawPath || event.path || "";
  const match = path.match(/\/vaccines\/([^/]+)(?:\/([^/]+))?/);
  if (name === "childId") return match?.[1] ? decodeURIComponent(match[1]) : null;
  if (name === "doseId") return match?.[2] ? decodeURIComponent(match[2]) : null;
  return null;
}

function truncate(value, maxLength) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

async function getChild(userId, childId) {
  const result = await documentClient.send(new GetCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId }
  }));
  return result.Item || null;
}

async function listRecords(childId) {
  const result = await documentClient.send(new QueryCommand({
    TableName: VACCINES_TABLE,
    KeyConditionExpression: "childId = :childId",
    ExpressionAttributeValues: { ":childId": childId }
  }));
  return result.Items || [];
}

async function handleGetVaccines(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before requesting vaccines.");

  const records = await listRecords(childId);
  return json(200, vaccines.buildVaccineProgress({ child, records }));
}

async function handleRecordVaccine(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  const doseId = truncate(pathPart(event, "doseId"), 80);
  if (!childId || !doseId) return error(400, "INVALID_FIELD", "childId and doseId are required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before recording vaccines.");

  const dose = vaccines.findDose(doseId);
  if (!dose) return error(400, "UNKNOWN_VACCINE_DOSE", "doseId is not in the vaccine library.");

  const body = parseBody(event);
  const now = new Date().toISOString();
  const givenOn = truncate(body.givenOn, 20);
  if (!givenOn) return error(400, "INVALID_FIELD", "givenOn is required.");

  const record = {
    childId,
    doseId,
    vaccineId: dose.vaccineId,
    vaccineName: dose.name,
    fullName: dose.fullName,
    doseNum: dose.doseNum,
    displayGroup: dose.displayGroup,
    givenOn,
    note: truncate(body.note, 500),
    backfilled: Boolean(body.backfilled),
    recordedBy: userId,
    createdAt: body.createdAt || now,
    updatedAt: now
  };

  await documentClient.send(new PutCommand({
    TableName: VACCINES_TABLE,
    Item: record
  }));

  return json(201, { record });
}

async function handleDeleteVaccine(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  const doseId = truncate(pathPart(event, "doseId"), 80);
  if (!childId || !doseId) return error(400, "INVALID_FIELD", "childId and doseId are required.");

  const child = await getChild(userId, childId);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Create the child profile before updating vaccines.");

  await documentClient.send(new DeleteCommand({
    TableName: VACCINES_TABLE,
    Key: { childId, doseId }
  }));

  return noContent();
}

async function handleBackfillOffered(event) {
  const { userId } = claimsFromEvent(event);
  const childId = pathPart(event, "childId");
  if (!childId) return error(400, "INVALID_FIELD", "childId is required.");

  const now = new Date().toISOString();
  const result = await documentClient.send(new UpdateCommand({
    TableName: CHILDREN_TABLE,
    Key: { userId, childId },
    UpdateExpression: "SET vaccineBackfillOffered = :trueValue, vaccineBackfillOfferedAt = :now, updatedAt = :now",
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
  if (!CHILDREN_TABLE || !VACCINES_TABLE) {
    return error(500, "CONFIGURATION_ERROR", "Vaccine tables are not configured.");
  }

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.includes("/vaccines/")) return handleGetVaccines(event);
    if (event.httpMethod === "POST" && path.endsWith("/backfill-offered")) return handleBackfillOffered(event);
    if (event.httpMethod === "POST" && path.includes("/vaccines/")) return handleRecordVaccine(event);
    if (event.httpMethod === "DELETE" && path.includes("/vaccines/")) return handleDeleteVaccine(event);
    return error(404, "NOT_FOUND", "Mobile vaccines route not found.");
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      return error(404, "CHILD_NOT_FOUND", "Create the child profile before updating vaccine settings.");
    }
    console.error("mobile vaccines route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile vaccines service.");
  }
};

exports._private = vaccines;
