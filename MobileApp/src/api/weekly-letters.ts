export type WeeklyLetterStatus = "ready" | "emailed" | "read";

export type WeeklyLetterSummary = {
  letterId: string;
  childId: string;
  title: string;
  weekStartDate: string;
  weekEndDate: string;
  preview: string;
  themeLabel: string;
  status: WeeklyLetterStatus;
  emailedAt: string | null;
  readAt: string | null;
};

export type WeeklyLetter = WeeklyLetterSummary & {
  greeting: string;
  bodyText: string;
  closing: string;
};

type WeeklyLetterProfile = {
  childName?: string;
  parentFirstName?: string;
};

const mockWeeklyLetters: WeeklyLetter[] = [
  {
    letterId: "weekly-letter-2026-07-12",
    childId: "primary-child",
    title: "{childName} is learning your voice",
    weekStartDate: "2026-07-12",
    weekEndDate: "2026-07-18",
    preview: "This week, notice how {childName} turns toward familiar voices and settles into repeated rhythms.",
    themeLabel: "Connection",
    status: "emailed",
    emailedAt: "2026-07-18T13:00:00.000Z",
    readAt: null,
    greeting: "Dear {parentFirstName},",
    bodyText:
      "This week, {childName} is doing something quiet and powerful: learning that your voice belongs to safety. Around this age, babies often start connecting familiar sounds with familiar faces. Your ordinary narration, the small songs, the way you say your child's name while changing a diaper or moving through the room, all become part of how the world starts to feel familiar.\n\nYou do not need to make every moment educational. You are already teaching through repetition, warmth, and presence. Try saying what you are doing out loud once or twice during a routine you already have. I would call that a small anchor: simple enough for a tired day, steady enough for {childName} to feel.",
    closing: "With you this week"
  },
  {
    letterId: "weekly-letter-2026-07-05",
    childId: "primary-child",
    title: "A steadier rhythm for the little days",
    weekStartDate: "2026-07-05",
    weekEndDate: "2026-07-11",
    preview: "Tiny routines are beginning to matter, especially when everyone is tired.",
    themeLabel: "Rhythm",
    status: "read",
    emailedAt: "2026-07-11T13:00:00.000Z",
    readAt: "2026-07-12T09:24:00.000Z",
    greeting: "Dear {parentFirstName},",
    bodyText:
      "This week may not look dramatic from the outside. Still, {childName} is taking in patterns: how the morning begins, how feeding feels, how your face changes when you are close. When days blur together, it can help to choose one tiny routine and let it be enough.\n\nMaybe it is opening the curtain and saying good morning. Maybe it is the same phrase before sleep. These little repeated signals help babies feel the shape of the day, and they help parents feel less lost inside it too.",
    closing: "Warmly"
  },
  {
    letterId: "weekly-letter-2026-06-28",
    childId: "primary-child",
    title: "What you noticed counts",
    weekStartDate: "2026-06-28",
    weekEndDate: "2026-07-04",
    preview: "Your observations are not small. They are the beginning of useful care.",
    themeLabel: "Observation",
    status: "read",
    emailedAt: "2026-07-04T13:00:00.000Z",
    readAt: "2026-07-05T15:12:00.000Z",
    greeting: "Dear {parentFirstName},",
    bodyText:
      "A lot of parenting happens in the noticing. You saw when {childName} seemed a little fussier, when feeding changed, when being held longer mattered. Those notes may feel ordinary, but they help you understand your child's patterns.\n\nThis week, let Nianza hold a few of those observations for you. You do not need to remember everything. You only need a place to put what matters so you can return to it when your mind is crowded.",
    closing: "Here when you need me"
  }
];

function personalizeText(text: string, profile?: WeeklyLetterProfile) {
  const childName = profile?.childName?.trim() || "your child";
  const parentFirstName = profile?.parentFirstName?.trim() || "there";
  return text.replaceAll("{childName}", childName).replaceAll("{parentFirstName}", parentFirstName);
}

function personalizeLetter(letter: WeeklyLetter, profile?: WeeklyLetterProfile): WeeklyLetter {
  return {
    ...letter,
    title: personalizeText(letter.title, profile),
    preview: personalizeText(letter.preview, profile),
    greeting: personalizeText(letter.greeting, profile),
    bodyText: personalizeText(letter.bodyText, profile),
    closing: personalizeText(letter.closing, profile)
  };
}

function toSummary(letter: WeeklyLetter): WeeklyLetterSummary {
  const { greeting: _greeting, bodyText: _bodyText, closing: _closing, ...summary } = letter;
  return summary;
}

export async function listWeeklyLetters(childId = "primary-child", profile?: WeeklyLetterProfile): Promise<WeeklyLetterSummary[]> {
  return mockWeeklyLetters.filter((letter) => letter.childId === childId).map((letter) => toSummary(personalizeLetter(letter, profile)));
}

export async function getWeeklyLetter(letterId: string, profile?: WeeklyLetterProfile): Promise<WeeklyLetter> {
  const letter = mockWeeklyLetters.find((item) => item.letterId === letterId);
  if (!letter) {
    throw new Error("Weekly letter not found.");
  }
  return personalizeLetter(letter, profile);
}

export async function markWeeklyLetterRead(letterId: string): Promise<{ letterId: string; readAt: string }> {
  return {
    letterId,
    readAt: new Date().toISOString()
  };
}
