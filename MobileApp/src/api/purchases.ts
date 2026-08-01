// NZA-SUB-v1.0 Section 4/8.1: purchases are processed by Apple App Store /
// Google Play billing via the RevenueCat SDK (react-native-purchases) --
// not a custom checkout flow. That SDK was deliberately uninstalled during
// the July 2026 TestFlight stabilization work (it was linked but never
// configured, and became one of the suspects chased down while tracking a
// native-module crash across ~18 builds). This module is the seam where it
// plugs back in: the plan-picker screen calls purchasePlan() without
// knowing whether the real SDK is wired up yet, so reinstalling
// react-native-purchases later only means filling in this one function
// (plus a Purchases.configure() call in app/_layout.tsx) -- not touching
// the UI at all.
//
// DO NOT reinstall react-native-purchases casually. Last time it caused a
// multi-day debugging cycle. When it's time: `npx expo install
// react-native-purchases` (not "latest" -- see the SDK-version-mismatch
// postmortem from that debugging session), configure it deliberately with
// Purchases.configure({ apiKey }) gated behind the platform's actual public
// SDK key (iOS/Android keys differ, both live in RevenueCat's dashboard
// under Project Settings > API Keys -- NOT the secret key already in AWS
// Secrets Manager for the backend webhook, which is a different key for a
// different purpose), and do a full TestFlight/Play internal-testing
// round-trip before trusting it.
export type PlanId = "monthly" | "yearly";

export class PurchasesNotConfiguredError extends Error {
  constructor() {
    super("Purchases are not available in this build yet.");
    this.name = "PurchasesNotConfiguredError";
  }
}

/** Initiates a store purchase for the given plan. Throws
 * PurchasesNotConfiguredError until react-native-purchases is reinstalled
 * and wired up -- callers should catch that specifically and show a
 * friendly "not available yet" state rather than a generic error. */
export async function purchasePlan(_planId: PlanId): Promise<void> {
  throw new PurchasesNotConfiguredError();
}

/** Restores a prior purchase (e.g. after reinstall, or on a second
 * device) -- same not-yet-wired seam as purchasePlan. */
export async function restorePurchases(): Promise<void> {
  throw new PurchasesNotConfiguredError();
}
