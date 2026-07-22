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
  photoUrls = []
}: {
  childId?: string;
  milestoneId: string;
  checked?: boolean;
  photoUrls?: string[];
}) {
  return apiPost<{ observation: unknown }>(`/milestones/${encodeURIComponent(childId)}/observations`, {
    milestoneId,
    checked,
    observedAt: new Date().toISOString(),
    photoUrls
  });
}
