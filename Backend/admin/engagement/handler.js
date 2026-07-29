// NZA-ADMIN-v2 SS1 (Engagement): DAU/MAU-style rollups, chat session
// count/length, retention by cohort.
//
// NOTE: this app has no dedicated event-tracking pipeline (no analytics SDK,
// no per-screen instrumentation), so "DAU" here is a proxy: distinct users
// with a conversation session updated that day. That's a real, honest signal
// of engagement, but it under-counts parents who used the app without
// chatting with Patricia, and it can't give per-screen "feature adoption"
// numbers at all -- that needs real event instrumentation, tracked as a
// separate follow-on. This Lambda is dual-mode: an EventBridge schedule
// invokes it nightly to write today's rollup into nianza-usage-aggregates;
// API Gateway invokes it to read rollups for the admin Engagement page,
// falling back to on-demand computation for any day that hasn't been
// rolled up yet so the page is never just empty while waiting on a cron.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_OPERATIONS, ROLE_CONTENT_EDITOR } = require("../../shared/auth");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const USERS_TABLE = process.env.USERS_TABLE;
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE;
const USAGE_AGGREGATES_TABLE = process.env.USAGE_AGGREGATES_TABLE;

function dateOnly(iso) {
  return iso ? iso.slice(0, 10) : null;
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

async function computeDayRollup(day) {
  const [users, conversations] = await Promise.all([scanAll(USERS_TABLE), scanAll(CONVERSATIONS_TABLE)]);
  const sessionsToday = conversations.filter((c) => dateOnly(c.updatedAt) === day);
  const dau = new Set(sessionsToday.map((c) => c.userId)).size;
  const newUsers = users.filter((u) => dateOnly(u.createdAt) === day).length;
  const totalMessages = sessionsToday.reduce((sum, c) => sum + (Array.isArray(c.messages) ? c.messages.length : 0), 0);
  return {
    dau,
    newUsers,
    chatSessions: sessionsToday.length,
    avgSessionLength: sessionsToday.length ? Number((totalMessages / sessionsToday.length).toFixed(1)) : 0
  };
}

// EventBridge-scheduled entry point: rolls up "yesterday" (the schedule
// fires early morning UTC) and writes one row per metric.
async function runNightlyRollup() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rollup = await computeDayRollup(yesterday);
  await Promise.all(
    Object.entries(rollup).map(([metricKey, value]) =>
      documentClient.send(new PutCommand({
        TableName: USAGE_AGGREGATES_TABLE,
        Item: { aggregateDate: yesterday, metricKey, value, computedAt: new Date().toISOString() }
      }))
    )
  );
  console.log(`Rolled up usage aggregates for ${yesterday}`, rollup);
}

function daysForPeriod(period) {
  const count = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return Array.from({ length: count }, (_, i) => new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
}

async function rollupForDay(day) {
  if (USAGE_AGGREGATES_TABLE) {
    const result = await documentClient.send(new QueryCommand({
      TableName: USAGE_AGGREGATES_TABLE,
      KeyConditionExpression: "aggregateDate = :day",
      ExpressionAttributeValues: { ":day": day }
    }));
    if (result.Items?.length) {
      const row = { dau: 0, newUsers: 0, chatSessions: 0, avgSessionLength: 0 };
      for (const item of result.Items) row[item.metricKey] = item.value;
      return row;
    }
  }
  // Not yet rolled up (e.g. today, or the cron hasn't run yet) -- compute
  // on demand rather than showing a gap.
  return computeDayRollup(day);
}

// GET /admin/v1/engagement/metrics?period=7d|30d|90d
async function handleGet(event) {
  const query = event.queryStringParameters || {};
  const period = query.period || "30d";
  const days = daysForPeriod(period);

  const rollups = await Promise.all(days.map(async (day) => ({ date: day, ...(await rollupForDay(day)) })));
  rollups.reverse(); // oldest first for charting

  const totalUsers = (await scanAll(USERS_TABLE)).length;
  const avgDau = rollups.length ? Math.round(rollups.reduce((sum, r) => sum + r.dau, 0) / rollups.length) : 0;

  return json(200, {
    metrics: {
      totalUsers,
      avgDau,
      totalChatSessionsInPeriod: rollups.reduce((sum, r) => sum + r.chatSessions, 0),
      avgSessionLength: rollups.length ? Number((rollups.reduce((sum, r) => sum + r.avgSessionLength, 0) / rollups.length).toFixed(1)) : 0,
      newUsersInPeriod: rollups.reduce((sum, r) => sum + r.newUsers, 0)
    },
    dauTrend: rollups.map((r) => ({ date: r.date, dau: r.dau })),
    note: "DAU is a proxy (distinct users with a chat session that day) -- there is no per-screen event pipeline yet, so true MAU-by-unique-identity and per-screen feature adoption aren't available. Treat avgDau, the trend, and session counts as the reliable numbers here."
  });
}

exports.handler = async (event) => {
  // EventBridge scheduled invocations have no httpMethod.
  if (!event.httpMethod) return runNightlyRollup();

  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN, ROLE_OPERATIONS, ROLE_CONTENT_EDITOR])) return error(403, "FORBIDDEN", "You do not have permission to view engagement metrics.");

  try {
    if (event.httpMethod === "GET") return handleGet(event);
    return error(404, "NOT_FOUND", "Admin engagement route not found.");
  } catch (err) {
    console.error("admin engagement route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin engagement service.");
  }
};
