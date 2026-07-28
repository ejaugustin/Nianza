// N1 (Milestone anniversaries): deterministic note-selection rule that folds
// into the same daily-note slot Home already renders. Never AI-generated --
// picks one real observed milestone/first whose observedAt lands on a
// recognized anniversary of today, and fills a fixed template with it.

const ANNIVERSARY_TIERS = [
  // Checked in this order (most emotionally significant first); the first
  // match wins so a child with years of history doesn't get buried under
  // every possible anniversary firing on the same day.
  { unit: "year", amount: 1, label: "a year" },
  { unit: "month", amount: 6, label: "six months" },
  { unit: "month", amount: 3, label: "three months" },
  { unit: "month", amount: 1, label: "one month" },
  { unit: "day", amount: 7, label: "one week" }
];

// Real milestone text reads as a verb phrase ("rolls over both ways"), but
// custom firsts are freeform names the parent typed ("First laugh", "Said
// grandma"), which don't fit the same "{childName} {text}" slot without
// risking broken grammar. Two separate variant banks, chosen by kind.
const MILESTONE_OPENING_VARIANTS = [
  "{Label} ago today, {childName} {milestoneText}. Look how far {pronoun} come.",
  "On this day {label} ago, {childName} {milestoneText}. Worth pausing on.",
  "{Label} ago, {childName} {milestoneText}. Just a small note to remember it."
];

const FIRST_OPENING_VARIANTS = [
  "{Label} ago today: {milestoneText}. Worth remembering.",
  "On this day {label} ago, this happened -- {milestoneText}.",
  "{Label} ago, {childName} had a first: {milestoneText}."
];

function stableIndex(seed, length) {
  if (length <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  return hash % length;
}

function lowerFirst(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function upperFirst(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function isAnniversaryMatch(observedAt, now, unit, amount) {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return false;

  if (unit === "day") {
    const diffMs = now.setHours(0, 0, 0, 0) - new Date(observed).setHours(0, 0, 0, 0);
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    return diffDays === amount;
  }

  if (unit === "month") {
    const monthsSince = (now.getFullYear() - observed.getFullYear()) * 12 + (now.getMonth() - observed.getMonth());
    return monthsSince === amount && now.getDate() === observed.getDate();
  }

  if (unit === "year") {
    const yearsSince = now.getFullYear() - observed.getFullYear();
    return yearsSince >= amount && yearsSince % amount === 0 && now.getMonth() === observed.getMonth() && now.getDate() === observed.getDate();
  }

  return false;
}

/**
 * @param {{ observations: Array<{ milestoneText: string, observedAt: string, kind?: "milestone"|"first" }>, childName: string, sexAtBirth?: string|null, now?: Date }} params
 * @returns {{ tierLabel: string, milestoneText: string, observedAt: string, bodyText: string } | null}
 */
function selectAnniversaryNote({ observations, childName, sexAtBirth, now = new Date() }) {
  const pronoun = sexAtBirth === "boy" ? "he's" : sexAtBirth === "girl" ? "she's" : "they've";

  for (const tier of ANNIVERSARY_TIERS) {
    const matches = observations.filter((obs) => isAnniversaryMatch(new Date(obs.observedAt), new Date(now), tier.unit, tier.amount));
    if (!matches.length) continue;

    // Deterministic tie-break: most recently recorded observation in this tier.
    matches.sort((a, b) => String(b.observedAt || "").localeCompare(String(a.observedAt || "")));
    const chosen = matches[0];
    const isFirst = chosen.kind === "first";
    const variantBank = isFirst ? FIRST_OPENING_VARIANTS : MILESTONE_OPENING_VARIANTS;
    const variant = variantBank[stableIndex(`${chosen.observedAt}#${chosen.milestoneText}`, variantBank.length)];
    const bodyText = variant
      .replace("{Label}", upperFirst(tier.label))
      .replace("{label}", tier.label)
      .replace("{childName}", childName)
      .replace("{milestoneText}", isFirst ? chosen.milestoneText.trim() : lowerFirst(chosen.milestoneText))
      .replace("{pronoun}", pronoun);

    return { tierLabel: tier.label, milestoneText: chosen.milestoneText, observedAt: chosen.observedAt, bodyText };
  }

  return null;
}

module.exports = { selectAnniversaryNote, ANNIVERSARY_TIERS };
