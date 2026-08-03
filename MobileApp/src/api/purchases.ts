import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, PurchasesError, PurchasesPackage } from "react-native-purchases";

// NZA-SUB-v1.0 Section 4/8.1: purchases are processed by Apple App Store /
// Google Play billing via the RevenueCat SDK (react-native-purchases) --
// not a custom checkout flow.
//
// HISTORY: this SDK was deliberately uninstalled during the July 2026
// TestFlight stabilization work (it was linked but never configured, and
// became one of the suspects chased down while tracking a native-module
// crash across ~18 builds). Reinstalled Aug 3 2026 alongside the real
// RevenueCat dashboard setup (products "nianza_premium_monthly" /
// "nianza_premium_yearly", entitlement "NIanza Pro", offering "default" --
// see app.revenuecat.com/projects/86547d89). DO NOT reinstall/upgrade this
// package casually -- last time it caused a multi-day debugging cycle. Any
// version bump needs a full TestFlight round-trip before trusting it.
//
// APP USER ID: must be the Cognito `sub` claim (see
// auth/cognito.ts#getUserIdFromIdToken), never the email or an anonymous
// RevenueCat-generated id -- the billing webhook resolves events by
// matching RevenueCat's app_user_id against nianza-users' userId, which is
// always the Cognito sub. configurePurchasesSDK() runs anonymously at app
// boot; identifyPurchasesUser() logs in the real id once a session exists;
// resetPurchasesUser() logs back out on sign-out so entitlements never leak
// across accounts on a shared device.
export type PlanId = "monthly" | "yearly";

// RevenueCat package identifiers as configured in the "default" offering
// (app.revenuecat.com/projects/86547d89/product-catalog/offerings) -- these
// are RevenueCat's own default package identifiers, not something we chose.
const PACKAGE_IDENTIFIER: Record<PlanId, string> = {
  monthly: "$rc_monthly",
  yearly: "$rc_annual"
};

export class PurchasesNotConfiguredError extends Error {
  constructor(message = "Purchases are not available in this build yet.") {
    super(message);
    this.name = "PurchasesNotConfiguredError";
  }
}

let configured = false;

function apiKeyForPlatform(): string | null {
  if (Platform.OS === "ios") {
    return process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || null;
  }
  if (Platform.OS === "android") {
    // No Google Play Store app/products exist in RevenueCat yet (only "NIanza
    // (App Store)" as of Aug 2026) -- there is deliberately no
    // EXPO_PUBLIC_REVENUECAT_ANDROID_KEY to set here until that's built out.
    return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || null;
  }
  return null;
}

/** Call once, as early as possible (app/_layout.tsx), before any auth state
 * is known. Configures the SDK anonymously -- RevenueCat assigns a
 * temporary anonymous appUserID until identifyPurchasesUser() logs in the
 * real Cognito sub. Safe to call multiple times; only the first call does
 * anything. Never throws -- a missing/invalid key degrades to
 * PurchasesNotConfiguredError on the actual purchase/restore calls instead
 * of crashing app boot. */
export async function configurePurchasesSDK(): Promise<void> {
  if (configured) return;
  const apiKey = apiKeyForPlatform();
  if (!apiKey) {
    console.warn(`[purchases] No RevenueCat API key for platform "${Platform.OS}" -- purchases disabled this build.`);
    return;
  }
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    await Purchases.configure({ apiKey });
    configured = true;
  } catch (err) {
    console.warn("[purchases] Purchases.configure() failed -- purchases disabled this session.", err);
  }
}

/** Call once a Cognito session exists (idToken decoded -> sub). Aliases the
 * anonymous RevenueCat user to the real account id so billing webhook
 * events resolve to the correct nianza-users row. Safe to call on every
 * app foreground/session refresh -- logIn() is a no-op if already logged in
 * as that id. */
export async function identifyPurchasesUser(userId: string): Promise<void> {
  if (!configured || !userId) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.warn("[purchases] Purchases.logIn() failed", err);
  }
}

/** Call on sign-out / local account data deletion so a shared device never
 * shows one account's entitlements to the next. */
export async function resetPurchasesUser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    // logOut() throws if already anonymous -- expected on a double sign-out,
    // not worth surfacing.
    console.warn("[purchases] Purchases.logOut() failed (likely already anonymous)", err);
  }
}

async function findPackage(planId: PlanId): Promise<PurchasesPackage> {
  if (!configured) throw new PurchasesNotConfiguredError();
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current;
  if (!offering) {
    throw new PurchasesNotConfiguredError("No current RevenueCat offering is configured.");
  }
  const identifier = PACKAGE_IDENTIFIER[planId];
  const pkg = offering.availablePackages.find((candidate) => candidate.identifier === identifier);
  if (!pkg) {
    throw new PurchasesNotConfiguredError(`No "${identifier}" package in the current offering.`);
  }
  return pkg;
}

/** Initiates a store purchase for the given plan. Throws
 * PurchasesNotConfiguredError if the SDK isn't configured or the offering
 * is missing the requested package -- callers should catch that
 * specifically and show a friendly "not available yet" state. A user-
 * cancelled purchase (PurchasesError.userCancelled) is swallowed rather
 * than surfaced as an error, matching standard store-purchase UX. */
export async function purchasePlan(planId: PlanId): Promise<void> {
  const pkg = await findPackage(planId);
  try {
    await Purchases.purchasePackage(pkg);
  } catch (err) {
    if ((err as PurchasesError)?.userCancelled) return;
    throw err;
  }
}

/** Restores a prior purchase (e.g. after reinstall, or on a second
 * device). */
export async function restorePurchases(): Promise<void> {
  if (!configured) throw new PurchasesNotConfiguredError();
  await Purchases.restorePurchases();
}
