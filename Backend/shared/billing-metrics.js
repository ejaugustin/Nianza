// NZA-ADMIN-v1.1 SS3.3: fixed, documented, versioned metric definitions for
// real billing data. Shared between nianza-billing-lambda (which recomputes
// and caches this after every webhook event) and admin/billing/handler.js
// (which serves it to the portal, falling back to a live recompute if the
// cache is cold). Do not duplicate this math anywhere else -- if a metric
// needs to change, it changes here and every consumer picks it up.
//
// Pricing basis (Ej, July 2026): $9.99/mo, $99.99/yr. Annual normalizes to
// $99.99 / 12 = $8.3325/mo for MRR purposes. These are the same constants
// admin/metrics/handler.js uses for the old projected-revenue figure --
// intentionally not imported from there, since that module is legacy
// (pre-billing-webhook) and is expected to be retired once every consumer
// has moved to this real pipeline.
const PRICE_MONTHLY = 9.99;
const PRICE_ANNUAL = 99.99;
const PRICE_ANNUAL_MONTHLY_EQUIVALENT = Number((PRICE_ANNUAL / 12).toFixed(4));

const METRICS_VERSION = "2026-07-nza-admin-v1.1-s3.3";

function monthlyEquivalent(productId) {
  if (productId === "annual") return PRICE_ANNUAL_MONTHLY_EQUIVALENT;
  if (productId === "monthly") return PRICE_MONTHLY;
  return 0; // unknown product id -- don't guess a price, contribute $0 rather than inflate MRR
}

// users: array of nianza-users rows (subscriptionStatus, currentProductId,
// billingIssueSince, willRenew). Computes MRR/ARR/at-risk-MRR exactly per
// spec SS3.3:
//   - MRR sums active + billing-issue-grace subscriptions (trialing = $0).
//   - At-risk MRR is a SUBSET breakout of that same MRR (billingIssueSince
//     set), never additive -- a user is in both numbers or neither, never
//     double-counted, and leaves both simultaneously on EXPIRATION.
function computeBillingSummary(users) {
  let mrr = 0;
  let atRiskMrr = 0;
  let activeMonthlyCount = 0;
  let activeAnnualCount = 0;
  let trialingCount = 0;
  let billingIssueCount = 0;

  for (const user of users || []) {
    if (user.subscriptionStatus === "trialing") {
      trialingCount += 1;
      continue;
    }
    // "active" here covers both healthy-active and billing-issue-grace --
    // per spec, a user in grace retains entitlement and still contributes
    // to headline MRR; billingIssueSince is what routes them into the
    // at-risk breakout too.
    if (user.subscriptionStatus !== "active") continue;

    const contribution = monthlyEquivalent(user.currentProductId);
    mrr += contribution;
    if (user.currentProductId === "annual") activeAnnualCount += 1;
    else activeMonthlyCount += 1;

    if (user.billingIssueSince) {
      atRiskMrr += contribution;
      billingIssueCount += 1;
    }
  }

  mrr = Number(mrr.toFixed(2));
  atRiskMrr = Number(atRiskMrr.toFixed(2));

  return {
    version: METRICS_VERSION,
    mrr,
    arr: Number((mrr * 12).toFixed(2)),
    atRiskMrr,
    activeMonthlyCount,
    activeAnnualCount,
    trialingCount,
    billingIssueCount,
    pricing: { monthly: PRICE_MONTHLY, annual: PRICE_ANNUAL, annualMonthlyEquivalent: PRICE_ANNUAL_MONTHLY_EQUIVALENT }
  };
}

module.exports = { computeBillingSummary, monthlyEquivalent, PRICE_MONTHLY, PRICE_ANNUAL, PRICE_ANNUAL_MONTHLY_EQUIVALENT, METRICS_VERSION };
