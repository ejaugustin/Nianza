import { apiGet } from "@/api/client";

export type MobileContentItem = {
  contentId: string;
  version: string;
  contentType: "daily-note";
  language: "en" | "es" | "fr" | "ar";
  ageWindowMonths: number | null;
  domain: string | null;
  bodyText: string;
  sourceRef: string;
  audioUrl?: string | null;
  milestoneTag?: string | null;
  ttsEnabled: boolean;
  status: "approved";
  updatedAt?: string;
};

type DailyNoteResponse = {
  item: MobileContentItem | null;
};

export type DailyNoteParams = {
  language: string;
  ageWindowMonths?: number | null;
  /** Days since the child's date of birth (day 1 = birth day). The
   * daily-tip library is authored as a day-of-life-indexed sequence, so
   * this is what actually drives which tip is "today's" note -- see
   * Backend/mobile/content/handler.js selectByDayOfLife(). */
  dayOfLife?: number | null;
};

export async function getDailyNote(params: DailyNoteParams) {
  const response = await apiGet<DailyNoteResponse>("/content/daily-note", params);
  return response.item;
}

export type GenerationalShiftItem = {
  contentId: string;
  version: string;
  contentType: "generational-shift";
  language: "en" | "es" | "fr" | "ar";
  topic: string | null;
  bodyText: string;
  sourceRef: string;
  ttsEnabled: boolean;
  status: string;
  updatedAt?: string;
};

/** N4 (Village Translator): a single generational-shift item by topic slug,
 * for a G.0 "Ask Patricia" contextual link. Returns null if that topic
 * doesn't exist in this language yet rather than throwing, so callers can
 * simply not render the link. */
export async function getGenerationalShiftTopic(topic: string, language = "en") {
  try {
    const response = await apiGet<{ item: GenerationalShiftItem }>("/content/generational-shift", { topic, language });
    return response.item;
  } catch {
    return null;
  }
}

export type PostcardDateRange = {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
};

export type PostcardFrameCategory = "core" | "seasonal" | "holiday";

/** M16 (Family postcards), per NZA-POSTCARDS-v1.0/v1.1-Seasonal: metadata
 * for one visual template. `templateKey` maps to a hand-built component in
 * @/components/postcards/registry -- this row never carries executable
 * design content, just which templates exist, their palette (for the
 * picker), and (for seasonal/holiday) their active date window. */
export type PostcardFrame = {
  contentId: string;
  version: string;
  contentType: "postcard-frame";
  language: "en" | "es" | "fr" | "ar";
  templateKey: string;
  category: PostcardFrameCategory;
  composition: string | null;
  bestFor: string | null;
  palette: string[] | null;
  dateRange: PostcardDateRange | null;
  ttsEnabled: boolean;
  status: string;
  updatedAt?: string;
};

/** Fetched once and cached client-side (staleTime handles that at the call
 * site) -- the deck changes rarely, if ever. */
export async function getPostcardFrames(language = "en") {
  try {
    const response = await apiGet<{ items: PostcardFrame[] }>("/content/postcard-frames", { language });
    return response.items || [];
  } catch {
    return [];
  }
}
