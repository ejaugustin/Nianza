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
    topic: item.topic ?? null,
    bodyText: item.bodyText,
    sourceRef: item.sourceRef,
    colorTheme: item.colorTheme ?? null,
    captionFormat: item.captionFormat ?? null,
    season: item.season ?? null,
    dateRange: item.dateRange ?? null,
    templateKey: item.templateKey ?? null,
    category: item.category ?? null,
    composition: item.composition ?? null,
    bestFor: item.bestFor ?? null,
    palette: item.palette ?? null,
    ttsEnabled: Boolean(item.ttsEnabled),
    status: statusFor(item),
    updatedAt: item.updatedAt,
    // Traceability back to the source tip library (NZA daily-tip docs). Not
    // used by the client for anything functional -- just handy in the admin
    // portal / logs to see which authored tip actually served.
    tipId: item.tipId ?? null,
    startDay: item.startDay ?? item.dayOfLife ?? null
  };
}

function latestItem(items) {
  return [...items].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).at(0) || null;
}

// The daily-tip library (NZA-DAILYTIPS-v1, both the 0-12mo and 13mo-graduation
// docs) is authored as a single day-of-life-indexed sequence: every item has a
// startDay -- the day of the child's life (day 1 = date of birth) on which it
// becomes the "current" tip. Cadence differs by age (daily in year one,
// weekly/biweekly/monthly after), but that's just spacing between startDay
// values -- selection itself is always the same rule: the item with the
// largest startDay that is <= the child's current age in days. That one rule
// naturally reproduces daily rotation, weekly rotation, and eventually holds
// on GRAD-06 (the last item) once the child ages past the authored library.
function selectByDayOfLife(items, dayOfLife) {
  let best = null;
  let bestStartDay = -Infinity;
  for (const item of items) {
    const startDay = Number(item.startDay ?? item.dayOfLife);
    if (!Number.isFinite(startDay) || startDay > dayOfLife) continue;
    if (startDay > bestStartDay) {
      best = item;
      bestStartDay = startDay;
    }
  }
  return best;
}

function matchesAudience(item, { ageWindowMonths, domain }) {
  const ageMatches = ageWindowMonths == null || item.ageWindowMonths == null || Number(item.ageWindowMonths) === ageWindowMonths;
  const domainMatches = !domain || !item.domain || item.domain === domain;
  return ageMatches && domainMatches;
}

// v2.2 design decision (Nianza_Complete_Design_Brief, restated to Cowork
// 2026-07-28): the daily-tip library ships without per-item clinical review
// or ejApproved gating -- it's sourced from CDC Learn the Signs / Bright
// Futures and was curated as a batch, not per-item. clinicallyReviewed/
// ejApproved remain in the schema (and still gate other content types) but
// are intentionally NOT required here, unlike the FilterExpression this
// endpoint used to run.
async function handleDailyNote(event) {
  const query = event.queryStringParameters || {};
  const language = query.language || "en";
  if (!VALID_LANGUAGES.has(language)) return error(400, "INVALID_FIELD", "language must be one of en, es, fr, ar.");

  const dayOfLife = parseAgeWindow(query.dayOfLife);
  const audience = {
    ageWindowMonths: parseAgeWindow(query.ageWindowMonths),
    domain: query.domain || undefined
  };

  const result = await documentClient.send(new QueryCommand({
    TableName: CONTENT_TABLE,
    IndexName: "language-contentType-index",
    KeyConditionExpression: "#language = :language AND contentType = :contentType",
    FilterExpression: "attribute_not_exists(deleted) OR deleted = :deletedFalse",
    ExpressionAttributeNames: { "#language": "language" },
    ExpressionAttributeValues: {
      ":language": language,
      ":contentType": "daily-note",
      ":deletedFalse": false
    }
  }));

  const items = result.Items || [];

  // Primary selection: exact day-of-life lookup against the authored tip
  // sequence. This is what makes the note actually change day to day.
  if (dayOfLife != null) {
    const dayMatch = selectByDayOfLife(items, dayOfLife);
    if (dayMatch) return json(200, { item: serialize(dayMatch) });
  }

  // Fallback for callers that don't send dayOfLife yet, or for a child older
  // than the authored library: match by age window and take the newest.
  // This preserves the old behavior rather than returning nothing.
  const audienceMatches = items.filter((item) => matchesAudience(item, audience));
  return json(200, { item: serialize(latestItem(audienceMatches)) });
}

// N4 (Village Translator): generational-shift content ships without the
// per-item admin review gate daily-note goes through (v2.2 precedent -- it
// only restates existing vetted guidance), so this doesn't filter on
// clinicallyReviewed/ejApproved the way handleDailyNote does. `topic` picks
// out one specific item (for a G.0 "Ask Patricia" link); omitting it returns
// the whole small library for a future browse surface.
async function handleGenerationalShift(event) {
  const query = event.queryStringParameters || {};
  const language = query.language || "en";
  if (!VALID_LANGUAGES.has(language)) return error(400, "INVALID_FIELD", "language must be one of en, es, fr, ar.");

  const result = await documentClient.send(new QueryCommand({
    TableName: CONTENT_TABLE,
    IndexName: "language-contentType-index",
    KeyConditionExpression: "#language = :language AND contentType = :contentType",
    FilterExpression: "attribute_not_exists(deleted) OR deleted = :deletedFalse",
    ExpressionAttributeNames: { "#language": "language" },
    ExpressionAttributeValues: {
      ":language": language,
      ":contentType": "generational-shift",
      ":deletedFalse": false
    }
  }));

  const items = result.Items || [];
  const byTopic = new Map();
  for (const item of items) {
    const existing = byTopic.get(item.topic);
    if (!existing || String(item.updatedAt || "") > String(existing.updatedAt || "")) byTopic.set(item.topic, item);
  }

  if (query.topic) {
    const match = byTopic.get(query.topic);
    if (!match) return error(404, "NOT_FOUND", "No generational-shift content for that topic.");
    return json(200, { item: serialize(match) });
  }

  return json(200, { items: [...byTopic.values()].map(serialize) });
}

// M16 (Family postcards), per NZA-POSTCARDS-v1.0/v1.1-Seasonal: a curated
// deck of visually distinct templates (composition metadata -- the actual
// render components ship in the app). No meaningful "audience" filter, so
// this always returns the whole deck; the client sorts into core / seasonal
// / holiday and applies the date-window gate itself (never proactively
// notified, never defaulted to a seasonal/holiday pick -- DO NOT 22). Like
// generational-shift, ships without the per-item review gate since it's
// design content, not clinical text.
async function handlePostcardFrames(event) {
  const query = event.queryStringParameters || {};
  const language = query.language || "en";
  if (!VALID_LANGUAGES.has(language)) return error(400, "INVALID_FIELD", "language must be one of en, es, fr, ar.");

  const result = await documentClient.send(new QueryCommand({
    TableName: CONTENT_TABLE,
    IndexName: "language-contentType-index",
    KeyConditionExpression: "#language = :language AND contentType = :contentType",
    FilterExpression: "attribute_not_exists(deleted) OR deleted = :deletedFalse",
    ExpressionAttributeNames: { "#language": "language" },
    ExpressionAttributeValues: {
      ":language": language,
      ":contentType": "postcard-frame",
      ":deletedFalse": false
    }
  }));

  const items = result.Items || [];
  const byTemplateKey = new Map();
  for (const item of items) {
    const existing = byTemplateKey.get(item.templateKey);
    if (!existing || String(item.updatedAt || "") > String(existing.updatedAt || "")) byTemplateKey.set(item.templateKey, item);
  }

  return json(200, { items: [...byTemplateKey.values()].map(serialize) });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  if (!CONTENT_TABLE) return error(500, "CONFIGURATION_ERROR", "CONTENT_TABLE is not configured.");

  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.endsWith("/content/daily-note")) return handleDailyNote(event);
    if (event.httpMethod === "GET" && path.endsWith("/content/generational-shift")) return handleGenerationalShift(event);
    if (event.httpMethod === "GET" && path.endsWith("/content/postcard-frames")) return handlePostcardFrames(event);
    return error(404, "NOT_FOUND", "Mobile content route not found.");
  } catch (err) {
    console.error("mobile content route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile content service.");
  }
};
