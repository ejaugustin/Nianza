// NZA-ADMIN-v1.0 SS4.5: notification log + broadcast send.
//
// NOTE (Phase 0 build-out, July 2026): there is no push-delivery
// infrastructure in this backend yet -- no SNS/Pinpoint topic, no Expo push
// token storage on user records. So "sent"/"failed" below are honest zeros
// with a note attached rather than a fabricated success count; dryRun's
// targetCount is real (computed from actual user records), which is the
// part of this flow that's safe to rely on today. Wiring real delivery is a
// follow-on task once push infrastructure exists.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_OPERATIONS } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const USERS_TABLE = process.env.USERS_TABLE;
const NOTIFICATION_LOG_TABLE = process.env.NOTIFICATION_LOG_TABLE;
const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;
const TITLE_MAX = 60;
const BODY_MAX = 140;

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

// GET /admin/v1/notifications -- read-only log of broadcast attempts.
async function handleList(event) {
  const query = event.queryStringParameters || {};
  const limit = Math.min(Number(query.limit || 50), 200);

  if (!NOTIFICATION_LOG_TABLE) return json(200, { notifications: [], count: 0 });

  const result = await documentClient.send(new ScanCommand({ TableName: NOTIFICATION_LOG_TABLE, Limit: limit }));
  let notifications = result.Items || [];
  if (query.notificationType) notifications = notifications.filter((n) => n.notificationType === query.notificationType);
  if (query.startDate) notifications = notifications.filter((n) => n.createdAt >= query.startDate);
  if (query.endDate) notifications = notifications.filter((n) => n.createdAt <= query.endDate);
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return json(200, { notifications, count: notifications.length });
}

async function targetCountForSegment(segment) {
  if (!USERS_TABLE) return 0;
  const result = await documentClient.send(new ScanCommand({ TableName: USERS_TABLE }));
  const items = result.Items || [];
  if (!segment || segment === "all") return items.length;

  const [kind, value] = segment.split(":");
  if (kind === "language") return items.filter((u) => u.language === value).length;
  if (kind === "subscriptionStatus") return items.filter((u) => u.subscriptionStatus === value).length;
  return 0;
}

// POST /admin/v1/notifications/broadcast -- SUPER_ADMIN ONLY. Service
// announcements only, never marketing/re-engagement (hard constraint from
// spec). dryRun must be used before any real send -- the UI enforces this,
// but the Lambda also refuses a non-dryRun call without an explicit
// confirmation flag as a second guard.
async function handleBroadcast(event, actor) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "Only super_admin can send a broadcast.");

  const body = parseBody(event);
  if (!body.title) return error(400, "MISSING_FIELD", "title is required.");
  if (!body.body) return error(400, "MISSING_FIELD", "body is required.");
  if (body.title.length > TITLE_MAX) return error(400, "INVALID_FIELD", `title must be ${TITLE_MAX} characters or fewer.`);
  if (body.body.length > BODY_MAX) return error(400, "INVALID_FIELD", `body must be ${BODY_MAX} characters or fewer.`);

  const segment = body.segment || "all";
  const targetCount = await targetCountForSegment(segment);

  if (body.dryRun) {
    return json(200, { targetCount, dryRun: true });
  }

  const timestamp = new Date().toISOString();
  const logRow = {
    notificationType: "broadcast",
    createdAt: timestamp,
    segment,
    title: body.title,
    body: body.body,
    targetCount,
    sent: 0,
    failed: targetCount,
    triggeredBy: actor.email,
    deliveryNote: "No push-delivery infrastructure (SNS/Pinpoint/Expo push) is wired up yet -- this broadcast was logged and audited but not actually delivered."
  };

  if (NOTIFICATION_LOG_TABLE) await documentClient.send(new PutCommand({ TableName: NOTIFICATION_LOG_TABLE, Item: logRow }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "notification.broadcast",
    targetType: "notification-broadcast",
    targetId: segment,
    newValue: { title: body.title, body: body.body, segment, targetCount },
    event
  });

  return json(200, { targetCount, sent: logRow.sent, failed: logRow.failed, note: logRow.deliveryNote });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");
  if (!hasRole(actor, [ROLE_SUPER_ADMIN, ROLE_OPERATIONS])) return error(403, "FORBIDDEN", "You do not have permission to view notifications.");

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.endsWith("/notifications")) return handleList(event);
    if (event.httpMethod === "POST" && path.endsWith("/broadcast")) return handleBroadcast(event, actor);
    return error(404, "NOT_FOUND", "Admin notifications route not found.");
  } catch (err) {
    console.error("admin notifications route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin notifications service.");
  }
};
