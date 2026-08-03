# NIANZA — Weekly Patricia Letter: Addenda A, B & C (Combined)

**Document owner:** The Average Tech Company LLC
**Status:** Draft for implementation
**Date:** August 1, 2026
**Parent spec:** NZA-WEEKLY-LETTER-v1.0

This document combines three addenda to the parent Weekly Letter spec:

- **Addendum A** — Content, Continuity & Open Questions
- **Addendum B** — Email Delivery via Shared SES Account
- **Addendum C** — Email Template, Matching Claricito's Sunday Letter Format

Read together, they resolve the parent spec's four open questions, bring email delivery into v1 scope, and define the exact visual/content format of that email. Two corrections made in Addendum C to statements in Addendum B are called out where they occur (Section 3 of Part II, Section 3 of Part III).

---

# Part I — Addendum A: Content, Continuity & Open Questions

*(NZA-WEEKLY-LETTER-v1.0-ADDENDUM-A)*

## 1. Purpose

Resolves the four open questions in NZA-WEEKLY-LETTER-v1.0 and specifies the content, prompt, and continuity requirements needed for the weekly letter to feel like Patricia paying attention rather than a report generator with a warm voice. The parent spec's infrastructure (schedule, fan-out, storage, idempotency) is sound as written and is not revisited here — this addendum is entirely about what goes into the letter and why.

## 2. Open Questions — Resolved

| Question | Decision | Rationale |
|---|---|---|
| **Tier gating** | Free for everyone, including non-subscribed accounts. | Low marginal cost (one call per child per week, not per-message) and the single best conversion lever the app has — a free-tier parent feels the full Patricia relationship every Sunday. Locking it removes that argument; the Doctor Visit Pack and Progress Reports remain the paid differentiation. |
| **Partial-week letters** | Generate on the first Sunday after a child profile is created, even with a handful of data points. | A new child's first Sunday is one of the highest-emotional-value moments the app will ever get. Patricia can say so directly ("We've only just started, but here's what I noticed already") rather than going silent while a full week accumulates. |
| **"6pm" definition** | 6pm US Eastern (22:00 UTC / 23:00 UTC during EDT — confirm DST handling in the cron). | Matches the audience-first instinct already used for daily-note weather/AQI awareness. Log as a known limitation, not a final answer: this becomes per-user-local-time once the timezone-aware infra from NZA-NOTIF-v1.0's quiet-hours logic exists. |
| **Empty weeks** | Always generate, never skip — and treat a quiet week as a feature, not a gap to apologize for. | Data-driven competitors (Huckleberry, Kinedu) literally cannot say anything when nothing was logged. Patricia can — a letter about rest, or about a normal boring week, is exactly the kind of thing a data instrument can't produce and a companion can. |

## 3. Content & Prompt Requirements

### 3.1 The counts-and-descriptions summary is not enough on its own

The parent spec's current input to the model is "a compact summary of that week's logged items (counts + short descriptions)." This is the single biggest risk to letter quality: counts alone produce fluent paragraphs about nothing. A letter that says "you logged 3 feeds and 1 milestone this week" in warmer language is not a letter a parent screenshots. The model needs the texture underneath the counts, not just the counts.

- Include the parent's actual freeform notes text (from `VitalsLogTable` and `MilestoneProgressTable` entries) in the weekly summary passed to the model, not just structured counts. If freeform notes aren't currently included in `reportData.fetchVitalsInRange` / `fetchMilestonesInRange` output, extend those fetch helpers to include them — this is the single highest-leverage change in this addendum.
- Where a milestone was logged, include its specific name/description, not just "1 milestone observed."
- Where a sick encounter occurred, include its name/label (per the nameable sick-encounter pattern already used elsewhere), not just a count.
- Redundant with 3.1 but worth stating plainly: if the underlying data for a given week is genuinely just counts with no notes or specifics, the letter should read as shorter and simpler that week (Section 3.4) rather than the model being asked to pad sparse input into full-length prose.

### 3.2 Zero-interpretation rule extends to letters

Vitals or growth data referenced in a letter must be described, never diagnosed or flagged with alarm language — the same zero-interpretation rule already in force elsewhere in the app applies here without exception. The model prompt should restate this constraint explicitly rather than relying on general model behavior alone.

### 3.3 Theme label should emerge from content, not rotate on a fixed schedule

The parent spec proposes rotating through a small fixed list (Connection, Rhythm, Observation, etc.). Over months of weekly letters, a parent will eventually notice the rotation pattern, and once noticed, the letter reads as templated rather than felt — the opposite of the intended effect.

- Keep the fixed list as a vocabulary the model selects from, but let it choose the label that actually fits the week's content rather than enforcing rotation order.
- Deterministic fallback (API failure case) can still rotate mechanically, since that path is explicitly the lower-quality safety net and consistency there matters more than variety.

### 3.4 Letter length should track the week, not a template

A full, eventful week earns a fuller letter. A quiet week earns a short, warm one. Padding a quiet week's letter out to match a busy week's length is one of the more reliable ways generated text starts to feel generated. Prompt guidance should explicitly permit a short letter and should not target a fixed word count.

### 3.5 Multi-caregiver attribution, where applicable

Where the logged data indicates which caregiver made an entry (per the multi-caregiver attribution pattern already flagged as worth incorporating from competitive analysis), the letter should reflect that specifically where it adds warmth — e.g. noting which parent caught a particular first — rather than flattening every entry into a generic "you." This depends on attribution data being available on the underlying log entries; if it isn't yet, this requirement activates once that data exists rather than blocking this spec.

### 3.6 Deliberately excluded: reply prompts or reflective questions

A closing question or reply prompt ("What was your favorite moment this week?") was considered and rejected. It's a natural engagement lever, but it edges toward the gamification/guilt-inducing pattern the app has already ruled out elsewhere (Section 2 principle referenced in the parent spec's own open question #4). The letter should read as a gift with no ask attached.

## 4. Continuity Mechanism

The parent spec generates each letter in isolation, with no reference to prior weeks. A relationship that resets to zero context every Sunday reads as a report generator with a nice voice, not a grandmother who remembers last week. This is the second-highest-leverage change in this addendum, and it's cheap: no new data source, one additional field in the generation prompt.

- When generating week N's letter, pass a thin slice of week N-1's letter into the prompt — its `themeLabel` and a short (1-2 sentence) extracted "key beat" summary, not the full letter body.
- This lets Patricia occasionally callback naturally — "last week you mentioned the eczema was flaring up, sounds like it's settled since" — without requiring the model to reconstruct context from raw historical data.
- Callbacks should be occasional, not mandatory every week — forcing a callback into every letter risks feeling as templated as the theme-rotation problem in Section 3.3. Prompt guidance: reference last week only when there's a natural, specific thread to pick up.
- For the first letter of a new child (Section 2, partial-week case) and the first letter after a gap (e.g. app reinstall, long dormancy), there is no prior letter to reference — prompt should omit the continuity field entirely rather than passing an empty placeholder.

### 4.1 Data model addition

`WeeklyLettersTable` (as defined in the parent spec) needs one additional field to support this mechanism:

| Field | Type | Notes |
|---|---|---|
| `priorLetterThemeLabel` | string, nullable | Copied from the previous week's letter at generation time; null for a child's first letter |
| `priorLetterKeyBeat` | string, nullable | Short (1-2 sentence) extracted summary of the prior letter's most notable specific detail; null for a child's first letter. Can be extracted at generation time from the prior letter's stored `bodyText`, or generated as a separate short field alongside the main letter content to avoid a second model call. |

Recommend generating `priorLetterKeyBeat` as a byproduct of the same generation call that produces the full letter (an extra short field in the model's structured output), rather than a separate summarization pass the following week — this avoids adding a second Anthropic API call per child per week.

## 5. Updated Generation Approach (supersedes parent spec's summary)

Input to the model, revised from the parent spec's "counts + short descriptions":

- Child name, week window
- Per logged item: type, specific name/label/description, and freeform note text where present (not just counts)
- Theme vocabulary list (model selects, does not rotate mechanically)
- `priorLetterThemeLabel` and `priorLetterKeyBeat`, when available (Section 4)
- Explicit zero-interpretation constraint (Section 3.2), restated in the prompt rather than assumed
- Explicit permission for a short letter on a quiet week (Section 3.4), rather than a target length

Output shape is unchanged from the parent spec: `{ title, preview, greeting, bodyText, closing, themeLabel }`, with `priorLetterKeyBeat` added as a new field the model produces for next week's continuity use, not shown to the parent directly this week.

## 6. Implementation Instructions for Cowork

Additive to the parent spec's rollout (Section "Rollout" in NZA-WEEKLY-LETTER-v1.0) — this does not change the schedule, fan-out, storage shape, or idempotency approach already specified there.

### 6.1 Scope

- Extend `reportData.fetchVitalsInRange` and `fetchMilestonesInRange` (or equivalent) to include freeform note text in their output, if not already present — verify this first, since it's the prerequisite for Section 3.1.
- Add `priorLetterThemeLabel` and `priorLetterKeyBeat` fields to `WeeklyLettersTable`.
- Update the generation prompt (mirroring `narrative.js` / `gateway.js` pattern per the parent spec) to include: full item detail instead of counts-only, theme vocabulary as selectable rather than rotated, continuity fields when available, explicit zero-interpretation and variable-length instructions.
- Update the fallback template (deterministic, API-failure path) to still rotate theme mechanically, per Section 3.3 — this path does not need the full content-richness logic since it's the safety net, not the primary path.
- Resolve tier gating per Section 2: weekly letter generation and viewing should not check `capabilityForReportType` or any subscription gate — confirm this explicitly in the routes/handler rather than assuming it inherits the Progress Report gating pattern.

### 6.2 Explicitly out of scope for this pass

- Email delivery and push-on-new-letter — unchanged from the parent spec's non-goals *(superseded for email by Part II of this document — see Addendum B)*.
- Per-user timezone-aware scheduling — unchanged from the parent spec; Section 2's 6pm Eastern decision is logged as a known limitation, not solved here.
- Multi-caregiver attribution in letter content (Section 3.5) — implement the hook only if attribution data already exists on log entries; do not build new attribution infrastructure as part of this addendum.

### 6.3 Acceptance criteria

- A letter for a week with specific logged notes references at least one specific detail from that week's actual content, not only counts.
- A letter for a genuinely empty week is still generated, is shorter than a full-week letter, and reads as warm rather than apologetic or gap-flagging.
- A second consecutive letter for the same child, where the prior week's letter had a clear specific detail, at least sometimes (not necessarily every time) references that detail naturally.
- A first-ever letter for a new child contains no reference to a prior week and does not error on the missing continuity fields.
- No letter for any week describes a vitals/growth value with clinical or alarm language, verified by the same review standard applied elsewhere to vitals display.
- Free-tier (non-subscribed, post-trial) accounts can view weekly letters with no paywall or locked state, verified against the NZA-SUB-v1.0 capability service directly rather than assumed.

---

# Part II — Addendum B: Email Delivery via Shared SES Account

*(NZA-WEEKLY-LETTER-v1.0-ADDENDUM-B)*

**Parent specs:** NZA-WEEKLY-LETTER-v1.0, ADDENDUM-A, NZA-NOTIF-v1.0

## 1. Purpose

Brings email delivery into scope for the weekly letter, reversing non-goal #1 in the parent spec ("no SES/SendGrid/nodemailer infra exists... a separate workstream"). Email now ships in v1, reusing the same AWS SES account Claricito already sends from, via the `claricito-email-dispatcher` extension architected in NZA-NOTIF-v1.0. This addendum specifies the account-sharing considerations, the taxonomy/governance addition this requires, and the data model and implementation changes.

> **Note:** Section 6 of this Part is corrected by Addendum C (Part III, Section 3.1) — the weekly letter email is the **full letter**, not a teaser. The original text of Section 6 is preserved below for record; treat Part III as authoritative on this point.

## 2. Decision Summary

- Email delivery for the weekly letter is in scope for v1, not deferred.
- Sends go through the same SES account Claricito uses today, via the existing `claricito-email-dispatcher` (extended for Nianza's engagement sends per NZA-NOTIF-v1.0 §7.2), rather than standing up new sending infrastructure.
- Sender identity is `patricia@nianzaapp.com` (or the closest available Nianza-branded address under that domain), verified as its own SES identity distinct from Claricito's.
- Push-on-new-letter remains deferred per the parent spec's non-goal — this addendum is email-only and does not change that.

## 3. Account-Sharing Considerations

Reusing an existing SES account is the right call for cost and speed, but sharing an account across two products is not risk-free by default. Four things need explicit configuration rather than assumption:

| Concern | Decision | Why it matters |
|---|---|---|
| **Sender identity** | `patricia@nianzaapp.com` verified as its own SES identity (domain or address, per DNS setup convenience), with its own DKIM/SPF records. | Never reuses Claricito's From address. A parent's first Patricia email should say Patricia, not the other product this infrastructure also serves. |
| **Configuration set** | Separate SES configuration set for Nianza sends, distinct from Claricito's. | Isolates bounce/complaint-rate reputation tracking so a spike in one product's sending pattern doesn't throttle or flag the other's deliverability. |
| **Suppression scope** | Nianza's own `EmailSuppressionList` table (per NZA-NOTIF-v1.0 §8.5) is the authoritative pre-send check. SES's native account-level suppression list is shared across all identities in the account by default — do not rely on it alone as the Nianza-specific suppression source. | A bounce or complaint against an address from a Claricito send would otherwise suppress that same address for Nianza sends, and vice versa, since account-level suppression isn't scoped per identity unless explicitly configured per configuration set. |
| **IP pool / sending infrastructure** | Shared is acceptable at current volume; revisit dedicated IP pool if either product's volume or reputation profile diverges materially. | Not a launch blocker — flagged so it isn't forgotten if Nianza's send volume grows past what made sense when this was written. |

## 4. Taxonomy Update to NZA-NOTIF-v1.0

The weekly letter doesn't fit the existing seven-category taxonomy cleanly. NZA-NOTIF-v1.0's governance model mirrors email to whatever event wins that day's push arbitration — but the weekly letter has no push counterpart (deferred by design), so the mirroring rule doesn't apply to it. It belongs in the same class as Re-engagement: email-only, exempt from the push cap, never competing in priority arbitration because there's no push slot to compete for.

| Category | Examples | Channel(s) | Cap Treatment |
|---|---|---|---|
| **Weekly letter (email)** | New weekly-letter-ready notice | Email only | No push counterpart (deferred per parent spec). Exempt from the daily push cap, same class as Re-engagement. Not subject to the "email mirrors push" rule in NZA-NOTIF-v1.0 §4. |

*Recommend this row be added directly to NZA-NOTIF-v1.0 §3 when that spec is next revised, so the taxonomy table stays the single source of truth rather than this addendum silently amending it.*

## 5. Data Model Additions

### 5.1 WeeklyLettersTable — new fields

| Field | Type | Notes |
|---|---|---|
| `emailStatus` | enum | `not_sent` / `sent` / `bounced` / `complained` / `suppressed` |
| `emailSentAt` | timestamp, nullable | |
| `emailMessageId` | string, nullable | SES message ID, for delivery tracing |

### 5.2 EmailSuppressionList (existing table, per NZA-NOTIF-v1.0 §8.5)

No schema change. This table remains the pre-send check for weekly letter emails specifically. Confirm the dispatcher extension checks this table before every Nianza send regardless of category, not only for the categories originally scoped in NZA-NOTIF-v1.0.

## 6. Architecture Notes

- Weekly letter generation (`WeeklyLetterFunction`, per the parent spec) calls the dispatcher directly after a letter is generated and stored — this is an email-only send, so it does not route through the NZA-NOTIF-v1.0 orchestrator's push-arbitration path, since there's nothing to arbitrate against.
- It does, however, still check `EmailSuppressionList` before sending, same as every other Nianza engagement email.
- Dispatcher must select the correct configuration set (Section 3) and From identity (`patricia@nianzaapp.com`) based on which product is calling it — confirm the dispatcher's extension takes a product/sender-identity parameter rather than defaulting to Claricito's existing configuration.
- ~~Email content: subject + short body derived from the same generated letter content (title, preview, greeting) already produced for in-app display — no separate email-specific generation call needed. The email should function as a warm summary/teaser that opens the full letter in-app, not a full duplicate of the in-app letter body.~~ **Superseded — see Part III, Section 3.1: the email is the full letter, not a teaser.**

## 7. Edge Cases & Open Questions

- DNS/domain setup for `nianzaapp.com` as a verified SES identity (or subdomain, e.g. `mail.nianzaapp.com`, if preferred for deliverability isolation from any other DNS records on the root domain) is an infrastructure task not yet scheduled — flag for whoever owns domain/DNS.
- ~~Reply-to behavior: if a parent replies to a weekly letter email, where does that go? Recommend a monitored inbox or explicit no-reply framing in the email footer if replies aren't handled yet — needs a decision before launch, not left implicit.~~ **Resolved — see Part III, Section 3.2: no reply-to path; footer redirects to the app.**
- SES sending quota/rate limits are account-wide; confirm current Claricito volume plus projected Nianza weekly-letter volume (one email per active child per week) stays comfortably within the account's current sending limits, or request a limit increase proactively rather than discovering it at send time.

## 8. Implementation Instructions for Cowork

### 8.1 Scope

- Verify `patricia@nianzaapp.com` (or agreed equivalent) as a new SES identity, with DKIM/SPF configured.
- Create a separate SES configuration set for Nianza sends.
- Extend `claricito-email-dispatcher` to accept a product/sender-identity parameter, defaulting to Claricito's existing configuration for Claricito's own calls (no regression) and using the new Nianza identity/configuration set when called from Nianza services.
- Add `emailStatus`, `emailSentAt`, `emailMessageId` fields to `WeeklyLettersTable`.
- Wire `WeeklyLetterFunction` to call the dispatcher after successful letter generation, checking `EmailSuppressionList` first.
- Add the new taxonomy row (Section 4) to NZA-NOTIF-v1.0 §3 for documentation consistency.

### 8.2 Explicitly out of scope for this pass

- Push-on-new-letter-ready — remains deferred per the parent spec.
- Reply handling — resolved as not needed, see Part III.
- Dedicated IP pool — only needed if volume/reputation concerns materialize; not built preemptively.

### 8.3 Acceptance criteria

- A weekly letter email sends from `patricia@nianzaapp.com`, never from Claricito's sender identity, verified by inspecting the From header on a real test send.
- A test address added to `EmailSuppressionList` never receives a weekly letter email, verified by attempting a send against it.
- A simulated bounce or complaint against a Claricito-only test address does not suppress that same address for a Nianza send, and vice versa — verified against the configuration-set isolation, not assumed.
- Existing Claricito sends continue to work unchanged after the dispatcher extension — regression check, not just a new-feature check.
- `emailStatus` on `WeeklyLettersTable` accurately reflects sent/bounced/complained/suppressed state for a sample of real sends.

---

# Part III — Addendum C: Email Template, Matching Claricito's Sunday Letter Format

*(NZA-WEEKLY-LETTER-v1.0-ADDENDUM-C)*

**Parent specs:** NZA-WEEKLY-LETTER-v1.0, ADDENDUM-A, ADDENDUM-B

## 1. Purpose

Specifies Nianza's weekly letter email to match the visual and structural format of Claricito's existing Sunday Letter email, per direct reference (two screenshots of a live Sunday Letter, reviewed August 1, 2026). Documents the reference format, the Nianza mapping, one correction to Addendum B's architecture assumption, and a resolution to Addendum B's open reply-to question.

## 2. Reference Format — Claricito's Sunday Letter

Observed structure, top to bottom, from the reviewed screenshots:

- **Banner header:** warm cream/khaki background, product wordmark in caps, centered, wide letter-spacing, dark text.
- **Body panel:** near-black background, distinct break from the light banner above it.
- **Eyebrow label:** small caps, gold/amber accent color — "FROM CLARI" — the persona identifies itself before any letter content appears.
- **Full letter body:** serif type, off-white text on the dark panel, multiple paragraphs. This is the complete letter, not a preview or teaser.
- **Signature:** "— Clari," first person, no corporate sign-off or logo repeated at the close.
- **Footer:** small gray text — "Open the [app] to reply or read your letter archive" — with "letter archive" as the only link in the email. No button-style CTA anywhere in the template.

*One element is unconfirmed: the word "letter" appears with a yellow highlight in one screenshot, which may be intentional design or may be the email client highlighting a search term the user had typed. This addendum does not treat it as confirmed design and does not carry it into the Nianza template pending clarification.*

One formatting defect observed and not carried forward: an emphasized word appears wrapped in literal asterisks (`*holding*`) rather than rendered as italics — markdown emphasis that was not converted to HTML `<em>` before send. Section 5 specifies the fix for Nianza's template.

## 3. Corrections to Prior Addenda

### 3.1 Correction to Addendum B — email is the full letter, not a teaser

Addendum B, Section 6, stated the weekly letter email "should function as a warm summary/teaser that opens the full letter in-app, not a full duplicate of the in-app letter body." The reference format contradicts this: Claricito sends the complete letter in the email itself. Nianza's weekly letter email is revised to match — the full generated letter (greeting + bodyText + closing) is the email body, not a truncated preview. **This supersedes the relevant sentence in Addendum B §6.**

### 3.2 Resolution to Addendum B's open reply-to question

Addendum B, Section 7, flagged reply-to handling as an unresolved decision. The reference format resolves it: there is no reply-to path. The footer directs the parent back into the app ("Open the Nianza app to reply or read your letter archive") rather than supporting inbound email replies. Nianza's template follows the same pattern — verified sender identity can remain a standard no-reply-style configuration, with the footer link doing the work of redirecting engagement back to the app rather than an email reply thread.

## 4. Nianza Mapping

| Claricito element | Nianza equivalent |
|---|---|
| "CLARICITO" wordmark banner | "NIANZA" wordmark banner, same cream banner / dark body two-panel structure |
| "FROM CLARI" eyebrow label | "FROM PATRICIA" eyebrow label, same small-caps gold/amber treatment |
| Full letter body, serif, off-white on near-black | Full generated letter body (greeting + bodyText + closing fields), same typography treatment |
| "— Clari" signature | "— Patricia" signature |
| "Open the Claricito app to reply or read your letter archive" | "Open the Nianza app to reply or read your letter archive," linking to the in-app weekly letters list |

## 5. Content Field Mapping

Maps the letter's existing structured output (per NZA-WEEKLY-LETTER-v1.0 and Addendum A) onto the email template:

| Generated field | Email placement |
|---|---|
| `title` | Not shown in the email body (matches reference — no title line appears in the Claricito letter body). Used for the subject line — see Section 6. |
| `greeting`, `bodyText`, `closing` | Concatenated as the full letter body in the dark panel, in order, matching the reference's single continuous letter text. |
| `themeLabel` | Not displayed in the email (the reference shows no visible theme chip or label in the letter itself). Remains in-app only, consistent with the reference format. |
| `preview` | Not used in the email — this field exists for the in-app letters list, not the email. |
| `priorLetterKeyBeat` (Addendum A) | Not surfaced as a separate element — if the generated `bodyText` naturally includes a callback per Addendum A §4, it flows through as part of the body text like any other sentence, not a distinct visual element. |

*Markdown emphasis (e.g. `*word*`) produced by the model must be converted to HTML `<em>` or `<i>` tags in the email template before send, not passed through literally — this is the one defect from the reference format this addendum explicitly does not replicate.*

## 6. Subject Line

Not visible in the reviewed screenshots (email client shows the opened message, not the inbox subject line). Recommend a consistent, simple pattern rather than guessing at Claricito's exact convention: "Patricia's letter — [Child]'s week" or "This week with [Child]" using the letter's `title` field as the basis. Flagged as needing either a look at Claricito's actual subject convention (if available) or a product decision, not left to engineering to invent independently.

## 7. Visual Style Reference

Approximate values from the reviewed screenshots, for implementation — exact hex values should be confirmed against Claricito's actual template source/HTML if available, rather than estimated from a photo of a phone screen:

| Element | Approx. treatment |
|---|---|
| Banner background | Warm cream/khaki (approx. `#E8E2D3`) |
| Banner text | Dark charcoal, centered, wide letter-spacing, all caps |
| Body panel background | Near-black (approx. `#141414`) |
| Eyebrow label | Small caps, gold/amber accent (approx. `#C9A227`) |
| Body text | Off-white/cream serif (approx. `#EDEAE2`) |
| Footer text | Muted gray, small size (approx. `#8A8A85`) |
| CTA style | No button anywhere — the only interactive element is the "letter archive" text link in the footer |

*If Claricito's actual HTML email template source is available (rather than reconstructing from screenshots), pulling it directly and adapting only the wordmark, eyebrow label, and signature is preferable to rebuilding the layout from visual inspection — flagged for whoever owns claricito-email-dispatcher's templates.*

## 8. Implementation Instructions for Cowork

### 8.1 Scope

- Locate Claricito's existing Sunday Letter HTML template within `claricito-email-dispatcher` and confirm exact structure/CSS before rebuilding from the screenshot-based approximation in Section 7.
- Create a Nianza weekly-letter HTML email template following Section 4's mapping, reusing Claricito's template structure/CSS where the underlying HTML supports parameterizing the wordmark, eyebrow label, and signature rather than duplicating the whole template file.
- Ensure the dispatcher converts markdown emphasis in generated letter text to HTML `<em>`/`<i>` before render, per Section 5's fix.
- Confirm no reply-to inbox needs to be provisioned, per Section 3.2 — the footer link, not email reply, is the engagement path back to the app.
- Resolve the subject line per Section 6 — confirm with product before defaulting to the recommended pattern.
- Wire the "letter archive" footer link to deep-link into the in-app weekly letters list (`reports.tsx` per the parent spec), matching Claricito's equivalent deep link pattern if one already exists to reuse.

### 8.2 Explicitly out of scope for this pass

- Confirming the yellow-highlight treatment on "letter" in the footer — do not implement until confirmed as intentional design rather than an artifact of the reference screenshot.
- Any reply-handling infrastructure — explicitly not needed per Section 3.2.

### 8.3 Acceptance criteria

- A test weekly letter email renders with the cream banner / dark body two-panel structure, "FROM PATRICIA" eyebrow, full letter text, "— Patricia" signature, and footer link — visually consistent with the reference Sunday Letter format.
- No literal asterisks or unconverted markdown appear in a rendered test email, even when the underlying generated letter text contains emphasis markers.
- The footer's "letter archive" link opens directly to the in-app weekly letters list on a test device.
- Existing Claricito Sunday Letter sends are unaffected by any shared-template refactor — regression check, not just a new-template check.
