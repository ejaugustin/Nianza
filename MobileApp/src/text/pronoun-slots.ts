// Shared pronoun-slot substitution for daily-note (and similar) content.
//
// English "her" does double duty as both the object pronoun ("talk to
// her") and the possessive determiner ("her hands"), while the "he" family
// splits those into "him" and "his". A 3-token scheme ({she}/{her}/{hers})
// can't represent both roles correctly for boys -- {her} would render as
// "his" even where "him" is grammatically required ("talk to his" is
// wrong). This is a 4-slot scheme instead:
//   {she} / {She}   -- subject pronoun            she / he
//   {her} / {Her}   -- possessive determiner       her / his   ("her hands")
//   {him} / {Him}   -- object pronoun              her / him   ("talk to her")
//   {hers} / {Hers} -- possessive pronoun          hers / his  ("that's hers")
// Capitalized tokens are for sentence-initial use; content authors pick
// whichever case fits the sentence, this function replaces both.
export type SexAtBirth = "girl" | "boy" | null | undefined;

type PronounSet = { she: string; her: string; him: string; hers: string };

function pronounSetFor(sexAtBirth: SexAtBirth, neutral: boolean): PronounSet {
  if (neutral) return { she: "they", her: "their", him: "them", hers: "theirs" };
  if (sexAtBirth === "boy") return { she: "he", her: "his", him: "him", hers: "his" };
  return { she: "she", her: "her", him: "her", hers: "hers" };
}

function capitalize(word: string) {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/**
 * @param neutral Free-tier / personalization-disabled path: resolves to
 * they/their/them/theirs regardless of sexAtBirth.
 */
export function applyPronounSlots(text: string, sexAtBirth: SexAtBirth, { neutral = false }: { neutral?: boolean } = {}) {
  const pronouns = pronounSetFor(sexAtBirth, neutral);
  return text
    .replaceAll("{She}", capitalize(pronouns.she))
    .replaceAll("{she}", pronouns.she)
    .replaceAll("{Her}", capitalize(pronouns.her))
    .replaceAll("{her}", pronouns.her)
    .replaceAll("{Him}", capitalize(pronouns.him))
    .replaceAll("{him}", pronouns.him)
    .replaceAll("{Hers}", capitalize(pronouns.hers))
    .replaceAll("{hers}", pronouns.hers);
}
