# Forward-looking product notes

Running log of ideas surfaced during implementation that are genuinely
promising but out of scope for the feature they came up in. Not committed to
a roadmap -- just captured here so they don't get lost.

---

## Standing convention: instructional copy is Patricia's voice

**Decided:** July 2026, per Ej: "conversation with Patricia is the essence of
the app." Any copy that's inviting the parent to do something or explaining
why -- offer banners, empty states, onboarding-style prompts, confirmations
that carry real meaning ("I'll keep this safe until...") -- should read as
Patricia speaking in first person, not generic system copy. This was
retrofitted across the postcard offer, voice memory/capsule prompts, the
capsule shelf, and the custom-firsts sheet in the Delight/Memory feature set.

**What stays functional, not voiced:** button labels (Save, Not now, Done),
loading states, and mechanical how-to text (e.g. "Tap 'Add photo' on any
milestone..."). The existing pattern elsewhere in the app (visit-debrief
screen, birthday letter Home card) already drew this line correctly before
this was made explicit -- this is documenting an existing convention, not
inventing a new one.

**Apply this going forward:** any new instructional/prompt copy in future
features should default to Patricia's first-person voice from the start,
rather than being retrofitted later.

---

## M16 (Family postcards): adaptive offer throttle

**Where this came from:** while shipping the postcard feature (Delight
backlog, July 2026), we set `lastPostcardOfferAt` to throttle the "want to
share this?" offer to at most once every two weeks, flat, for everyone. Ej
flagged that if postcard usage turns out to be as high as expected, a fixed
two-week cooldown may end up under-serving parents who want to share
constantly.

**The idea:** make the cooldown adaptive per-family instead of a global
constant. If a parent has made and shared several postcards in a short
window, that's a signal they want the feature more, not less -- shorten
their cooldown. Conversely, a parent who consistently taps "Not now" is
telling us to back off; lengthen theirs instead. This is a small
personalization loop on top of infrastructure that already exists
(`lastPostcardOfferAt` on the child record, `markPostcardOffered()` on
mobile) -- would need one new signal (accept vs. decline rate) tracked
alongside the timestamp.

**Worth validating first:** whether real usage after launch actually shows
the bimodal pattern (heavy sharers vs. non-users) that would justify this,
or whether the flat two-week default is already fine. Cheap to check with
basic offer-accept-rate telemetry before building anything.

---

## Recipient-side "family view" (no-login feed)

**Where this came from:** same conversation. Today, sharing a postcard is a
one-way trip through the OS share sheet -- it lands in a text thread or
email and Nianza has no idea what happened to it after that. There's no
record on the recipient's side, and grandparents/family members have no
persistent place to go back and see what's been shared over time.

**The idea:** a lightweight, no-login "family view" -- a shareable link
(one per child, or one per invited family member) that shows a running feed
of everything the parent has chosen to share: postcards, birthday letters,
maybe eventually photos from the memory book. Recipients don't need an
account; the parent controls what's visible by choosing what to share, the
same way they do today. This turns postcards from isolated one-off shares
into a cumulative, always-there family scrapbook, and gives Nianza a
second surface (the recipient's read of the link) that's a much stronger
acquisition signal than a one-off image in a text thread.

**Why it's a bigger lift than it looks:** this isn't just a new screen. It
needs a public (or invite-token-gated), read-only surface with its own
access model -- decisions about link expiry/revocation, whether recipients
can be removed, what happens if the parent deletes the child's account
(same account-deletion gap noted elsewhere -- there's no cascade-delete
Lambda in this codebase yet), and how much of the memory book (photos,
voice, capsules) is ever appropriate to expose outside the parent's own
login. Real feature, not a quick add-on -- flagged here as a "if postcard
adoption validates the demand" next step, not committed work.

**Signal to watch for:** if/when postcard share volume is meaningfully
higher than expected, or if support/feedback starts asking "can grandma see
these without me re-sending every time," that's the trigger to actually
scope this properly.
