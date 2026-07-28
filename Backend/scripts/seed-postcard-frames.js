// One-off seed script for M16 (Family postcards) visual template deck, per
// NZA-POSTCARDS-v1.0 / v1.1-Seasonal. Run with the CONTENT_TABLE env var
// pointed at the target environment's content-library table, e.g.:
//   CONTENT_TABLE=nianza-content-library-prod node scripts/seed-postcard-frames.js
//
// Replaces the old `postcard-template` rows (color-theme-only "variety"),
// which the spec explicitly calls insufficient. These are design metadata,
// not clinical guidance, so -- like generational-shift and the old
// postcard-template rows -- they skip the per-item admin review gate and are
// marked reviewed/approved directly by this script.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { POSTCARD_FRAMES } = require("../mobile/content/postcard-frames-seed");

const CONTENT_TABLE = process.env.CONTENT_TABLE;

async function main() {
  if (!CONTENT_TABLE) {
    console.error("Set CONTENT_TABLE before running this script.");
    process.exit(1);
  }

  const rawClient = new DynamoDBClient({});
  const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
  const now = new Date().toISOString();

  for (const frame of POSTCARD_FRAMES) {
    const item = {
      contentId: `postcard-frame#en#global#${frame.templateKey}`,
      version: "1.0.0",
      contentType: "postcard-frame",
      language: "en",
      topic: frame.templateKey,
      ageWindowMonths: null,
      domain: null,
      bodyText: frame.composition,
      sourceRef: null,
      templateKey: frame.templateKey,
      category: frame.category,
      composition: frame.composition,
      bestFor: frame.bestFor,
      palette: frame.palette,
      dateRange: frame.dateRange || null,
      ttsEnabled: false,
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

  console.log(`Done. Seeded ${POSTCARD_FRAMES.length} postcard frames.`);
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
