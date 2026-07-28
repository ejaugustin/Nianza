// One-off seed script for N4 (Village Translator) content. Run with the
// CONTENT_TABLE env var pointed at the target environment's content-library
// table, e.g.:
//   CONTENT_TABLE=nianza-content-library-prod node scripts/seed-generational-shift.js
//
// English only for now -- translation to es/fr/ar is future scope, not
// required to ship N4. Per Brief v2.15 (source-derived from AAP/Bright
// Futures, v2.2 precedent), these ship without the per-item admin review
// workflow other content types go through, so this script sets
// clinicallyReviewed/ejApproved true directly rather than going through
// admin/content's draft -> review -> approve flow.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { GENERATIONAL_SHIFT_ITEMS } = require("../mobile/content/generational-shift-seed");

const CONTENT_TABLE = process.env.CONTENT_TABLE;

async function main() {
  if (!CONTENT_TABLE) {
    console.error("Set CONTENT_TABLE before running this script.");
    process.exit(1);
  }

  const rawClient = new DynamoDBClient({});
  const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
  const now = new Date().toISOString();

  for (const seedItem of GENERATIONAL_SHIFT_ITEMS) {
    const item = {
      contentId: `generational-shift#en#global#${seedItem.topic}`,
      version: "1.0.0",
      contentType: "generational-shift",
      language: "en",
      topic: seedItem.topic,
      ageWindowMonths: null,
      domain: null,
      bodyText: seedItem.bodyText,
      sourceRef: seedItem.sourceRef,
      ttsEnabled: true,
      clinicallyReviewed: true,
      ejApproved: true,
      deleted: false,
      createdBy: "seed-script",
      createdAt: now,
      updatedAt: now
    };

    await documentClient.send(new PutCommand({ TableName: CONTENT_TABLE, Item: item }));
    console.log(`Seeded: ${item.contentId}`);
  }

  console.log(`Done. Seeded ${GENERATIONAL_SHIFT_ITEMS.length} generational-shift items.`);
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
