const assert = require("node:assert/strict");
const chatContext = require("./context");

async function run() {
  const ambientContext = chatContext.sanitizeAmbientContext({
        sourceScreen: "E1-vaccines",
        screenState: "DTaP due",
        localTime: "morning"
  });
  const text = chatContext.generatePatriciaReply("What should I expect?", {
    ambientContext,
    contextSeed: undefined,
    childSnapshot: { name: "Eric" },
    parentContext: null,
    todaysNote: null,
    recentEvents: {
      milestones: [],
      encounter: null,
      daysUntilVisit: null
    },
    recentTopics: []
  });

  assert.match(text, /DTaP/);
  assert.match(text, /pediatrician|doctor/i);
  assert.doesNotMatch(text, /I see|I noticed|vaccine screen|looking at/i);

  console.log("Ej acceptance passed: vaccine context informs without announcing.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
