# Nianza — Admin Portal Consolidated
### NZA-ADMIN-v1.1 · July 22, 2026

---

The Average Tech Company LLC — Cowork Engineering Brief

**Nianza**

Admin Portal — Consolidated · NZA-ADMIN-v1.1

Supersedes the speculative NZA-ADMIN-v1.0 draft. Baseline is the AS-BUILT NZA-ADMIN-v1.0 (dated Jul 17, 2026, uploaded). This document reconciles the two and specs only the DELTA — what's missing relative to the rest of this project's specs.

|                                        |                                                                                                                                                                                                                     |
|----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Status**                             | The admin portal exists and is substantially better-specified than my prior draft in most areas. Do not rebuild what's built — this brief covers reconciliation notes + two genuine gaps + one confirmation needed. |
| **Baseline source**                    | NZA-ADMIN-v1.0 (as-built), NZA-ENG-v1.4, NZA-PDD-v1.7. This document adds to that baseline; it does not replace its Lambda contracts, schemas, or IAM roles, all of which remain authoritative.                     |
| **AWS accounts (confirmed canonical)** | nianza-prod (672061768724) — all admin infra; Banxito (869935087622) — SES/email; claricito-prod (839001574339) — reference only, not integrated.                                                                   |
| **Date**                               | July 22, 2026                                                                                                                                                                                                       |

## 1. Reconciliation — My Prior Draft vs. As-Built

| **Area**                      | **My prior draft (NZA-ADMIN-v1.0, superseded)**                                       | **As-built (authoritative)**                                                                                                                                                                                                          |
|-------------------------------|---------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Frontend framework            | Create React App (mirrored Claricito literally)                                       | React + Vite, Tailwind, TanStack Table, Recharts, Amplify Auth. USE THIS.                                                                                                                                                             |
| Roles                         | Support / Clinical Reviewer / Full Admin                                              | super_admin / content_editor / operations — real, Lambda-enforced. USE THIS.                                                                                                                                                          |
| Health-data access control    | Role-gated access + a view-audit log for any health-record read                       | Stronger: sensitive fields (vitals, milestone detail, conversation content) are NEVER RETURNED by any admin API regardless of role — data minimization beats access-gating. My view-audit-log proposal is WITHDRAWN in favor of this. |
| Moderation → Content review   | Sketched as one 'Content & Clinical Review' page with vague panels                    | Fully realized: versioned content items, two-stage clinicallyReviewed→ejApproved gate with a hard 400 guard, sourceRef as audit trail, edit-resets-review. This is done and good — no further spec needed for content-library items.  |
| Subscriptions/Churn/Ops split | Four separate pages + Lambdas (Subscriptions, Churn, SubscriptionOps, CohortAnalysis) | One Subscriptions page (cohort counts + trend + CSV export) covers this more simply. Adopt the simpler as-built version; my four-page split was over-engineered relative to actual need at this stage.                                |
| Team page                     | TeamPage / TeamManagementFunction                                                     | Portal Users screen — same function, as-built name. Use as-built naming.                                                                                                                                                              |
| Data export / deletion        | New DataExportsPage for COPPA/GDPR                                                    | Handled via user.delete-initiate endpoint invoking the existing nianza-account-deletion-lambda — simpler, reuses existing infra, no new page needed. Adopt as-built approach.                                                         |
| Patterns / Tier-2 aggregation | Proposed building the pipeline now, cohort-gated                                      | Correctly ABSENT from as-built — consistent with the v2.15 gate that Tier 2 is not yet authorized. No action; confirms the discipline held.                                                                                           |

## 2. Confirmed Gaps — New Work for v1.1

### 2.1 Schedule & Reference Data screen (missing entirely)

vaccines-en.json, growth-lms-en.json, and milestones-en.json each carry a sourceVerifiedBy launch gate (NZA-VACCINES-v1.0, NZA-VITALS-GROWTH-v1.0, NZA-MILESTONES-IMPL-v1.0). These are versioned whole-file S3 blobs, not nianza-content-library rows, so the existing content-approval workflow doesn't cover them — there is currently no way to publish a new schedule version or set sourceVerifiedBy anywhere in the portal.

| **Component**                         | **Spec**                                                                                                                                                                                                                                                                                  |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| New screen                            | /settings/reference-data — SUPER_ADMIN ONLY. Lists the three seed files: current version, sourceVerifiedBy (name + date, or 'NOT VERIFIED' in red), last-updated date, download-current-version link.                                                                                     |
| nianza-admin-reference-list-lambda    | GET /admin/v1/reference-data — reads S3 object metadata for the three known keys (nianza-content/vaccines/en.json, /growth-lms/en.json, /milestones/en.json).                                                                                                                             |
| nianza-admin-reference-upload-lambda  | POST /admin/v1/reference-data/{key}/upload — uploads a new version to a staging path, does NOT overwrite the live key. Returns a diff summary (row counts, added/removed doses or milestones) for review before publish.                                                                  |
| nianza-admin-reference-publish-lambda | POST /admin/v1/reference-data/{key}/publish — SUPER_ADMIN ONLY. Requires sourceVerifiedBy (reviewer name, string) in the request body — returns 400 without it. Copies staged version to the live S3 key, writes audit log action reference-data.publish with previousVersion/newVersion. |

**⚠ App Lambdas that read these files (vaccine status, growth percentile engine, milestone rollover) must refuse to serve data from a file with no sourceVerifiedBy on record — confirm this check exists in NZA-ENG; if not, it's a launch blocker independent of this portal work.**

### 2.2 Golden-Conversation Harness sign-off (missing entirely)

NZA-CHAT-v1.0 §5 requires the 25-scenario transcript set to be reviewed and signed by Ej before any Patricia prompt/model/bundle change promotes past staging. No screen currently exists for this.

| **Component**                                                 | **Spec**                                                                                                                                                                                                                                                                                                                        |
|---------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| New screen                                                    | /settings/ai (extend the existing AI & Voice Controls screen rather than adding a new route) — new panel: 'Harness Runs'. Lists recent runs: runId, triggeringChange (prompt/model/bundle diff summary), timestamp, pass/fail on automated assertions, signedBy (null until signed).                                            |
| Run detail                                                    | Click into a run → all 25 scenario transcripts rendered read-only, automated-assertion results per scenario (word count, banned-phrase scan, template-fired checks per NZA-CHAT-v1.0 §5). 'Sign off' button — SUPER_ADMIN ONLY, disabled if any automated assertion failed.                                                     |
| nianza-admin-harness-list-lambda / -get-lambda / -sign-lambda | New Lambdas, same audit-logged-write pattern as content approval. New table: nianza-admin-harness-runs (PK runId, attrs per above). Sign action writes audit log harness.sign-off; a change cannot be marked promotable to production without a signed run — enforce this as a deploy-pipeline check, not just a portal nicety. |

### 2.3 Confirmation needed, not new work

- Confirm M8 (distress) and G4 (emergency) templates are nianza-content-library rows with contentType: 'distress-template' / 'emergency-template', flowing through the existing clinicallyReviewed→ejApproved gate. If so, no new work — the as-built workflow already covers them and this is simply the mechanism by which Content Worklist P1 gets closed.

- Same confirmation for the newer template banks: postcard-template, generational-shift, birthday-letter-template, grandparent-note-template, catchup-digest, postcard-frame (v2.5/v2.15/v2.17). All should be ordinary content-library rows — no reason any of them need bespoke screens if the contentType filter in Content Library already exposes them.

## 3. Build Order Addendum

| **Phase**                             | **What**                                                                                                        | **Gate before proceeding**                                                                                                                                                                                                      |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 6 — Reference data & harness sign-off | §2.1 and §2.2 above: Schedule & Reference Data screen, Harness Runs panel, associated Lambdas and audit actions | Ej publishes one reference-data file with sourceVerifiedBy set and confirms the corresponding app Lambda refuses to serve an unverified version in a test; Ej signs one harness run and confirms an unsigned run cannot promote |

This slots after the as-built Phase 5 (frontend complete) — both new pieces are additive to an already-functioning portal and carry no dependency on anything before Phase 4.

## 4. Risk Register Addendum

| **Risk**                                                                                                                                                                                              | **Severity** | **Mitigation**                                                                                                                                                                            |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A vaccine/growth/milestone schedule update is published without sourceVerifiedBy, silently going live                                                                                                 | Critical     | Publish Lambda returns 400 without sourceVerifiedBy (same double-guard pattern as content approval). App-side Lambda check is the second independent guard — verify it exists in NZA-ENG. |
| A Patricia prompt or model change reaches production without a passing, signed harness run                                                                                                            | Critical     | Deploy pipeline check (not just UI) blocking promotion without a signed run in nianza-admin-harness-runs.                                                                                 |
| Safety templates or new content types (postcards, capsules, etc.) accidentally bypass the review gate because they were added to content-library with a new contentType the filter UI doesn't surface | Medium       | Content Library screen's contentType filter should be driven off actual distinct values present in the table, not a hardcoded list — confirm with Cowork.                                 |

**✓ Definition of done: every launch gate this project has written into a spec document — content, safety templates, reference-data sources, and the conversation harness — has exactly one place in the admin portal where it gets closed, and no path around it.**
