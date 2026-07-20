const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

async function writeAuditLog({
  tableName,
  actor,
  action,
  targetType,
  targetId,
  previousValue = null,
  newValue = null,
  result = "success",
  errorMessage = null,
  event = {}
}) {
  if (!tableName) return;

  const actionId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const row = {
    adminUserId: actor.userId,
    timestampActionId: `${timestamp}#${actionId}`,
    actionId,
    adminEmail: actor.email,
    adminRole: actor.role,
    action,
    targetId,
    targetType,
    previousValue: previousValue == null ? null : JSON.stringify(previousValue),
    newValue: newValue == null ? null : JSON.stringify(newValue),
    ipAddress: event.requestContext?.identity?.sourceIp || event.requestContext?.http?.sourceIp || null,
    userAgent: event.headers?.["User-Agent"] || event.headers?.["user-agent"] || null,
    result,
    errorMessage,
    timestamp,
    createdAt: timestamp
  };

  await documentClient.send(new PutCommand({ TableName: tableName, Item: row }));
}

module.exports = { writeAuditLog };
