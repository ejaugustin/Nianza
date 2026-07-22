const crypto = require("crypto");

const ENTRY_TYPES = [
  "temperature",
  "medication",
  "symptom",
  "weight",
  "height",
  "head_circumference",
  "feeding",
  "diaper",
  "sleep",
  "note"
];

const GROWTH_TYPES = new Set(["weight", "height", "head_circumference"]);
const GROWTH_SEED = {
  sourceVerifiedBy: null,
  percentilesAvailable: false,
  status: "unverified-lms-seed"
};

const SYMPTOM_TYPES = new Set(["vomiting", "diarrhea", "cough", "rash", "ear-pulling", "other"]);

function truncate(value, maxLength) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function requireText(value, fieldName, maxLength = 200) {
  const text = truncate(value, maxLength);
  if (!text) throw new Error(`${fieldName} is required.`);
  return text;
}

function normalizeType(type) {
  const normalized = truncate(type, 80);
  if (!ENTRY_TYPES.includes(normalized)) {
    throw new Error("entryType must be one of the supported Vitals types.");
  }
  return normalized;
}

function newEntryId(recordedAt = new Date().toISOString()) {
  return `${recordedAt}#${crypto.randomUUID()}`;
}

function normalizeEntry(input = {}, { childId, recordedBy, activeEncounter } = {}) {
  const entryType = normalizeType(input.entryType);
  const now = new Date().toISOString();
  const recordedAt = truncate(input.recordedAt, 40) || now;
  const base = {
    childId,
    entryId: input.entryId || newEntryId(recordedAt),
    entryType,
    recordedAt,
    recordedBy,
    note: truncate(input.note, 500),
    encounterId: input.encounterId || activeEncounter?.encounterId || null,
    encounterName: input.encounterName || activeEncounter?.name || null,
    createdAt: input.createdAt || now,
    updatedAt: now
  };

  if (entryType === "temperature") {
    return {
      ...base,
      valueText: requireText(input.valueText || input.value, "temperature", 60)
    };
  }

  if (entryType === "medication") {
    return {
      ...base,
      medName: requireText(input.medName, "medName", 120),
      doseText: truncate(input.doseText, 120) || null
    };
  }

  if (entryType === "symptom") {
    const symptomType = truncate(input.symptomType, 40);
    if (!SYMPTOM_TYPES.has(symptomType)) throw new Error("symptomType is required.");
    return {
      ...base,
      symptomType,
      otherText: symptomType === "other" ? requireText(input.otherText, "otherText", 120) : truncate(input.otherText, 120) || null
    };
  }

  if (GROWTH_TYPES.has(entryType)) {
    return {
      ...base,
      value: requireText(input.value, "value", 40),
      unit: requireText(input.unit, "unit", 20),
      percentile: null,
      percentileLabel: null,
      percentileStatus: GROWTH_SEED.status
    };
  }

  if (entryType === "feeding") {
    return {
      ...base,
      feedingType: truncate(input.feedingType, 80) || "feeding",
      amount: truncate(input.amount, 120) || null
    };
  }

  if (entryType === "diaper") {
    return {
      ...base,
      diaperType: requireText(input.diaperType, "diaperType", 80)
    };
  }

  if (entryType === "sleep") {
    return {
      ...base,
      note: requireText(input.note, "note", 500)
    };
  }

  return {
    ...base,
    note: requireText(input.note, "note", 500)
  };
}

function titleForEntry(entryType) {
  return {
    temperature: "Temperature",
    medication: "Medication",
    symptom: "Symptom",
    weight: "Weight",
    height: "Length / height",
    head_circumference: "Head circumference",
    feeding: "Feeding",
    diaper: "Diaper",
    sleep: "Sleep",
    note: "Note"
  }[entryType] || "Vitals";
}

function labelForEntry(entry) {
  if (entry.entryType === "temperature") return entry.valueText;
  if (entry.entryType === "medication") return [entry.medName, entry.doseText].filter(Boolean).join(" - ");
  if (entry.entryType === "symptom") return entry.symptomType === "other" ? entry.otherText : entry.symptomType;
  if (GROWTH_TYPES.has(entry.entryType)) return `${entry.value} ${entry.unit}`;
  if (entry.entryType === "feeding") return [entry.feedingType, entry.amount].filter(Boolean).join(" - ");
  if (entry.entryType === "diaper") return entry.diaperType;
  return entry.note;
}

function serializeEntry(entry) {
  return {
    ...entry,
    title: titleForEntry(entry.entryType),
    label: labelForEntry(entry)
  };
}

function activeEncounter(encounters = []) {
  return encounters
    .filter((encounter) => encounter.status === "active")
    .sort((a, b) => String(b.updatedAt || b.startedAt).localeCompare(String(a.updatedAt || a.startedAt)))[0] || null;
}

function buildVitalsResponse({ entries = [], encounters = [] }) {
  const serializedEntries = entries
    .map(serializeEntry)
    .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)));

  return {
    entries: serializedEntries,
    encounters,
    activeEncounter: activeEncounter(encounters),
    growth: {
      percentilesAvailable: false,
      status: GROWTH_SEED.status,
      message: "Growth reference tables are waiting for clinical verification."
    }
  };
}

function sanitizeEntryForPatricia(entry) {
  return {
    entryType: entry.entryType,
    encounterId: entry.encounterId || null,
    encounterName: entry.encounterName || null,
    recordedAt: entry.recordedAt
  };
}

module.exports = {
  ENTRY_TYPES,
  GROWTH_TYPES,
  GROWTH_SEED,
  buildVitalsResponse,
  labelForEntry,
  normalizeEntry,
  sanitizeEntryForPatricia,
  serializeEntry,
  titleForEntry
};
