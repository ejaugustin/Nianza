// NZA-ADMIN-v1.1 SS2.2: Golden-Conversation Harness sign-off. Ej reviews the
// scenario transcripts + automated-assertion results and digitally signs a
// run before the underlying prompt/model/bundle change can promote past
// staging. Sign-off is disabled if any automated assertion failed.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const HARNESS_RUNS_TABLE = process.env.HARNESS_RUNS_TABLE;
const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;

function runIdFromEvent(event) {
  const raw = event.pathParameters?.runId || (event.path || event.rawPath || "").split("/harness-runs/")[1] || "";
  return decodeURIComponent(raw.split("/")[0]);
}

function summarize(run) {
  const { scenarios, ...summary } = run;
  return summary;
}

// GET /admin/v1/harness-runs -- list, most recent first, summary only (no
// full transcripts -- those load on the detail view).
async function handleList() {
  const result = await documentClient.send(new ScanCommand({ TableName: HARNESS_RUNS_TABLE }));
  const runs = (result.Items || []).map(summarize).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json(200, { runs });
}

// GET /admin/v1/harness-runs/{runId} -- full transcripts + per-scenario
// assertion results.
async function handleGet(runId) {
  const result = await documentClient.send(new GetCommand({ TableName: HARNESS_RUNS_TABLE, Key: { runId } }));
  if (!result.Item) return error(404, "NOT_FOUND", "Harness run not found.");
  return json(200, { run: result.Item });
}

// POST /admin/v1/harness-runs/{runId}/sign -- SUPER_ADMIN ONLY. Disabled if
// any automated assertion failed (run.passed === false) or already signed.
async function handleSign(event, actor, runId) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "Only super_admin can sign off a harness run.");

  const existing = await documentClient.send(new GetCommand({ TableName: HARNESS_RUNS_TABLE, Key: { runId } }));
  const run = existing.Item;
  if (!run) return error(404, "NOT_FOUND", "Harness run not found.");
  if (!run.passed) return error(400, "AUTOMATED_ASSERTIONS_FAILED", "Cannot sign a run with failing automated assertions.");
  if (run.signedBy) return error(409, "ALREADY_SIGNED", "This run has already been signed.");

  const signedAt = new Date().toISOString();
  const result = await documentClient.send(new UpdateCommand({
    TableName: HARNESS_RUNS_TABLE,
    Key: { runId },
    UpdateExpression: "SET signedBy = :signedBy, signedAt = :signedAt",
    ExpressionAttributeValues: { ":signedBy": actor.email, ":signedAt": signedAt },
    ReturnValues: "ALL_NEW"
  }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "harness.sign-off",
    targetType: "harness-run",
    targetId: runId,
    newValue: { signedBy: actor.email, signedAt, triggeringChange: run.triggeringChange },
    event
  });

  return json(200, { run: summarize(result.Attributes) });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!HARNESS_RUNS_TABLE) return error(500, "CONFIGURATION_ERROR", "HARNESS_RUNS_TABLE is not configured.");

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");

  const path = event.path || event.rawPath || "";
  const runId = runIdFromEvent(event);

  try {
    if (event.httpMethod === "GET" && path.endsWith("/harness-runs")) return handleList();
    if (event.httpMethod === "POST" && path.endsWith("/sign")) return handleSign(event, actor, runId);
    if (event.httpMethod === "GET" && runId) return handleGet(runId);
    return error(404, "NOT_FOUND", "Admin harness route not found.");
  } catch (err) {
    console.error("admin harness route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin harness service.");
  }
};
