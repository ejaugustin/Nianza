import { apiGet } from "@/api/client";

export type BirthdayLetter = {
  childId: string;
  childName: string;
  ageYears: number;
  windowStart: string;
  windowEnd: string;
  title: string;
  bodyText: string;
  milestoneCount: number;
  customFirstsCount: number;
  generatedAt: string;
};

/** N7 (Birthday Letter): generated on-demand, never proactively pushed.
 * Throws a recognizable error if the child hasn't had a first birthday yet
 * (backend returns 409 TOO_YOUNG) so the caller can hide the entry point
 * entirely rather than show a broken screen. */
export async function getBirthdayLetter(childId: string) {
  const response = await apiGet<{ letter: BirthdayLetter }>(`/memories/${encodeURIComponent(childId)}/birthday-letter`);
  return response.letter;
}

export type AnniversaryNote = {
  childId: string;
  bodyText: string;
  milestoneText: string;
  observedAt: string;
  tierLabel: string;
};

/** N1 (Milestone anniversaries): a note-selection rule that folds into the
 * same slot the regular daily note occupies on Home. Returns null on an
 * ordinary day -- that's the expected common case, not an error. */
export async function getAnniversaryNote(childId: string) {
  try {
    const response = await apiGet<{ note: AnniversaryNote | null }>(`/memories/${encodeURIComponent(childId)}/anniversary-note`);
    return response.note;
  } catch {
    return null;
  }
}
