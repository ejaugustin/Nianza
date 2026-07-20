const ROLE_SUPER_ADMIN = "super_admin";
const ROLE_CONTENT_EDITOR = "content_editor";
const ROLE_OPERATIONS = "operations";

function decodeJwtPayload(token) {
  const [, payload] = token.split(".");
  if (!payload) return {};
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function actorFromEvent(event) {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
  if (claims) {
    return {
      userId: claims.sub || "unknown",
      email: claims.email || "unknown",
      role: claims["custom:role"] || claims.role || ROLE_OPERATIONS,
      isAuthenticated: Boolean(claims.sub)
    };
  }

  const authorization = event.headers?.Authorization || event.headers?.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return { userId: "anonymous", email: "anonymous", role: ROLE_OPERATIONS, isAuthenticated: false };

  try {
    const payload = decodeJwtPayload(token);
    return {
      userId: payload.sub || "unknown",
      email: payload.email || "unknown",
      role: payload["custom:role"] || payload.role || ROLE_OPERATIONS,
      isAuthenticated: Boolean(payload.sub)
    };
  } catch {
    return { userId: "unknown", email: "unknown", role: ROLE_OPERATIONS, isAuthenticated: false };
  }
}

function hasRole(actor, allowedRoles) {
  return allowedRoles.includes(actor.role);
}

module.exports = {
  ROLE_SUPER_ADMIN,
  ROLE_CONTENT_EDITOR,
  ROLE_OPERATIONS,
  actorFromEvent,
  hasRole
};
