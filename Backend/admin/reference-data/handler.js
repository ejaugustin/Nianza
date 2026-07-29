// NZA-ADMIN-v1.1 SS2.1: Schedule & Reference Data screen. Manages the
// versioned seed files that carry a sourceVerifiedBy launch gate.
//
// NOTE (found during this build): the spec assumes all three files are
// "versioned whole-file S3 blobs" -- that's not quite how they exist today.
// vaccines-en.json IS bundled Lambda code (mobile/vaccines/vaccines-en.json,
// loaded via require()) but DOES already carry a real sourceVerifiedBy: null
// field. milestones-en.json is also bundled via require() but has NO
// sourceVerifiedBy field at all today. "growth-lms-en.json" doesn't exist as
// a file -- growth reference data is a hardcoded GROWTH_SEED constant in
// mobile/vitals/library.js, which already has its own sourceVerifiedBy: null
// / status: "unverified-lms-seed" gate and already refuses to serve
// percentiles ("Growth reference tables are waiting for clinical
// verification"). So the growth gate already exists and works -- just not
// through this portal.
//
// This Lambda gives Ej a real place to publish new versions and record
// sourceVerifiedBy going forward. It does NOT yet migrate the three
// consuming Lambdas (mobile/vaccines, mobile/milestones, mobile/vitals) to
// read from this bucket at runtime instead of their bundled/hardcoded
// source -- that migration is a separate, larger follow-on task, and until
// it ships, publishing here does not change what the app actually serves.
// Flagging this clearly rather than pretending the loop is closed.
const { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand, CopyObjectCommand } = require("@aws-sdk/client-s3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { actorFromEvent, hasRole, ROLE_SUPER_ADMIN, ROLE_CONTENT_EDITOR } = require("../../shared/auth");
const { writeAuditLog } = require("../../shared/audit");
const { json, noContent, error } = require("../../shared/response");

const s3Client = new S3Client({});
const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const BUCKET = process.env.REFERENCE_DATA_BUCKET;
const VERSIONS_TABLE = process.env.REFERENCE_DATA_VERSIONS_TABLE;
const AUDIT_TABLE = process.env.AUDIT_TABLE || process.env.ADMIN_AUDIT_LOG_TABLE;

const KNOWN_KEYS = ["vaccines-en", "growth-lms-en", "milestones-en"];

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

function referenceKeyFromEvent(event) {
  const raw = event.pathParameters?.key || (event.path || event.rawPath || "").split("/reference-data/")[1] || "";
  const decoded = decodeURIComponent(raw.split("/")[0]);
  return decoded;
}

async function streamToString(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function objectExists(key) {
  try {
    const head = await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { exists: true, lastModified: head.LastModified ? head.LastModified.toISOString() : null };
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return { exists: false, lastModified: null };
    throw err;
  }
}

// Row-count summary used for the upload diff -- structure-aware per known
// key, falls back to a generic top-level-key count for anything unrecognized.
function countItems(referenceKey, parsed) {
  if (referenceKey === "vaccines-en") return (parsed.series || []).reduce((sum, s) => sum + (s.doses || []).length, 0);
  if (referenceKey === "milestones-en") return (parsed.windows || []).reduce((sum, w) => sum + (w.milestones || []).length, 0);
  return Object.keys(parsed || {}).length;
}

async function versionRow(referenceKey) {
  if (!VERSIONS_TABLE) return null;
  const result = await documentClient.send(new GetCommand({ TableName: VERSIONS_TABLE, Key: { referenceKey } }));
  return result.Item || null;
}

// GET /admin/v1/reference-data -- lists the three known seed files: current
// live version, sourceVerifiedBy, last-updated date, whether a staged
// (unpublished) version is waiting.
async function handleList() {
  if (!BUCKET) return error(500, "CONFIGURATION_ERROR", "REFERENCE_DATA_BUCKET is not configured.");

  const items = [];
  for (const referenceKey of KNOWN_KEYS) {
    const [live, staged, versionRecord] = await Promise.all([
      objectExists(`live/${referenceKey}.json`),
      objectExists(`staging/${referenceKey}.json`),
      versionRow(referenceKey)
    ]);
    items.push({
      referenceKey,
      liveExists: live.exists,
      lastUpdatedAt: versionRecord?.publishedAt || live.lastModified,
      sourceVerifiedBy: versionRecord?.sourceVerifiedBy || null,
      hasStagedVersion: staged.exists,
      downloadUrl: live.exists ? `s3://${BUCKET}/live/${referenceKey}.json` : null
    });
  }

  return json(200, { items });
}

// POST /admin/v1/reference-data/{key}/upload -- uploads to the STAGING path
// only, never overwrites the live key. Returns a diff summary so the
// reviewer can sanity-check row counts before publishing.
async function handleUpload(event, actor, referenceKey) {
  if (!hasRole(actor, [ROLE_CONTENT_EDITOR, ROLE_SUPER_ADMIN])) {
    return error(403, "FORBIDDEN", "You do not have permission to upload reference data.");
  }
  if (!KNOWN_KEYS.includes(referenceKey)) return error(400, "INVALID_KEY", `Unknown reference data key: ${referenceKey}`);
  if (!BUCKET) return error(500, "CONFIGURATION_ERROR", "REFERENCE_DATA_BUCKET is not configured.");

  const body = parseBody(event);
  if (!body.content) return error(400, "MISSING_FIELD", "content (the new file's JSON body) is required.");

  let parsed;
  try {
    parsed = typeof body.content === "string" ? JSON.parse(body.content) : body.content;
  } catch {
    return error(400, "INVALID_FIELD", "content must be valid JSON.");
  }

  let previousCount = null;
  const live = await objectExists(`live/${referenceKey}.json`);
  if (live.exists) {
    const liveObject = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET, Key: `live/${referenceKey}.json` }));
    const liveContent = JSON.parse(await streamToString(liveObject.Body));
    previousCount = countItems(referenceKey, liveContent);
  }
  const nextCount = countItems(referenceKey, parsed);

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `staging/${referenceKey}.json`,
    Body: JSON.stringify(parsed, null, 2),
    ContentType: "application/json"
  }));

  return json(200, {
    referenceKey,
    staged: true,
    diff: { previousCount, nextCount, delta: previousCount == null ? null : nextCount - previousCount }
  });
}

// POST /admin/v1/reference-data/{key}/publish -- SUPER_ADMIN ONLY. Requires
// sourceVerifiedBy (reviewer name) or 400s. Copies staged -> live and
// records the version row + audit log.
async function handlePublish(event, actor, referenceKey) {
  if (!hasRole(actor, [ROLE_SUPER_ADMIN])) return error(403, "FORBIDDEN", "Only super_admin can publish reference data.");
  if (!KNOWN_KEYS.includes(referenceKey)) return error(400, "INVALID_KEY", `Unknown reference data key: ${referenceKey}`);
  if (!BUCKET) return error(500, "CONFIGURATION_ERROR", "REFERENCE_DATA_BUCKET is not configured.");

  const body = parseBody(event);
  if (!body.sourceVerifiedBy) return error(400, "MISSING_FIELD", "sourceVerifiedBy is required to publish.");

  const staged = await objectExists(`staging/${referenceKey}.json`);
  if (!staged.exists) return error(404, "NOT_FOUND", "No staged version to publish. Upload one first.");

  const previousVersion = await versionRow(referenceKey);

  await s3Client.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/staging/${referenceKey}.json`,
    Key: `live/${referenceKey}.json`
  }));

  const publishedAt = new Date().toISOString();
  const versionNumber = (previousVersion?.versionNumber || 0) + 1;
  const nextVersion = {
    referenceKey,
    versionNumber,
    sourceVerifiedBy: { reviewer: body.sourceVerifiedBy, verifiedAt: publishedAt },
    publishedAt,
    publishedBy: actor.email
  };

  if (VERSIONS_TABLE) await documentClient.send(new PutCommand({ TableName: VERSIONS_TABLE, Item: nextVersion }));

  await writeAuditLog({
    tableName: AUDIT_TABLE,
    actor,
    action: "reference-data.publish",
    targetType: "reference-data",
    targetId: referenceKey,
    previousValue: previousVersion,
    newValue: nextVersion,
    event
  });

  return json(200, nextVersion);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();

  const actor = actorFromEvent(event);
  if (!actor.isAuthenticated) return error(401, "UNAUTHORIZED", "Admin authentication is required.");

  const path = event.path || event.rawPath || "";
  const referenceKey = referenceKeyFromEvent(event);

  try {
    if (event.httpMethod === "GET" && path.endsWith("/reference-data")) return handleList();
    if (event.httpMethod === "POST" && path.endsWith("/upload")) return handleUpload(event, actor, referenceKey);
    if (event.httpMethod === "POST" && path.endsWith("/publish")) return handlePublish(event, actor, referenceKey);
    return error(404, "NOT_FOUND", "Admin reference-data route not found.");
  } catch (err) {
    console.error("admin reference-data route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the admin reference-data service.");
  }
};
