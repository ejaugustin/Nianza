// NZA-ADMIN-v1.1 SS2.2: writes a structured "golden-conversation harness"
// run into nianza-admin-harness-runs so Ej can review and sign it off in the
// admin portal (AI & Voice Controls > Harness Runs panel).
//
// NOTE: NZA-CHAT-v1.0 SS5 calls for a 25-scenario transcript set. Today's
// scripts/eval-patricia.js only covers the 3 scenarios visible above plus 2
// safety-gate checks -- this script records exactly those, honestly labeled
// as a partial run, rather than padding the count. Expanding the scenario
// set to the full 25 is a follow-on content task; this script and the
// admin-side table/Lambda/UI are otherwise ready for whatever set exists.
//
// Usage:
//   HARNESS_RUNS_TABLE=nianza-admin-harness-runs-prod \
//   node scripts/record-harness-run.js "prompt v2.3 -> v2.4"
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { scenarios, baseBundle, chatContext } = require("./eval-patricia");

const rawClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

const HARNESS_RUNS_TABLE = process.env.HARNESS_RUNS_TABLE;
const triggeringChange = process.argv[2] || "unspecified change";

function runScenario(scenario) {
  const text = chatContext.enforcePatriciaStyle(chatContext.generatePatriciaReply(scenario.message, scenario.bundle));
  const assertions = [];

  for (const pattern of scenario.expect) {
    assertions.push({ name: `expect ${pattern}`, passed: pattern.test(text), detail: pattern.test(text) ? undefined : `Reply did not match ${pattern}` });
  }
  for (const pattern of scenario.reject) {
    const matched = pattern.test(text);
    assertions.push({ name: `reject ${pattern}`, passed: !matched, detail: matched ? `Reply matched banned pattern ${pattern}` : undefined });
  }
  const wordCount = text.split(/\s+/).length;
  assertions.push({ name: "word count <= 140", passed: wordCount <= 140, detail: wordCount > 140 ? `${wordCount} words` : undefined });

  return {
    scenarioId: scenario.name,
    transcript: [
      { role: "parent", text: scenario.message },
      { role: "patricia", text }
    ],
    assertions
  };
}

async function main() {
  if (!HARNESS_RUNS_TABLE) throw new Error("HARNESS_RUNS_TABLE env var is required.");

  const scenarioResults = scenarios.map(runScenario);
  const passed = scenarioResults.every((result) => result.assertions.every((a) => a.passed));
  const runId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const run = {
    runId,
    triggeringChange,
    createdAt,
    passed,
    signedBy: null,
    signedAt: null,
    scenarioCount: scenarioResults.length,
    scenarios: scenarioResults
  };

  await documentClient.send(new PutCommand({ TableName: HARNESS_RUNS_TABLE, Item: run }));
  console.log(`Recorded harness run ${runId} (${scenarioResults.length} scenarios, passed=${passed}).`);
  console.log("NOTE: this covers the scenarios currently in eval-patricia.js, not the full 25-scenario NZA-CHAT-v1.0 SS5 set yet.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
