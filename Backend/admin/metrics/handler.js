// NZA-ADMIN-v1.0 SS4.6: key business/operational metrics for the Dashboard
// screen. Never reads conversation content, vitals, or milestone detail --
// only aggregate counts. Cached in SSM Parameter Store at 15-minute
// intervals to avoid repeated expensive scans.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { SSMClient, GetParameterCommand, PutParameterCommand } = require("@aws-sdk/client-ssm");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_OPERATIONS, ROLE_CONTENT_EDITOR } = require("../../shared/auth");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
const ssmClient = new SSMClient({});

const USERS_TABLE = process.env.USERS_TABLE;
const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const CONTENT_TABLE = process.env.CONTENT_TABLE;
const NOTIFICATION_LOG_TABLE = process.env.NOTIFICATION_LOG_TABLE;
const REPORTS_TABLE = process.env.REPORTS_TABLE;
const CACHE_TTL_MS = 15 * 60 * 1000;
const VALID_PERIODS = new Set(["today", "week", "month", "all"]);

// Pricing constants (Ej, July 2026): $9.99/mo, $99.99/yr, 14-day trial.
// There is no RevenueCat/App Store/Play Billing integration yet -- nothing
// writes subscriptionStatus or planType from a real purchase event, so this
// is a PROJECTION formula applied to whatever subscriptionStatus counts
// exist today, not a live revenue feed. Once a billing webhook exists (see
// admin/billing/handler.js, not yet built), this same shape keeps working
// but the underlying counts become real.
const PRICE_MONTHLY = 9.99;
const PRICE_ANNUAL = 99.99;
const PRICE_ANNUAL_MONTHLY_EQUIVALENT = Number((PRICE_ANNUAL / 12).toFixed(2));

function cacheKey(period) {
  return `/nianza/admin/metrics-cache/${period}`;
}

function periodStart(period) {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (period === "week") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (period === "month") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

async function readCache(period) {
  try {
    const result = await ssmClient.send(new GetParameterCommand({ Name: cacheKey(period) }));
    const parsed = JSON.parse(result.Parameter?.Value || "null");
    if (!parsed || !parsed.cachedAt) return null;
    if (Date.now() - new Date(parsed.cachedAt).getTime() > CACHE_TTL_MS) return null;
    return parsed.metrics;
  } catch (err) {
    if (err.name === "ParameterNotFound") return null;
    console.error("metrics cache read failed", err);
    return null;
  }
}

async function writeCache(period, metrics) {
  try {
    await ssmClient.send(new PutParameterCommand({
      Name: cacheKey(period),
      Type: "String",
      Overwrite: true,
      Value: JSON.stringify({ cachedAt: new Date().toISOString(), metrics })
    }));
  } catch (err) {
    console.error("metrics cache write failed (non-fatal)", err);
  }
}

async function scanAll(tableName) {
  if (!tableName) return [];
  const items = [];
  let lastKey;
  do {
    const page = await documentClient.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastKey }));
    items.push(...(page.Items || []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function computeMetrics(period) {
  const since = periodStart(period);
  const [users, children, content, notifications, reports] = await Promise.all([
    scanAll(USERS_TABLE),
    scanAll(CHILDREN_TABLE),
    scanAll(CONTENT_TABLE),
    scanAll(NOTIFICATION_LOG_TABLE),
    scanAll(REPORTS_TABLE)
  ]);

  const inPeriod = (row, field) => !since || (row[field] && row[field] >= since);

  const userTotals = { total: 0, trialing: 0, active: 0, expired: 0, cancelled: 0, newThisPeriod: 0 };
  let activeMonthlyCount = 0;
  let activeAnnualCount = 0;
  for (const user of users) {
    userTotals.total += 1;
    if (user.subscriptionStatus && userTotals[user.subscriptionStatus] != null) userTotals[user.subscriptionStatus] += 1;
    if (inPeriod(user, "createdAt")) userTotals.newThisPeriod += 1;
    if (user.subscriptionStatus === "active") {
      // planType isn't populated by anything real yet -- default unknowns to
      // monthly so the projection is a conservative (lower) estimate rather
      // than an inflated one.
      if (user.planType === "annual") activeAnnualCount += 1;
      else activeMonthlyCount += 1;
    }
  }

  const projectedMrr = Number((activeMonthlyCount * PRICE_MONTHLY + activeAnnualCount * PRICE_ANNUAL_MONTHLY_EQUIVALENT).toFixed(2));
  const revenue = {
    projectedMrr,
    projectedArr: Number((projectedMrr * 12).toFixed(2)),
    activeMonthlyCount,
    activeAnnualCount,
    pricing: { monthly: PRICE_MONTHLY, annual: PRICE_ANNUAL, trialDays: 14 },
    note: "Projected from subscriptionStatus counts, not real billing data -- no RevenueCat/App Store/Play Billing integration exists yet."
  };

  const activeContent = content.filter((item) => !item.deleted);

  return {
    users: userTotals,
    revenue,
    children: { total: children.length, avgPerUser: userTotals.total ? Number((children.length / userTotals.total).toFixed(2)) : 0 },
    content: {
      total: activeContent.length,
      approved: activeContent.filter((item) => item.ejApproved).length,
      pendingReview: activeContent.filter((item) => !item.ejApproved).length
    },
    notifications: {
      sentThisPeriod: notifications.filter((n) => inPeriod(n, "createdAt")).reduce((sum, n) => sum + (n.sent || 0), 0),
      deliveryRate: null // no push infra yet -- see admin/notifications/handler.js NOTE
    },
    reports: { generatedThisPeriod: reports.filter((r) => inPeriod(r, "createdAt") || inPeriod(r, "generatedAt")).length }
  };
}

async function handleGet(event) {
  const query = event.queryStringParameters || {};
  const period = VALID_PERIODS.has(query.period) ? query.period : "all";

  const cached = await readCache(period);
  if (cached) return json(200, cached);

  const metrics = await computeMetrics(period);
  await writeCache(period, metrics);
  return json(200, metrics);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN, ROLE_OPERATIONS, ROLE_CONTENT_EDITOR])) return error(403, "FORBIDDEN", "You do not have permission to view metrics.");

  try {
    if (event.httpMethod === "GET") return handleGet(event);
    return error(404, "NOT_FOUND", "Admin metrics route not found.");
  } catch (err) {
    console.error("admin metrics route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin metrics service.");
  }
};
