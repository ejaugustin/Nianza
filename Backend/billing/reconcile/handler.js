// NZA-ADMIN-v1.1-COWORK-IMPL SS2.4: nianza-billing-reconcile. Nightly
// EventBridge job (see infra/template.yaml). Pages the RevenueCat subscriber
// REST API for everyone our snapshot thinks currently has an entitlement
// (active/trialing/paused), diffs RevenueCat's view against ours, and writes
// any mismatch as a RECONCILIATION_DRIFT row so a webhook we silently missed
// doesn't leave MRR quietly wrong forever (see risk register: "Webhook loss
// or duplication -- MRR silently wrong, the worst kind of wrong").
//
// HONEST GAP: this requires nianza/revenuecat/api-key (Secrets Manager) to
// hold Ej's real RevenueCat REST API key. That secret is created empty by
// infra/template.yaml (Ej must paste the real value in after connecting a
// live RevenueCat project -- see IMPLEMENTATION-NOTES.md). Until then this
// Lambda detects the placeholder, logs it, writes a single
// RECONCILIATION_NOT_CONFIGURED marker row (so System Health can tell "never
// ran" apart from "ran clean"), and returns -- it does not fail loudly every
// night before RevenueCat is even connected.
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
const secretsClient = new SecretsManagerClient({});

const USERS_TABLE = process.env.USERS_TABLE;
const BILLING_EVENTS_TABLE = process.env.BILLING_EVENTS_TABLE;
const API_KEY_SECRET_ARN = process.env.REVENUECAT_API_KEY_SECRET_ARN;
const PLACEHOLDER_VALUE = "REPLACE_ME_MANUALLY_IN_CONSOLE";
const REVENUECAT_API_BASE = "https://api.revenuecat.com/v1";
const SYSTEM_PSEUDO_USER = "__SYSTEM__";
const ENTITLED_STATUSES = new Set(["active", "trialing", "paused"]);

async function apiKey() {
  if (!API_KEY_SECRET_ARN) return null;
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: API_KEY_SECRET_ARN }));
  const value = result.SecretString;
  if (!value || value === PLACEHOLDER_VALUE) return null;
  return value;
}

async function writeSystemEvent(eventType, payload) {
  const nowIso = new Date().toISOString();
  const eventId = crypto.randomUUID();
  await documentClient.send(new PutCommand({
    TableName: BILLING_EVENTS_TABLE,
    Item: {
      userId: SYSTEM_PSEUDO_USER,
      eventTimestampEventId: `${nowIso}#${eventId}`,
      eventId,
      eventTimestamp: nowIso,
      eventType,
      createdAt: nowIso,
      ...payload
    }
  }));
}

async function scanEntitledUsers() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await documentClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: "userId, subscriptionStatus, currentProductId, currentPeriodEndsAt, billingIssueSince",
      ExclusiveStartKey
    }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items.filter((u) => ENTITLED_STATUSES.has(u.subscriptionStatus));
}

// RevenueCat GET /v1/subscribers/{app_user_id} returns
// { subscriber: { entitlements: {...}, subscriptions: { [productId]: {...} } } }.
// We only need a coarse signal here: does RevenueCat currently consider this
// user entitled, and does their billing-issue state match ours. Full
// per-entitlement modeling isn't needed for drift detection.
async function fetchSubscriber(key, userId) {
  const response = await fetch(`${REVENUECAT_API_BASE}/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}` }
  });
  if (response.status === 404) return null; // RevenueCat has never seen this user -- itself a drift signal
  if (!response.ok) throw new Error(`RevenueCat subscriber lookup failed: ${response.status}`);
  return response.json();
}

function revenueCatSaysEntitled(subscriberPayload) {
  const entitlements = subscriberPayload?.subscriber?.entitlements || {};
  const now = Date.now();
  return Object.values(entitlements).some((e) => !e.expires_date || new Date(e.expires_date).getTime() > now);
}

function revenueCatSaysBillingIssue(subscriberPayload) {
  const subscriptions = subscriberPayload?.subscriber?.subscriptions || {};
  return Object.values(subscriptions).some((s) => Boolean(s.billing_issues_detected_at) && !s.unsubscribe_detected_at);
}

exports.handler = async () => {
  const key = await apiKey();
  if (!key) {
    console.log("billing reconcile: RevenueCat API key not configured yet, skipping (see handler.js header comment)");
    await writeSystemEvent("RECONCILIATION_NOT_CONFIGURED", { note: "nianza/revenuecat/api-key secret is still the placeholder -- connect a live RevenueCat project and paste the real key in to enable reconciliation." });
    return { ok: true, configured: false };
  }

  const users = await scanEntitledUsers();
  let driftCount = 0;

  for (const user of users) {
    let subscriber;
    try {
      subscriber = await fetchSubscriber(key, user.userId);
    } catch (err) {
      console.error(`billing reconcile: subscriber lookup failed for ${user.userId}`, err);
      continue; // don't let one API hiccup block the rest of the nightly run
    }

    const rcEntitled = subscriber ? revenueCatSaysEntitled(subscriber) : false;
    const ourEntitled = ENTITLED_STATUSES.has(user.subscriptionStatus);
    const rcBillingIssue = subscriber ? revenueCatSaysBillingIssue(subscriber) : false;
    const ourBillingIssue = Boolean(user.billingIssueSince);

    if (rcEntitled !== ourEntitled || rcBillingIssue !== ourBillingIssue) {
      driftCount += 1;
      await writeSystemEvent("RECONCILIATION_DRIFT", {
        driftUserId: user.userId,
        ourSnapshot: { subscriptionStatus: user.subscriptionStatus, billingIssueSince: user.billingIssueSince ?? null },
        revenueCatSaysEntitled: rcEntitled,
        revenueCatSaysBillingIssue: rcBillingIssue,
        note: subscriber ? "Entitlement or billing-issue state disagrees with RevenueCat." : "RevenueCat has no record of this app_user_id at all."
      });
    }
  }

  console.log(`billing reconcile: checked ${users.length} entitled users, found ${driftCount} drift`);
  return { ok: true, configured: true, checked: users.length, driftCount };
};
