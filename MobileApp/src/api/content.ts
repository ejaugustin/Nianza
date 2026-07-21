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
  domain?: string | null;
};

export async function getDailyNote(params: DailyNoteParams) {
  const response = await apiGet<DailyNoteResponse>("/content/daily-note", params);
  return response.item;
}
