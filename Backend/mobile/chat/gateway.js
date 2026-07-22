const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { GetParameterCommand, SSMClient } = require("@aws-sdk/client-ssm");
const fallbackContext = require("./context");

const s3Client = new S3Client({});
const ssmClient = new SSMClient({});

const PROMPT_BUCKET = process.env.PATRICIA_PROMPT_BUCKET;
const PROMPT_KEY = process.env.PATRICIA_PROMPT_KEY || "en/grandmother-chat.txt";
const ANTHROPIC_API_KEY_PARAMETER = process.env.ANTHROPIC_API_KEY_PARAMETER;
const ANTHROPIC_MODEL_PARAMETER = process.env.ANTHROPIC_MODEL_PARAMETER;
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || null;
const MAX_TOKENS = Number(process.env.PATRICIA_MAX_TOKENS || 450);
const TEMPERATURE = Number(process.env.PATRICIA_TEMPERATURE || 0.7);

let promptCache = null;
let apiKeyCache = null;
let modelCache = null;

async function streamToString(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function readSsmParameter(name, withDecryption = true) {
  if (!name) return null;
  try {
    const result = await ssmClient.send(new GetParameterCommand({
      Name: name,
      WithDecryption: withDecryption
    }));
    return result.Parameter?.Value || null;
  } catch (err) {
    console.warn("SSM parameter unavailable for Patricia chat", name, err?.name || err);
    return null;
  }
}

async function getPromptText() {
  if (promptCache) return promptCache.text;
  if (PROMPT_BUCKET) {
    const result = await s3Client.send(new GetObjectCommand({
      Bucket: PROMPT_BUCKET,
      Key: PROMPT_KEY
    }));
    promptCache = {
      etag: result.ETag,
      text: await streamToString(result.Body)
    };
    return promptCache.text;
  }
  promptCache = { etag: "local", text: fallbackContext.localPromptText() };
  return promptCache.text;
}

async function getAnthropicConfig() {
  if (!apiKeyCache) apiKeyCache = await readSsmParameter(ANTHROPIC_API_KEY_PARAMETER);
  if (!modelCache) modelCache = await readSsmParameter(ANTHROPIC_MODEL_PARAMETER, false) || DEFAULT_ANTHROPIC_MODEL;
  return { apiKey: apiKeyCache, model: modelCache };
}

function systemBlock(name, value) {
  return `<${name}>\n${JSON.stringify(value, null, 2)}\n</${name}>`;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000)
    }));
}

async function callPatriciaModel({ message, messages, bundle }) {
  const { apiKey, model } = await getAnthropicConfig();
  if (!apiKey || !model) {
    return {
      text: fallbackContext.generatePatriciaReply(message, bundle),
      source: "deterministic-fallback"
    };
  }

  const prompt = await getPromptText();
  const system = [
    prompt,
    systemBlock("ambient_context", fallbackContext.promptSafeBundle(bundle).ambientContext),
    bundle.contextSeed ? systemBlock("context_seed", fallbackContext.promptSafeBundle(bundle).contextSeed) : null
  ].filter(Boolean);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: system.join("\n\n"),
      messages: [
        ...cleanMessages(messages),
        { role: "user", content: String(message || "").slice(0, 4000) }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Anthropic chat failed", response.status, payload);
    return {
      text: fallbackContext.generatePatriciaReply(message, bundle),
      source: "deterministic-fallback-after-model-error"
    };
  }

  const text = (payload.content || [])
    .filter((part) => part?.type === "text" && part.text)
    .map((part) => part.text)
    .join("\n")
    .trim();

  return {
    text: fallbackContext.enforcePatriciaStyle(text || fallbackContext.generatePatriciaReply(message, bundle)),
    source: "anthropic"
  };
}

async function classifyMessage(message) {
  const text = String(message || "").toLowerCase();
  if (fallbackContext.isEmergencyText(text)) return "emergency";
  if (fallbackContext.isDistressText(text)) return "distress";
  if (fallbackContext.isVaccineHesitancyText(text)) return "vaccine-hesitancy";

  const { apiKey, model } = await getAnthropicConfig();
  if (!apiKey || !model) return "clear";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      model,
      max_tokens: 8,
      temperature: 0,
      system: "Classify the parent message as exactly one label: distress, vaccine-hesitancy, clear. Emergency phrases should be distress here because hard emergency matching already ran. Output only the label.",
      messages: [{ role: "user", content: String(message || "").slice(0, 1000) }]
    })
  });

  if (!response.ok) return "clear";
  const payload = await response.json().catch(() => ({}));
  const label = (payload.content || []).map((part) => part.text || "").join("").trim().toLowerCase();
  return ["distress", "vaccine-hesitancy", "clear"].includes(label) ? label : "clear";
}

module.exports = {
  callPatriciaModel,
  classifyMessage,
  getPromptText
};
