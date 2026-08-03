# NZA-WEEKLY-LETTER-v1.0 — Weekly Patricia Letter (spec, pre-implementation)

## Why this exists

The Reports tab currently shows "weekly letters" from `MobileApp/src/api/weekly-letters.ts` —
three hardcoded fake entries (weeks of 6/28, 7/5, 7/12) with no real generation logic anywhere.
There is no backend table, no schedule, no LLM call, no email delivery for this feature today.
That's why the parent got a letter for July 11-17 and nothing since: the mock array simply ends
there. This spec defines the real thing.

## Goals

- Every child with an active profile gets a new Patricia-voiced weekly letter generated
  automatically, once a week, covering the prior Sunday-through-Saturday window.
- Letter content is grounded in what was actually logged that week (vitals, milestones,
  custom firsts, sick encounters, vaccine doses given) — not generic filler.
- Letters are viewable in-app immediately (Reports tab), matching the existing UI the mobile app
  already renders (`weekly-letter/[letterId].tsx`, `reports.tsx`) with zero client changes needed
  beyond swapping the mock import for a real API call.

## Non-goals (this version)

- **Email delivery.** No SES/SendGrid/nodemailer infra exists in `Backend/` today. The mock's
  `emailedAt`/`status: "emailed"` fields imply email, but standing up verified-sender email is a
  separate workstream. v1 generates and stores the letter; `status` stays `"ready"` until the
  parent opens it in-app (`"read"`). Email can follow once this is proven.
- **Push notification on new-letter-ready.** Same reasoning — defer until the letter itself
  exists and is reliable.
- **Configurable send time per user / timezone-aware "Sunday" per user.** v1 runs the job once
  on a fixed UTC schedule (see below); "Sunday 6pm" is treated as a single global anchor, not
  personalized per parent's local timezone.

## Open questions — resolved by Addenda A/B/C (2026-08-01), tier gating overridden by product decision

1. **Tier gating → locked, matching Progress Reports / Doctor Visit Pack.** Addendum A
   recommended free-for-everyone; **overridden 2026-08-01 — weekly letter generation and
   viewing use the same `capabilityForReportType`-style gate as the rest of `mobile/reports/`**,
   keeping the paywall consistent. Everywhere below that says "no gate," read it as superseded
   by this decision.
2. **Partial-week letters → generate on the first Sunday after child creation**, even with a
   handful of data points ("We've only just started, but here's what I noticed already").
3. **"6pm" → 6pm US Eastern** (22:00 UTC / 23:00 UTC during EDT). Logged as a known limitation
   (not per-user-local-time) until timezone-aware scheduling infra exists elsewhere.
4. **Empty weeks → always generate, never skip.** A quiet week gets a short, warm letter, not an
   apology or a gap.

Full rationale for all four in `NZA-WEEKLY-LETTER-v1.0-ADDENDA-A-B-C.md`.

## Scope now includes email (Addenda B + C)

Non-goal #1 below (no email) is **reversed**. The weekly letter now sends as a full email —
not a teaser — from `patricia@nianza.com`, styled to match Claricito's existing Sunday
Letter format (cream banner / dark body panel, "FROM PATRICIA" eyebrow, serif body, "—
Patricia" signature, footer link back into the app, no reply-to). Push-on-new-letter-ready
stays deferred; this is an email-only send, exempt from any push-arbitration system.

**Corrected 2026-08-01 (Addendum D) — real infra state, not the earlier assumption:**

- **SES account structure.** Banxito (AWS account `869935087622`, `us-east-1`) is the single
  parent account. SES, all verified domains (`banxito.com`, `zeedium.com`, `claricito.com`, and
  now `nianza.com`), and `claricito-email-dispatcher` itself all live in *this one account* —
  not in a separate "Claricito account" as I'd assumed earlier. Confirmed directly from the SES
  console.
- **`nianza.com` domain identity was created today**, Easy DKIM (RSA 2048), MAIL FROM subdomain
  `mail.nianza.com`, Route53 auto-publish enabled. **Status as of setup: DKIM and MAIL FROM both
  Pending, not yet Verified.** No sends should be attempted until both flip to Verified — check
  via console or `aws sesv2 get-email-identity --email-identity nianza.com`; if still pending
  after a few hours, confirm the DKIM CNAME records actually resolve (`dig CNAME
  <token>._domainkey.nianza.com`) rather than assuming propagation is just slow.
- **Nianza-specific SES configuration set does not exist yet** — a separate console/IaC step
  from creating the identity, still to be done before any real send.
- **SES Tenant Management** (a native multi-product-isolation feature visible in the console)
  was deliberately not adopted — sticking with the configuration-set-per-product approach
  already specced. Flagged as a future architectural question, not to be mixed in now.
- **Cross-account call is real, not hypothetical.** Nianza's backend runs in `nianza-prod`
  (`672061768724`, `us-east-2` per this repo's CLAUDE.md) — a separate AWS account from Banxito
  (`869935087622`, `us-east-1`). So `WeeklyLetterFunction` invoking `claricito-email-dispatcher`
  is a genuine cross-account Lambda call, needing a resource-based policy on the dispatcher
  granting `672061768724` account `lambda:InvokeFunction`, or a fronting API Gateway. This
  answers Addendum D §2.2's open question directly from what's already in this repo.
- **Re-scoping the dispatcher is still real work, not a parameter.** It's hardcoded today to
  Claricito's 7 lifecycle email types and one sender identity. Extending it needs a new
  emailType namespace for Nianza and confirmation that its dedup table's `userId` key won't
  collide across Claricito's and Nianza's separate user pools (recommend a product-prefixed
  key, e.g. `nianza#{userId}`, since the table is genuinely shared).

**Explicitly not required for this feature:** the full NZA-NOTIF-v1.0 orchestrator (EventBridge
bus, priority arbitration, quiet hours, push integration). Per Addendum B §6, the weekly letter
is email-only and calls the dispatcher directly — it doesn't need push arbitration to exist
first. Building NZA-NOTIF-v1.0 in full is a separate, larger initiative and shouldn't block this.

## Data sources (all already exist, per-child, windowed to the week)

| Source | Table | Existing fetch helper |
|---|---|---|
| Vitals/growth/meds/notes | `VitalsLogTable` | `reportData.fetchVitalsInRange` |
| Milestone observations | `MilestoneProgressTable` | `reportData.fetchMilestonesInRange` |
| Custom "firsts" | `MilestoneProgressTable` (`custom#` prefix) | `mobile/milestones/handler.js:handleGetCustomFirsts` pattern |
| Sick encounters | `SickEncountersTable` | `reportData.fetchAllEncounters` (needs date-window filter added) |
| Vaccine doses given | `ImmunizationStatusTable` | `reportData.fetchAllVaccineDoses` (filter to window, same as `dosesInWindow` in reports handler) |

No new tables needed for input data. One new table needed for output: `WeeklyLettersTable`
(`childId` HASH, `letterId` RANGE — same shape as `MobileReportsTable`).

## Generation approach (superseded by Addendum A §5 — this is the version to build)

Mirrors the existing pattern in `mobile/reports/narrative.js` and `mobile/chat/gateway.js`
exactly — same Anthropic Messages API call, same SSM-parameter credential resolution
(`/nianza/prod/anthropic/api-key`, `/nianza/prod/anthropic/model`), same deterministic
template fallback if the API call fails or returns unusable content. This is a proven pattern
already running in prod for two other features; no new AI vendor or integration needed.

- Input to the model: child name, week window; per logged item, its **type, specific
  name/label/description, and freeform note text** (not counts-only — this is Addendum A's
  single highest-leverage change; extend `reportData.fetchVitalsInRange` /
  `fetchMilestonesInRange` to include note text if they don't already); a theme vocabulary list
  the model **selects from rather than rotates mechanically**; `priorLetterThemeLabel` /
  `priorLetterKeyBeat` from the prior week's letter when available (omitted entirely for a
  child's first letter or after a gap — no empty placeholder); an explicit restated
  zero-interpretation constraint (vitals/growth described, never diagnosed or flagged); explicit
  permission for a short letter on a quiet week rather than a target length.
- Output: `{ title, preview, greeting, bodyText, closing, themeLabel, priorLetterKeyBeat }` —
  the first six match the mobile app's existing `WeeklyLetter` type; `priorLetterKeyBeat` is new,
  stored for next week's continuity use, never shown to the parent directly.
- Fallback (API failure): a template-filled version using the same "gentle, non-clinical,
  observational" voice already established in `assemble.js`'s fallback strings. Unlike the
  primary path, the fallback **does** rotate theme mechanically — consistency matters more than
  variety on the safety-net path.
- No reply prompts or reflective questions in the letter (considered and rejected in Addendum A
  §3.6 — reads as a gift with no ask attached, consistent with the app's no-gamification stance).

## Schedule & fan-out

New Lambda `WeeklyLetterFunction`, triggered by a `Schedule` event
(`cron(0 22 ? * SUN *)` for 6pm Eastern / 22:00 UTC — pending answer to open question #3),
following the exact fan-out shape already proven by `BillingReconcileFunction`
(`billing/reconcile/handler.js:59`): paginated `Scan` over `MobileChildrenTable` (not
`MobileUsersTable`, since generation is per-child, not per-user), generate + store one letter per
child for the window `[last Sunday 00:00, this Sunday 00:00)`.

## Storage & API (as implemented, Phase 1)

- `WeeklyLettersTable`: `letterId` is the **sole** PK (deterministic --
  `weekly-letter#{childId}#{weekStartDateKey}`, e.g.
  `weekly-letter#primary-child#2026-07-19`), not a childId+letterId composite. This is
  specifically so the existing mobile client's `getWeeklyLetter(letterId)` /
  `markWeeklyLetterRead(letterId)` signatures (no childId param) need zero UI changes. A
  `childId-index` GSI (`childId` HASH / `weekStartDate` RANGE) serves the list route. Routes:
  `GET /mobile/v1/weekly-letters/by-child/{childId}` (list, via GSI), `GET
  /mobile/v1/weekly-letters/{letterId}` (detail), `POST /mobile/v1/weekly-letters/{letterId}/read`
  (mark read). Fields: status (`ready`/`read`), generatedAt, the letter content, plus (Addendum
  A §4.1) `priorLetterThemeLabel` / `priorLetterKeyBeat` (nullable), plus (Addendum B §5.1,
  unused until Phase 2) `emailStatus` (`not_sent`/`sent`/`bounced`/`complained`/`suppressed`),
  `emailSentAt`, `emailMessageId`.
- `MobileWeeklyLettersFunction` mirrors `mobile/reports/handler.js`'s scaffolding
  (`claimsFromEvent`, response helpers) and is **gated with a new `canAccessWeeklyLetter`
  capability** on the entitlements service (kept separate from `canAccessProgressReports` so
  the two can diverge later), per the overridden tier-gating decision above.
- `MobileApp/src/api/weekly-letters.ts`: same exported function signatures
  (`listWeeklyLetters`, `getWeeklyLetter`, `markWeeklyLetterRead`), swapped from the mock array to
  real `apiGet`/`apiPost` calls — no changes needed in `reports.tsx` or
  `weekly-letter/[letterId].tsx` beyond that.
- **Email send:** after `WeeklyLetterFunction` stores a letter, it checks `EmailSuppressionList`
  (Claricito's, per Addendum B §5.2/§8.1 — confirm cross-account read access, same issue as the
  dispatcher invoke) then calls `claricito-email-dispatcher` cross-account with the full letter
  (greeting + bodyText + closing, HTML-escaped and with markdown emphasis converted to `<em>`
  per Addendum C §5) rendered into the Claricito-matching template (Addendum C §4/§7), sent from
  `patricia@nianza.com`, subject per Addendum C §6 pending a product decision on exact
  wording.

## Idempotency

Job is safe to re-run: `letterId` is deterministic from `childId` + week-start date
(`weekly-letter#{weekStartDate}`), so a `PutCommand` with a conditional
`attribute_not_exists(letterId)` prevents duplicate letters if the schedule ever fires twice or
the Lambda retries.

## Sequencing decision (2026-08-01)

Building in two phases rather than one pass: **Phase 1 (now) — real letter generation, storage,
tier-gated API, and in-app viewing, no email dependency.** **Phase 2 (later) — email send**,
once `nianza.com` DKIM/MAIL FROM verify, the Nianza SES configuration set is created, and
cross-account dispatcher access is granted. Phase 1 has zero dependency on any of that
infrastructure and can ship independently.

## Remaining open items before implementation starts

- **Tier-gating confirmation** (open question #1 above) — the one item I'd want explicit
  sign-off on given it reverses the paywall precedent from the subscription work.
- **Cross-account access** — need whoever owns the Claricito AWS account to grant Nianza's
  account either `lambda:InvokeFunction` on `claricito-email-dispatcher` or stand up a fronting
  API Gateway, plus confirm `EmailSuppressionList` is readable the same way.
- **Subject line wording** (Addendum C §6) — flagged in the addendum itself as a product
  decision, not an engineering default.
- **Yellow-highlight "letter" styling** in Claricito's reference email — Addendum C explicitly
  defers this pending confirmation it's intentional design vs. a screenshot artifact; not
  implemented either way until confirmed.

## Rollout

1. Backend: new table (with the Addendum A/B fields), new Lambda + schedule, new routes,
   generation logic (Anthropic + fallback, per the revised Generation approach above).
2. Manual smoke test: invoke the Lambda directly (same `aws lambda invoke` pattern used for the
   entitlements smoke test) against one real child, confirm a letter lands in the table with
   sane content, and that continuity fields populate correctly on a second consecutive week.
3. Cross-account wiring: confirm dispatcher invoke + suppression-list read access from Nianza's
   account; verify the dispatcher's product/sender-identity parameter routes correctly and
   doesn't affect existing Claricito sends (regression check, per Addendum B §8.3).
4. Email template: build the Nianza-branded HTML template per Addendum C, ideally starting from
   Claricito's actual template source rather than the screenshot-based approximation, if that
   source is accessible.
5. Client: swap `weekly-letters.ts` from mock to real API calls.
6. Backfill: none — first real letter is the next Sunday after deploy; no attempt to
   retroactively generate July 18-24 or other missed weeks, since there's no "activity data
   trigger" it was supposed to react to in the first place.
