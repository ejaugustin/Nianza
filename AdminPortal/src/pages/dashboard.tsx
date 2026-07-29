import { useQuery } from "@tanstack/react-query";
import { getMetrics, getBillingSummary } from "../api/admin";

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function DashboardPage() {
  const metricsQuery = useQuery({ queryKey: ["metrics", "all"], queryFn: () => getMetrics("all") });
  const metrics = metricsQuery.data;

  // NZA-ADMIN-v1.1 SS3 / DO NOT 4: this now reads the real RevenueCat-fed
  // pipeline (admin/billing/handler.js), not the old projected-from-status
  // estimate. billing.mrr === 0 with billingIssueCount === trialingCount ===
  // activeMonthlyCount === activeAnnualCount === 0 means "no webhook events
  // have landed yet" (RevenueCat not connected, or nothing sold since
  // connecting) -- that's the honest zero, not a broken query. The old
  // metrics.revenue projection still exists server-side (admin/metrics) but
  // is no longer rendered here now that real data exists.
  const billingQuery = useQuery({ queryKey: ["billing", "summary"], queryFn: getBillingSummary });
  const billing = billingQuery.data;
  const noBillingEventsYet = billing && billing.mrr === 0 && billing.activeMonthlyCount === 0 && billing.activeAnnualCount === 0 && billing.trialingCount === 0;
  const revenueCards: [string, string][] | null = billing
    ? [
        ["MRR", formatUsd(billing.mrr) + (billing.atRiskMrr > 0 ? ` (of which ${formatUsd(billing.atRiskMrr)} at risk)` : "")],
        ["ARR", formatUsd(billing.arr)],
        ["Monthly-plan subscribers", String(billing.activeMonthlyCount)],
        ["Annual-plan subscribers", String(billing.activeAnnualCount)],
        ["Trialing", String(billing.trialingCount)]
      ]
    : null;

  const cards: [string, string | number][] = metrics
    ? [
        ["Users", metrics.users.total],
        ["Active subscribers", metrics.users.active],
        ["Trialing", metrics.users.trialing],
        ["Content pending review", metrics.content.pendingReview],
        ["Content approved", metrics.content.approved],
        ["Reports generated (period)", metrics.reports.generatedThisPeriod],
        ["Children on file", metrics.children.total],
        ["New users (period)", metrics.users.newThisPeriod]
      ]
    : [
        ["Users", "..."],
        ["Active subscribers", "..."],
        ["Content pending review", "..."],
        ["Reports generated", "..."]
      ];

  return (
    <section>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Operational overview for Nianza launch readiness.</p>
      {metricsQuery.isError ? <div className="notice notice-error">Could not load metrics. The admin-metrics Lambda may not be deployed yet.</div> : null}

      <h2 className="section-title">Revenue</h2>
      {billingQuery.isError ? <div className="notice notice-error">Could not load billing data. The admin-billing Lambda may not be deployed yet.</div> : null}
      {revenueCards && billing ? (
        <>
          {noBillingEventsYet ? (
            <div className="notice">No RevenueCat billing events received yet. Real MRR/ARR will appear here once the webhook is connected and configured in RevenueCat's dashboard (Project Settings &gt; Integrations &gt; Webhooks) and at least one purchase or trial event has landed.</div>
          ) : (
            <div className="notice">
              Real billing data from RevenueCat. Pricing basis: ${billing.pricing.monthly}/mo or ${billing.pricing.annual}/yr.
            </div>
          )}
          <div className="card-grid">
            {revenueCards.map(([label, value]) => (
              <div className="card" key={label}>
                <div className="card-label">{label}</div>
                <div className="card-value">{value}</div>
              </div>
            ))}
          </div>
        </>
      ) : billingQuery.isLoading ? (
        <div className="notice">Loading revenue…</div>
      ) : null}

      <h2 className="section-title">Operations</h2>
      <div className="card-grid">
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="card-label">{label}</div>
            <div className="card-value">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
