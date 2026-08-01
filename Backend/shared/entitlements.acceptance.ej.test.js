// NZA-SUB-v1.0 Section 2/8.4 QA pass (Section 8.3 step 6): "verify a lapsed
// account retains full timeline/logging access with zero data loss or
// read-only lockout -- this is the one regression that would violate the
// guiding principle in Section 2." Pure-function checks only (resolveTier /
// capabilitiesForTier take no AWS dependency), matching the plain node
// `assert` acceptance-test pattern already used by mobile/chat/acceptance.ej.test.js
// rather than pulling in a DynamoDB mock for what's fundamentally logic
// coverage, not integration coverage.
//
// Run with: node Backend/shared/entitlements.acceptance.ej.test.js
// (Not yet wired into .github/workflows/checks.yml -- same as chat's
// acceptance test, this is a manual/local regression check today.)
const assert = require("node:assert/strict");
const {
  TIER_FREE,
  TIER_TRIAL,
  TIER_SUBSCRIBED,
  GRACE_PERIOD_DAYS,
  resolveTier,
  capabilitiesForTier
} = require("./entitlements");

function run() {
  const now = new Date("2026-08-01T12:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;

  // Section 2: "A lapsed subscriber keeps full, unlimited access to
  // everything they logged and everything Patricia already generated for
  // them." These four flags must be true on every tier, including free --
  // if any of these ever flip false for TIER_FREE, that's the exact
  // regression this test exists to catch.
  for (const tier of [TIER_FREE, TIER_TRIAL, TIER_SUBSCRIBED]) {
    const capabilities = capabilitiesForTier(tier);
    assert.equal(capabilities.canLogEvents, true, `canLogEvents must be true on ${tier}`);
    assert.equal(capabilities.canAccessTimeline, true, `canAccessTimeline must be true on ${tier}`);
    assert.equal(capabilities.canAccessReferenceContent, true, `canAccessReferenceContent must be true on ${tier}`);
    assert.equal(capabilities.canAccessPatriciaConversation, true, `canAccessPatriciaConversation must be true on ${tier}`);
  }

  // Every plausible "lapsed" shape resolves to TIER_FREE, never throws, and
  // never resolves to a tier that would somehow read as "even more locked"
  // than free -- free is the floor.
  const lapsedShapes = [
    { label: "no user row at all", user: null },
    { label: "no subscriptionStatus on file (mid-onboarding, never started trial)", user: {} },
    { label: "status: expired", user: { subscriptionStatus: "expired" } },
    { label: "status: paused", user: { subscriptionStatus: "paused" } },
    { label: "status: unknown/garbage value", user: { subscriptionStatus: "something-unexpected" } },
    {
      label: "trialing but trialEndsAt already passed",
      user: { subscriptionStatus: "trialing", trialEndsAt: new Date(now.getTime() - day).toISOString() }
    },
    {
      label: "active but billing issue outside the grace window",
      user: {
        subscriptionStatus: "active",
        billingIssueSince: new Date(now.getTime() - (GRACE_PERIOD_DAYS + 1) * day).toISOString()
      }
    }
  ];

  for (const { label, user } of lapsedShapes) {
    const tier = resolveTier(user, now);
    assert.equal(tier, TIER_FREE, `expected TIER_FREE for: ${label} (got ${tier})`);
    const capabilities = capabilitiesForTier(tier);
    assert.equal(capabilities.canLogEvents, true, `canLogEvents must survive: ${label}`);
    assert.equal(capabilities.canAccessTimeline, true, `canAccessTimeline must survive: ${label}`);
  }

  // Sanity check the inverse too: still-active states must NOT resolve to
  // free (guards against an overly-broad future edit to resolveTier that
  // accidentally free-tiers a paying subscriber).
  const stillGoodShapes = [
    {
      label: "trialing, trialEndsAt in the future",
      user: { subscriptionStatus: "trialing", trialEndsAt: new Date(now.getTime() + day).toISOString() },
      expected: TIER_TRIAL
    },
    {
      label: "active, no billing issue",
      user: { subscriptionStatus: "active" },
      expected: TIER_SUBSCRIBED
    },
    {
      label: "active, billing issue but still inside the grace window",
      user: { subscriptionStatus: "active", billingIssueSince: new Date(now.getTime() - 1 * day).toISOString() },
      expected: TIER_SUBSCRIBED
    }
  ];

  for (const { label, user, expected } of stillGoodShapes) {
    const tier = resolveTier(user, now);
    assert.equal(tier, expected, `expected ${expected} for: ${label} (got ${tier})`);
  }

  console.log("entitlements.acceptance.ej.test.js: all checks passed");
}

run();
