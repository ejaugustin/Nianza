import { apiGet, apiPost } from "@/api/client";

// NZA-WEEKLY-LETTER-v1.0 Phase 1: real backend, no email yet -- "emailed"
// isn't a reachable status until Phase 2 wires up the nianza.com SES
// identity and the cross-account claricito-email-dispatcher call. Kept as
// "ready" | "read" for now rather than promising a status this build can't
// produce.
export type WeeklyLetterStatus = "ready" | "read";

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

// Server response shape from mobile/weekly-letters/handler.js -- kept
// separate from the client-facing type above since the backend's field
// names (emailSentAt, emailStatus) differ slightly from what the UI expects.
type WeeklyLetterRecord = {
  letterId: string;
  childId: string;
  title: string;
  weekStartDate: string;
  weekEndDate: string;
  preview: string;
  themeLabel: string;
  status: WeeklyLetterStatus;
  emailSentAt: string | null;
  readAt: string | null;
  greeting?: string;
  bodyText?: string;
  closing?: string;
};

function toClientLetter(record: WeeklyLetterRecord): WeeklyLetter {
  return {
    letterId: record.letterId,
    childId: record.childId,
    title: record.title,
    weekStartDate: record.weekStartDate,
    weekEndDate: record.weekEndDate,
    preview: record.preview,
    themeLabel: record.themeLabel,
    status: record.status,
    emailedAt: record.emailSentAt,
    readAt: record.readAt,
    greeting: record.greeting || "",
    bodyText: record.bodyText || "",
    closing: record.closing || ""
  };
}

export async function listWeeklyLetters(childId = "primary-child"): Promise<WeeklyLetterSummary[]> {
  const response = await apiGet<{ letters: WeeklyLetterRecord[] }>(`/weekly-letters/by-child/${encodeURIComponent(childId)}`);
  return (response.letters || []).map(toClientLetter);
}

// parentFirstName is optional and only used to fill the "locked feature"
// copy's {Name} slot server-side if this account is free-tier -- same
// pattern as getMobileReport in api/reports.ts.
export async function getWeeklyLetter(letterId: string, options?: { parentFirstName?: string }): Promise<WeeklyLetter> {
  const response = await apiGet<{ letter: WeeklyLetterRecord }>(`/weekly-letters/${encodeURIComponent(letterId)}`, {
    parentFirstName: options?.parentFirstName
  });
  return toClientLetter(response.letter);
}

export async function markWeeklyLetterRead(letterId: string): Promise<{ letterId: string; readAt: string }> {
  return apiPost<{ letterId: string; readAt: string }>(`/weekly-letters/${encodeURIComponent(letterId)}/read`, {});
}
