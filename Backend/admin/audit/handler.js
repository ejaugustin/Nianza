// NZA-ADMIN-v1.0 SS5.2 (Audit Log screen): full audit log with filtering by
// action type, admin user, date range. Read-only, SUPER_ADMIN ONLY. Never
// deletable through the portal.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN } = require("../../shared/auth");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;

function deserializeRow(row) {
  return {
    ...row,
    previousValue: row.previousValue ? JSON.parse(row.previousValue) : null,
    newValue: row.newValue ? JSON.parse(row.newValue) : null
  };
}

async function handleList(event) {
  const query = event.queryStringParameters || {};
  const limit = Math.min(Number(query.limit || 100), 300);

  let items;
  if (query.action) {
    const result = await documentClient.send(new QueryCommand({
      TableName: AUDIT_TABLE,
      IndexName: "action-timestamp-index",
      KeyConditionExpression: "#action = :action",
      ExpressionAttributeNames: { "#action": "action" },
      ExpressionAttributeValues: { ":action": query.action },
      Limit: limit,
      ScanIndexForward: false
    }));
    items = result.Items || [];
  } else if (query.adminUserId) {
    const result = await documentClient.send(new QueryCommand({
      TableName: AUDIT_TABLE,
      KeyConditionExpression: "adminUserId = :adminUserId",
      ExpressionAttributeValues: { ":adminUserId": query.adminUserId },
      Limit: limit,
      ScanIndexForward: false
    }));
    items = result.Items || [];
  } else {
    const result = await documentClient.send(new ScanCommand({ TableName: AUDIT_TABLE, Limit: limit }));
    items = result.Items || [];
  }

  if (query.startDate) items = items.filter((row) => row.timestamp >= query.startDate);
  if (query.endDate) items = items.filter((row) => row.timestamp <= query.endDate);
  items.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  return json(200, { entries: items.map(deserializeRow), count: items.length });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!AUDIT_TABLE) return error(500, "CONFIGURATION_ERROR", "AUDIT_TABLE is not configured.");

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "The audit log is readable only by super_admin.");

  try {
    if (event.httpMethod === "GET") return handleList(event);
    return error(404, "NOT_FOUND", "Admin audit route not found.");
  } catch (err) {
    console.error("admin audit route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin audit service.");
  }
};
