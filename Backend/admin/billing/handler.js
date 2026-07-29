// NZA-ADMIN-v1.1 SS3.1 / COWORK-IMPL SS2: admin-facing billing endpoints,
// reading from the real RevenueCat-fed pipeline (nianza-billing-lambda +
// nianza-billing-events + nianza-users snapshot fields). This is what
// admin/metrics/handler.js's header comment pointed at: "Once a billing
// webhook exists (see admin/billing/handler.js, not yet built)". It's built
// now. admin/metrics/handler.js's old projected-revenue block is left
// untouched -- it's superseded, not deleted, since Phase 5 (full dashboard
// rebuild + Launch Readiness panel) is still ahead and may want the
// comparison during rollout.
//
// GET /admin/v1/billing/summary        -- MRR/ARR/at-risk cards
// GET /admin/v1/billing/events         -- event feed, newest first
// GET /admin/v1/billing/failed-payments -- users currently in BILLING_ISSUE grace
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_OPERATIONS } = require("../../shared/auth");
const { json, noContent, error } = require("../../shared/response");
const { computeBillingSummary } = require("../../shared/billing-metrics");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
const ssmClient = new SSMClient({});

const USERS_TABLE = process.env.USERS_TABLE;
const BILLING_EVENTS_TABLE = process.env.BILLING_EVENTS_TABLE;
const BILLING_CACHE_PARAM = process.env.BILLING_CACHE_PARAM || "/nianza/admin/billing-summary-cache";
const CACHE_TTL_MS = 15 * 60 * 1000; // cache is also refreshed on every webhook event; this TTL is just a safety net
const SYSTEM_PSEUDO_USER = "__SYSTEM__";

async function scanUsersForMetrics() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await documentClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: "subscriptionStatus, currentProductId, billingIssueSince",
      ExclusiveStartKey
    }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// GET /admin/v1/billing/summary -- prefers the cache nianza-billing-lambda
// keeps warm on every event; falls back to a live recompute if the cache is
// missing/stale (e.g. right after this Lambda's own first deploy, or if no
// webhook event has landed yet at all).
async function handleSummary() {
  try {
    const result = await ssmClient.send(new GetParameterCommand({ Name: BILLING_CACHE_PARAM }));
    const parsed = JSON.parse(result.Parameter?.Value || "null");
    if (parsed?.cachedAt && Date.now() - new Date(parsed.cachedAt).getTime() <= CACHE_TTL_MS) {
      return json(200, { ...parsed.summary, cachedAt: parsed.cachedAt, source: "cache" });
    }
  } catch (err) {
    if (err.name !== "ParameterNotFound") console.error("billing summary cache read failed", err);
  }

  const users = await scanUsersForMetrics();
  const summary = computeBillingSummary(users);
  return json(200, { ...summary, cachedAt: null, source: "live" });
}

// GET /admin/v1/billing/events?eventType=&limit= -- newest first. With an
// eventType filter this is a clean GSI1 query; without one it's a bounded
// scan + in-memory sort, the same small-scale tradeoff admin/metrics and
// admin/subscriptions already make (see their header comments) -- revisit if
// event volume ever makes this slow.
async function handleEvents(event) {
  const query = event.queryStringParameters || {};
  const limit = Math.min(Number(query.limit || 50), 200);

  if (query.eventType) {
    const result = await documentClient.send(new QueryCommand({
      TableName: BILLING_EVENTS_TABLE,
      IndexName: "eventType-eventTimestamp-index",
      KeyConditionExpression: "eventType = :eventType",
      ExpressionAttributeValues: { ":eventType": query.eventType },
      ScanIndexForward: false,
      Limit: limit
    }));
    return json(200, { events: result.Items || [], count: (result.Items || []).length });
  }

  const page = await documentClient.send(new ScanCommand({ TableName: BILLING_EVENTS_TABLE, Limit: 500 }));
  const events = (page.Items || [])
    .filter((e) => e.userId !== SYSTEM_PSEUDO_USER)
    .sort((a, b) => (a.eventTimestamp < b.eventTimestamp ? 1 : -1))
    .slice(0, limit);
  return json(200, { events, count: events.length });
}

// GET /admin/v1/billing/failed-payments -- users currently in a
// BILLING_ISSUE grace period (billingIssueSince set), for the failed-payments
// queue with per-user drill-in (Phase 5 UI; this is the data side, built now
// since the dashboard summary card links here per NZA-ADMIN-v1.1's
// drill-down rule).
async function handleFailedPayments() {
  const page = await documentClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: "attribute_exists(billingIssueSince)",
    ProjectionExpression: "userId, email, subscriptionStatus, currentProductId, currentPeriodEndsAt, billingIssueSince"
  }));
  const items = (page.Items || []).sort((a, b) => (a.billingIssueSince < b.billingIssueSince ? 1 : -1));
  return json(200, { users: items, count: items.length });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!USERS_TABLE || !BILLING_EVENTS_TABLE) return error(500, "CONFIGURATION_ERROR", "USERS_TABLE/BILLING_EVENTS_TABLE not configured.");

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN, ROLE_OPERATIONS])) return error(403, "FORBIDDEN", "You do not have permission to view billing data.");

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.endsWith("/billing/summary")) return handleSummary();
    if (event.httpMethod === "GET" && path.endsWith("/billing/events")) return handleEvents(event);
    if (event.httpMethod === "GET" && path.endsWith("/billing/failed-payments")) return handleFailedPayments();
    return error(404, "NOT_FOUND", "Admin billing route not found.");
  } catch (err) {
    console.error("admin billing route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin billing service.");
  }
};
