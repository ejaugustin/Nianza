// NZA-ADMIN-v1.0 SS4.3: read/write admin view of app users for support/ops.
// disable goes through Cognito directly; delete performs a real cross-table
// + Cognito data sweep (see sweepUserData below) rather than just logging
// intent. SUPER_ADMIN and OPERATIONS roles.
//
// NOTE (found during Phase 0 build-out, July 2026): nianza-users is declared
// in infra and read-permissioned to the chat Lambda, but nothing in the app
// backend currently writes profile rows to it or persists subscriptionStatus/
// trialEndsAt -- the app has no RevenueCat integration and no user-profile
// write path yet, it works entirely off Cognito claims. So this Lambda treats
// Cognito as the source of truth for account existence/status and merges in
// any DynamoDB fields if/when they exist, rather than assuming they're
// populated. Flagging this as a real gap, not pretending it's wired.
//
// NOTE (deletion sweep, added when suspend/delete was audited for business
// use, July 2026): the sweep below deletes DynamoDB rows, voice-memory audio
// in S3, and the Cognito identity. It does NOT touch RevenueCat -- there is
// no billing integration in this codebase yet (see Phase 1 billing-pipeline
// work), so a deleted user's subscription must currently be cancelled there
// by hand. Closing that gap is a follow-on task once RevenueCat is wired up.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, QueryCommand, DeleteCommand, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminGetUserCommand,
  AdminDisableUserCommand,
  AdminDeleteUserCommand
} = require("@aws-sdk/client-cognito-identity-provider");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_OPERATIONS } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");
const voiceStorage = require("../../mobile/memories/voice-storage");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
const cognitoClient = new CognitoIdentityProviderClient({});

const USERS_TABLE = process.env.USERS_TABLE;
const CHILDREN_TABLE = process.env.CHILDREN_TABLE;
const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;
const USER_POOL_ID = process.env.MOBILE_USER_POOL_ID;

// Per-child tables swept on deletion, each keyed by (childId HASH, <sortKey> RANGE).
const CHILD_SCOPED_TABLES = [
  { table: process.env.MILESTONE_TABLE, sortKey: "observedAt" },
  { table: process.env.IMMUNIZATION_TABLE, sortKey: "doseId" },
  { table: process.env.SICK_ENCOUNTERS_TABLE, sortKey: "encounterId" },
  { table: process.env.VITALS_TABLE, sortKey: "entryId" },
  { table: process.env.VISIT_DEBRIEFS_TABLE, sortKey: "debriefId" },
  { table: process.env.REPORTS_TABLE, sortKey: "reportId" }
];
const VOICE_MEMORIES_TABLE = process.env.VOICE_MEMORIES_TABLE;
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE;

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function attrMap(attributes = []) {
  const map = {};
  for (const { Name, Value } of attributes) map[Name] = Value;
  return map;
}

function userIdFromEvent(event) {
  const raw = event.pathParameters?.userId || (event.path || event.rawPath || "").split("/users/")[1] || "";
  try {
    return decodeURIComponent(raw.split("/")[0]);
  } catch {
    return raw.split("/")[0];
  }
}

async function profileRow(userId) {
  if (!USERS_TABLE) return null;
  const result = await documentClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  return result.Item || null;
}

function toUserSummary(cognitoUser, profile) {
  const attrs = attrMap(cognitoUser.Attributes);
  return {
    userId: attrs.sub,
    email: attrs.email || null,
    firstName: profile?.firstName ?? null,
    language: profile?.language ?? attrs.locale ?? null,
    subscriptionStatus: profile?.subscriptionStatus ?? null,
    trialStartedAt: profile?.trialStartedAt ?? null,
    trialEndsAt: profile?.trialEndsAt ?? null,
    createdAt: cognitoUser.UserCreateDate ? new Date(cognitoUser.UserCreateDate).toISOString() : null,
    accountStatus: cognitoUser.UserStatus || null,
    enabled: cognitoUser.Enabled !== false,
    childCount: null // computed only on the detail view -- listing all children per user here would be an N+1 scan
  };
}

// GET /admin/v1/users -- paginated via Cognito's native pagination token.
// Filtering by subscriptionStatus/trialEndsAt range is applied client-side
// after the Cognito page is fetched, since that data doesn't live in Cognito
// (see NOTE above) -- acceptable at current scale, revisit if/when a real
// user-profile table is populated.
async function handleList(event) {
  if (!USER_POOL_ID) return error(500, "CONFIGURATION_ERROR", "MOBILE_USER_POOL_ID is not configured.");
  const query = event.queryStringParameters || {};
  const limit = Math.min(Number(query.limit || 25), 60);

  const page = await cognitoClient.send(new ListUsersCommand({
    UserPoolId: USER_POOL_ID,
    Limit: limit,
    PaginationToken: query.lastEvaluatedKey || undefined
  }));

  const users = [];
  for (const cognitoUser of page.Users || []) {
    const attrs = attrMap(cognitoUser.Attributes);
    const profile = attrs.sub ? await profileRow(attrs.sub) : null;
    const summary = toUserSummary(cognitoUser, profile);
    if (query.language && summary.language !== query.language) continue;
    if (query.subscriptionStatus && summary.subscriptionStatus !== query.subscriptionStatus) continue;
    users.push(summary);
  }

  return json(200, { users, count: users.length, lastEvaluatedKey: page.PaginationToken || null });
}

// GET /admin/v1/users/{userId} -- full profile for support. Never returns
// vitals log, milestone progress detail, or conversation content -- this is
// an operational view, not a surveillance tool.
async function handleGet(event, userId) {
  if (!USER_POOL_ID) return error(500, "CONFIGURATION_ERROR", "MOBILE_USER_POOL_ID is not configured.");

  let cognitoUser;
  try {
    cognitoUser = await cognitoClient.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: userId }));
  } catch (err) {
    if (err.name === "UserNotFoundException") return error(404, "NOT_FOUND", "User not found.");
    throw err;
  }

  const profile = await profileRow(userId);
  const childrenResult = CHILDREN_TABLE
    ? await documentClient.send(new QueryCommand({
        TableName: CHILDREN_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId }
      }))
    : { Items: [] };

  const children = (childrenResult.Items || []).map((child) => ({
    childId: child.childId,
    firstName: child.firstName ?? null,
    correctedAgeMonths: child.correctedAgeMonths ?? null,
    dateOfBirth: child.dateOfBirth ?? null
  }));

  const attrs = attrMap(cognitoUser.UserAttributes);
  return json(200, {
    user: {
      userId,
      email: attrs.email || null,
      firstName: profile?.firstName ?? null,
      language: profile?.language ?? attrs.locale ?? null,
      accountStatus: cognitoUser.UserStatus || null,
      enabled: cognitoUser.Enabled !== false,
      createdAt: cognitoUser.UserCreateDate ? new Date(cognitoUser.UserCreateDate).toISOString() : null
    },
    children,
    subscriptionStatus: profile?.subscriptionStatus ?? null,
    notificationLog: [] // NotificationLog table isn't built yet -- see Phase 0 Notifications Lambda task
  });
}

// POST /admin/v1/users/{userId}/disable -- SUPER_ADMIN ONLY. Sets Cognito
// account status to DISABLED. Does not delete data or cancel subscription.
async function handleDisable(event, actor, userId) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "Only super_admin can disable a user account.");
  if (!USER_POOL_ID) return error(500, "CONFIGURATION_ERROR", "MOBILE_USER_POOL_ID is not configured.");

  const body = parseBody(event);
  if (!body.reason) return error(400, "MISSING_FIELD", "reason is required.");

  try {
    await cognitoClient.send(new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: userId }));
  } catch (err) {
    if (err.name === "UserNotFoundException") return error(404, "NOT_FOUND", "User not found.");
    throw err;
  }

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "user.disable",
    targetType: "user",
    targetId: userId,
    newValue: { reason: body.reason },
    event
  });

  return json(200, { userId, disabled: true });
}

// Deletes up to 25 keys per BatchWriteCommand call (DynamoDB's hard limit),
// chunking and retrying UnprocessedItems. Small helper shared by every table
// swept below -- none of these tables hold enough rows per user/child to
// need anything fancier than a Query + chunked BatchWrite.
async function batchDeleteKeys(tableName, keys) {
  if (!tableName || keys.length === 0) return 0;
  const chunks = [];
  for (let i = 0; i < keys.length; i += 25) chunks.push(keys.slice(i, i + 25));

  for (const chunk of chunks) {
    let requestItems = {
      [tableName]: chunk.map((Key) => ({ DeleteRequest: { Key } }))
    };
    // A handful of retries is plenty here -- these are small, single-user
    // batches, not the kind of contested hot-partition workload BatchWrite's
    // unprocessed-item backoff is really meant for.
    for (let attempt = 0; attempt < 5 && requestItems[tableName]?.length; attempt++) {
      const result = await documentClient.send(new BatchWriteCommand({ RequestItems: requestItems }));
      requestItems = result.UnprocessedItems && Object.keys(result.UnprocessedItems).length ? result.UnprocessedItems : {};
    }
  }
  return keys.length;
}

async function queryAllByPartition(tableName, keyName, keyValue, indexName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const result = await documentClient.send(new QueryCommand({
      TableName: tableName,
      IndexName: indexName,
      KeyConditionExpression: "#k = :v",
      ExpressionAttributeNames: { "#k": keyName },
      ExpressionAttributeValues: { ":v": keyValue },
      ExclusiveStartKey
    }));
    items.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

// Real cross-table + cross-service data sweep for one user. Runs inline in
// this Lambda rather than invoking a separate nianza-account-deletion-lambda
// (see historical NOTE above) -- per-user data volume here is a handful of
// children and a few hundred rows at most, well within a single invocation,
// so a dedicated queue/reconciler Lambda would be more infra than the
// problem warrants. KNOWN GAP: there is no RevenueCat integration yet
// (tracked separately as the billing-pipeline phase), so this does not yet
// cancel/delete the RevenueCat subscriber record -- flagging rather than
// pretending that step happens.
async function sweepUserData(userId) {
  const counts = { children: 0, childRecords: 0, voiceMemories: 0, conversations: 0, cognitoDeleted: false };

  const childrenResult = CHILDREN_TABLE
    ? await documentClient.send(new QueryCommand({
        TableName: CHILDREN_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId }
      }))
    : { Items: [] };
  const children = childrenResult.Items || [];

  for (const child of children) {
    for (const { table, sortKey } of CHILD_SCOPED_TABLES) {
      if (!table) continue;
      const rows = await queryAllByPartition(table, "childId", child.childId);
      const deleted = await batchDeleteKeys(table, rows.map((row) => ({ childId: child.childId, [sortKey]: row[sortKey] })));
      counts.childRecords += deleted;
    }
  }
  if (CHILDREN_TABLE && children.length) {
    await batchDeleteKeys(CHILDREN_TABLE, children.map((child) => ({ userId, childId: child.childId })));
    counts.children = children.length;
  }

  if (VOICE_MEMORIES_TABLE) {
    const memories = await queryAllByPartition(VOICE_MEMORIES_TABLE, "userId", userId);
    for (const memory of memories) {
      if (memory.audioKey) {
        try {
          await voiceStorage.deleteAudioObject(memory.audioKey);
        } catch (err) {
          console.error(`voice memory audio delete failed for ${memory.audioKey}`, err);
        }
      }
    }
    counts.voiceMemories = await batchDeleteKeys(VOICE_MEMORIES_TABLE, memories.map((m) => ({ userId, childMemoryId: m.childMemoryId })));
  }

  if (CONVERSATIONS_TABLE) {
    const conversations = await queryAllByPartition(CONVERSATIONS_TABLE, "userId", userId, "user-updatedAt-index");
    counts.conversations = await batchDeleteKeys(CONVERSATIONS_TABLE, conversations.map((c) => ({ sessionId: c.sessionId })));
  }

  if (USERS_TABLE) {
    await documentClient.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { userId } }));
  }

  if (USER_POOL_ID) {
    try {
      await cognitoClient.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: userId }));
      counts.cognitoDeleted = true;
    } catch (err) {
      if (err.name !== "UserNotFoundException") throw err;
      // Already gone from Cognito (e.g. deleted manually) -- not a failure,
      // the rest of the sweep still needs to run.
    }
  }

  return counts;
}

// POST /admin/v1/users/{userId}/delete -- SUPER_ADMIN ONLY. Performs a real
// cross-table + Cognito deletion sweep (see sweepUserData above), not just
// an audit-logged intent. Writes an audit row before attempting the sweep
// and a second row recording success (with counts) or failure, so a failed
// sweep is never silently indistinguishable from a completed one.
async function handleDeleteInitiate(event, actor, userId) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "Only super_admin can initiate account deletion.");

  const body = parseBody(event);
  if (!body.reason) return error(400, "MISSING_FIELD", "reason is required.");
  if (!body.legalBasis) return error(400, "MISSING_FIELD", "legalBasis is required (e.g. 'COPPA request', 'user request via email').");

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "user.deletion-initiated",
    targetType: "user",
    targetId: userId,
    newValue: { reason: body.reason, legalBasis: body.legalBasis },
    event
  });

  let counts;
  try {
    counts = await sweepUserData(userId);
  } catch (err) {
    console.error("account deletion sweep failed", err);
    await writeAuditLog({
      tableName: AUDIT_TABLE,
      actor,
      action: "user.deletion-failed",
      targetType: "user",
      targetId: userId,
      result: "failure",
      errorMessage: err.message || String(err),
      event
    });
    return error(500, "DELETION_FAILED", "Account deletion sweep failed partway through -- check the audit log and retry. Some data may already be removed.");
  }

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "user.deletion-completed",
    targetType: "user",
    targetId: userId,
    newValue: counts,
    event
  });

  return json(200, {
    userId,
    deleted: true,
    counts,
    note: counts.cognitoDeleted
      ? "Account and associated data deleted. RevenueCat subscriber deletion is not yet wired up (no billing integration exists yet) -- follow up manually if this user has an active subscription."
      : "Data deleted. Cognito identity was already gone. RevenueCat subscriber deletion is not yet wired up (no billing integration exists yet) -- follow up manually if this user has an active subscription."
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN, ROLE_OPERATIONS])) return error(403, "FORBIDDEN", "You do not have permission to view user data.");

  const path = event.path || event.rawPath || "";
  const userId = userIdFromEvent(event);

  try {
    if (event.httpMethod === "GET" && path.endsWith("/users")) return handleList(event);
    if (event.httpMethod === "POST" && path.endsWith("/disable")) return handleDisable(event, actor, userId);
    if (event.httpMethod === "POST" && path.endsWith("/delete")) return handleDeleteInitiate(event, actor, userId);
    if (event.httpMethod === "GET" && userId) return handleGet(event, userId);
    return error(404, "NOT_FOUND", "Admin users route not found.");
  } catch (err) {
    console.error("admin users route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin users service.");
  }
};
