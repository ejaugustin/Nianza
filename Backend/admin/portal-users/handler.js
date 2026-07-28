// NZA-ADMIN-v1.0 SS4.7: manages admin PORTAL accounts (the AdminUserPool
// Cognito pool), not app users. SUPER_ADMIN ONLY for every action here.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand
} = require("@aws-sdk/client-cognito-identity-provider");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_CONTENT_EDITOR, ROLE_OPERATIONS } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
const cognitoClient = new CognitoIdentityProviderClient({});

const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;
const ADMIN_SESSIONS_TABLE = process.env.ADMIN_SESSIONS_TABLE;
const ADMIN_USER_POOL_ID = process.env.ADMIN_USER_POOL_ID;
const ASSIGNABLE_ROLES = new Set([ROLE_CONTENT_EDITOR, ROLE_OPERATIONS]);

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function attrMap(attributes = []) {
  const map = {};
  for (const { Name, Value } of attributes) map[Name] = Value;
  return map;
}

function adminUserIdFromEvent(event) {
  const raw = event.pathParameters?.adminUserId || (event.path || event.rawPath || "").split("/portal-users/")[1] || "";
  try {
    return decodeURIComponent(raw.split("/")[0]);
  } catch {
    return raw.split("/")[0];
  }
}

async function lastLoginFor(adminUserId) {
  if (!ADMIN_SESSIONS_TABLE) return null;
  const result = await documentClient.send(new QueryCommand({
    TableName: ADMIN_SESSIONS_TABLE,
    KeyConditionExpression: "adminUserId = :adminUserId",
    ExpressionAttributeValues: { ":adminUserId": adminUserId },
    ScanIndexForward: false,
    Limit: 1
  }));
  return (result.Items || [])[0]?.lastActiveAt || null;
}

// GET /admin/v1/portal-users
async function handleList() {
  if (!ADMIN_USER_POOL_ID) return error(500, "CONFIGURATION_ERROR", "ADMIN_USER_POOL_ID is not configured.");

  const page = await cognitoClient.send(new ListUsersCommand({ UserPoolId: ADMIN_USER_POOL_ID, Limit: 60 }));
  const users = [];
  for (const cognitoUser of page.Users || []) {
    const attrs = attrMap(cognitoUser.Attributes);
    users.push({
      userId: attrs.sub,
      email: attrs.email || cognitoUser.Username,
      role: attrs["custom:role"] || null,
      status: cognitoUser.UserStatus || null,
      createdAt: cognitoUser.UserCreateDate ? new Date(cognitoUser.UserCreateDate).toISOString() : null,
      lastLoginAt: attrs.sub ? await lastLoginFor(attrs.sub) : null
    });
  }

  return json(200, { users });
}

// POST /admin/v1/portal-users -- role super_admin can never be assigned
// through this endpoint, only through direct Cognito console modification.
async function handleCreate(event, actor) {
  if (!ADMIN_USER_POOL_ID) return error(500, "CONFIGURATION_ERROR", "ADMIN_USER_POOL_ID is not configured.");

  const body = parseBody(event);
  if (!body.email) return error(400, "MISSING_FIELD", "email is required.");
  if (!ASSIGNABLE_ROLES.has(body.role)) {
    return error(400, "INVALID_FIELD", `role must be one of: ${[...ASSIGNABLE_ROLES].join(", ")}. super_admin cannot be assigned through this endpoint.`);
  }

  const result = await cognitoClient.send(new AdminCreateUserCommand({
    UserPoolId: ADMIN_USER_POOL_ID,
    Username: body.email,
    UserAttributes: [
      { Name: "email", Value: body.email },
      { Name: "email_verified", Value: "true" },
      { Name: "custom:role", Value: body.role },
      ...(body.firstName ? [{ Name: "given_name", Value: body.firstName }] : [])
    ]
    // DesiredDeliveryMediums defaults to EMAIL -- Cognito sends the
    // temporary-password email per AdminUserPool's InviteMessageTemplate.
  }));

  const attrs = attrMap(result.User.Attributes);
  const created = { userId: attrs.sub, email: body.email, role: body.role, status: result.User.UserStatus || "FORCE_CHANGE_PASSWORD" };

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "portal-user.create",
    targetType: "portal-user",
    targetId: created.userId,
    newValue: created,
    event
  });

  return json(201, { user: created });
}

// POST /admin/v1/portal-users/{adminUserId}/disable -- also terminates all
// active sessions in nianza-admin-sessions. Cannot disable your own account.
async function handleDisable(event, actor, adminUserId) {
  if (!ADMIN_USER_POOL_ID) return error(500, "CONFIGURATION_ERROR", "ADMIN_USER_POOL_ID is not configured.");
  if (adminUserId === actor.userId) return error(400, "CANNOT_SELF_DISABLE", "You cannot disable your own account.");

  const page = await cognitoClient.send(new ListUsersCommand({
    UserPoolId: ADMIN_USER_POOL_ID,
    Filter: `sub = "${adminUserId}"`,
    Limit: 1
  }));
  const cognitoUser = (page.Users || [])[0];
  if (!cognitoUser) return error(404, "NOT_FOUND", "Portal user not found.");

  await cognitoClient.send(new AdminDisableUserCommand({ UserPoolId: ADMIN_USER_POOL_ID, Username: cognitoUser.Username }));

  let terminatedSessions = 0;
  if (ADMIN_SESSIONS_TABLE) {
    const sessions = await documentClient.send(new QueryCommand({
      TableName: ADMIN_SESSIONS_TABLE,
      KeyConditionExpression: "adminUserId = :adminUserId",
      ExpressionAttributeValues: { ":adminUserId": adminUserId }
    }));
    for (const session of sessions.Items || []) {
      if (!session.isActive) continue;
      await documentClient.send(new UpdateCommand({
        TableName: ADMIN_SESSIONS_TABLE,
        Key: { adminUserId, sessionId: session.sessionId },
        UpdateExpression: "SET isActive = :falseValue",
        ExpressionAttributeValues: { ":falseValue": false }
      }));
      terminatedSessions += 1;
    }
  }

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "portal-user.disable",
    targetType: "portal-user",
    targetId: adminUserId,
    newValue: { terminatedSessions },
    event
  });

  return json(200, { adminUserId, disabled: true, terminatedSessions });
}

// GET /admin/v1/sessions -- all active admin sessions across all portal
// users, for the Active Sessions screen. Requires a table scan since
// nianza-admin-sessions is keyed by adminUserId, not a global session index
// -- acceptable at admin-team scale.
async function handleSessionsList() {
  if (!ADMIN_SESSIONS_TABLE) return json(200, { sessions: [] });
  const result = await documentClient.send(new ScanCommand({ TableName: ADMIN_SESSIONS_TABLE }));
  const sessions = (result.Items || []).filter((s) => s.isActive);
  return json(200, { sessions });
}

// POST /admin/v1/sessions/{sessionId}/terminate -- force-terminate a single
// session. adminUserId is required in the body since sessions are keyed by
// (adminUserId, sessionId), not sessionId alone.
async function handleSessionTerminate(event, actor, sessionId) {
  if (!ADMIN_SESSIONS_TABLE) return error(500, "CONFIGURATION_ERROR", "ADMIN_SESSIONS_TABLE is not configured.");
  const body = parseBody(event);
  if (!body.adminUserId) return error(400, "MISSING_FIELD", "adminUserId is required.");

  await documentClient.send(new UpdateCommand({
    TableName: ADMIN_SESSIONS_TABLE,
    Key: { adminUserId: body.adminUserId, sessionId },
    UpdateExpression: "SET isActive = :falseValue",
    ExpressionAttributeValues: { ":falseValue": false }
  }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "portal-user.session-terminate",
    targetType: "admin-session",
    targetId: sessionId,
    newValue: { adminUserId: body.adminUserId },
    event
  });

  return json(200, { sessionId, terminated: true });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "Only super_admin can manage portal users.");

  const path = event.path || event.rawPath || "";
  const adminUserId = adminUserIdFromEvent(event);

  try {
    if (event.httpMethod === "GET" && path.endsWith("/portal-users")) return handleList();
    if (event.httpMethod === "POST" && path.endsWith("/portal-users")) return handleCreate(event, actor);
    if (event.httpMethod === "POST" && path.endsWith("/disable")) return handleDisable(event, actor, adminUserId);
    if (event.httpMethod === "GET" && path.endsWith("/sessions")) return handleSessionsList();
    if (event.httpMethod === "POST" && path.endsWith("/terminate")) {
      const sessionId = (path.match(/\/sessions\/([^/]+)\/terminate/) || [])[1] || "";
      return handleSessionTerminate(event, actor, decodeURIComponent(sessionId));
    }
    return error(404, "NOT_FOUND", "Admin portal-users route not found.");
  } catch (err) {
    console.error("admin portal-users route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin portal-users service.");
  }
};
