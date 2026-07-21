const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { json, noContent, error } = require("../../shared/response");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true }
});

const CONTENT_TABLE = process.env.CONTENT_TABLE || process.env.CONTENT_LIBRARY_TABLE;
const VALID_LANGUAGES = new Set(["en", "es", "fr", "ar"]);

function parseAgeWindow(value) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function statusFor(item) {
  if (item.deleted) return "deleted";
  if (item.ejApproved) return "approved";
  if (item.clinicallyReviewed) return "reviewed";
  return "draft";
}

function serialize(item) {
  if (!item) return null;
  return {
    contentId: item.contentId,
    version: item.version,
    contentType: item.contentType,
    language: item.language,
    ageWindowMonths: item.ageWindowMonths ?? null,
    domain: item.domain ?? null,
    bodyText: item.bodyText,
    sourceRef: item.sourceRef,
    ttsEnabled: Boolean(item.ttsEnabled),
    status: statusFor(item),
    updatedAt: item.updatedAt
  };
}

function latestItem(items) {
  return [...items].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).at(0) || null;
}

function matchesAudience(item, { ageWindowMonths, domain }) {
  const ageMatches = ageWindowMonths == null || item.ageWindowMonths == null || Number(item.ageWindowMonths) === ageWindowMonths;
  const domainMatches = !domain || !item.domain || item.domain === domain;
  return ageMatches && domainMatches;
}

async function handleDailyNote(event) {
  const query = event.queryStringParameters || {};
  const language = query.language || "en";
  if (!VALID_LANGUAGES.has(language)) return error(400, "INVALID_FIELD", "language must be one of en, es, fr, ar.");

  const audience = {
    ageWindowMonths: parseAgeWindow(query.ageWindowMonths),
    domain: query.domain || undefined
  };

  const result = await documentClient.send(new QueryCommand({
    TableName: CONTENT_TABLE,
    IndexName: "language-contentType-index",
    KeyConditionExpression: "#language = :language AND contentType = :contentType",
    FilterExpression: "clinicallyReviewed = :trueValue AND ejApproved = :trueValue AND (attribute_not_exists(deleted) OR deleted = :deletedFalse)",
    ExpressionAttributeNames: { "#language": "language" },
    ExpressionAttributeValues: {
      ":language": language,
      ":contentType": "daily-note",
      ":trueValue": true,
      ":deletedFalse": false
    }
  }));

  const approvedItems = (result.Items || []).filter((item) => matchesAudience(item, audience));
  return json(200, { item: serialize(latestItem(approvedItems)) });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CONTENT_TABLE) return error(500, "CONFIGURATION_ERROR", "CONTENT_TABLE is not configured.");

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.endsWith("/content/daily-note")) return handleDailyNote(event);
    return error(404, "NOT_FOUND", "Mobile content route not found.");
  } catch (err) {
    console.error("mobile content route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile content service.");
  }
};
