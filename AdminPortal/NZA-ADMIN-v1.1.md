# Nianza Admin Console
### Management, Support & Insight Brief — Prioritized Specification

| | |
|---|---|
| **Document ID** | NZA-ADMIN-v1.1 |
| **Changelog** | v1.1 (July 27, 2026): audit protocol changed to intent-first for actions with external side effects (§4.3, §5.1); at-risk MRR definition disambiguated as a subset breakout, not additive (§3.3); scope-vs-date decision made explicit with a defined P0-minimal cut (§2.1); email dispatcher recorded as a pending shared-infra decision (§4.3, §6.1); open questions promoted to Decisions Required with recommendations (§13). v1.0: initial. |
| **Parent specs** | Nianza_Complete_Design_Brief_v2.md (v2.16) · NZA-REPORTS-v1.0 (July 21, 2026) + Addendum A |
| **Purpose** | Turn admin.nianza.com from a counter display into a working management tool: manage the business (real revenue), support customers (lookup, actions, compliance), and understand operations (funnels, engagement, cost). Every item is assigned a priority tier with an explicit gate definition. |
| **Pricing basis** | $9.99/month or $99.99/year after a 14-day free trial. Annual normalizes to $8.3325/month for MRR purposes. Products managed in RevenueCat. |
| **Priority model** | P0 = launch gate (ships before public launch, same tier as the growth-lms-en.json sourceVerifiedBy gate). P1 = first 30 days post-launch. P2 = growth phase, requires real usage history to be meaningful. |
| **Scope boundary** | Admin console (admin.nianza.com) only. No parent-facing app changes. Patricia's pattern-synthesis Tier 2 (Patricia speaking to parents from aggregated usage) remains NOT authorized — internal analytics in this brief are a separate, admin-only concern and do not feed Patricia's voice. |
| **Reviewer / gate** | Ej (eja@banxito.com). All P0 items block launch. P0 sign-off requires the Launch Readiness panel (Section 7) showing all-green. |
| **Date** | July 27, 2026 |

> This brief is organized by priority tier, then by feature. Each feature covers: what it changes at a glance (layer table), backend, admin frontend, and constraints to enforce. Infra naming follows existing conventions (nianza-* Lambdas and tables, us-east-1).

---

## 1. Context — What the Dashboard Is Today, and Isn't

The current admin dashboard renders twelve point-in-time counters: projected MRR/ARR (derived from subscriptionStatus counts, honestly disclaimed as not real billing), monthly/annual subscriber counts, users, active subscribers, trialing, content pending review, content approved, reports generated, children on file, and new users. Navigation stubs exist for Content, Users, Subscriptions, Notifications, Engagement, System Health, Data Exports, and Settings.

Three structural gaps prevent it from functioning as a management tool:

- **No truth.** Revenue is projected from status counts. Until RevenueCat events land in our own tables, MRR, ARR, churn, and conversion are all fiction, and no financial decision can be made from this screen.
- **No actions.** There is no way to look up a user, fix a subscription, extend a trial, process a refund, or answer a support email from this console. Every support interaction currently requires direct database access, which is unauditable and unscalable past one admin.
- **No why.** Every metric is a level with no slope. A manager cannot see whether "Users: 47" is growth or stall, whether trials convert, or whether Patricia — the product's stated fabric — is actually being used.

> The disclaimer on the current revenue section is the right instinct and stays in spirit: this console never presents derived or estimated numbers as billing truth. Once P0.1 ships, the disclaimer is removed because the numbers become real.

---

## 2. Priority Model

| Tier | Definition | Items |
|---|---|---|
| **P0** | Launch gate. The app does not go to public launch without these. Rationale: real billing is the financial nervous system; user lookup + audit log are the minimum viable support surface; the data-request workflow is a legal requirement for a product holding children's health data (COPPA/GDPR/CCPA). | P0.1 Real billing · P0.2 User lookup & account actions · P0.3 Audit log & roles · P0.4 Data-request workflow · P0.5 Launch Readiness panel |
| **P1** | First 30 days post-launch. These convert the console from record-keeping to management: funnels, trends, Patricia engagement, unit cost. Built against real event data flowing from P0.1. | P1.1 Trial funnel · P1.2 Trends & MRR waterfall · P1.3 Patricia engagement & unit cost · P1.4 Feature adoption · P1.5 System health substance · P1.6 Drill-down rule |
| **P2** | Growth phase. Only meaningful once months of real usage exist. Premature builds here would render empty charts and waste effort. | P2.1 Cohort retention · P2.2 LTV / CAC / ARPU & plan-mix economics · P2.3 Content ops latency |

Sequencing rule: P0.1 (billing events) is the data foundation for P1.1, P1.2, and all of P2. It is first in the build order regardless of any other consideration.

### 2.1 Scope vs. date — the decision this brief cannot make alone

P0 as written is five workstreams: a billing pipeline, a support console with money-moving actions, an audit log wired into every mutation, a deletion/export workflow, and a readiness panel. That is a large single gate, and the brief must be honest that it embeds an assumption: **P0 as written assumes the scope is fixed and the date bends.** If instead the launch date is fixed, the following P0-minimal cut is the pre-approved fallback — decided here so the build team never has to improvise it under deadline pressure:

| Tier | Contents | Rationale |
|---|---|---|
| **P0-minimal (date-fixed fallback)** | P0.1 billing pipeline (full — it is the foundation and cannot be cut) · P0.2 **read-only** user lookup (no actions) · P0.3 audit log covering reads and the deletion workflow · P0.4 **deletion path only** (export deferred ≤ 2 weeks post-launch, within the 30-day SLA of any request received at launch) · P0.5 readiness panel (cheap, keeps the gate visible) | Legal exposure (deletion) and financial truth (billing) are non-negotiable. Money-moving support actions (comp, refund, trial extension) are the deferrable slice: at launch volume, super_admin can handle the rare case via RevenueCat's own dashboard — which has its own audit trail — while the in-console actions land as fast-follow. |
| **Deferred to fast-follow (weeks 1–2)** | P0.2 actions (with the §4.3 intent-first protocol) · P0.4 export assembly | Both are additive to shipped foundations; neither blocks a customer-safe, legally compliant launch. |

**Decision required (§13, D1): fixed-date or fixed-scope.** Until answered, the build order in §11 proceeds unchanged, since steps 1–2 are identical under both answers.

---

## 3. P0.1 — Real Billing (RevenueCat Integration)

Replace projected revenue with actual billing events. RevenueCat is the source of truth for purchases across App Store and Play Billing; its webhooks feed a billing-events table we own, from which all revenue metrics are computed.

### 3.1 What it changes — at a glance

| Layer | What changes |
|---|---|
| **RevenueCat** | Webhook configured to POST all event types to our endpoint. Shared-secret Authorization header verified on every request. |
| **API** | New endpoint: `POST /v1/webhooks/revenuecat` (API Gateway, no Cognito — secret-header auth). Admin endpoints: `GET /v1/admin/billing/summary`, `GET /v1/admin/billing/events`, `GET /v1/admin/billing/failed-payments`. |
| **Lambda** | New: `nianza-billing-lambda`. Validates secret, dedupes by event id, writes event, updates the user's subscription snapshot, recomputes cached metrics. |
| **DynamoDB** | New table: `nianza-billing-events`. PK `userId`, SK `eventTimestamp#eventId`. Attributes: eventType, productId (monthly\|annual), price, currency, store, environment, expirationAt, raw payload pointer. GSI1: eventType (PK) + eventTimestamp (SK) for event-feed and metric queries. `nianza-users`: subscriptionStatus becomes webhook-driven, never client-reported; add currentProductId, currentPeriodEndsAt, billingIssueSince. |
| **Admin UI** | Revenue section: real MRR, real ARR, plan mix, live event feed (newest first), failed-payments queue with per-user drill-in. Projected-data disclaimer removed. |

### 3.2 Events consumed

INITIAL_PURCHASE, TRIAL_STARTED, TRIAL_CONVERTED, TRIAL_CANCELLED, RENEWAL, CANCELLATION, UNCANCELLATION, BILLING_ISSUE, PRODUCT_CHANGE, REFUND, EXPIRATION, SUBSCRIPTION_PAUSED. Every event is stored verbatim (raw payload archived to S3 `nianza-billing-raw/{userId}/{eventId}.json`) before any processing — replayability is a requirement, since metric definitions will evolve and must be recomputable from source.

### 3.3 Metric definitions (fixed, documented, versioned)

| Metric | Definition |
|---|---|
| **MRR** | Sum over active subscriptions: monthly plan contributes $9.99; annual plan contributes $99.99 / 12 = $8.3325. Trialing users contribute $0. Users in BILLING_ISSUE grace contribute their plan value but are counted separately as at-risk MRR. |
| **ARR** | MRR × 12. Displayed alongside, never as an independent calculation. |
| **Active subscribers** | Paid, current-period entitlement, not in trial. Split monthly / annual. |
| **At-risk MRR** | A **subset breakout of headline MRR, never additive to it**. Headline MRR includes users in BILLING_ISSUE grace (they retain entitlement and their payment usually recovers); at-risk MRR is the portion of that same headline attributable to users with billingIssueSince set. Dashboard renders it as "MRR $X, of which $Y at risk" with drill-in to the failed-payments queue. When a grace period lapses to EXPIRATION, the value leaves both numbers simultaneously via the churn event. No value is ever counted twice. |
| **Refund rate** | Refund events / initial purchases, trailing 30 days. |

> ⚠️ **Constraint:** the mobile client never writes subscriptionStatus. Client-side entitlement checks use RevenueCat SDK state for UX only; the server-side status set by nianza-billing-lambda is authoritative for everything else. Divergence between the two is itself a metric (entitlement drift) and appears in System Health.

---

## 4. P0.2 — User Lookup & Account Actions

The support surface. A support admin must be able to go from a customer email to a full account picture and a resolution action in under a minute, without touching DynamoDB directly.

### 4.1 What it changes — at a glance

| Layer | What changes |
|---|---|
| **API** | `GET /v1/admin/users/search?q=` (email prefix or userId) · `GET /v1/admin/users/{userId}` · `POST /v1/admin/users/{userId}/actions` (typed action payload) · `GET /v1/admin/users/{userId}/timeline` |
| **Lambda** | New: `nianza-admin-users-lambda`. Composes the account detail view from nianza-users, nianza-children, nianza-billing-events, and engagement timestamps. Executes actions, calling the RevenueCat REST API where billing is involved. |
| **DynamoDB** | `nianza-users`: GSI2 emailLower (PK) for exact/prefix email search. No new tables — this feature is a read-composition layer plus actions. |
| **Admin UI** | Users nav item becomes real: search bar, results list, account detail page with action buttons and an activity timeline. |

### 4.2 Account detail view — contents

- **Identity & plan.** Email, userId, signup date, platform (iOS/Android), app version, language, subscription status, product, current period end, trial dates, full billing-event history for this user.
- **Family shape.** Number of children and each child's age band (e.g., "14 months") — not names, not photos. Enough to support a customer; no more.
- **Engagement summary.** Last active date, milestones logged (count), reports generated (count), Doctor Visit Packs generated (count), notification deliveries last 7 days against the one-per-day ceiling.
- **Patricia metadata.** Conversation count, last conversation timestamp, voice vs. text counts. Metadata only — see the constraint below.

### 4.3 Actions (each one audit-logged, see P0.3)

| Action | Mechanism | Guard |
|---|---|---|
| Extend trial | RevenueCat REST: grant promotional entitlement for N days | Max 30 days per grant; super_admin approval above 30 |
| Comp subscription | RevenueCat promotional entitlement (1–12 months) | super_admin only |
| Refund | Deep link to store-appropriate refund flow (App Store server API where available; Play refund via RevenueCat); record outcome | Reason code required, free-text note required |
| Cancel at period end | RevenueCat REST cancellation | Confirmation dialog with period-end date shown |
| Resend receipt | Trigger via the email infra selected in §13 D5 (new emailType: receipt_resend) | Rate limit 3/day/user |
| Trigger data request | Opens the P0.4 workflow pre-filled for this user | — |

### 4.3.1 Audit protocol for actions with external side effects — intent-first

A single "action + audit in one transaction" model breaks for actions that call RevenueCat first: once the external call succeeds, money has moved or entitlement has been granted, and a subsequent audit-write failure would leave a real-world side effect with no trail — the exact scenario the audit system exists to prevent. External APIs cannot participate in our transaction, so the protocol inverts:

1. **Write intent.** Audit row written with status `intent`, capturing actor, action, target, and full parameters — **before** any external call. If this write fails, the action never starts. No intent row, no RevenueCat call, ever.
2. **Execute.** The external call runs, passing the audit row's id as the RevenueCat idempotency key where the API supports it, so a retry after a crash cannot double-execute.
3. **Confirm.** Audit row updated to `succeeded` (with the external response reference) or `failed` (with the error).
4. **Sweep.** A scheduled sweeper (`nianza-audit-sweeper`, every 15 minutes) flags any `intent` row older than 5 minutes as `unconfirmed`, alerts super_admin, and reconciles against the RevenueCat API to determine whether the side effect actually occurred.

The worst remaining case is an action recorded as `unconfirmed` pending reconciliation — an honest state — rather than an un-audited side effect. Purely internal actions (notes, data-request intake) keep the simpler same-transaction model. Status transition `intent → succeeded | failed | unconfirmed` is append-only like everything else in the log: transitions are new rows referencing the intent id, so the original intent is never mutated.

> **Infra note (pending decision, §13 D5):** receipt-resend here and data-export delivery in §6.1 route through `claricito-email-dispatcher`. That is Claricito's cross-account infra, deliberately reused so far — but given the account/region confusion that has already occurred between the two projects, this brief does not treat the reuse as settled. Alternative: a `nianza-email-lambda` + SES identity owned entirely by the Nianza stack. Two emailTypes is a small surface; migrating later is cheap, but the decision should be recorded either way.

> ⚠️ **Privacy constraint (record as Admin DO NOT 1):** Patricia conversation transcripts are never viewable in the admin console, under any role, ever. Parents confide in Patricia — sleep struggles, postpartum feelings, fears about their child. The moment a support admin can read that, the trust the entire product is built on is gone. Support works from metadata (counts, timestamps, modality). Reasoning recorded so future stakeholders meet the argument, not just the rule.

> ⚠️ **Privacy constraint (record as Admin DO NOT 2):** child names and photos never render in admin list views or detail views. Age bands and counts only. The admin console holds the least child data that still lets a human help a customer.

---

## 5. P0.3 — Audit Log & Admin Roles

Every admin mutation is recorded immutably. The console currently has one super_admin; the audit log ships before the second admin account exists, not after. For a product holding children's health data, "who looked at what and who changed what" is table stakes.

### 5.1 What it changes — at a glance

| Layer | What changes |
|---|---|
| **DynamoDB** | New table: `nianza-audit-log`. PK date (YYYY-MM-DD), SK `timestamp#actorId#actionId`. Attributes: actorId, actorRole, action, targetUserId, targetResource, payload summary, outcome, sourceIp. Point-in-time recovery ON. No delete or update permission in any IAM policy — append-only by construction. |
| **Lambda** | Two protocols, chosen by action type. **Internal-only actions** (no external side effect): audit write is a step of the action's own transaction — if it fails, the action fails. **Actions with external side effects** (anything touching RevenueCat or sending email): the intent-first protocol of §4.3.1 — intent row before the external call, confirmation after, sweeper reconciliation for anything left unconfirmed. In both protocols the invariant holds: no side effect can exist without an audit row preceding it. New: `nianza-audit-sweeper` (scheduled, 15 min). |
| **Roles** | Three roles in the admin Cognito pool: **super_admin** (all actions), **support** (lookup + trial extension + receipt resend + data-request intake), **read_only** (view everything except account detail actions). Role checked server-side per endpoint. |
| **Admin UI** | Audit viewer under Settings: filter by actor, target user, action type, date range. Sensitive account views (opening a user detail page) are themselves logged as read events. |

> Design decision: account-detail page views are logged as read events. This is deliberate friction — support admins should know that looking at a family's account leaves a trace. It protects customers and protects admins.

---

## 6. P0.4 — Data-Request Workflow (COPPA / GDPR / CCPA)

Deletion and export requests get a tracked workflow with SLA visibility, not an email inbox. This is the same tier as the growth-lms-en.json verification gate: a legal-exposure item that blocks launch.

### 6.1 What it changes — at a glance

| Layer | What changes |
|---|---|
| **Intake** | Two doors: (a) parent-initiated from the app's existing account-deletion path — no change to the parent UX; (b) admin-initiated from the user detail page (email/legal requests arrive out-of-band and are entered here). |
| **DynamoDB** | New table: `nianza-data-requests`. PK requestId, SK static. Attributes: userId, type (delete\|export), source, receivedAt, dueAt (receivedAt + 30 days), status (received \| in_progress \| completed \| verified), completedAt, verifiedBy. GSI1: status (PK) + dueAt (SK) for the SLA board. |
| **Deletion** | Reuses `nianza-account-deletion-lambda` (already deletes all S3 objects under the userId prefix and all table rows). Adds: RevenueCat subscriber deletion call, billing-events tombstone (financial records retained as required, de-identified), and a completion write-back to nianza-data-requests. |
| **Export** | New export assembly in the same Lambda: JSON bundle of profile, children, milestones, encounters, reports metadata, and Patricia conversation history (the parent owns their transcripts — export includes them even though admin viewing never does). Delivered via time-limited presigned S3 URL emailed through the email infra selected in §13 D5 (new emailType: data_export_ready). |
| **Admin UI** | Data Requests board: open requests sorted by dueAt, color state at 20+ days, completion requires a named verifier. Fully audit-logged. |

> ⚠️ **SLA:** 30 calendar days from receipt to completion, tracked automatically. A request at 20 days without completion escalates to super_admin. Nothing about this workflow is optional at launch — a kids' product that cannot execute a deletion request on day one is not launch-ready.

---

## 7. P0.5 — Launch Readiness Panel

The dashboard subtitle already promises "launch readiness" — this panel makes the page honest to its own tagline. A checklist section at the top of the dashboard, each item red/green, each item linking to its evidence. Launch sign-off (Ej) requires all-green.

| Gate item | Green means | Evidence link |
|---|---|---|
| Billing live | RevenueCat webhook verified end-to-end in prod; a sandbox INITIAL_PURCHASE appears in the event feed | Billing event feed |
| growth-lms-en.json verified | sourceVerifiedBy is non-null; verifier and date recorded | Content > data sources |
| Data-request workflow tested | One full deletion and one full export executed and verified in staging | Data Requests board |
| Audit log live | Admin actions in staging produce audit rows; append-only IAM confirmed | Audit viewer |
| Roles enforced | support role verified unable to comp subscriptions or view audit log | Settings > roles |
| Store review status | App Store / Play review state, manually updated | Settings > launch |

> The panel is cheap to build (static checklist with links and manual/automatic state) and disproportionately valuable: it is the single screen that answers "can we launch?"

---

## 8. P1 — First 30 Days Post-Launch

P1 converts real event data into management views. All P1 items consume the P0.1 event stream and existing app telemetry; none require new parent-facing instrumentation beyond what already exists, except where noted.

### 8.1 P1.1 — Trial funnel

With a 14-day trial at $9.99/$99.99, trial-to-paid conversion is the single number that decides whether Nianza works as a business. The funnel view: trial starts → active-in-trial (used app in last 7 days) → converted, with conversion rate, median time-to-convert, and cancellation timing (day-of-trial histogram — cancellations clustering at day 1 vs. day 13 are different problems).

- **Onboarding sub-funnel.** B3.5 (Patricia-voiced onboarding questions) completion and per-question skip rates, onboarding completion overall, and first-week activation (defined as: logged at least one event or had one Patricia conversation within 7 days of signup). Definition is written down here so it never silently drifts.

### 8.2 P1.2 — Trends & MRR waterfall

- **Sparklines everywhere.** Every dashboard card gains a 30-day sparkline and a WoW delta. Levels become slopes.
- **MRR waterfall.** Monthly view: starting MRR + new + reactivation − churned − refunded = ending MRR. Computed from billing events, recomputable from the raw archive.
- **Churn, both kinds.** Logo churn and revenue churn, monthly and annual cohorts separated — annual churn is invisible for 12 months, so annual renewal tracking is set up now even though it renders empty until mid-2027.

### 8.3 P1.3 — Patricia engagement & unit cost

If Patricia is the fabric, Patricia engagement is the leading indicator of retention and must be on the front page: conversations per active user per week, voice vs. text ratio, entry-point split (floating button vs. contextual entry), median conversation length, and daily-note TTS playback rate.

- **Unit cost.** Cost per conversation (Anthropic tokens + Deepgram minutes, from provider usage APIs) and cost per active user per month. At $9.99, Patricia's marginal cost directly attacks gross margin; this number gets a card and an alert threshold. A heavy voice user costs measurably more than a light text user, and pricing decisions later (P2.2) need this distribution, not just the mean.

> ⚠️ **Scope reminder (Admin DO NOT 3):** these are admin-only aggregates. They do not feed Patricia's conversational register. Pattern-synthesis Tier 2 — Patricia speaking to parents from aggregated real usage — remains unauthorized and is a separate future decision with its own brief. Internal analytics and Patricia's voice are firewalled by design.

### 8.4 P1.4 — Feature adoption (denominators)

Raw counts gain denominators: % of active users who have logged a milestone, generated any report, generated a Doctor Visit Pack, recorded a voice capsule or child recording, created a custom first. "Reports generated: 11" becomes "11 reports across 8 of 40 eligible users (20%)". Adoption below expectation is the roadmap's steering signal.

### 8.5 P1.5 — System health with substance

- API error rates and p95 latency per Lambda (CloudWatch-derived), Anthropic and Deepgram error/latency split out — a Patricia outage is a product outage.
- Notification delivery: sends, delivery failures, and ceiling compliance — the one-per-day ceiling is asserted by the guidance scheduler; this view verifies it empirically (any user with 2+ sends in a day is a bug, surfaced by day, not user identity).
- Entitlement drift (client RevenueCat state vs. server subscriptionStatus) as defined in P0.1.

### 8.6 P1.6 — Drill-down rule

Standing rule, applies to every card present and future: every number links to the filtered list behind it. "Content pending review: 3" opens the review queue; "At-risk MRR" opens the failed-payments queue; "Trialing: 12" opens those users. A dashboard that is all display and no drill-down sends managers back to the database, which defeats the console's purpose.

---

## 9. P2 — Growth Phase

### 9.1 P2.1 — Cohort retention

Two cohort axes, both rendered as classic retention triangles once 3+ months of data exist:

- **By signup month.** Standard subscription retention — the health check every subscription business runs.
- **By child age at signup.** The strategically decisive view for a birth-to-5 product: do families churn when the baby sleeps through the night? At 18 months? At preschool entry? The answer determines whether Nianza is a 6-month product or a 5-year product, which changes LTV math, content investment, and whether the 0–5 promise needs mid-journey re-engagement features. No other single chart changes strategy more.

### 9.2 P2.2 — Unit economics

| Metric | Definition |
|---|---|
| **ARPU** | MRR / active subscribers, trended monthly. |
| **LTV** | ARPU × average subscriber lifetime (from observed churn once churn stabilizes; explicitly labeled "insufficient data" until then rather than rendering a fabricated number — same honesty rule as the old projected-revenue disclaimer). |
| **CAC** | Marketing spend (manual monthly entry in Settings until ad platforms are integrated) / new paid subscribers. LTV:CAC ratio card. |
| **Plan mix economics** | Monthly→annual upgrade rate and prompts' effectiveness. Annual at $99.99 is a ~16.6% discount that eliminates months-3-through-12 churn risk; the console shows breakeven math (annual beats monthly retention whenever expected monthly lifetime < 10.0 months) against observed churn, so the upgrade-nudge decision is made on data. |
| **Annual renewals** | First annual renewal cohort arrives ~mid-2027; the tracking exists from P1.2 and lights up here. |

### 9.3 P2.3 — Content ops latency

Beyond pending/approved counts: median time from content submission to review decision, review throughput per week, and age of oldest pending item. Keeps the content pipeline honest as volume grows.

---

## 10. Admin DO NOTs (Recorded with Reasoning)

Continuing the design brief's convention: declined capabilities are recorded with their argument, so future stakeholders meet the reasoning, not just the rule.

| # | DO NOT | Reasoning |
|---|---|---|
| 1 | Never render Patricia conversation transcripts in the admin console, under any role. | Parents confide in Patricia. Admin-readable transcripts destroy the trust the product is built on and create an unbounded privacy liability. Support operates on metadata only. (The parent's own data export includes their transcripts — they own them; we don't browse them.) |
| 2 | Never render child names or photos in admin views. | Least-data principle for a children's product. Age bands and counts are sufficient for every support scenario identified; anything more is exposure without benefit. |
| 3 | Never feed admin analytics into Patricia's conversational register. | Pattern-synthesis Tier 2 is a separate, unauthorized decision. Silent leakage of aggregate usage into Patricia's voice would ship Tier 2 without the deliberate review it requires. |
| 4 | Never present derived or estimated figures as billing truth. | The v1 dashboard's own disclaimer, promoted to permanent principle. Estimates are labeled (see LTV's "insufficient data" state); real numbers come from real events. |
| 5 | Never allow un-audited admin mutations. | For internal actions, the audit write is part of the action transaction. For actions with external side effects, an intent row precedes the external call (§4.3.1) — no intent, no call. Either way: an action that can't be logged doesn't happen, and the worst reachable state is `unconfirmed`, never unrecorded. |

---

## 11. Build Order

| Step | Item | Depends on |
|---|---|---|
| 1 | nianza-billing-events table + nianza-billing-lambda + RevenueCat webhook (P0.1 backend) | — |
| 2 | nianza-audit-log table + role model in admin Cognito pool (P0.3) | — (parallel with 1) |
| 3 | User lookup & account detail, read-only (P0.2 views) | 1, 2 |
| 4 | Account actions with audit transaction (P0.2 actions) | 3 |
| 5 | Data-request workflow (P0.4) | 2; deletion path reuses existing Lambda |
| 6 | Real revenue dashboard section + event feed + failed-payments queue (P0.1 UI) | 1 |
| 7 | Launch Readiness panel (P0.5) | 1–6 to have anything to show |
| 8 | P1 items in order 1.2 → 1.1 → 1.3 → 1.6 → 1.4 → 1.5 | Launch + real data flowing |
| 9 | P2 items as data matures | 3+ months post-launch |

## 12. Risk Register

| Risk | Exposure | Mitigation |
|---|---|---|
| Webhook loss or duplication | MRR silently wrong — worst kind of wrong | Dedupe on event id; raw archive to S3 before processing; nightly reconciliation job comparing RevenueCat subscriber API against our snapshot, drift surfaced in System Health |
| Refund/entitlement actions hit real money | Support mistakes cost revenue or goodwill | Guards per action (§4.3), intent-first audit protocol (§4.3.1), idempotency keys on external calls, super_admin ceiling on comps |
| External side effect succeeds, audit confirmation fails | Money moved with an incomplete trail | Intent row exists before the call by construction (§4.3.1); sweeper reconciles unconfirmed intents against RevenueCat within 15 minutes; unconfirmed count surfaced in System Health |
| Deletion pipeline misses a store | COPPA/GDPR exposure | Deletion completion requires named verifier; staging test is a Launch Readiness gate item; new tables added to the app must register with the deletion Lambda (checklist item in every future brief) |
| Cost-per-conversation blindness | Patricia usage grows, margin quietly erodes | P1.3 unit-cost card with alert threshold; provider usage APIs polled daily |
| Analytics scope creep into Patricia | Tier 2 ships accidentally | DO NOT 3 + firewall: admin analytics Lambdas have no write path to any table Patricia reads |

## 13. Decisions Required Before Build (with Recommendations)

These are decisions for Ej, not the build team. Each carries a recommendation so nothing is left to be guessed at under deadline; the recommendation stands as the default unless overridden at sign-off.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | **Fixed date or fixed scope?** (§2.1) | If undecided by the time step 3 of the build order starts, default to **fixed-date with the P0-minimal cut**. | Steps 1–2 are identical either way, so the decision has a real deadline, not an immediate one. The minimal cut was designed to be safe to fall back to; full P0 was not designed to be safe to rush. |
| D2 | CAC entry method | **Manual monthly entry in Settings.** Defer ad-platform integration; do not defer CAC itself. | One number a month is trivial effort, and an LTV:CAC card with a manually entered denominator beats no card. Labeled "manually entered" per DO NOT 4. |
| D3 | Refund stance | **Reactive only at launch.** Failed-payments queue notifies the user (dunning email via the dispatcher decision D5) but never proactively offers refunds. | Proactive refund offers train refund-seeking behavior and complicate the queue before there's data on recovery rates. Revisit with 90 days of billing-issue recovery data. |
| D4 | Parent-facing deletion SLA visibility | **Show it.** The confirmation screen says deletion completes within 30 days, and the completion email confirms when done. | Matches the product's honesty posture (zero-interpretation, honest disclaimers). Silent-but-faster sounds better until a deletion takes 9 days and the parent has no expectation set. |
| D5 | Email infra: `claricito-email-dispatcher` vs. Nianza-native | **Confirm shared dispatcher deliberately, or approve `nianza-email-lambda` + SES.** Weak preference: Nianza-native, given the cross-project account/region confusion already experienced and the small surface (two emailTypes) making now the cheapest moment to separate. | Whichever way, the reasoning gets recorded here — this is exactly the kind of quiet infra coupling that becomes expensive precisely when it's least convenient. |
| D6 | Second admin hire timing | No product decision needed — **role model ships at launch regardless** (it's a P0.3 gate item). Support-role UX polish trails to match hire timing. | Enforcement server-side is the security boundary; polish is cosmetic and schedulable. |

---

*Nianza · NZA-ADMIN-v1.1 · July 27, 2026*
