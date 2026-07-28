// N4 (Village Translator), "Note from Patricia" compose flow. Deterministic
// template assembly only -- never generated -- same discipline as M16
// postcards. The topic string picks a stable variant (not random) so the
// same topic always drafts the same way, which keeps this genuinely
// "template assembly" rather than something that feels generative.
const OPENING_VARIANTS = [
  "I wanted to share something with you.",
  "There's something I've been meaning to mention.",
  "I thought you'd want to know about this."
];

const CLOSING_VARIANTS = [
  "We know more now than we did back then, and I know you only ever wanted the best for us. Thank you for understanding.",
  "Things really have changed a lot since you were raising us -- but the love behind it all hasn't. Thanks for being patient with us.",
  "It's not that anything was done wrong before -- the guidance has just moved on. We appreciate you rolling with it."
];

function stableIndex(seed: string, length: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

export function buildGrandparentNoteDraft(input: { topic: string; bodyText: string; childName: string }) {
  const opening = OPENING_VARIANTS[stableIndex(input.topic, OPENING_VARIANTS.length)];
  const closing = CLOSING_VARIANTS[stableIndex(`${input.topic}-close`, CLOSING_VARIANTS.length)];
  return `${opening} With ${input.childName}, we're following the current guidance: ${input.bodyText}\n\n${closing}`;
}
