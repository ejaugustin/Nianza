import { apiGet, apiPost } from "@/api/client";
import type { MilestoneDefinition } from "@/data/milestones";

export type WatchForProgressItem = {
  actEarlyId: string;
  text: string;
  status: "checked" | "unchecked";
  checkedAt?: string | null;
  originWindow?: string;
  originLabel?: string;
};

export type MilestoneProgressResponse = {
  childId: string;
  effectiveAgeMonths: number;
  currentWindow: {
    ageKey: string;
    label: string;
    windowEndMonths: number;
    milestones: Array<MilestoneDefinition & {
      status: "observed" | "unobserved";
      observedAt?: string | null;
      backfilled?: boolean;
      photoUrls?: string[];
    }>;
  };
  watchFor: WatchForProgressItem[];
  rolledOver: Array<MilestoneDefinition & {
    status: "observed" | "unobserved";
    originWindow?: string;
    originLabel?: string;
  }>;
};

export async function getMilestoneProgress(childId = "primary-child") {
  return apiGet<MilestoneProgressResponse>(`/milestones/${encodeURIComponent(childId)}`);
}

export async function recordMilestoneObservation({
  childId = "primary-child",
  milestoneId,
  checked = true,
  photoUrls = [],
  milestoneName,
  observedAt
}: {
  childId?: string;
  milestoneId: string;
  checked?: boolean;
  photoUrls?: string[];
  milestoneName?: string;
  observedAt?: string;
}) {
  return apiPost<{ observation: unknown }>(`/milestones/${encodeURIComponent(childId)}/observations`, {
    milestoneId,
    checked,
    observedAt: observedAt || new Date().toISOString(),
    photoUrls,
    ...(milestoneName ? { milestoneName } : {})
  });
}

export type CustomFirst = {
  milestoneId: string;
  customName: string;
  observedAt: string;
  photoUrls: string[];
};

/** D7 (Custom "firsts"): pure memory, zero clinical surface -- these never
 * appear in getMilestoneProgress() at all (buildMilestoneProgress only
 * surfaces items that match a real library milestoneId), so they need this
 * separate read path. */
export async function listCustomFirsts(childId = "primary-child") {
  const result = await apiGet<{ firsts: CustomFirst[] }>(`/milestones/${encodeURIComponent(childId)}/firsts`);
  return result.firsts || [];
}

export async function recordCustomFirst({
  childId = "primary-child",
  name,
  observedAt,
  photoUrls = []
}: {
  childId?: string;
  name: string;
  observedAt?: string;
  photoUrls?: string[];
}) {
  const milestoneId = `custom#${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return recordMilestoneObservation({ childId, milestoneId, checked: true, milestoneName: name, observedAt, photoUrls });
}
