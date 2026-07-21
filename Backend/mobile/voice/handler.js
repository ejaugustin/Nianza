const { json, noContent, error } = require("../../shared/response");

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_TTS_MODEL = process.env.DEEPGRAM_TTS_MODEL || "aura-2-cordelia-en";
const DEEPGRAM_STT_MODEL = process.env.DEEPGRAM_STT_MODEL || "nova-2";
const MAX_TTS_CHARS = 2000;
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return JSON.parse(raw);
}

function requireDeepgramKey() {
  if (!DEEPGRAM_API_KEY) {
    const err = new Error("DEEPGRAM_API_KEY is not configured.");
    err.statusCode = 503;
    err.code = "VOICE_NOT_CONFIGURED";
    throw err;
  }
  return DEEPGRAM_API_KEY;
}

function firstTranscript(data) {
  const alternative = data?.results?.channels?.[0]?.alternatives?.[0];
  return {
    transcript: String(alternative?.transcript || "").trim(),
    confidence: alternative?.confidence ?? null,
    words: alternative?.words || []
  };
}

async function handleTranscribe(event) {
  const body = parseBody(event);
  const audioBase64 = body.audioBase64 || body.audio;
  const contentType = body.contentType || body.mimeType || "audio/mp4";

  if (!audioBase64 || typeof audioBase64 !== "string") {
    return error(400, "INVALID_FIELD", "audioBase64 is required.");
  }

  const audioBuffer = Buffer.from(audioBase64, "base64");
  if (!audioBuffer.length) return error(400, "INVALID_FIELD", "audioBase64 did not contain audio bytes.");
  if (audioBuffer.length > MAX_AUDIO_BYTES) return error(413, "AUDIO_TOO_LARGE", "Voice notes must be under 6 MB.");

  const url = new URL("https://api.deepgram.com/v1/listen");
  url.searchParams.set("model", body.model || DEEPGRAM_STT_MODEL);
  url.searchParams.set("language", body.language || "en");
  url.searchParams.set("smart_format", "true");
  url.searchParams.set("punctuate", "true");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${requireDeepgramKey()}`,
      "Content-Type": contentType
    },
    body: audioBuffer
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Deepgram STT failed", response.status, details);
    return error(502, "DEEPGRAM_STT_FAILED", "Patricia could not understand that voice note. Please try again.");
  }

  const result = firstTranscript(await response.json());
  return json(200, {
    ...result,
    empty: !result.transcript,
    model: body.model || DEEPGRAM_STT_MODEL
  });
}

async function handleSpeak(event) {
  const body = parseBody(event);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return error(400, "INVALID_FIELD", "text is required.");
  if (text.length > MAX_TTS_CHARS) return error(413, "TEXT_TOO_LARGE", `Text-to-speech is limited to ${MAX_TTS_CHARS} characters.`);

  const model = body.model || DEEPGRAM_TTS_MODEL;
  const url = new URL("https://api.deepgram.com/v1/speak");
  url.searchParams.set("model", model);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${requireDeepgramKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("Deepgram TTS failed", response.status, details);
    return error(502, "DEEPGRAM_TTS_FAILED", "Patricia could not create audio just now. Please try again.");
  }

  const audio = Buffer.from(await response.arrayBuffer());
  return json(200, {
    audioBase64: audio.toString("base64"),
    contentType: response.headers.get("content-type") || "audio/mpeg",
    model,
    chars: text.length
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return noContent();
  const path = event.path || event.rawPath || "";

  try {
    if (event.httpMethod === "POST" && path.endsWith("/voice/transcribe")) return handleTranscribe(event);
    if (event.httpMethod === "POST" && path.endsWith("/voice/speak")) return handleSpeak(event);
    return error(404, "NOT_FOUND", "Mobile voice route not found.");
  } catch (err) {
    console.error("mobile voice route failed", err);
    return error(err.statusCode || 500, err.code || "INTERNAL_ERROR", err.statusCode ? err.message : "Something went wrong in the mobile voice service.");
  }
};
