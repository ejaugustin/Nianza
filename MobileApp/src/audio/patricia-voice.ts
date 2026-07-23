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
