const { GetParameterCommand, SSMClient } = require("@aws-sdk/client-ssm");

const ssmClient = new SSMClient({});
const ANTHROPIC_API_KEY_PARAMETER = process.env.ANTHROPIC_API_KEY_PARAMETER;
const ANTHROPIC_MODEL_PARAMETER = process.env.ANTHROPIC_MODEL_PARAMETER;
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || null;

let apiKeyCache = null;
let modelCache = null;

async function readSsmParameter(name, withDecryption = true) {
  if (!name) return null;
  try {
    const result = await ssmClient.send(new GetParameterCommand({ Name: name, WithDecryption: withDecryption }));
    return result.Parameter?.Value || null;
  } catch (err) {
    console.warn("SSM parameter unavailable for report narrative", name, err?.name || err);
    return null;
  }
}

async function getAnthropicConfig() {
  if (!apiKeyCache) apiKeyCache = await readSsmParameter(ANTHROPIC_API_KEY_PARAMETER);
  if (!modelCache) modelCache = await readSsmParameter(ANTHROPIC_MODEL_PARAMETER, false) || DEFAULT_ANTHROPIC_MODEL;
  return { apiKey: apiKeyCache, model: modelCache };
}

// Report narrative sections (Month at a Glance, Half-Year Narrative, Year in
// Review, Since Your Last Visit, Talking Points, Questions to Ask) are all
// generated from the same shape of call: a system instruction describing the
// section's job and word budget, plus the real logged data as JSON, asking
// for a JSON object back. If the model is unavailable or errors, callers
// supply a deterministic fallback built directly from the same data --
// factual and plain, never a fabricated-sounding narrative pretending to be
// AI-written when it isn't.
async function generateStructured({ system, data, fallback }) {
  const { apiKey, model } = await getAnthropicConfig();
  if (!apiKey || !model) return fallback;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system,
        messages: [
          {
            role: "user",
            content: `Here is the logged data for this child, as JSON. Use only what's in it -- never invent events, dates, or values that aren't present. Respond with a single JSON object and nothing else.\n\n${JSON.stringify(data)}`
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("Anthropic report narrative call failed", response.status, await response.text().catch(() => ""));
      return fallback;
    }

    const payload = await response.json();
    const text = (payload.content || [])
      .filter((part) => part?.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...fallback, ...parsed, source: "anthropic" };
  } catch (err) {
    console.error("Anthropic report narrative call threw", err);
    return fallback;
  }
}

module.exports = { generateStructured };
