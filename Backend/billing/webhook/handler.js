// NZA-ADMIN-v1.1 SS3 / COWORK-IMPL SS2.3: nianza-billing-lambda. Public
// RevenueCat webhook endpoint -- POST /v1/webhooks/revenuecat, no Cognito
// authorizer (see infra/template.yaml), shared-secret Authorization header
// auth instead. Handler order is spec'd as non-negotiable:
//   1. verify secret -> 401 + stop on failure
//   2. archive raw payload to S3 BEFORE further parsing -> 500 on failure
//      (RevenueCat retries; we never process an event we didn't archive)
//   3. dedupe on eventId (conditional write)
//   4. write event row, update the user's subscription snapshot
//   5. recompute + cache MRR/ARR/at-risk metrics
//   6. return 200
//
// PRODUCT IDS: confirmed live against the NIanza RevenueCat project (July 28
// 2026, app.revenuecat.com/projects/86547d89/product-catalog/products) --
// the real product identifiers are "monthly" and "yearly" (Test Store only
// so far, no real App Store/Play Store app connected yet). If the products
// are ever recreated with different ids, update REVENUECAT_MONTHLY_PRODUCT_ID
// / REVENUECAT_ANNUAL_PRODUCT_ID in infra/template.yaml to match. An
// unrecognized product id contributes $0 to MRR rather than guessing.
//
// FIELD NAMES: app_user_id, product_id, id (event id), and event_timestamp_ms
// are confirmed-present-on-every-event per RevenueCat's own docs
// (revenuecat.com/docs/integrations/webhooks/event-types-and-fields, checked
// July 2026). price/currency/store/environment/expiration_at_ms/purchased_at_ms
// are standard fields per that same doc but weren't individually re-verified
// against a live payload here -- if metrics look off after the first real
// events land, diff a raw archived payload in S3 against this parsing.
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { SSMClient, PutParameterCommand } = require("@aws-sdk/client-ssm");
const { computeBillingSummary } = require("../../shared/billing-metrics");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
const s3Client = new S3Client({});
const secretsClient = new SecretsManagerClient({});
const ssmClient = new SSMClient({});

const BILLING_EVENTS_TABLE = process.env.BILLING_EVENTS_TABLE;
const USERS_TABLE = process.env.USERS_TABLE;
const BILLING_RAW_BUCKET = process.env.BILLING_RAW_BUCKET;
const WEBHOOK_SECRET_ARN = process.env.WEBHOOK_SECRET_ARN;
const BILLING_CACHE_PARAM = process.env.BILLING_CACHE_PARAM || "/nianza/admin/billing-summary-cache";
const MONTHLY_PRODUCT_ID = process.env.REVENUECAT_MONTHLY_PRODUCT_ID || "monthly";
const ANNUAL_PRODUCT_ID = process.env.REVENUECAT_ANNUAL_PRODUCT_ID || "yearly";

const HANDLED_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE", "TRIAL_STARTED", "TRIAL_CONVERTED", "TRIAL_CANCELLED",
  "RENEWAL", "CANCELLATION", "UNCANCELLATION", "BILLING_ISSUE",
  "PRODUCT_CHANGE", "REFUND", "EXPIRATION", "SUBSCRIPTION_PAUSED"
]);

// Cached for the lifetime of the Lambda execution environment -- a secret
// rotation needs a cold start to pick up (acceptable; this isn't rotated
// automatically and Ej would redeploy/restart on rotation anyway).
let cachedSecret = null;
async function webhookSecret() {
  if (cachedSecret) return cachedSecret;
  if (!WEBHOOK_SECRET_ARN) throw new Error("WEBHOOK_SECRET_ARN is not configured.");
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: WEBHOOK_SECRET_ARN }));
  // The secret is stored as {"value": "<random string>"} via GenerateSecretString
  // (see infra/template.yaml) -- fall back to the raw string in case someone
  // rotates it manually with a plain SecretString.
  try {
    cachedSecret = JSON.parse(result.SecretString).value;
  } catch {
    cachedSecret = result.SecretString;
  }
  return cachedSecret;
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeProductId(rawProductId) {
  if (rawProductId === MONTHLY_PRODUCT_ID) return "monthly";
  if (rawProductId === ANNUAL_PRODUCT_ID) return "annual";
  return null;
}

// Per-event-type snapshot transition. Returns the UpdateExpression pieces to
// apply to the user's nianza-users row, or null if this event type doesn't
// change the snapshot (still gets archived + logged either way).
function snapshotChangesFor(evt, nowIso) {
  const productId = normalizeProductId(evt.product_id);
  const periodEndsAt = evt.expiration_at_ms ? new Date(evt.expiration_at_ms).toISOString() : null;

  switch (evt.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "TRIAL_CONVERTED":
      return { subscriptionStatus: "active", currentProductId: productId, currentPeriodEndsAt: periodEndsAt, billingIssueSince: null, willRenew: true };
    case "TRIAL_STARTED":
      return {
        subscriptionStatus: "trialing",
        currentProductId: productId,
        trialStartedAt: evt.purchased_at_ms ? new Date(evt.purchased_at_ms).toISOString() : nowIso,
        trialEndsAt: periodEndsAt,
        willRenew: true
      };
    case "TRIAL_CANCELLED":
      return { willRenew: false };
    case "CANCELLATION":
      return { willRenew: false };
    case "BILLING_ISSUE":
      // Only set billingIssueSince if not already set -- handled by the
      // caller with a conditional attribute-not-exists SET, since this
      // function doesn't have read access to the existing row.
      return { subscriptionStatus: "active", billingIssueSince: nowIso, __billingIssueSinceIfAbsent: true };
    case "EXPIRATION":
      return { subscriptionStatus: "expired", billingIssueSince: null, willRenew: false };
    case "SUBSCRIPTION_PAUSED":
      return { subscriptionStatus: "paused" };
    case "REFUND":
      // RevenueCat sends a separate EXPIRATION when entitlement is actually
      // revoked -- REFUND alone doesn't change the snapshot, just feeds the
      // refund-rate metric via the stored event row.
      return null;
    default:
      return null;
  }
}

async function applySnapshot(userId, changes) {
  if (!USERS_TABLE || !userId || !changes) return;

  const setParts = [];
  const removeParts = [];
  const values = {};
  const names = {};

  for (const [key, value] of Object.entries(changes)) {
    if (key === "__billingIssueSinceIfAbsent") continue;
    names[`#${key}`] = key;
    if (value === null) {
      removeParts.push(`#${key}`);
    } else {
      values[`:${key}`] = value;
      if (key === "billingIssueSince" && changes.__billingIssueSinceIfAbsent) {
        setParts.push(`#${key} = if_not_exists(#${key}, :${key})`);
      } else {
        setParts.push(`#${key} = :${key}`);
      }
    }
  }
  names["#updatedAt"] = "updatedAt";
  values[":updatedAt"] = new Date().toISOString();
  setParts.push("#updatedAt = :updatedAt");

  const updateExpression = [
    setParts.length ? `SET ${setParts.join(", ")}` : null,
    removeParts.length ? `REMOVE ${removeParts.join(", ")}` : null
  ].filter(Boolean).join(" ");

  await documentClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values
  }));
}

async function scanActiveUsers() {
  // Small-scale scan, same tradeoff every other admin Lambda in this
  // codebase makes today (see admin/metrics/handler.js) -- revisit if the
  // subscriber count ever makes a full scan slow. Only pulls the handful of
  // fields computeBillingSummary needs, not full profiles.
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await documentClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: "subscriptionStatus, currentProductId, billingIssueSince",
      ExclusiveStartKey
    }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function recomputeAndCacheMetrics() {
  const users = await scanActiveUsers();
  const summary = computeBillingSummary(users);
  try {
    await ssmClient.send(new PutParameterCommand({
      Name: BILLING_CACHE_PARAM,
      Type: "String",
      Overwrite: true,
      Value: JSON.stringify({ cachedAt: new Date().toISOString(), summary })
    }));
  } catch (err) {
    // Cache write failure is non-fatal -- admin/billing/handler.js falls
    // back to a live recompute if the cache is missing or stale.
    console.error("billing metrics cache write failed (non-fatal)", err);
  }
  return summary;
}

exports.handler = async (event) => {
  const rawAuth = event.headers?.Authorization || event.headers?.authorization || "";

  // 1. Verify secret. Fail closed, no side effects, no parsing beyond this.
  let secret;
  try {
    secret = await webhookSecret();
  } catch (err) {
    console.error("billing webhook secret unavailable", err);
    return { statusCode: 500, body: JSON.stringify({ error: "CONFIGURATION_ERROR" }) };
  }
  const presented = rawAuth.replace(/^Bearer\s+/i, "");
  if (!timingSafeEqual(presented, secret)) {
    console.error("billing webhook auth failed", { hasAuthHeader: Boolean(rawAuth) });
    return { statusCode: 401, body: JSON.stringify({ error: "UNAUTHORIZED" }) };
  }

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (err) {
    console.error("billing webhook payload not valid JSON", err);
    return { statusCode: 400, body: JSON.stringify({ error: "INVALID_PAYLOAD" }) };
  }

  const evt = body?.event;
  const userId = evt?.app_user_id;
  const eventId = evt?.id;
  if (!userId || !eventId) {
    console.error("billing webhook payload missing app_user_id/id", { hasEvent: Boolean(evt) });
    return { statusCode: 400, body: JSON.stringify({ error: "INVALID_PAYLOAD" }) };
  }

  // 2. Archive raw payload to S3 BEFORE any further parsing. This is a hard
  // requirement (replayability) -- if this fails, RevenueCat must retry, so
  // we return 500 rather than continue.
  if (BILLING_RAW_BUCKET) {
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BILLING_RAW_BUCKET,
        Key: `${userId}/${eventId}.json`,
        Body: JSON.stringify(body),
        ContentType: "application/json"
      }));
    } catch (err) {
      console.error("billing webhook raw archive failed", err);
      return { statusCode: 500, body: JSON.stringify({ error: "ARCHIVE_FAILED" }) };
    }
  } else {
    console.error("BILLING_RAW_BUCKET not configured -- skipping archive (should never happen in a real deploy)");
  }

  const nowIso = new Date().toISOString();
  const eventTimestamp = evt.event_timestamp_ms ? new Date(evt.event_timestamp_ms).toISOString() : nowIso;
  const eventTimestampEventId = `${eventTimestamp}#${eventId}`;

  // 3. Dedupe via conditional write. A duplicate delivery is expected
  // RevenueCat behavior (at-least-once), not an error -- acknowledge 200.
  try {
    await documentClient.send(new PutCommand({
      TableName: BILLING_EVENTS_TABLE,
      Item: {
        userId,
        eventTimestampEventId,
        eventId,
        eventTimestamp,
        eventType: evt.type,
        productId: evt.product_id ?? null,
        normalizedProductId: normalizeProductId(evt.product_id),
        price: evt.price ?? null,
        currency: evt.currency ?? null,
        store: evt.store ?? null,
        environment: evt.environment ?? null,
        expirationAt: evt.expiration_at_ms ? new Date(evt.expiration_at_ms).toISOString() : null,
        rawPayloadKey: BILLING_RAW_BUCKET ? `${userId}/${eventId}.json` : null,
        createdAt: nowIso
      },
      ConditionExpression: "attribute_not_exists(eventTimestampEventId)"
    }));
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return { statusCode: 200, body: JSON.stringify({ deduped: true }) };
    }
    console.error("billing webhook event write failed", err);
    return { statusCode: 500, body: JSON.stringify({ error: "EVENT_WRITE_FAILED" }) };
  }

  // Unknown event types (forward-compat) and SANDBOX events are archived
  // and logged but never touch the user snapshot or metrics -- sandbox
  // traffic must never leak into real MRR.
  const isSandbox = evt.environment === "SANDBOX";
  if (!HANDLED_EVENT_TYPES.has(evt.type)) {
    console.log("billing webhook: unrecognized event type, archived only", { type: evt.type });
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }

  if (!isSandbox) {
    // 4. Update the user's subscription snapshot.
    try {
      const changes = snapshotChangesFor(evt, nowIso);
      await applySnapshot(userId, changes);
    } catch (err) {
      // The event is already durably archived + stored, so a snapshot
      // failure doesn't need RevenueCat to retry -- log loudly and let the
      // nightly reconciliation job catch the drift.
      console.error("billing webhook snapshot update failed (event already archived, will be caught by reconciliation)", err);
    }

    // 5. Recompute + cache metrics.
    try {
      await recomputeAndCacheMetrics();
    } catch (err) {
      console.error("billing webhook metrics recompute failed (non-fatal)", err);
    }
  }

  // 6. Ack.
  return { statusCode: 200, body: JSON.stringify({ ok: true, sandbox: isSandbox }) };
};
