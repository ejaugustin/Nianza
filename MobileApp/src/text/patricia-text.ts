// Covers common emoji blocks plus variation selectors and the zero-width
// joiner used to combine them. Patricia's persona is never to use emoji --
// this is a client-side backstop in case any text reaches the app without
// having gone through the backend's own stripping (e.g. bundled fallback
// copy). It matters most for speech: Deepgram TTS has no way to "say" an
// emoji gracefully, so it spells out the character name instead (a heart
// becomes the spoken words "yellow heart").
const EMOJI_PATTERN = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

/** Nianza already knows the child's sex at birth, so Patricia's own
 * personalized copy (not shared library content) uses "his"/"her" rather
 * than defaulting to "their" — it reads warmer and more like she actually
 * knows the child. Falls back to "their" only if sex is somehow unset. */
export function possessivePronoun(sexAtBirth?: "girl" | "boy" | null) {
  if (sexAtBirth === "boy") return "his";
  if (sexAtBirth === "girl") return "her";
  return "their";
}

export function objectPronoun(sexAtBirth?: "girl" | "boy" | null) {
  if (sexAtBirth === "boy") return "him";
  if (sexAtBirth === "girl") return "her";
  return "them";
}

export function normalizePatriciaDisplayText(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(EMOJI_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?;:])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizePatriciaSpeechText(text: string) {
  return normalizePatriciaDisplayText(text)
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .trim();
}
