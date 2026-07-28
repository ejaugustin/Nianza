// NZA-ADMIN-v1.0 SS4.2: a controlled interface to the SSM parameters that
// govern app behavior (AI vendor/model, TTS approval flags, feature flags).
// All writes are audit-logged and SUPER_ADMIN ONLY. Per the risk register
// (SS8, "SSM write without audit trail"): the audit log row is written
// BEFORE the SSM change, and the SSM change is aborted if the audit log
// write fails -- never the other way around.
const { SSMClient, DescribeParametersCommand, GetParameterCommand, PutParameterCommand } = require("@aws-sdk/client-ssm");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");

const ssmClient = new SSMClient({});
const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;
const PARAM_NAMESPACE = "/nianza/";
const SECRET_PATTERN = /key|secret|password/i;

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function maskValue(name, value) {
  if (!SECRET_PATTERN.test(name)) return value;
  if (!value) return value;
  return value.length <= 4 ? "****" : `****${value.slice(-4)}`;
}

function paramNameFromEvent(event) {
  const raw = event.pathParameters?.paramName || (event.path || event.rawPath || "").split("/ssm/")[1] || "";
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  // API Gateway's {paramName+} greedy proxy captures everything AFTER the
  // literal "/ssm/" segment, which consumes the leading slash -- so a
  // request for /ssm/nianza/tts-approved/en arrives here as
  // "nianza/tts-approved/en", not "/nianza/tts-approved/en". Restore it so
  // the /nianza/ namespace check below (and the eventual PutParameter call)
  // see the real, fully-qualified parameter name.
  return decoded.startsWith("/") ? decoded : `/${decoded}`;
}

// GET /admin/v1/ssm -- lists all /nianza/* parameters. Read-only, no audit
// log entry for reads (per spec: "No audit log for reads.").
async function handleList() {
  const parameters = [];
  let nextToken;
  do {
    const page = await ssmClient.send(new DescribeParametersCommand({
      ParameterFilters: [{ Key: "Name", Option: "BeginsWith", Values: [PARAM_NAMESPACE] }],
      NextToken: nextToken
    }));
    for (const meta of page.Parameters || []) {
      const value = await ssmClient.send(new GetParameterCommand({ Name: meta.Name }));
      parameters.push({
        name: meta.Name,
        value: maskValue(meta.Name, value.Parameter?.Value ?? ""),
        type: meta.Type,
        lastModifiedAt: meta.LastModifiedDate ? new Date(meta.LastModifiedDate).toISOString() : null
      });
    }
    nextToken = page.NextToken;
  } while (nextToken);

  return json(200, { parameters });
}

// PUT /admin/v1/ssm/{paramName} -- SUPER_ADMIN ONLY. paramName must live
// under /nianza/ -- refuses writes to anything outside this namespace so the
// portal can never touch unrelated SSM state.
async function handleWrite(event, actor) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) {
    return error(403, "FORBIDDEN", "Only super_admin can write SSM parameters.");
  }

  const paramName = paramNameFromEvent(event);
  if (!paramName.startsWith(PARAM_NAMESPACE)) {
    return error(400, "INVALID_NAMESPACE", `paramName must start with ${PARAM_NAMESPACE}.`);
  }

  const body = parseBody(event);
  if (body.value == null || body.value === "") return error(400, "MISSING_FIELD", "value is required.");
  if (!body.reason) return error(400, "MISSING_FIELD", "reason is required.");

  let previousValue = null;
  let paramType = "String";
  try {
    const existing = await ssmClient.send(new GetParameterCommand({ Name: paramName }));
    previousValue = existing.Parameter?.Value ?? null;
    paramType = existing.Parameter?.Type || "String";
  } catch (err) {
    if (err.name !== "ParameterNotFound") throw err;
  }

  // Audit-first: if this write fails, the SSM change below never happens.
  try {
    await writeAuditLog({
      tableName: AUDIT_TABLE,
      actor,
      action: "ssm.write",
      targetType: "ssm-parameter",
      targetId: paramName,
      previousValue,
      newValue: body.value,
      event
    });
  } catch (auditErr) {
    console.error("audit log write failed -- aborting SSM change", auditErr);
    return error(500, "AUDIT_LOG_FAILED", "Could not record audit log entry -- SSM change was not made.");
  }

  await ssmClient.send(new PutParameterCommand({
    Name: paramName,
    Value: body.value,
    Type: paramType,
    Overwrite: true
  }));

  return json(200, {
    parameter: { name: paramName, value: maskValue(paramName, body.value), type: paramType },
    previousValue: maskValue(paramName, previousValue)
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.endsWith("/ssm")) return handleList();
    if (event.httpMethod === "PUT" && path.includes("/ssm/")) return handleWrite(event, actor);
    return error(404, "NOT_FOUND", "Admin SSM route not found.");
  } catch (err) {
    console.error("admin ssm route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin SSM service.");
  }
};
