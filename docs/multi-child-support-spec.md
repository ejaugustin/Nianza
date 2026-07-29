# Multi-Child Support — Spec

## Why now

Every domain table (`nianza-vitals-*`, `nianza-milestone-progress-*`, `nianza-vaccine-progress-*`, `nianza-reports-*`, chat memory) is already keyed on `childId`. The `nianza-children` table itself is keyed on `{userId (HASH), childId (RANGE)}` — a user can already own more than one child row today; nothing has to change about that table to allow it.

What actually caps every account at one child is the mobile app: `src/api/children.ts` hardcodes every request to a constant, `PRIMARY_CHILD_ID = "primary-child"`, `ChildProfile` state in `auth-context.tsx` holds exactly one object, and `RequireAuth` gates the whole app on that single profile existing. So this is close to a pure app-layer + small-API change, not a data model rebuild.

## Current state (verified against the repo)

- `nianza-children` table: `KeySchema` = `userId` HASH, `childId` RANGE (`Backend/infra/template.yaml:388-392`). Querying by `userId` alone already returns every child that user owns — no GSI needed for a "list my children" call.
- Child upsert (`PUT /mobile/v1/children/{childId}`) is handled inside the Milestones Lambda (`Backend/mobile/milestones/handler.js:80`, wired at `template.yaml:633-640`), not a dedicated children function.
- There is no `GET /mobile/v1/children` (list) route today — only get/put by a specific `childId`.
- Vitals, milestones, vaccines, and reports Lambdas all call `ensureChild(userId, childId)` before touching child-scoped data, so ownership is already enforced per-request rather than assumed.
- Mobile: `src/api/children.ts` → `upsertPrimaryChild()` always writes to `childId = "primary-child"`. `ChildProfile` (`src/auth/auth-context.tsx`) is a single object in state, persisted to SecureStore under one key per parent email.
- Chat/Patricia memory is **not** childId-scoped. `getRecentTopics()` in `Backend/mobile/chat/handler.js:218-229` queries `CONVERSATIONS_TABLE` by `userId` only (via a `user-updatedAt-index` GSI), so "recent topics Patricia remembers" are pooled across every child on the account today. Per-message context (`enrichContext`) does take a `childId` for pulling that child's milestones/vitals/encounters, but the conversation history itself is account-wide, not child-specific.

## What "switch active child" means for existing users

No migration is required. Every existing account's one child is already stored as `{userId, childId: "primary-child", ...}` and every one of their vitals/milestones/vaccine/report rows already carries `childId: "primary-child"`. That row becomes their first child automatically. Nothing needs to be renamed, copied, or backfilled — the id `"primary-child"` simply stops being a hardcoded constant and becomes an ordinary (if oddly named) child id already sitting in the data.

## Backend changes

1. **New route: `GET /mobile/v1/children`** — lists all children for the authenticated user (`Query` on `nianza-children` by `userId`, no new index). Small new handler or added to the Milestones Lambda alongside the existing child upsert, since it already owns that table's access pattern.
2. **New route: `POST /mobile/v1/children`** — creates a new child with a generated `childId` (e.g. `ulid()`), replacing the pattern of always targeting `"primary-child"`. `PUT /mobile/v1/children/{childId}` keeps working unchanged for edits.
3. **Optional: `DELETE /mobile/v1/children/{childId}`** — needed to make the "Remove child from account" action in J6/J1 real instead of a stub. Should soft-delete (mark `removedAt`) rather than hard-delete, so vitals/milestones/report history isn't silently orphaned.
4. **Audit chat/Patricia memory storage** — confirm whatever keys chat history and `context.js` memory (this determines whether switching children mid-session needs to also swap conversation history, or whether that's already keyed correctly). This is the one piece I haven't verified yet and want to check before quoting effort.
5. No changes needed to vitals/milestones/vaccines/reports Lambdas — they already take `childId` as a path parameter and enforce ownership per-request.

## Mobile changes

1. **State**: introduce an `activeChildId` alongside (not replacing) a new `children: ChildProfile[]` list in `auth-context.tsx`. Persist `activeChildId` to SecureStore per parent email, same pattern as `profile` today.
2. **Data loading**: on sign-in, call `GET /children`, hydrate the list, default `activeChildId` to the first child (which for every existing account is `"primary-child"`) unless a previously saved `activeChildId` exists.
3. **Every screen call site** that currently does `upsertPrimaryChild(...)` or reads `profile` as if it's the only child needs to read/write against `activeChildId` instead. This touches vitals, milestones, vaccines, reports, chat, and all eight settings screens built this session — mechanical but wide.
4. **Child switcher UI**: add to J1 Settings, "Your children" section — a row per child (avatar + name), tap to make active, plus "Add another child" now actually pushing a create flow (reuse the J6 form in "create" mode) instead of showing the "not supported yet" notice.
5. **`RequireAuth`**: gating logic needs to become "at least one child exists" rather than "the one profile exists" — functionally the same check today since there's always exactly one.
6. **Home screen, chat, reports** all need a visible "who am I looking at" indicator once there's more than one child, so a parent switching between kids doesn't lose track of context mid-session.

## Rollout order

1. Backend: list + create child endpoints, confirm chat/memory scoping.
2. Mobile: `activeChildId` plumbing + child switcher UI in Settings, with "Add another child" still gated behind a feature flag if backend isn't deployed yet.
3. Flip on `POST /children` support once verified in a test account with 2+ kids across a full day of vitals/milestones/vaccine entries.
4. Ship delete/remove-child as a fast follow — it's the one action with real data-loss risk and deserves its own confirmation flow (mirrors the M13 account-deletion pattern already built).

## Decisions

- **Patricia's conversation memory stays shared across siblings** (account-wide, keyed by `userId`, not `childId`). No change needed to `CONVERSATIONS_TABLE` or its `user-updatedAt-index` GSI — the existing query in `getRecentTopics()` already matches this. Per-message context (milestones/vitals/encounters pulled via `enrichContext`) still resolves per active `childId`, so Patricia references the right child's data in a reply even though her memory of "recent topics" spans the family.

## Open questions

- Subscription/billing (currently unbuilt) — does a second child cost more, or is it flat per-account? Affects whether "Add another child" needs a paywall check once billing exists.
