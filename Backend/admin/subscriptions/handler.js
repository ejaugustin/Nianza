// NZA-ADMIN-v1.0 SS4.4: subscription status across users, read from
// nianza-users. Per spec this reads a subscriptionStatus GSI -- no such GSI
// exists yet (see NOTE in admin/users/handler.js: nianza-users has no write
// path from the app today, RevenueCat isn't integrated). This handler scans
// the table and works correctly once profile rows exist; it just won't
// return anything meaningful until that's built. Flagging, not faking.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_OPERATIONS } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const USERS_TABLE = process.env.USERS_TABLE;
const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;
const MAX_EXTENSION_DAYS = 14;
const MAX_TOTAL_TRIAL_DAYS = 30;

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function userIdFromEvent(event) {
  const raw = event.pathParameters?.userId || (event.path || event.rawPath || "").split("/subscriptions/")[1] || "";
  try {
    return decodeURIComponent(raw.split("/")[0]);
  } catch {
    return raw.split("/")[0];
  }
}

// GET /admin/v1/subscriptions -- cohort counts + optional filtered list.
async function handleList(event) {
  const query = event.queryStringParameters || {};
  const result = await documentClient.send(new ScanCommand({ TableName: USERS_TABLE, Limit: 500 }));
  const items = result.Items || [];

  const totals = { trialing: 0, active: 0, expired: 0, cancelled: 0 };
  const subscriptions = [];
  for (const item of items) {
    const status = item.subscriptionStatus;
    if (status && totals[status] != null) totals[status] += 1;
    if (query.status && status !== query.status) continue;
    if (query.language && item.language !== query.language) continue;
    subscriptions.push({
      userId: item.userId,
      email: item.email ?? null,
      language: item.language ?? null,
      subscriptionStatus: status ?? null,
      trialStartedAt: item.trialStartedAt ?? null,
      trialEndsAt: item.trialEndsAt ?? null
    });
  }

  // Churn rate, folded into this same page rather than a separate Churn
  // page (NZA-ADMIN-v1.1 SS1 judged the 4-page Claricito split as
  // over-engineered relative to actual need here; this keeps the one real
  // piece of value -- churn visibility -- without reversing that call).
  // Proxy only: percentage of known-status users currently cancelled, not a
  // true period-over-period churn rate, since there's no cancellation-event
  // log yet, just a point-in-time subscriptionStatus field.
  const knownStatusCount = totals.trialing + totals.active + totals.expired + totals.cancelled;
  const churnRate = knownStatusCount ? Number(((totals.cancelled / knownStatusCount) * 100).toFixed(1)) : null;

  return json(200, { subscriptions, totals, churnRate });
}

// POST /admin/v1/subscriptions/{userId}/extend-trial -- SUPER_ADMIN ONLY.
async function handleExtendTrial(event, actor, userId) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "Only super_admin can extend a trial.");

  const body = parseBody(event);
  const extensionDays = Number(body.extensionDays);
  if (!Number.isFinite(extensionDays) || extensionDays <= 0) return error(400, "INVALID_FIELD", "extensionDays must be a positive number.");
  if (extensionDays > MAX_EXTENSION_DAYS) return error(400, "INVALID_FIELD", `extensionDays cannot exceed ${MAX_EXTENSION_DAYS}.`);
  if (!body.reason) return error(400, "MISSING_FIELD", "reason is required.");

  const existing = await documentClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  const user = existing.Item;
  if (!user) return error(404, "NOT_FOUND", "User has no subscription record.");
  if (user.subscriptionStatus && user.subscriptionStatus !== "trialing") {
    return error(400, "TRIAL_NOT_ACTIVE", "Cannot extend a trial that isn't currently active.");
  }

  const trialStartedAt = user.trialStartedAt ? new Date(user.trialStartedAt) : null;
  const currentTrialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : new Date();
  if (currentTrialEndsAt.getTime() < Date.now()) return error(400, "TRIAL_EXPIRED", "Cannot extend a trial that has already expired.");

  const nextTrialEndsAt = new Date(currentTrialEndsAt.getTime() + extensionDays * 24 * 60 * 60 * 1000);
  if (trialStartedAt) {
    const totalDays = (nextTrialEndsAt.getTime() - trialStartedAt.getTime()) / (24 * 60 * 60 * 1000);
    if (totalDays > MAX_TOTAL_TRIAL_DAYS) {
      return error(400, "MAX_TRIAL_EXCEEDED", `Cannot extend past ${MAX_TOTAL_TRIAL_DAYS} days total from original trialStartedAt.`);
    }
  }

  const result = await documentClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: "SET trialEndsAt = :trialEndsAt, updatedAt = :updatedAt",
    ExpressionAttributeValues: { ":trialEndsAt": nextTrialEndsAt.toISOString(), ":updatedAt": new Date().toISOString() },
    ReturnValues: "ALL_NEW"
  }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "subscription.trial-extended",
    targetType: "user",
    targetId: userId,
    previousValue: { trialEndsAt: user.trialEndsAt ?? null },
    newValue: { trialEndsAt: result.Attributes.trialEndsAt, extensionDays, reason: body.reason },
    event
  });

  return json(200, { userId, trialEndsAt: result.Attributes.trialEndsAt });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!USERS_TABLE) return error(500, "CONFIGURATION_ERROR", "USERS_TABLE is not configured.");

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN, ROLE_OPERATIONS])) return error(403, "FORBIDDEN", "You do not have permission to view subscription data.");

  const path = event.path || event.rawPath || "";
  const userId = userIdFromEvent(event);

  try {
    if (event.httpMethod === "GET" && path.endsWith("/subscriptions")) return handleList(event);
    if (event.httpMethod === "POST" && path.endsWith("/extend-trial")) return handleExtendTrial(event, actor, userId);
    return error(404, "NOT_FOUND", "Admin subscriptions route not found.");
  } catch (err) {
    console.error("admin subscriptions route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin subscriptions service.");
  }
};
