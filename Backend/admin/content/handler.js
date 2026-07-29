const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand
} = require("@aws-sdk/lib-dynamodb");
const { actorFromEvent, hasRole, ROLE_CONTENT_EDITOR, ROLE_SUPER_ADMIN } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CONTENT_TABLE = process.env.CONTENT_TABLE || process.env.CONTENT_LIBRARY_TABLE;
const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;
const VALID_LANGUAGES = new Set(["en", "es", "fr", "ar"]);

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function nowIso() {
  return new Date().toISOString();
}

function statusFor(item) {
  if (item.deleted) return "deleted";
  if (item.ejApproved) return "approved";
  if (item.clinicallyReviewed) return "reviewed";
  return "draft";
}

function serialize(item) {
  return { ...item, status: statusFor(item) };
}

function latestVersion(items) {
  return [...items].sort((a, b) => String(b.version).localeCompare(String(a.version), undefined, { numeric: true })).at(0);
}

// version increment per NZA-ADMIN-v1.0 SS4.1: patch for minor text edits,
// minor for structural changes -- caller specifies via body.versionBump.
function bumpVersion(version, bump) {
  const parts = String(version || "1.0.0").split(".").map((part) => Number(part) || 0);
  while (parts.length < 3) parts.push(0);
  const [major, minor, patch] = parts;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] == null || body[field] === "");
  if (missing.length) {
    return `Missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}`;
  }
  return null;
}

function buildContentId({ contentType, language, ageWindowMonths, domain }) {
  const ageWindow = ageWindowMonths == null || ageWindowMonths === "" ? "global" : `${ageWindowMonths}mo`;
  const domainValue = domain || "none";
  const suffix = crypto.randomUUID().slice(0, 6);
  return `${contentType}#${language}#${ageWindow}#${domainValue}#${suffix}`;
}

function buildFilters(query = {}) {
  const names = {};
  const values = {};
  const filters = ["attribute_not_exists(deleted) OR deleted = :deletedFalse"];
  values[":deletedFalse"] = false;

  for (const [field, value] of Object.entries(query)) {
    if (value == null || value === "" || ["limit", "lastEvaluatedKey"].includes(field)) continue;
    const nameKey = `#${field}`;
    const valueKey = `:${field}`;
    names[nameKey] = field;
    values[valueKey] = value === "true" ? true : value === "false" ? false : value;
    filters.push(`${nameKey} = ${valueKey}`);
  }

  return {
    FilterExpression: filters.map((filter) => `(${filter})`).join(" AND "),
    ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
    ExpressionAttributeValues: values
  };
}

function encodeCursor(key) {
  if (!key) return null;
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return undefined;
  return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function contentIdFromEvent(event, path) {
  const rawContentId = event.pathParameters?.contentId || (path.match(/\/content\/([^/]+)/) || [])[1] || "";
  return rawContentId ? decodePathPart(rawContentId) : "";
}

async function getContentVersion(contentId, version) {
  if (version) {
    const result = await documentClient.send(new GetCommand({
      TableName: CONTENT_TABLE,
      Key: { contentId, version }
    }));
    return result.Item || null;
  }

  const result = await documentClient.send(new QueryCommand({
    TableName: CONTENT_TABLE,
    KeyConditionExpression: "contentId = :contentId",
    ExpressionAttributeValues: { ":contentId": contentId }
  }));
  return latestVersion(result.Items || []) || null;
}

async function handleList(event) {
  const query = event.queryStringParameters || {};
  const limit = Math.min(Number(query.limit || 50), 100);
  const filters = buildFilters(query);
  const result = await documentClient.send(new ScanCommand({
    TableName: CONTENT_TABLE,
    Limit: limit,
    ExclusiveStartKey: decodeCursor(query.lastEvaluatedKey),
    ...filters
  }));

  return json(200, {
    items: (result.Items || []).map(serialize),
    count: result.Count || 0,
    lastEvaluatedKey: encodeCursor(result.LastEvaluatedKey)
  });
}

async function handleCreate(event, actor) {
  if (!hasRole(actor, [ROLE_CONTENT_EDITOR, ROLE_SUPER_ADMIN])) {
    return error(403, "FORBIDDEN", "You do not have permission to create content.");
  }

  const body = parseBody(event);
  const missing = requireFields(body, ["contentType", "language", "bodyText", "sourceRef"]);
  if (missing) return error(400, "MISSING_FIELD", missing);
  if (!VALID_LANGUAGES.has(body.language)) return error(400, "INVALID_FIELD", "language must be one of en, es, fr, ar.");

  const timestamp = nowIso();
  const item = {
    contentId: buildContentId(body),
    version: "1.0.0",
    contentType: body.contentType,
    language: body.language,
    ageWindowMonths: body.ageWindowMonths ?? null,
    domain: body.domain || null,
    bodyText: body.bodyText,
    ttsEnabled: Boolean(body.ttsEnabled),
    sourceRef: body.sourceRef,
    clinicallyReviewed: false,
    ejApproved: false,
    deleted: false,
    createdBy: actor.email,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await documentClient.send(new PutCommand({
    TableName: CONTENT_TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(contentId)"
  }));
  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "content.create",
    targetType: "content",
    targetId: item.contentId,
    newValue: item,
    event
  });

  return json(201, { item: serialize(item) });
}

// PUT /admin/v1/content/{contentId} -- versioned update, never an overwrite.
// contentType/language/ageWindowMonths/domain are structural and would
// require a new contentId, so those fields are rejected here rather than
// silently ignored. Updating always resets clinicallyReviewed/ejApproved to
// false on the new version -- an edit requires re-review, even if only the
// wording changed. The previous approved version stays queryable/active
// (still returned by getContentVersion when no explicit version is asked
// for, since it remains the highest ejApproved version) until the new one
// is approved in turn.
async function handleUpdate(event, actor, contentId) {
  if (!hasRole(actor, [ROLE_CONTENT_EDITOR, ROLE_SUPER_ADMIN])) {
    return error(403, "FORBIDDEN", "You do not have permission to update content.");
  }

  const body = parseBody(event);
  const structuralFields = ["contentType", "language", "ageWindowMonths", "domain"];
  const attemptedStructural = structuralFields.filter((field) => field in body);
  if (attemptedStructural.length) {
    return error(400, "STRUCTURAL_FIELD_IMMUTABLE", `Cannot update structural field(s): ${attemptedStructural.join(", ")}. Create a new content item instead.`);
  }

  const current = await getContentVersion(contentId, body.version);
  if (!current || current.deleted) return error(404, "NOT_FOUND", "Content item not found.");

  const timestamp = nowIso();
  const nextVersion = bumpVersion(current.version, body.versionBump === "minor" ? "minor" : "patch");
  const nextItem = {
    ...current,
    version: nextVersion,
    bodyText: body.bodyText ?? current.bodyText,
    ttsEnabled: body.ttsEnabled != null ? Boolean(body.ttsEnabled) : current.ttsEnabled,
    sourceRef: body.sourceRef ?? current.sourceRef,
    clinicallyReviewed: false,
    ejApproved: false,
    clinicalReviewer: null,
    clinicalReviewedAt: null,
    reviewerNote: null,
    approvedBy: null,
    approvedAt: null,
    supersedes: current.version,
    updatedBy: actor.email,
    updatedAt: timestamp
  };

  await documentClient.send(new PutCommand({
    TableName: CONTENT_TABLE,
    Item: nextItem,
    ConditionExpression: "attribute_not_exists(contentId) OR attribute_not_exists(version)"
  }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "content.update",
    targetType: "content",
    targetId: contentId,
    previousValue: current,
    newValue: nextItem,
    event
  });

  return json(200, { item: serialize(nextItem) });
}

// DELETE /admin/v1/content/{contentId} -- soft delete only (deleted=true),
// SUPER_ADMIN ONLY. Never a physical DynamoDB delete. reason is required and
// stored both in the audit log and on the item itself so it's visible from
// the Content Item screen without needing to open the audit log.
async function handleDelete(event, actor, contentId) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) {
    return error(403, "FORBIDDEN", "Only super_admin can delete content.");
  }

  const body = parseBody(event);
  const query = event.queryStringParameters || {};
  const version = body.version || query.version;
  const reason = body.reason || query.reason;
  if (!reason) return error(400, "MISSING_FIELD", "reason is required to delete content.");

  const item = await getContentVersion(contentId, version);
  if (!item || item.deleted) return error(404, "NOT_FOUND", "Content item not found.");

  const deletedAt = nowIso();
  const result = await documentClient.send(new UpdateCommand({
    TableName: CONTENT_TABLE,
    Key: { contentId: item.contentId, version: item.version },
    UpdateExpression: "SET deleted = :trueValue, deletedBy = :deletedBy, deletedAt = :deletedAt, deleteReason = :reason, updatedAt = :deletedAt",
    ExpressionAttributeValues: {
      ":trueValue": true,
      ":deletedBy": actor.email,
      ":deletedAt": deletedAt,
      ":reason": reason
    },
    ReturnValues: "ALL_NEW"
  }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "content.delete",
    targetType: "content",
    targetId: item.contentId,
    previousValue: item,
    newValue: { ...result.Attributes, reason },
    event
  });

  return json(200, { item: serialize(result.Attributes) });
}

async function handleReview(event, actor, contentId) {
  if (!hasRole(actor, [ROLE_CONTENT_EDITOR, ROLE_SUPER_ADMIN])) {
    return error(403, "FORBIDDEN", "You do not have permission to clinically review content.");
  }

  const body = parseBody(event);
  const item = await getContentVersion(contentId, body.version);
  if (!item || item.deleted) return error(404, "NOT_FOUND", "Content item not found.");
  if (item.clinicallyReviewed) return error(409, "ALREADY_REVIEWED", "Content item has already been clinically reviewed.");

  const reviewedAt = nowIso();
  const result = await documentClient.send(new UpdateCommand({
    TableName: CONTENT_TABLE,
    Key: { contentId: item.contentId, version: item.version },
    UpdateExpression: "SET clinicallyReviewed = :trueValue, clinicalReviewer = :reviewer, clinicalReviewedAt = :reviewedAt, reviewerNote = :note, updatedAt = :reviewedAt",
    ExpressionAttributeValues: {
      ":trueValue": true,
      ":reviewer": actor.email,
      ":reviewedAt": reviewedAt,
      ":note": body.reviewerNote || null
    },
    ReturnValues: "ALL_NEW"
  }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "content.clinical-review",
    targetType: "content",
    targetId: item.contentId,
    previousValue: item,
    newValue: result.Attributes,
    event
  });

  return json(200, { item: serialize(result.Attributes) });
}

async function handleApprove(event, actor, contentId) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) {
    return error(403, "FORBIDDEN", "Only super_admin can approve content for users.");
  }

  const body = parseBody(event);
  const item = await getContentVersion(contentId, body.version);
  if (!item || item.deleted) return error(404, "NOT_FOUND", "Content item not found.");
  if (!item.clinicallyReviewed) return error(400, "CLINICAL_REVIEW_REQUIRED", "Clinical review required before Ej approval.");
  if (item.ejApproved) return error(409, "ALREADY_APPROVED", "Content item is already approved.");

  const approvedAt = nowIso();
  const result = await documentClient.send(new UpdateCommand({
    TableName: CONTENT_TABLE,
    Key: { contentId: item.contentId, version: item.version },
    UpdateExpression: "SET ejApproved = :trueValue, approvedBy = :approver, approvedAt = :approvedAt, updatedAt = :approvedAt",
    ExpressionAttributeValues: {
      ":trueValue": true,
      ":approver": actor.email,
      ":approvedAt": approvedAt
    },
    ReturnValues: "ALL_NEW"
  }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "content.approve",
    targetType: "content",
    targetId: item.contentId,
    previousValue: item,
    newValue: result.Attributes,
    event
  });

  return json(200, { item: serialize(result.Attributes) });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CONTENT_TABLE) return error(500, "CONFIGURATION_ERROR", "CONTENT_TABLE is not configured.");

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");

  const path = event.path || event.rawPath || "";
  const contentId = contentIdFromEvent(event, path);

  try {
    if (event.httpMethod === "GET" && path.endsWith("/content")) return handleList(event);
    if (event.httpMethod === "POST" && path.endsWith("/content")) return handleCreate(event, actor);
    if (event.httpMethod === "POST" && path.endsWith("/review")) return handleReview(event, actor, contentId);
    if (event.httpMethod === "POST" && path.endsWith("/approve")) return handleApprove(event, actor, contentId);
    if (event.httpMethod === "PUT" && contentId && !path.endsWith("/review") && !path.endsWith("/approve")) return handleUpdate(event, actor, contentId);
    if (event.httpMethod === "DELETE" && contentId) return handleDelete(event, actor, contentId);

    return error(404, "NOT_FOUND", "Admin content route not found.");
  } catch (err) {
    console.error("admin content route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin content service.");
  }
};
