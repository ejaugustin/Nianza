import { apiGet, apiPost } from "@/api/client";

// NZA-SUB-v1.0 Section 8.1: mirrors Backend/shared/entitlements.js's
// capabilities object exactly -- this is a read view of that same source
// of truth, not an independent copy of the gating logic. Screens should
// check `capabilities.<flag>` here rather than looking at `tier` directly,
// so the actual gating rule only ever lives in one place (the backend).
export type EntitlementsTier = "free" | "trial" | "subscribed";

export type Entitlements = {
  tier: EntitlementsTier;
  capabilities: {
    canLogEvents: boolean;
    canAccessTimeline: boolean;
    canAccessReferenceContent: boolean;
    dailyNotePersonalization: boolean;
    canAccessPatriciaConversation: boolean;
    patriciaMessageLimitPerDay: number | null;
    canAccessDoctorVisitPack: boolean;
    canAccessProgressReports: boolean;
    canAccessMemoryHumanMoments: boolean;
    canAccessPatternSynthesis: boolean;
  };
  patricia: {
    limitPerDay: number | null;
    usedToday: number;
    remainingToday: number | null;
  };
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
};

export type TrialNoticeType = "day10" | "day14";

export type TrialNotice = {
  type: TrialNoticeType | null;
  title?: string;
  body?: string;
  ctaLabel?: string;
  secondaryLabel?: string;
};

export type EntitlementsWithTrialNotice = Entitlements & { trialNotice: TrialNotice };

/** Current account's tier + feature-gate flags + today's Patricia message
 * quota, plus whether a Day 10/Day 14 trial notice is due right now
 * (NZA-SUB-v1.0 Section 3/6). Call this to decide what to show/lock in the
 * UI -- the backend enforces the same rules independently on every gated
 * call, so this is for UI decisions, not the actual security boundary.
 * parentFirstName/childName are optional and only used to fill the trial
 * notice copy's {Name}/{Child} slots server-side. */
export async function getEntitlements(params?: { parentFirstName?: string; childName?: string }) {
  return apiGet<EntitlementsWithTrialNotice>("/entitlements", params);
}

/** Marks a trial notice as shown -- call this once the card has actually
 * been rendered (or dismissed) on-screen, never speculatively, so it can
 * never fire twice (Section 8.4: "exactly one notification on Day 10 and
 * one on Day 14"). */
export async function acknowledgeTrialNotice(type: TrialNoticeType) {
  return apiPost<{ acknowledged: boolean }>("/entitlements/trial-notice/ack", { type });
}
