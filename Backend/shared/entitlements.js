// NZA-SUB-v1.0 Section 8.1/8.3 step 1: the single source of truth every
// screen and API call reads from for trial/subscription state. Nothing
// outside this module should hardcode a subscription check -- callers ask
// "can this account do X" or "how many Patricia messages does it have left
// today," never "is subscriptionStatus === 'active'" directly, so gating
// logic only ever lives in one place (Section 8.1: "do not hardcode
// subscription checks per-screen").
//
// Reads/writes MobileUsersTable, the same table billing/webhook/handler.js
// already writes subscriptionStatus/trialStartedAt/trialEndsAt/
// currentPeriodEndsAt/billingIssueSince/willRenew onto (see that file's
// snapshotChangesFor()) -- this module is the read/interpret side of that
// same row, plus the Patricia message counter fields it owns itself
// (patriciaMessageDate, patriciaMessageCount).
//
// KNOWN GAP (flagged, not silently swallowed): Section 8.1 asks for the
// Patricia counter to reset "at local midnight per user timezone." No
// timezone field exists anywhere in the user/child profile schema today --
// onboarding never collects one. This resets at UTC midnight instead until
// a timezone field is added to the profile; a user near the UTC boundary
// may see their 3 free messages refresh a few hours off from their actual
// local midnight. Fixing this for real means adding a timezone to
// onboarding/profile, which is bigger than this task -- out of scope here,
// tracked as a follow-up.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const USERS_TABLE = process.env.USERS_TABLE;

const TIER_FREE = "free";
const TIER_TRIAL = "trial";
const TIER_SUBSCRIBED = "subscribed";

// Section 7: "recommend a short grace window (e.g. 3 days) with full
// functionality intact before dropping to free tier" on a billing-issue
// (card decline) renewal failure.
const GRACE_PERIOD_DAYS = 3;

// Section 5, Free Tier row-by-row. Trial and Subscribed are identical
// (Section 5 table: both columns read "Full"/"Unlimited" on every row) --
// only Free is actually restricted, so it's the only tier worth spelling
// out; trial/subscribed share one fully-open object.
const FREE_TIER_CAPABILITIES = {
  canLogEvents: true,
  canAccessTimeline: true,
  canAccessReferenceContent: true,
  dailyNotePersonalization: false,
  canAccessPatriciaConversation: true,
  patriciaMessageLimitPerDay: 3,
  canAccessDoctorVisitPack: false,
  canAccessProgressReports: false,
  canAccessMemoryHumanMoments: false,
  canAccessPatternSynthesis: false
};

const FULL_CAPABILITIES = {
  canLogEvents: true,
  canAccessTimeline: true,
  canAccessReferenceContent: true,
  dailyNotePersonalization: true,
  canAccessPatriciaConversation: true,
  patriciaMessageLimitPerDay: null, // null = unlimited
  canAccessDoctorVisitPack: true,
  canAccessProgressReports: true,
  canAccessMemoryHumanMoments: true,
  canAccessPatternSynthesis: true
};

function todayKey(now) {
  // UTC date key -- see the timezone gap note above.
  return now.toISOString().slice(0, 10);
}

/** Resolves a user row's raw billing snapshot fields into one of the three
 * product tiers, defensively -- not just trusting subscriptionStatus at
 * face value, since a webhook can lag behind reality by a few minutes
 * (RevenueCat is at-least-once, not instant), and a trial's real end could
 * arrive before TRIAL_CONVERTED/EXPIRATION does. */
function resolveTier(user, now) {
  if (!user) return TIER_FREE;

  const status = user.subscriptionStatus;

  if (status === "trialing") {
    if (user.trialEndsAt && new Date(user.trialEndsAt).getTime() <= now.getTime()) return TIER_FREE;
    return TIER_TRIAL;
  }

  if (status === "active") {
    if (user.billingIssueSince) {
      const graceDeadline = new Date(user.billingIssueSince).getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
      if (now.getTime() > graceDeadline) return TIER_FREE;
    }
    return TIER_SUBSCRIBED;
  }

  // "expired", "paused", missing/unknown status, or no row at all (never
  // started a trial, e.g. mid-onboarding) all land on the free tier --
  // Section 3's free tier is "the permanent state of a non-subscribed
  // account, not a second countdown," so there's no separate handling for
  // "never subscribed" vs "subscription lapsed."
  return TIER_FREE;
}

function capabilitiesForTier(tier) {
  return tier === TIER_FREE ? FREE_TIER_CAPABILITIES : FULL_CAPABILITIES;
}

async function getUserRow(userId) {
  if (!USERS_TABLE || !userId) return null;
  const result = await documentClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
  return result.Item || null;
}

/** The read-only entitlements snapshot a screen or API call checks before
 * doing anything gated. Does NOT consume a Patricia message -- see
 * recordPatriciaMessage for that (separate because reading entitlements
 * should never have a side effect). */
async function getEntitlements(userId, now = new Date()) {
  const user = await getUserRow(userId);
  const tier = resolveTier(user, now);
  const capabilities = capabilitiesForTier(tier);

  const limit = capabilities.patriciaMessageLimitPerDay;
  let usedToday = 0;
  if (limit !== null && user) {
    const key = todayKey(now);
    usedToday = user.patriciaMessageDate === key ? Number(user.patriciaMessageCount) || 0 : 0;
  }

  return {
    tier,
    capabilities,
    patricia: {
      limitPerDay: limit,
      usedToday,
      remainingToday: limit === null ? null : Math.max(0, limit - usedToday)
    },
    trialEndsAt: user?.trialEndsAt || null,
    subscriptionStatus: user?.subscriptionStatus || null
  };
}

/** Call this once, server-side, at the point a Patricia message is about to
 * be answered -- never client-side-only (Section 8.1: "client-only counters
 * are trivially bypassed"). Unlimited tiers (trial/subscribed) are a no-op
 * short-circuit: no table write, since there's nothing to enforce or track
 * for them here.
 *
 * Returns { allowed, remainingToday, limitPerDay }. When allowed is false,
 * the caller (mobile/chat/handler.js) should return the Section 6.3
 * "message cap reached" copy instead of invoking the model.
 *
 * Concurrency note: this is an optimistic increment with a same-day
 * conditional UpdateCommand, falling back to a reset-for-new-day
 * conditional UpdateCommand if the first one fails. It is not wrapped in a
 * DynamoDB transaction. For a single parent's own app sending their own
 * chat messages this is an acceptable tradeoff (matches the concurrency
 * assumptions the rest of this codebase makes -- see e.g. the
 * scan-then-write pattern in billing/webhook/handler.js's metrics cache);
 * two truly simultaneous requests from the same account could in the rare
 * case both succeed and slightly over-count. Not worth a transaction for a
 * cap this small and this low-stakes to overshoot by one.
 */
async function recordPatriciaMessage(userId, now = new Date()) {
  const entitlements = await getEntitlements(userId, now);
  const limit = entitlements.capabilities.patriciaMessageLimitPerDay;
  if (limit === null) return { allowed: true, remainingToday: null, limitPerDay: null };

  const key = todayKey(now);

  // Attempt 1: same-day increment, only succeeds if under the cap.
  try {
    const result = await documentClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "SET patriciaMessageCount = patriciaMessageCount + :one, updatedAt = :now",
      ConditionExpression: "patriciaMessageDate = :today AND patriciaMessageCount < :limit",
      ExpressionAttributeValues: { ":one": 1, ":today": key, ":limit": limit, ":now": now.toISOString() },
      ReturnValues: "ALL_NEW"
    }));
    const count = Number(result.Attributes.patriciaMessageCount) || 0;
    return { allowed: true, remainingToday: Math.max(0, limit - count), limitPerDay: limit };
  } catch (err) {
    if (err?.name !== "ConditionalCheckFailedException") throw err;
  }

  // Attempt 1 failed either because it's a new day (date mismatch) or the
  // cap is already hit (same day, count >= limit). Re-read to tell which.
  const fresh = await getUserRow(userId);
  const alreadyToday = fresh?.patriciaMessageDate === key;
  if (alreadyToday) {
    // Genuinely at the cap for today.
    return { allowed: false, remainingToday: 0, limitPerDay: limit };
  }

  // Attempt 2: first message of a new day -- reset-and-set-to-1, guarded so
  // a concurrent request can't double-reset (only succeeds if the date is
  // still stale by the time this runs).
  try {
    await documentClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "SET patriciaMessageDate = :today, patriciaMessageCount = :one, updatedAt = :now",
      ConditionExpression: "attribute_not_exists(patriciaMessageDate) OR patriciaMessageDate <> :today",
      ExpressionAttributeValues: { ":today": key, ":one": 1, ":now": now.toISOString() }
    }));
    return { allowed: true, remainingToday: Math.max(0, limit - 1), limitPerDay: limit };
  } catch (err) {
    if (err?.name !== "ConditionalCheckFailedException") throw err;
    // Lost the race to another request that reset the day first -- that
    // request's write already counts as today's message #1, so this one
    // is safely message #2 or later. Recurse once; the same-day branch
    // above will now apply correctly.
    return recordPatriciaMessage(userId, now);
  }
}

// NZA-SUB-v1.0 Section 3/6/8.3 step 4: Day 10 ("4 days left") and Day 14
// ("trial end / transition") are the only two trial touchpoints -- "Two
// touchpoints only... every day within the existing one-notification-per-day
// ceiling by construction." Each fires exactly once, tracked by a shown-at
// timestamp on the user's own row (trialDay10NoticeShownAt /
// trialDay14NoticeShownAt) so re-opening the app on day 11 doesn't re-show
// day 10's card, and so day 10 can never fire retroactively once the trial
// has already ended (see the `now < trialEndsAt` guard below).
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

// Section 6.1/6.2 copy, implemented verbatim per Section 8.4. {Name}/{Child}
// interpolation degrades the same way the home screen greeting fix does
// (Section 8.3 note): a missing name drops its clause/punctuation instead of
// leaving a dangling comma, rather than fabricating a placeholder like
// "there" that Patricia never actually said.
function day10Copy(parentFirstName, childName) {
  const namePrefix = parentFirstName ? `${parentFirstName}, ` : "";
  const child = childName || "your child";
  return {
    type: "day10",
    title: "4 days left",
    body: `${namePrefix}your free trial ends in 4 days. These first weeks with ${child} have been something — I'd love to stick around for what's next. Pick a plan below and I'm all yours.`,
    ctaLabel: "Choose a plan"
  };
}

function day14Copy(parentFirstName, childName) {
  const namePrefix = parentFirstName ? `${parentFirstName}, ` : "";
  const child = childName || "your child";
  return {
    type: "day14",
    title: "Trial ended",
    body: `${namePrefix}my full self needs a plan to keep going — I'm still here, just a little more limited for now. Your notes on ${child} are safe, and I can still chat a bit each day. Whenever you're ready, I'd love to be back at full strength.`,
    ctaLabel: "See plans",
    secondaryLabel: "Not now"
  };
}

/** Read-only: is a trial notice due right now, and if so which one. Never
 * marks it shown -- see acknowledgeTrialNotice, called only once the client
 * has actually rendered the card (or the equivalent push has been sent),
 * so a notice can't be silently consumed by a background fetch that never
 * reaches the user's eyes. */
async function getTrialNotice(userId, now = new Date(), { parentFirstName, childName } = {}) {
  const user = await getUserRow(userId);
  if (!user || !user.trialStartedAt) return { type: null };

  const trialStartedAt = new Date(user.trialStartedAt).getTime();
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt).getTime() : null;
  const nowMs = now.getTime();

  // Day 14 takes priority: once the trial has actually ended, day 10's
  // window is moot (see TEN_DAYS_MS guard below) so there's no ordering
  // ambiguity, but checking day 14 first keeps that explicit.
  if (trialEndsAt != null && nowMs >= trialEndsAt && !user.trialDay14NoticeShownAt) {
    return day14Copy(parentFirstName, childName);
  }

  if (
    trialEndsAt != null &&
    nowMs < trialEndsAt &&
    nowMs >= trialStartedAt + TEN_DAYS_MS &&
    !user.trialDay10NoticeShownAt
  ) {
    return day10Copy(parentFirstName, childName);
  }

  return { type: null };
}

/** Marks a trial notice as shown so it never fires again. Call this once,
 * after the card has actually been displayed (or dismissed) client-side --
 * mirrors recordPatriciaMessage's "side effect only on the real event"
 * shape. `type` must be "day10" or "day14"; anything else is a no-op. */
async function acknowledgeTrialNotice(userId, type, now = new Date()) {
  const field = type === "day10" ? "trialDay10NoticeShownAt" : type === "day14" ? "trialDay14NoticeShownAt" : null;
  if (!field || !USERS_TABLE || !userId) return { acknowledged: false };

  await documentClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: `SET ${field} = :now, updatedAt = :now`,
    ExpressionAttributeValues: { ":now": now.toISOString() }
  }));
  return { acknowledged: true };
}

module.exports = {
  TIER_FREE,
  TIER_TRIAL,
  TIER_SUBSCRIBED,
  GRACE_PERIOD_DAYS,
  resolveTier,
  capabilitiesForTier,
  getEntitlements,
  recordPatriciaMessage,
  getTrialNotice,
  acknowledgeTrialNotice
};
