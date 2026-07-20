import { adminApiClient } from "./client";

export type ContentStatus = "draft" | "reviewed" | "approved" | "deleted";

export type ContentItem = {
  contentId: string;
  version: string;
  contentType: string;
  language: "en" | "es" | "fr" | "ar";
  ageWindowMonths: number | null;
  domain: string | null;
  bodyText: string;
  sourceRef: string;
  ttsEnabled: boolean;
  clinicallyReviewed: boolean;
  ejApproved: boolean;
  status: ContentStatus;
};

export type CreateContentInput = {
  contentType: string;
  language: ContentItem["language"];
  ageWindowMonths?: number | null;
  domain?: string | null;
  bodyText: string;
  sourceRef: string;
  ttsEnabled: boolean;
};

const mockItems: ContentItem[] = [
  {
    contentId: "daily-note#en#4mo#movement#sample",
    version: "1.0.0",
    contentType: "daily-note",
    language: "en",
    ageWindowMonths: 4,
    domain: "movement",
    bodyText: "Around now, Sofia is starting to connect voices to faces.",
    sourceRef: "CDC-LTSAE-2022",
    ttsEnabled: true,
    clinicallyReviewed: false,
    ejApproved: false,
    status: "draft"
  }
];

function isLocalFallbackAllowed() {
  return import.meta.env.DEV && !import.meta.env.VITE_ADMIN_API_URL;
}

export async function listContent(): Promise<ContentItem[]> {
  if (isLocalFallbackAllowed()) return mockItems;
  const response = await adminApiClient.get<{ items: ContentItem[] }>("/content");
  return response.data.items;
}

export async function createContent(input: CreateContentInput): Promise<ContentItem> {
  if (isLocalFallbackAllowed()) {
    return {
      ...input,
      contentId: `${input.contentType}#${input.language}#${input.ageWindowMonths ?? "global"}#${input.domain || "none"}#local`,
      version: "1.0.0",
      ageWindowMonths: input.ageWindowMonths ?? null,
      domain: input.domain || null,
      clinicallyReviewed: false,
      ejApproved: false,
      status: "draft"
    };
  }
  const response = await adminApiClient.post<{ item: ContentItem }>("/content", input);
  return response.data.item;
}

export async function reviewContent(item: ContentItem): Promise<ContentItem> {
  if (isLocalFallbackAllowed()) return { ...item, clinicallyReviewed: true, status: "reviewed" };
  const response = await adminApiClient.post<{ item: ContentItem }>(
    `/content/${encodeURIComponent(item.contentId)}/review`,
    { version: item.version }
  );
  return response.data.item;
}

export async function approveContent(item: ContentItem): Promise<ContentItem> {
  if (isLocalFallbackAllowed()) return { ...item, clinicallyReviewed: true, ejApproved: true, status: "approved" };
  const response = await adminApiClient.post<{ item: ContentItem }>(
    `/content/${encodeURIComponent(item.contentId)}/approve`,
    { version: item.version }
  );
  return response.data.item;
}
