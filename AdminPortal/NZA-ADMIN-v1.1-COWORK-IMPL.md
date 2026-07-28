# NZA-ADMIN-v1.1 — Cowork Implementation Instructions

| | |
|---|---|
| **Document ID** | NZA-ADMIN-v1.1-COWORK-IMPL (v1.0) |
| **Parent spec** | NZA-ADMIN-v1.1 (July 27, 2026) — the WHAT and WHY. This document is the HOW. Where they conflict, the parent spec wins and the conflict gets logged (see Deviation Protocol). |
| **Executor** | Claude Cowork, working against the Nianza repos and AWS account (us-east-1) |
| **Baseline** | The admin portal that already exists at admin.nianza.com: React 18 + Vite SPA, Tailwind, TanStack Table v8, Recharts, React Router v6, Axios + React Query, AWS Amplify Auth against `nianza-admin-pool` (TOTP MFA), deployed S3 (`nianza-admin-portal-prod`) + CloudFront, CodePipeline CI/CD. Existing screens include /login, / (dashboard), /content, /content/:contentId. Existing tables include `nianza-admin-audit-log` and `nianza-admin-sessions`. Existing roles include at least super_admin and content_editor. |
| **Mission** | Implement P0 of NZA-ADMIN-v1.1 by EXTENDING this portal — not rebuilding it, not scaffolding a second one. |
| **Date** | July 27, 2026 |

---

## 0. Ground Rules (read before writing any code)

1. **Extend, never fork.** Every feature lands inside the existing SPA, the existing API Gateway, the existing Cognito pool, and the existing CI/CD pipeline. If you find yourself running `npm create vite` or making a new user pool, stop — you've gone wrong.
2. **The spec's abstract names yield to the portal's real names.** NZA-ADMIN-v1.1 was written before this baseline was fully reconciled. Known reconciliations are listed in §1.3; you will find more. The rule: reuse the existing resource, keep its name, and record the mapping in IMPLEMENTATION-NOTES.md.
3. **Deviation Protocol.** Maintain `IMPLEMENTATION-NOTES.md` at the repo root of the admin portal. Every deviation from NZA-ADMIN-v1.1 — naming, schema, sequencing, anything — gets a dated entry: what the spec said, what you did, why. Ej reviews this file at each phase gate. Never silently deviate.
4. **The five Admin DO NOTs are hard constraints**, enforced in code, not convention:
   - **DO NOT 1:** No code path renders Patricia conversation transcripts in the portal. No API endpoint returns transcript content to the portal. Metadata only (counts, timestamps, modality).
   - **DO NOT 2:** No child names or photos in any portal view or any admin API response. Age bands and counts only. If an existing shared model/serializer includes child names, write an admin-specific serializer that strips them.
   - **DO NOT 3:** Admin analytics Lambdas get NO IAM write permission to any table Patricia's chat Lambda reads. Verify this in the IAM policy diff of every phase.
   - **DO NOT 4:** No derived/estimated figure is presented as billing truth. Estimated values carry a visible label in the UI.
   - **DO NOT 5:** No un-audited mutation. Internal actions: audit write in the same transaction. External side effects: intent-first protocol (§3.2). If the audit write fails, the action fails or never starts.
5. **Decision defaults D1–D6 from NZA-ADMIN-v1.1 §13 apply as written.** In particular: D3 reactive-only refunds, D4 parent-facing SLA is shown, D5 email defaults to **Nianza-native** (`nianza-email-lambda` + SES) unless Ej has confirmed the shared dispatcher by the time you reach Phase 4 — check IMPLEMENTATION-NOTES.md for an override entry before building.
6. **One PR per numbered step below**, branch naming `nza-admin/p0-<step>`, PR description links the spec section it implements. CI must be green before merge; CodePipeline deploys from main.
7. **Production is the only portal environment** (per the original portal brief: no staging portal). Therefore: backend Lambdas and tables get tested against dev/sandbox resources (RevenueCat sandbox, test Cognito users); frontend changes ship behind role checks and, where risky, a `?preview=` flag until the phase gate.

---

## 1. Phase 0 — Discovery & Verification (no code until this is done)

Cowork's first session produces a single artifact: `DISCOVERY.md`, committed to the repo. Do not trust this document's baseline blindly — verify it.

### 1.1 Repo & frontend verification
- Locate the admin portal source (likely `admin/` subdirectory of the main repo or its own repo — check both). Confirm: Vite config, React Router route table, Amplify Auth config, React Query usage, the existing dashboard component that renders the current cards (find where "Projected MRR" and the disclaimer text live — you will replace this in Phase 5).
- Inventory existing routes and components. Map each existing nav item (Dashboard, Content, Users, Subscriptions, Notifications, Engagement, System Health, Data Exports, Settings) to its component and note which are stubs vs. functional.
- Confirm the CI/CD path: buildspec, pipeline name, CloudFront distribution ID.

### 1.2 AWS verification (read-only pass)
- List all `nianza-*` DynamoDB tables with their key schemas and GSIs. Specifically capture the ACTUAL schema of `nianza-admin-audit-log` and `nianza-users` (attributes, GSIs) — Phase 1 and 2 build on these.
- List all `nianza-*` Lambdas and API Gateway routes. Identify the admin API's Gateway instance, its authorizer, and how role checks are currently enforced server-side.
- Dump the current groups/roles in `nianza-admin-pool` and the IAM policy attached to `nianza-admin-lambda-role`.
- Confirm `nianza-account-deletion-lambda` exists and read its current deletion coverage (which tables/prefixes it touches) — Phase 4 extends it.
- Confirm whether any RevenueCat webhook endpoint already exists (it should not, per the dashboard's own disclaimer, but verify).

### 1.3 Known reconciliations (spec name → real name)
| NZA-ADMIN-v1.1 says | Reality | Instruction |
|---|---|---|
| New table `nianza-audit-log` | `nianza-admin-audit-log` already exists | EXTEND the existing table: keep its name and key schema; add the new attributes and status-transition rows the intent-first protocol needs (§3.2). Do not create a second audit table. |
| Three roles: super_admin, support, read_only | Pool already has super_admin, content_editor, possibly others | ADD `support` and `read_only` groups. Leave `content_editor` untouched — it is out of this brief's scope. Update the server-side role matrix, don't replace it. |
| "Audit viewer under Settings" | Portal already has audit history on content items | Build the global audit viewer as specified, but reuse any existing audit-rendering components. |
| `claricito-email-dispatcher` for emails | D5 default: Nianza-native | Build `nianza-email-lambda` + SES identity (Phase 4) unless IMPLEMENTATION-NOTES.md contains an Ej override confirming the shared dispatcher. |

### 1.4 Phase 0 exit gate
`DISCOVERY.md` committed, containing: route/component inventory, table schema dump, Lambda/API inventory, role/IAM dump, the reconciliation table above extended with anything new you found, and a list of surprises. **Ej reviews before Phase 1 begins.**

---

## 2. Phase 1 — Billing Pipeline (P0.1 backend) — build order step 1

### 2.1 Secrets & config
- Store the RevenueCat webhook shared secret in AWS Secrets Manager: `nianza/revenuecat/webhook-secret`. Store the RevenueCat REST API key (needed in Phase 3) as `nianza/revenuecat/api-key`. Never in env vars committed to the repo, never in SSM plaintext.

### 2.2 Storage
- S3 bucket `nianza-billing-raw` — versioning ON, SSE ON, no public access, lifecycle: none (raw events are kept indefinitely for replayability).
- DynamoDB `nianza-billing-events` exactly per spec §3.1: PK `userId`, SK `eventTimestamp#eventId`, GSI1 `eventType` (PK) + `eventTimestamp` (SK). PAY_PER_REQUEST, encryption at rest, point-in-time recovery ON.
- `nianza-users` additions (new attributes, no migration needed for existing rows — they're absent until written): `currentProductId`, `currentPeriodEndsAt`, `billingIssueSince`. subscriptionStatus becomes webhook-authoritative from this phase forward.

### 2.3 `nianza-billing-lambda`
Handler order, non-negotiable:
1. Verify the Authorization header against the Secrets Manager secret. Fail → 401, log to CloudWatch, no further processing.
2. Archive the raw payload to `nianza-billing-raw/{userId}/{eventId}.json` BEFORE any parsing beyond extracting userId/eventId. Archive failure → 500 (RevenueCat retries; we never process an event we didn't archive).
3. Dedupe: conditional write on the event row keyed by eventId. Duplicate → 200 (acknowledge, skip).
4. Write the event row; update the user's subscription snapshot (status, productId, period end, billingIssueSince set/cleared per event type).
5. Recompute cached metrics (MRR, at-risk MRR per the §3.3 definitions — at-risk is a SUBSET of headline, "MRR $X of which $Y at risk", never additive).
6. Return 200. Total handler budget: keep p95 under 3s so RevenueCat doesn't time out.

- API Gateway: `POST /v1/webhooks/revenuecat`, NO Cognito authorizer on this one route (secret-header auth only).
- Event types handled: the full §3.2 list. Unknown event types: archive, log, 200, skip processing (forward-compat).

### 2.4 Reconciliation job
- `nianza-billing-reconcile` Lambda, EventBridge schedule nightly 03:00 ET. Pages the RevenueCat subscriber API, diffs against our snapshots, writes drift findings to a `nianza-billing-events` row of type `RECONCILIATION_DRIFT` and surfaces count via the System Health endpoint (Phase 5 renders it).

### 2.5 Phase 1 acceptance
- RevenueCat SANDBOX wired to the prod endpoint (sandbox events carry `environment: SANDBOX` — store them, exclude them from all metric computation).
- Test script proves: sandbox INITIAL_PURCHASE → archived to S3, row in table, user snapshot updated, MRR recompute correct for both products ($9.99 monthly; $99.99 annual → $8.3325/mo). Duplicate delivery → single row. Bad secret → 401 + no side effects.
- IAM check per DO NOT 3: `nianza-billing-lambda`'s role has NO write access to any Patricia-read table.

---

## 3. Phase 2 — Audit Extensions & Roles (P0.3) — build order step 2, parallel with Phase 1

### 3.1 Roles
- Add Cognito groups `support` and `read_only` to `nianza-admin-pool`.
- Server-side role matrix (single source of truth — one module the API layer imports; the frontend mirrors it for hiding, never for enforcement):
  - `super_admin`: everything.
  - `support`: user search/detail (read), trial extension ≤30 days, receipt resend, data-request intake. NOT: comps, refunds, cancellations, audit viewer, role management.
  - `read_only`: all read views EXCEPT user account detail. No actions.
  - `content_editor`: unchanged, untouched.

### 3.2 Intent-first audit protocol (extends `nianza-admin-audit-log`)
- New attributes on audit rows: `status` (`intent` | `succeeded` | `failed` | `unconfirmed` | n/a for plain reads), `intentId` (self for intent rows; referenced by transition rows), `externalRef` (RevenueCat response id etc.), `params` (action parameters, with anything sensitive redacted).
- **Transitions are new rows referencing the intentId — the intent row is never mutated.** Append-only is preserved by construction.
- Shared library `auditClient` (one module used by every admin Lambda):
  - `audit.read(actor, resource)` — plain read event (used by account-detail views, Phase 3).
  - `audit.transactional(actor, action, fn)` — internal mutations: audit write and mutation in one transaction.
  - `audit.intentFirst(actor, action, params, externalFn)` — writes intent row (failure → abort, external call never made), calls `externalFn(intentId)` passing intentId as the idempotency key, writes `succeeded`/`failed` transition row.
- `nianza-audit-sweeper` Lambda, EventBridge every 15 min: any `intent` row >5 min old with no transition row → write `unconfirmed` transition, reconcile against RevenueCat API to determine whether the side effect landed, alert super_admin (SNS → email for now), expose unconfirmed count via System Health endpoint.
- IAM: confirm NO principal has UpdateItem/DeleteItem on `nianza-admin-audit-log` — PutItem and Query/GetItem only. If the existing policy allows more, tighten it and note it.

### 3.3 Audit viewer UI
- Route `/audit`, super_admin only. TanStack table: filters by actor, target user, action, status, date range. Reuse the content-item audit-history components where sensible.

### 3.4 Phase 2 acceptance
- A test `support` user verifiably CANNOT: comp a subscription, open /audit, see actions beyond its matrix — enforced by the API (test with direct HTTP calls, not just hidden buttons).
- Simulated external-call-failure test: intent row exists, `failed` transition exists, no orphan side effect. Simulated crash-after-external-success test: sweeper produces `unconfirmed`, reconciliation resolves it.

---

## 4. Phase 3 — User Lookup & Actions (P0.2) — build order steps 3–4

### 4.1 Read-only first (step 3)
- `nianza-users`: add GSI2 `emailLower` (PK). Backfill script for existing rows (one-off, run once, logged).
- `nianza-admin-users-lambda`: `GET /v1/admin/users/search?q=`, `GET /v1/admin/users/{userId}`, `GET /v1/admin/users/{userId}/timeline`. The detail composition per spec §4.2 — and enforce DO NOTs 1–2 at the serializer: children as `[{ ageBand: "14 months" }]` only; Patricia data as counts/timestamps/modality only. Grep the response shape in a test: assert no `name`, no `photo`, no transcript-like field ever appears.
- Every detail-view request calls `audit.read()` — page views leave a trace (deliberate, per spec §5.1 note).
- UI: make the Users nav item real. `/users` (search + results table), `/users/:userId` (detail + timeline). Actions column rendered but disabled with "Phase 3b" tooltip until step 4 ships.

### 4.2 Actions (step 4)
- `POST /v1/admin/users/{userId}/actions` with typed payloads. Each action wired through `audit.intentFirst` (RevenueCat-touching) or `audit.transactional` (internal). Guards exactly per spec §4.3 table: trial extension ≤30 days for support / >30 super_admin; comps super_admin only; refunds require reason code + free-text note; cancellation confirm-dialog shows period-end date; receipt resend rate-limited 3/day/user.
- RevenueCat REST calls use the API key from Secrets Manager and the intentId as idempotency key.
- Receipt resend targets the D5 email path — if `nianza-email-lambda` (Phase 4) isn't built yet, stub the emailType behind an interface and note it; do not block this phase on email infra.

### 4.3 Phase 3 acceptance
- Support flow drill: from a test customer email → account found → trial extended → audit rows (intent + succeeded) present with correct actor/params → under 60 seconds end to end.
- Serializer tests proving DO NOT 1–2 compliance are in CI and fail the build if violated.

---

## 5. Phase 4 — Data-Request Workflow (P0.4) — build order step 5

- Table `nianza-data-requests` per spec §6.1 (PK requestId, GSI1 status+dueAt). `dueAt = receivedAt + 30 days`, computed at write.
- Intake door (a): the app's existing account-deletion path writes a request row (small change in the existing deletion entry Lambda — coordinate; do NOT change the parent-facing UX beyond D4: the confirmation copy now states completion within 30 days).
- Intake door (b): admin-initiated from `/users/:userId` (support role may intake).
- Deletion: extend `nianza-account-deletion-lambda` — add RevenueCat subscriber deletion, billing-events tombstone (de-identify, retain financial records), completion write-back to the request row. **Add a CI checklist file listing every table/prefix the deletion Lambda covers; any future PR adding a `nianza-*` table must update it (risk-register mitigation).**
- Export: assemble the §6.1 JSON bundle (includes the parent's own Patricia transcripts — the ONE sanctioned transcript path, machine-assembled, delivered only to the verified account email; still never rendered in the portal). Presigned URL TTL 72h.
- Email: build `nianza-email-lambda` + SES identity (D5 default; check IMPLEMENTATION-NOTES.md for an override first). emailTypes: `data_export_ready`, `deletion_complete`, `receipt_resend` (unstub Phase 3's interface).
- UI: `/data-requests` board — open requests by dueAt, amber at 20 days (with the super_admin escalation alert), completion requires named verifier, everything audited.
- **Acceptance:** one full deletion and one full export executed in a dev/test account and verified — this is also a Launch Readiness gate item, so script it repeatably.

---

## 6. Phase 5 — Real Revenue UI + Launch Readiness Panel (P0.1 UI + P0.5) — build order steps 6–7

- Replace the dashboard's projected-revenue section: real MRR / ARR / plan-mix cards from the Phase 1 cached metrics, at-risk MRR rendered as "of which $Y at risk", live event feed (GSI1 query, newest first), failed-payments queue with drill-in to `/users/:userId`. **Delete the projected-data disclaimer** — and per DO NOT 4, ensure nothing estimated ships unlabeled in its place.
- Wire existing Operations cards to real drill-downs where the target views now exist (P1.6 rule applies to everything you ship: every number links to its filtered list).
- Launch Readiness panel at the top of the dashboard, per spec §7's six gate items. Automate state where cheap (billing: last sandbox event seen; audit: append-only IAM verified flag; roles: matrix test suite green), manual toggles (super_admin only, audited) where not (store review status, growth-lms verification — read `sourceVerifiedBy` from the content data source if reachable, else manual).
- **Phase 5 acceptance = the launch gate itself:** all six panel items green in front of Ej, plus a screen-recorded run-through of: sandbox purchase → dashboard MRR moves; support drill (Phase 3 acceptance); deletion + export run (Phase 4 acceptance).

---

## 7. Out of Scope — Do Not Build (yet)

- **All P1 and P2 items** (funnels, sparklines, MRR waterfall, Patricia engagement metrics, cohorts, LTV/CAC). Ship P0, launch, then P1 per spec §8 ordering. Exception: it is fine to leave cheap seams (e.g., the metrics cache shaped so a sparkline query is easy later) — note them, don't build them.
- **Anything in the parent-facing app** beyond the two named touchpoints (deletion-path request row + D4 confirmation copy).
- **Anything touching Patricia's runtime** — tables, prompts, `ambientContext`, `grandmother-chat-en.txt`. DO NOT 3 is absolute.
- **P0-minimal cut (spec §2.1)**: only activated if Ej invokes D1 fixed-date. If invoked mid-build: finish Phases 1–2 as-is, ship Phase 3 read-only only, ship Phase 4 deletion-only, proceed to Phase 5.

## 8. Reporting Cadence

At each phase gate, Cowork posts: what shipped (with PR links), acceptance evidence, IMPLEMENTATION-NOTES.md diff, and anything needing an Ej decision. Blockers that touch money, legal, or Patricia stop work on that thread and escalate immediately rather than guessing — everything else, make the call and log it.

---

*Nianza · NZA-ADMIN-v1.1-COWORK-IMPL v1.0 · July 27, 2026*
