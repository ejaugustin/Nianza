// N7 (Birthday Letter): deterministic template assembly, same discipline as
// M16 postcards -- never generated. Addressed to the child, second person.
// Pulls only what's actually on record for the year; a quiet year with
// nothing logged still gets a warm, honest letter rather than a padded one.

function formatMilestoneLine(text) {
  const trimmed = text.trim();
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function assembleBirthdayLetter({ childName, ageYears, milestones, customFirsts, voiceMemoryCount }) {
  const opening = ageYears === 1
    ? `Dear ${childName}, you turned one today. What a year this was.`
    : `Dear ${childName}, today you turned ${ageYears}. This was the year of so much.`;

  // Milestone text comes from the CDC library in mixed grammatical forms
  // ("Rolls over both ways", "Can hold head up...", "Says first words"), so
  // forcing every one into a "You <verb>..." sentence produces subject-verb
  // mismatches ("You rolls over..."). Listing them as a labeled recap avoids
  // that entirely without needing per-item grammar handling.
  const milestoneLines = milestones.slice(0, 8).map((m) => formatMilestoneLine(m.text));
  const firstsLines = customFirsts.slice(0, 5).map((f) => formatMilestoneLine(f.customName || f.milestoneName || "a first"));

  const bodyParagraphs = [];
  if (milestoneLines.length) {
    bodyParagraphs.push(`Some of what we watched happen: ${milestoneLines.join("; ")}.`);
  } else {
    bodyParagraphs.push("This was a quieter year for the record books -- but a year lived is a year lived, checkbox or not.");
  }
  if (firstsLines.length) {
    bodyParagraphs.push(`And some firsts worth keeping: ${firstsLines.join("; ")}.`);
  }
  if (voiceMemoryCount > 0) {
    bodyParagraphs.push(
      voiceMemoryCount === 1
        ? "We even kept a little of your voice from this year, tucked away for later."
        : `We even kept a few pieces of your voice from this year, tucked away for later.`
    );
  }

  const closing = "We're so glad we get to watch you grow. Here's to the next one.";

  return {
    title: `Your ${ordinal(ageYears)} year`,
    bodyText: [opening, ...bodyParagraphs, closing].join("\n\n")
  };
}

function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  const lastDigitSuffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10];
  return `${n}${lastDigitSuffix || "th"}`;
}

module.exports = { assembleBirthdayLetter };
