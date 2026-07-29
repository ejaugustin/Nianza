// NZA-ADMIN-v2 page map: System Health / Reliability. Reads real Lambda
// invocation/error counts from CloudWatch for the core app + admin
// functions over the last 24h -- an actual operational signal, not a
// placeholder. Security & Compliance and a separate Reliability page were
// intentionally NOT built as distinct screens: at this stage they'd have no
// data source beyond what Audit Log (writes) and this page (Lambda health)
// already cover, and building empty-shell pages purely for nav parity with
// Claricito is the same anti-pattern already declined for the Subscriptions
// split (see NZA-ADMIN-v1.1 SS1). Revisit as separate pages once there's a
// real second data source (e.g. a WAF/security-events feed) to justify one.
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_OPERATIONS } = require("../../shared/auth");
const { json, noContent, error } = require("../../shared/response");

const cloudWatchClient = new CloudWatchClient({});
const ENVIRONMENT = process.env.ENVIRONMENT || "prod";

// The functions that matter most for uptime: the ones on the app's hot path
// (chat, content, milestones) plus the admin content-approval path.
const MONITORED_FUNCTIONS = [
  "nianza-mobile-chat",
  "nianza-mobile-content",
  "nianza-mobile-milestones",
  "nianza-mobile-memories",
  "nianza-admin-content"
].map((name) => `${name}-${ENVIRONMENT}`);

function metricQueries(functionName, index) {
  return [
    {
      Id: `invocations${index}`,
      MetricStat: {
        Metric: { Namespace: "AWS/Lambda", MetricName: "Invocations", Dimensions: [{ Name: "FunctionName", Value: functionName }] },
        Period: 86400,
        Stat: "Sum"
      },
      Label: `${functionName}-invocations`
    },
    {
      Id: `errors${index}`,
      MetricStat: {
        Metric: { Namespace: "AWS/Lambda", MetricName: "Errors", Dimensions: [{ Name: "FunctionName", Value: functionName }] },
        Period: 86400,
        Stat: "Sum"
      },
      Label: `${functionName}-errors`
    }
  ];
}

async function handleGet() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  const metricDataQueries = MONITORED_FUNCTIONS.flatMap((name, index) => metricQueries(name, index));

  let results;
  try {
    const response = await cloudWatchClient.send(new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: endTime,
      MetricDataResults: undefined,
      MetricDataQueries: metricDataQueries
    }));
    results = response.MetricDataResults || [];
  } catch (err) {
    console.error("cloudwatch GetMetricData failed", err);
    return error(502, "CLOUDWATCH_UNAVAILABLE", "Could not read Lambda metrics from CloudWatch.");
  }

  const byId = new Map(results.map((r) => [r.Id, (r.Values || []).reduce((sum, v) => sum + v, 0)]));

  const functions = MONITORED_FUNCTIONS.map((name, index) => {
    const invocations = byId.get(`invocations${index}`) || 0;
    const errors = byId.get(`errors${index}`) || 0;
    return {
      functionName: name,
      invocations24h: invocations,
      errors24h: errors,
      errorRate: invocations ? Number(((errors / invocations) * 100).toFixed(2)) : 0,
      status: errors === 0 ? "healthy" : errors / Math.max(invocations, 1) > 0.05 ? "degraded" : "watch"
    };
  });

  return json(200, { functions, windowHours: 24 });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN, ROLE_OPERATIONS])) return error(403, "FORBIDDEN", "You do not have permission to view system health.");

  try {
    if (event.httpMethod === "GET") return handleGet();
    return error(404, "NOT_FOUND", "Admin system-health route not found.");
  } catch (err) {
    console.error("admin system-health route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin system-health service.");
  }
};
