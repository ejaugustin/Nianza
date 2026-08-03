// NZA-WEEKLY-LETTER-v1.0 + Addendum A: same generateStructured/Anthropic
// pattern as mobile/reports/narrative.js and mobile/chat/gateway.js -- no
// new AI integration, just reuse of the proven one.
const narrative = require("../reports/narrative");

// Addendum A SS3.3: a fixed vocabulary the model selects from (fits the
// week), not a rotation it marches through -- rotation becomes noticeable
// and templated-feeling after a few months of letters.
const THEME_VOCABULARY = ["Connection", "Rhythm", "Observation", "Growth", "Rest", "Curiosity", "Everyday moments"];

function themeForFallback(weekStartDateKey) {
  // Deterministic-but-varied: the fallback path explicitly *should* rotate
  // mechanically (Addendum A SS3.3) since consistency matters more than
  // variety on the safety-net path. Hash the week key into the vocabulary.
  let hash = 0;
  for (let i = 0; i < weekStartDateKey.length; i += 1) hash = (hash * 31 + weekStartDateKey.charCodeAt(i)) >>> 0;
  return THEME_VOCABULARY[hash % THEME_VOCABULARY.length];
}

function buildSystemPrompt({ childName, windowLabel, hasPriorLetter, isFirstLetter }) {
  return [
    `You are Patricia, a warm, observant companion writing a weekly letter to a parent about their child, ${childName}, covering ${windowLabel}.`,
    "Rules:",
    "- Describe what was logged; never diagnose, interpret, or use alarm language about any vitals or growth data, even if a value looks unusual to you. Describe only what's present.",
    `- Choose exactly one theme label from this list, whichever genuinely fits this week's content: ${THEME_VOCABULARY.join(", ")}. Do not just pick the next one in some rotation -- choose what fits.`,
    "- Letter length should track the week: a full, eventful week can earn a fuller letter; a quiet or empty week should be short and warm, not padded out to match a busier week's length.",
    "- Never end with a question or a prompt for the parent to reply. This letter is a gift, with no ask attached.",
    isFirstLetter
      ? "- This is the very first letter for this child. Say so warmly and directly (something like \"we've only just started, but here's what I noticed already\") rather than writing as if many weeks of history exist."
      : hasPriorLetter
        ? "- If there's a natural, specific thread to pick up from last week's letter, you may reference it briefly -- but only when it genuinely fits, not as a forced callback every week."
        : "- There is no prior week's letter available to reference (first letter after a gap) -- do not reference a previous week.",
    "Respond with a single JSON object and nothing else, with these fields: title (short), preview (one sentence, used in a list view), greeting, bodyText, closing, themeLabel (must be exactly one of the list above), priorLetterKeyBeat (1-2 sentences capturing the most notable specific detail from this week, written for your own future reference next week -- not shown to the parent)."
  ].join("\n");
}

function fallbackLetter({ childName, window, items }) {
  const themeLabel = themeForFallback(window.weekStartDateKey);
  const hasItems = items.length > 0;
  const bodyText = hasItems
    ? `This week with ${childName} had ${items.length} thing${items.length === 1 ? "" : "s"} worth holding onto -- ${items.slice(0, 3).map((item) => item.label).filter(Boolean).join(", ")}${items.length > 3 ? ", and more" : ""}. I'm keeping it all safe for you.`
    : `A quiet week with ${childName}. Not every week needs to be eventful for it to matter -- I'm here either way.`;

  return {
    title: `${childName}'s week`,
    preview: hasItems ? `A few things worth remembering from this week.` : `A quiet week, and that's alright.`,
    greeting: `Dear you,`,
    bodyText,
    closing: "With you this week",
    themeLabel,
    priorLetterKeyBeat: hasItems ? items[items.length - 1].label || null : null,
    source: "fallback"
  };
}

async function generateWeeklyLetter({ childName, window, items, priorLetter, isFirstLetter }) {
  const hasPriorLetter = Boolean(priorLetter);
  const system = buildSystemPrompt({ childName, windowLabel: window.windowLabel, hasPriorLetter, isFirstLetter });
  const data = {
    childName,
    weekWindow: window.windowLabel,
    items,
    ...(hasPriorLetter
      ? { priorLetterThemeLabel: priorLetter.themeLabel || null, priorLetterKeyBeat: priorLetter.priorLetterKeyBeat || null }
      : {})
  };
  const fallback = fallbackLetter({ childName, window, items });
  return narrative.generateStructured({ system, data, fallback });
}

module.exports = { generateWeeklyLetter, THEME_VOCABULARY };
