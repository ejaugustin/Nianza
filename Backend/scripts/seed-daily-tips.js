// One-off seed script for the NZA-DAILYTIPS content library (contentType
// 'daily-note' -- see reconciliation note below). Run with the CONTENT_TABLE
// env var pointed at the target environment's content-library table, e.g.:
//   CONTENT_TABLE=nianza-content-library-prod node scripts/seed-daily-tips.js
//
// Sources:
//   daily-tips-0-12mo-en.json   -- Nianza_Daily_Tips_0-12mo_EN.pdf (344 tips, daily cadence)
//   daily-tips-yr2-5-en.json    -- Nianza_Daily_Tips_Yr2-5_EN.pdf (174 tips: weekly/
//                                  biweekly/monthly cadence + the 6-part graduation
//                                  sequence), dated July 18, 2026
//
// Deviations from the source docs, confirmed with Ej 2026-07-28:
//
// 1. Review gate. Both source PDFs' own header tables say "Review required:
//    clinicallyReviewed=true + ejApproved=true before any tip serves to a
//    live user." Ej explicitly overrode this for daily-tip content: "the
//    rotating tips don't need to be approved. They have already been
//    curated long ago." This matches the Design Brief's own earlier v2.2
//    decision (the daily-tip library ships without per-item clinical review
//    since it's source-derived from CDC/Bright Futures without
//    personalization risk). This script sets clinicallyReviewed/ejApproved
//    to true directly, same precedent as seed-generational-shift.js.
//
// 2. contentType naming. The source docs specify contentType: 'daily-tip'
//    (year 1) and 'daily-tip' / 'graduation-message' (years 2-5). The
//    already-deployed backend (Backend/mobile/content/handler.js), the GSI
//    (language-contentType-index), and the mobile client's MobileContentItem
//    type all use 'daily-note' instead. Rather than fork the content model,
//    this script seeds everything -- including the 6 graduation messages --
//    as contentType 'daily-note', keeping the real, deployed name. tipId
//    still records the source doc's own ID (e.g. 'NB-01', 'GRAD-04') for
//    traceability. If a distinct graduation-message surface is wanted later,
//    the client can special-case on a 'GRAD-' tipId prefix without needing a
//    second content type or endpoint.
//
// 3. Selection mechanism. Both docs are authored as a single day-of-life
//    sequence (year 1: daily; years 2-5: weekly/biweekly/monthly spacing,
//    then the graduation sequence). Rather than model "age window + rotate,"
//    every item gets a startDay -- the day of the child's life (day 1 =
//    date of birth) it becomes the current tip. Backend/mobile/content/
//    handler.js selectByDayOfLife() picks the item with the largest startDay
//    <= the child's current age in days, which reproduces daily, weekly,
//    biweekly, and monthly cadence with one rule, and naturally holds on
//    GRAD-06 once a child ages past the authored library (through age 6).
//    startDay values for years 2-5 were computed from each band's nominal
//    start (13mo/16mo/19mo/3yr/4yr/5yr/5yr+12mo) using average month =
//    30.44 days, year = 365.25 days, spaced by that band's stated cadence.
//
// 4. Pronouns. The source PDFs alternate fixed he/she pronouns per entry
//    (not the {she}/{her}/{hers} template-slot syntax the client's
//    pronoun-substitution code expects). Seeded as-authored -- since
//    bodyText contains no {slot} tokens, the client's .replaceAll() calls
//    are harmless no-ops and each tip displays exactly as written,
//    regardless of the actual child's sex. This is a known gap relative to
//    the Design Brief's "sex-aware, no arbitrary he/she alternation" goal;
//    closing it needs either a full re-author pass with {slot} tokens (and
//    a 4th token for object-pronoun uses, which the client's current
//    3-token scheme doesn't distinguish from possessive-determiner uses) or
//    two parallel sex-specific libraries. Flagged, not fixed, in this pass.
//
// 5. No `domain` field. These tips aren't categorized by developmental
//    domain (movement/sleep/feeding/etc) -- they're a straight sequential
//    program. domain is left unset, matching the mobile fix that stopped
//    sending a domain filter.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const YEAR1_TIPS = require("./daily-tips-0-12mo-en.json");
const YEAR2_5_TIPS = require("./daily-tips-yr2-5-en.json");

const CONTENT_TABLE = process.env.CONTENT_TABLE;
const LANGUAGE = "en";

function toContentItem(tip, now) {
  const startDay = tip.startDay ?? tip.dayOfLife;
  return {
    contentId: `daily-note#en#${tip.tipId.toLowerCase()}`,
    version: "1.0.0",
    contentType: "daily-note",
    language: LANGUAGE,
    tipId: tip.tipId,
    startDay,
    dayOfLife: tip.dayOfLife ?? null, // kept for year-1 items for backward compatibility with any code reading dayOfLife directly
    ageWindowMonths: tip.ageWindowMonths,
    domain: null,
    bodyText: tip.bodyText,
    sourceRef: tip.tipId.startsWith("GRAD-")
      ? "Nianza_Daily_Tips_Yr2-5_EN.pdf (graduation sequence)"
      : startDay <= 344
        ? "Nianza_Daily_Tips_0-12mo_EN.pdf (CDC Learn the Signs / Bright Futures)"
        : "Nianza_Daily_Tips_Yr2-5_EN.pdf (CDC Learn the Signs / Bright Futures)",
    ttsEnabled: true,
    clinicallyReviewed: true,
    ejApproved: true,
    deleted: false,
    createdBy: "seed-script",
    createdAt: now,
    updatedAt: now
  };
}

async function main() {
  if (!CONTENT_TABLE) {
    console.error("Set CONTENT_TABLE before running this script.");
    process.exit(1);
  }

  const rawClient = new DynamoDBClient({});
  const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
  const now = new Date().toISOString();

  const allTips = [...YEAR1_TIPS, ...YEAR2_5_TIPS];
  const seenIds = new Set();
  let count = 0;

  for (const tip of allTips) {
    if (seenIds.has(tip.tipId)) {
      console.error(`Duplicate tipId ${tip.tipId}, skipping.`);
      continue;
    }
    seenIds.add(tip.tipId);

    const item = toContentItem(tip, now);
    await documentClient.send(new PutCommand({ TableName: CONTENT_TABLE, Item: item }));
    count += 1;
    if (count % 25 === 0) console.log(`Seeded ${count}/${allTips.length}...`);
  }

  console.log(`Done. Seeded ${count} daily-note items (${YEAR1_TIPS.length} year-1 + ${YEAR2_5_TIPS.length} years 2-5/graduation).`);
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
