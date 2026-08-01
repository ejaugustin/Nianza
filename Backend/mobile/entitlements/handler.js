// NZA-SUB-v1.0 Section 8.1: read-side of the capability service, exposed to
// the mobile client so screens can gate UI (show/hide locked-feature
// affordances, show remaining Patricia messages) without guessing at
// subscription state themselves. Backend handlers enforce the same rules
// independently via shared/entitlements.js directly -- this endpoint is for
// the client's own UI decisions, not the source of truth for enforcement.
const { json, noContent, error } = require("../../shared/response");
const { getEntitlements, getTrialNotice, acknowledgeTrialNotice } = require("../../shared/entitlements");

function claimsFromEvent(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims || {};
  return { userId: claims.sub || "local-acceptance-user" };
}

function parseBody(event) {
  if (!event.body) return {};
  return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
}

// NZA-SUB-v1.0 Section 3/6: parentFirstName/childName are optional query
// params so the exact same {Name}/{Child} interpolation the client already
// sends on /chat (parentFirstName) and has on hand in profile (childName)
// can fill Section 6's copy server-side, keeping "verbatim, not paraphrased"
// (Section 8.4) enforceable in one place rather than templated client-side.
async function handleGetEntitlements(event) {
  const { userId } = claimsFromEvent(event);
  const query = event.queryStringParameters || {};
  const [entitlements, trialNotice] = await Promise.all([
    getEntitlements(userId),
    getTrialNotice(userId, new Date(), { parentFirstName: query.parentFirstName, childName: query.childName })
  ]);
  return json(200, { ...entitlements, trialNotice });
}

// POST /mobile/v1/entitlements/trial-notice/ack -- called only once the
// Day 10 or Day 14 card has actually been shown (or dismissed) on-screen,
// per Section 8.4's "exactly one notification" acceptance criterion. No
// push equivalent exists yet -- see the delivery-infrastructure gap noted
// in admin/notifications/handler.js; this endpoint governs the in-app card
// only, which is the one channel this backend can actually enforce today.
async function handleAckTrialNotice(event) {
  const { userId } = claimsFromEvent(event);
  const body = parseBody(event);
  if (body.type !== "day10" && body.type !== "day14") {
    return error(400, "INVALID_FIELD", "type must be one of: day10, day14.");
  }
  const result = await acknowledgeTrialNotice(userId, body.type);
  return json(200, result);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "GET" && path.endsWith("/entitlements")) return handleGetEntitlements(event);
    if (event.httpMethod === "POST" && path.endsWith("/trial-notice/ack")) return handleAckTrialNotice(event);
    return error(404, "NOT_FOUND", "Mobile entitlements route not found.");
  } catch (err) {
    console.error("mobile entitlements route failed", err);
    return error(500, "INTERNAL_ERROR", "Something went wrong in the mobile entitlements service.");
  }
};
