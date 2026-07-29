// One-off seed script for M16 (Family postcards) template library. Run with
// the CONTENT_TABLE env var pointed at the target environment's
// content-library table, e.g.:
//   CONTENT_TABLE=nianza-content-library-prod node scripts/seed-postcard-templates.js
//
// These are design templates (color theme + caption format), not clinical
// guidance, so like generational-shift they skip the per-item admin review
// gate and are marked reviewed/approved directly by this script.
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { POSTCARD_TEMPLATES } = require("../mobile/content/postcard-templates-seed");

const CONTENT_TABLE = process.env.CONTENT_TABLE;

async function main() {
  if (!CONTENT_TABLE) {
    console.error("Set CONTENT_TABLE before running this script.");
    process.exit(1);
  }

  const rawClient = new DynamoDBClient({});
  const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });
  const now = new Date().toISOString();

  for (const template of POSTCARD_TEMPLATES) {
    const item = {
      contentId: `postcard-template#en#global#${template.templateId}`,
      version: "1.0.0",
      contentType: "postcard-template",
      language: "en",
      topic: template.templateId,
      ageWindowMonths: null,
      domain: null,
      bodyText: template.captionFormat,
      sourceRef: null,
      colorTheme: template.colorTheme,
      captionFormat: template.captionFormat,
      season: template.season || null,
      dateRange: template.dateRange || null,
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

  console.log(`Done. Seeded ${POSTCARD_TEMPLATES.length} postcard templates.`);
}

main().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
