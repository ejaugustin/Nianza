const assert = require("assert");
const vitals = require("./library");

function normalize(input) {
  return vitals.normalizeEntry(input, {
    childId: "primary-child",
    recordedBy: "parent@example.com",
    activeEncounter: { encounterId: "encounter#1", name: "Low fever and extra cuddles" }
  });
}

assert.strictEqual(vitals.ENTRY_TYPES.length, 10, "Vitals entry type grid must stay at the v2.13 ceiling of 10 types.");
assert.ok(vitals.ENTRY_TYPES.includes("medication"), "Medication is part of the Vitals entry type grid.");
assert.ok(vitals.ENTRY_TYPES.includes("symptom"), "Symptom is part of the Vitals entry type grid.");
assert.ok(vitals.ENTRY_TYPES.includes("head_circumference"), "Head circumference is part of the Vitals entry type grid.");

const medication = normalize({
  entryType: "medication",
  medName: "Acetaminophen",
  doseText: "500 ml"
});
assert.strictEqual(medication.doseText, "500 ml", "Medication dose text must save exactly as the parent states it.");
assert.strictEqual(vitals.labelForEntry(medication), "Acetaminophen - 500 ml");

const symptomOne = normalize({ entryType: "symptom", symptomType: "cough" });
const symptomTwo = normalize({ entryType: "symptom", symptomType: "other", otherText: "clingy and flushed" });
assert.strictEqual(vitals.labelForEntry(symptomOne), "cough");
assert.strictEqual(vitals.labelForEntry(symptomTwo), "clingy and flushed");

const growth = normalize({ entryType: "weight", value: "12.5", unit: "lb" });
assert.strictEqual(growth.percentile, null, "Growth percentile must not render without a verified LMS seed.");
assert.strictEqual(growth.percentileStatus, "unverified-lms-seed");

assert.throws(
  () => normalize({ entryType: "oxygen", value: "98" }),
  /entryType/,
  "An eleventh Vitals entry type should be rejected."
);

const sanitized = vitals.sanitizeEntryForPatricia(growth);
assert.deepStrictEqual(
  Object.keys(sanitized).sort(),
  ["encounterId", "encounterName", "entryType", "recordedAt"].sort(),
  "Ambient Patricia context must not include raw Vitals values."
);

console.log("Vitals acceptance tests passed.");
