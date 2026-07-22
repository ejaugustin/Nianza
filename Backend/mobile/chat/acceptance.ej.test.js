const assert = require("node:assert/strict");
const chatContext = require("./context");
const { safetyGate } = require("./safety");

async function run() {
  const ambientContext = chatContext.sanitizeAmbientContext({
        sourceScreen: "E1-vaccines",
        screenState: "DTaP due",
        localTime: "morning"
  });
  const vaccineBundle = {
    ambientContext,
    contextSeed: undefined,
    childSnapshot: { name: "Eric" },
    parentContext: null,
    todaysNote: null,
    recentEvents: {
      milestones: [],
      encounter: null,
      vaccines: { dueDoseNames: ["DTaP"], mostRecentRecorded: null },
      daysUntilVisit: null
    },
    recentTopics: []
  };
  const text = chatContext.generatePatriciaReply("What should I expect?", vaccineBundle);

  assert.match(text, /DTaP/);
  assert.match(text, /pediatrician|doctor/i);
  assert.doesNotMatch(text, /I see|I noticed|vaccine screen|looking at/i);

  const safeBundle = chatContext.promptSafeBundle({
    ...vaccineBundle,
    rawTemperature: "104.2",
    rawDose: "5ml",
    rawPercentile: 84,
    recentEvents: {
      ...vaccineBundle.recentEvents,
      encounter: { name: "Low fever", entryTypeCounts: { temperature: 2, feeding: 1 } }
    }
  });
  const safeJson = JSON.stringify(safeBundle);
  assert.doesNotMatch(safeJson, /104\.2|5ml|percentile/i);
  assert.match(safeJson, /entryTypeCounts/);

  const styled = chatContext.enforcePatriciaStyle("I see you are on the vaccine screen! We can do this!");
  assert.doesNotMatch(styled, /I see you|vaccine screen|!/i);

  const emergency = await safetyGate({
    message: "My baby stopped breathing",
    bundle: vaccineBundle,
    language: "en",
    classifier: async () => "clear"
  });
  assert.equal(emergency.type, "emergency");
  assert.match(emergency.text, /emergency services/i);

  const distress = await safetyGate({
    message: "I might hurt myself",
    bundle: vaccineBundle,
    language: "en",
    classifier: async () => "clear"
  });
  assert.equal(distress.type, "distress");
  assert.match(distress.text, /right now/i);

  const hesitancy = await safetyGate({
    message: "I am scared the DTaP shot is dangerous",
    bundle: vaccineBundle,
    language: "en",
    classifier: async () => "vaccine-hesitancy"
  });
  assert.equal(hesitancy.type, "vaccine-hesitancy");
  assert.match(hesitancy.text, /pediatrician/i);

  console.log("Ej acceptance passed: Patricia uses context, safety gates, and no raw medical values.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
