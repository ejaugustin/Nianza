const ALLOWED_LOCAL_TIMES = new Set(["morning", "afternoon", "witching-hour", "night"]);
const ALLOWED_SEED_TYPES = new Set(["milestone-checked", "sick-encounter-active", "visit-upcoming", "capsule-invite", "custom-first"]);

function truncate(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function sanitizeAmbientContext(value) {
  if (!value || typeof value !== "object") return undefined;
  return {
    sourceScreen: truncate(value.sourceScreen, 80) || "unknown",
    screenState: truncate(value.screenState, 120),
    localTime: ALLOWED_LOCAL_TIMES.has(value.localTime) ? value.localTime : "afternoon"
  };
}

function sanitizeContextSeed(value) {
  if (!value || typeof value !== "object" || !ALLOWED_SEED_TYPES.has(value.eventType)) return undefined;
  return {
    sourceScreen: truncate(value.sourceScreen, 40) || "unknown",
    eventType: value.eventType,
    detail: truncate(value.detail, 160) || "Parent-opened context",
    occurredAt: truncate(value.occurredAt, 40) || new Date().toISOString()
  };
}

function hasVaccineContext(bundle) {
  const text = `${bundle.ambientContext?.sourceScreen || ""} ${bundle.ambientContext?.screenState || ""}`.toLowerCase();
  return text.includes("vaccine") || text.includes("dtap") || text.includes("immunization") || text.includes("e1");
}

function vaccineName(bundle) {
  const state = bundle.ambientContext?.screenState || "";
  const dtap = state.match(/dtap/i);
  if (dtap) return "DTaP";
  return "the vaccine that is due";
}

function generatePatriciaReply(message, bundle) {
  const normalized = String(message || "").toLowerCase();
  const childName = bundle.childSnapshot?.name || "your child";

  if (hasVaccineContext(bundle) && /expect|next|due|shot|vaccine|immun/i.test(normalized)) {
    const name = vaccineName(bundle);
    return `${name} is the one to keep on your list for ${childName}. I would ask the pediatrician what they want you to expect afterward, what would be normal for that day, and what would make them want a call. Write those three down before the visit. Tired parents forget very reasonable questions.`;
  }

  if (bundle.contextSeed?.eventType === "milestone-checked") {
    return "That is worth noticing. Tell me what you saw first, not the polished version. The small details are usually where the useful part is.";
  }

  if (bundle.contextSeed?.eventType === "sick-encounter-active") {
    return "Keep this simple. What changed first, what has stayed the same, and what would you want the doctor to know if you called? I will help you put it in order.";
  }

  if (bundle.contextSeed?.eventType === "visit-upcoming") {
    return "Let's make the visit easier before you walk in. Start with the question you are most afraid you will forget.";
  }

  if (bundle.todaysNote?.bodyText && /note|this morning|today/i.test(normalized)) {
    return "That note is a good place to start. What part felt true in your house today?";
  }

  return "I am here with you. Say the messy version first, and we will sort it into something useful.";
}

module.exports = {
  generatePatriciaReply,
  sanitizeAmbientContext,
  sanitizeContextSeed
};
