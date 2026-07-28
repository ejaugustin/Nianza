import { setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { speakPatriciaText } from "@/api/voice";
import { normalizePatriciaSpeechText } from "@/text/patricia-text";

export async function configurePatriciaPlayback() {
  await setAudioModeAsync({
    allowsRecording: false,
    interruptionMode: "doNotMix",
    playsInSilentMode: true,
    shouldRouteThroughEarpiece: false
  });
}

export function pausePatriciaPlayer(player: { pause: () => void }) {
  try {
    player.pause();
  } catch {
    // Expo may release the native audio object before React cleanup runs.
  }
}

function safeAudioKey(key: string) {
  return key.replace(/[^a-z0-9-]/gi, "").slice(0, 80) || "patricia";
}

export async function writePatriciaSpeechAudio(cacheKey: string, audioBase64: string) {
  const uri = `${FileSystem.cacheDirectory || ""}patricia-${safeAudioKey(cacheKey)}.mp3`;
  await FileSystem.writeAsStringAsync(uri, audioBase64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function fetchPatriciaSpeechAudio(text: string, cacheKey: string) {
  const response = await speakPatriciaText(normalizePatriciaSpeechText(text));
  return writePatriciaSpeechAudio(cacheKey, response.audioBase64);
}

// Deepgram synthesis time scales with text length, and a single request for a
// long, multi-sentence reply is what created the multi-second (sometimes
// multi-minute) gap between text appearing and voice starting. Splitting into
// short, sentence-bounded chunks means the first chunk -- usually one short
// sentence -- comes back fast enough to start playback almost immediately,
// while the rest keep synthesizing in the background and queue up behind it.
const MAX_CHUNK_CHARS = 260;

export function splitIntoSpeechChunks(text: string, maxChars = MAX_CHUNK_CHARS) {
  const cleaned = normalizePatriciaSpeechText(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const sentences = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [cleaned];
  // Guard against losing a trailing fragment that has no terminal punctuation
  // (the regex above requires one), which would otherwise silently drop it.
  const matchedLength = sentences.reduce((total, sentence) => total + sentence.length, 0);
  if (matchedLength < cleaned.length) {
    const remainder = cleaned.slice(matchedLength).trim();
    if (remainder) sentences.push(remainder);
  }
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > maxChars) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [cleaned.slice(0, maxChars)];
}

export async function fetchPatriciaSpeechChunkAudio(chunkText: string, cacheKey: string) {
  const response = await speakPatriciaText(chunkText);
  return writePatriciaSpeechAudio(cacheKey, response.audioBase64);
}
