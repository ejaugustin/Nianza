const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_LOCAL_TIMES = new Set(["morning", "afternoon", "witching-hour", "night"]);
const ALLOWED_SEED_TYPES = new Set([
  "general",
  "home",
  "reports",
  "vaccines",
  "weekly-letter",
  "milestone-checked",
  "watch-for-noticed",
  "sick-encounter-active",
  "visit-upcoming",
  "capsule-invite",
  "custom-first",
  "generational-shift"
]);
const BANNED_PHRASES = [
  /\bI see you (?:were|are)\b/i,
  /\bI noticed you (?:were|are)\b/i,
  /\bvaccine screen\b/i,
  /\bbased on your recent\b/i
];

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
    screenState: truncate(value.screenState || value.detail, 300),
    childId: truncate(value.childId, 120),
    childName: truncate(value.childName, 80),
    localTime: ALLOWED_LOCAL_TIMES.has(value.localTime) ? value.localTime : "afternoon",
    topics: Array.isArray(value.topics) ? value.topics.map((topic) => truncate(topic, 40)).filter(Boolean).slice(0, 5) : []
  };
}

function sanitizeContextSeed(value) {
  if (!value || typeof value !== "object" || !ALLOWED_SEED_TYPES.has(value.eventType)) return undefined;
  return {
    sourceScreen: truncate(value.sourceScreen, 40) || "unknown",
    eventType: value.eventType,
    entityId: truncate(value.entityId, 120),
    detail: truncate(value.detail, 160) || "Parent-opened context",
    occurredAt: truncate(value.occurredAt, 40) || new Date().toISOString()
  };
}

function hasVaccineContext(bundle) {
  const dueNames = bundle.recentEvents?.vaccines?.dueDoseNames || [];
  const text = `${bundle.ambientContext?.sourceScreen || ""} ${bundle.ambientContext?.screenState || ""} ${dueNames.join(" ")}`.toLowerCase();
  return text.includes("vaccine") || text.includes("dtap") || text.includes("immunization") || text.includes("e1");
}

function vaccineName(bundle) {
  const dueName = bundle.recentEvents?.vaccines?.dueDoseNames?.[0];
  if (dueName) return dueName;
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

  if (bundle.contextSeed?.eventType === "watch-for-noticed") {
    return "You did the right thing by setting this aside for the visit. Tell me what you have noticed in real life, and I will help you turn it into a clear question for the pediatrician.";
  }

  if (bundle.contextSeed?.eventType === "sick-encounter-active") {
    const recentEntries = bundle.recentEvents?.encounter?.recentEntries || [];
    const soFar = recentEntries.length ? ` I can see you've logged ${recentEntries.slice(0, 3).join("; ")} so far.` : "";
    return `Keep this simple.${soFar} What changed first, what has stayed the same, and what would you want the doctor to know if you called? I will help you put it in order.`;
  }

  if (bundle.contextSeed?.eventType === "visit-upcoming") {
    return "Let's make the visit easier before you walk in. Start with the question you are most afraid you will forget.";
  }

  if (bundle.todaysNote?.bodyText && /note|this morning|today/i.test(normalized)) {
    return "That note is a good place to start. What part felt true in your house today?";
  }

  if (/\b(developing|development|milestone|right way|normal|on track|look for)\b/i.test(normalized)) {
    return `For ${childName}, I would watch for a few everyday things: how they move, how they look toward voices and faces, how they use their hands, and how they respond to you. You do not need to grade every moment. If something feels missing, changing, or worrying, write down what you saw and when, and bring that to the pediatrician.`;
  }

  return "I am here with you. Say the messy version first, and we will sort it into something useful.";
}

function isEmergencyText(value) {
  const text = String(value || "").toLowerCase();
  return [
    /not breathing/,
    /stopped breathing/,
    /can't breathe/,
    /cannot breathe/,
    /unresponsive/,
    /won't wake/,
    /will not wake/,
    /turning blue/,
    /\bblue\b.*\b(lips|face|baby|skin)\b/,
    /\bseizure\b/,
    /\bconvulsion\b/
  ].some((pattern) => pattern.test(text));
}

function isDistressText(value) {
  const text = String(value || "").toLowerCase();
  return [
    /hurt myself/,
    /hurt my baby/,
    /harm myself/,
    /harm my baby/,
    /can't go on/,
    /cannot go on/,
    /hopeless/,
    /i want to die/,
    /kill myself/
  ].some((pattern) => pattern.test(text));
}

function isVaccineHesitancyText(value) {
  const text = String(value || "").toLowerCase();
  return /\b(vaccine|shot|immunization|dtap|mmr)\b/.test(text)
    && /\b(safe|dangerous|risk|side effect|autism|refuse|skip|delay|hesitant|worried|scared)\b/.test(text);
}

// Covers common emoji blocks plus variation selectors and the zero-width
// joiner used to combine them. Patricia's persona says she never uses emoji
// (TTS has no way to "say" one gracefully -- it spells out the character
// name, e.g. a heart becomes the spoken words "yellow heart"), so this is a
// hard backend guarantee that survives even if the model drifts from that
// instruction.
const EMOJI_PATTERN = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function stripEmoji(text) {
  return text.replace(EMOJI_PATTERN, "").replace(/[ \t]{2,}/g, " ").replace(/ +([.,!?;:])/g, "$1").trim();
}

function enforcePatriciaStyle(value) {
  let text = String(value || "").trim();
  for (const phrase of BANNED_PHRASES) text = text.replace(phrase, "").trim();
  text = text.replace(/!/g, ".");
  text = stripEmoji(text);

  const MAX_WORDS = 140;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > MAX_WORDS) {
    // Trim to the last complete sentence within the word budget instead of
    // chopping mid-word and forcing a period onto a sentence that never
    // finished (e.g. "...that's worth mentioning at.").
    const budget = words.slice(0, MAX_WORDS).join(" ");
    const lastSentenceEnd = Math.max(budget.lastIndexOf("."), budget.lastIndexOf("?"));
    text = lastSentenceEnd > 40 ? budget.slice(0, lastSentenceEnd + 1) : `${budget}...`;
  }

  return text || "I am here with you. Say the messy version first, and we will sort it into something useful.";
}

function promptSafeBundle(bundle) {
  const childSnapshot = bundle.childSnapshot ? {
    name: bundle.childSnapshot.name || null,
    ageMonths: bundle.childSnapshot.ageMonths ?? null,
    correctedAgeMonths: bundle.childSnapshot.correctedAgeMonths ?? null,
    sexAtBirth: bundle.childSnapshot.sexAtBirth || null
  } : null;

  return {
    ambientContext: {
      sourceScreen: bundle.ambientContext?.sourceScreen || null,
      screenState: bundle.ambientContext?.screenState || null,
      localTime: bundle.ambientContext?.localTime || null,
      childSnapshot,
      parentContext: bundle.parentContext || null,
      todaysNote: bundle.todaysNote || null,
      recentEvents: {
        milestones: bundle.recentEvents?.milestones || [],
        watchForNames: bundle.recentEvents?.watchForNames || [],
        encounter: bundle.recentEvents?.encounter
          ? {
              name: bundle.recentEvents.encounter.name || null,
              startDate: bundle.recentEvents.encounter.startDate || null,
              entryTypeCounts: bundle.recentEvents.encounter.entryTypeCounts || {},
              // Actual logged readings/symptoms/medications, most recent
              // first -- so Patricia can speak to what's really going on
              // instead of just acknowledging that notes exist.
              recentEntries: bundle.recentEvents.encounter.recentEntries || []
            }
          : null,
        vaccines: bundle.recentEvents?.vaccines || null,
        daysUntilVisit: bundle.recentEvents?.daysUntilVisit ?? null
      },
      recentTopics: bundle.recentTopics || []
    },
    contextSeed: bundle.contextSeed || null
  };
}

function localPromptText() {
  const promptPath = path.resolve(__dirname, "../../../MobileApp/grandmother-chat-en.txt");
  try {
    return fs.readFileSync(promptPath, "utf8");
  } catch {
    return [
      "You are Patricia, Nianza's warm, experienced parenting companion.",
      "Speak plainly, gently, and briefly. You are voice-first.",
      "Never diagnose, dose, triage, or interpret vitals. Help parents organize what to tell a clinician.",
      "Use context without announcing it. Remembering is not reciting."
    ].join("\n");
  }
}

module.exports = {
  enforcePatriciaStyle,
  generatePatriciaReply,
  isDistressText,
  isEmergencyText,
  isVaccineHesitancyText,
  localPromptText,
  promptSafeBundle,
  sanitizeAmbientContext,
  sanitizeContextSeed
};
