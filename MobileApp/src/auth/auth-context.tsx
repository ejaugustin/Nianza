import * as SecureStore from "expo-secure-store";
import { Redirect } from "expo-router";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PRIMARY_CHILD_ID, createChild, deleteChild, listChildren, upsertChild } from "@/api/children";
import { setAuthToken, setUnauthorizedHandler } from "@/api/client";
import {
  AuthSession,
  confirmParent,
  confirmPasswordReset,
  isSessionFresh,
  refreshParentSession,
  requestPasswordReset,
  signInParent,
  signUpParent
} from "@/auth/cognito";

const SESSION_KEY = "nianza.mobile.session";
// Legacy key: before multi-child support, exactly one profile was stored per
// parent email under this key (no childId in the key at all). Kept only so
// restore() can migrate it forward the first time an existing account opens
// the updated app.
const LEGACY_PROFILE_KEY = "nianza.mobile.profile";
const PROFILE_KEY_PREFIX = "nianza.mobile.profile";
const CHILD_INDEX_KEY_PREFIX = "nianza.mobile.children-index";
const ACTIVE_CHILD_KEY_PREFIX = "nianza.mobile.active-child";

export type ChildProfile = {
  // Optional only at the moment a profile is first assembled (onboarding
  // doesn't know the id yet — completeOnboarding assigns it). Every profile
  // that has actually been through completeOnboarding/addChild and is
  // sitting in `children` state or SecureStore is guaranteed to have one.
  childId?: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentName: string;
  childName: string;
  childBirthDate: string;
  sexAtBirth: "girl" | "boy";
  bornEarly?: boolean;
  weeksEarly?: number | null;
  ageWindowMonths: number;
  language: "en" | "es" | "fr" | "ar";
  firstTimeParent?: boolean | null;
  parentRole?: "mother" | "father" | "other" | null;
  parentingSolo?: boolean | null;
  multilingualHome?: boolean | null;
  notificationCadence?: "daily" | "few-times-week" | "weekly";
  notificationsEnabled: boolean;
  vaccineRemindersEnabled?: boolean;
  childPhotoUri?: string | null;
  privacyConsentAcceptedAt?: string;
  onboardingCompletedAt?: string;
  // Settings (Section J) fields not yet backed by a dedicated backend
  // endpoint -- stored locally (SecureStore) the same way most profile
  // fields already are, and best-effort synced through upsertChild
  // wherever that endpoint already understands the field.
  allergies?: string;
  pediatricianName?: string;
  pediatricianEmail?: string;
  pediatricianPhone?: string;
  nextVisitDate?: string | null;
  // M16 (Family postcards): server-side throttle timestamp, mirrors
  // nextVisitDate's pattern exactly -- local optimistic copy kept here,
  // source of truth is the backend children record.
  lastPostcardOfferAt?: string | null;
};

/** Fields that describe the parent/account rather than a specific child.
 * Copied onto every new child so the household-level preferences (name,
 * language, notification cadence, privacy consent) don't need re-entering
 * per kid. Patricia's conversation memory is intentionally shared across
 * siblings on one account (see docs/multi-child-support-spec.md), so this
 * mirrors that same "one family, one account" model. */
const PARENT_LEVEL_FIELDS = [
  "parentFirstName",
  "parentLastName",
  "parentName",
  "language",
  "firstTimeParent",
  "parentRole",
  "parentingSolo",
  "multilingualHome",
  "notificationCadence",
  "notificationsEnabled",
  "vaccineRemindersEnabled",
  "privacyConsentAcceptedAt"
] as const;

/** A ChildProfile that is guaranteed to have gone through completeOnboarding
 * or addChild, and therefore always has a real childId. Used internally for
 * anything that persists to SecureStore or the backend, both of which need
 * the id. */
type StoredChildProfile = ChildProfile & { childId: string };

export type NewChildInput = {
  childName: string;
  childBirthDate: string;
  sexAtBirth: "girl" | "boy";
  bornEarly?: boolean;
  weeksEarly?: number | null;
  childPhotoUri?: string | null;
  allergies?: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  profile: StoredChildProfile | null;
  /** Every child on this account, in the order they were added. */
  children: StoredChildProfile[];
  activeChildId: string | null;
  signUp: (email: string, password: string, parentName: string, locale: string) => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<StoredChildProfile | null>;
  requestReset: (email: string) => Promise<void>;
  confirmReset: (email: string, code: string, password: string) => Promise<void>;
  completeOnboarding: (profile: ChildProfile) => Promise<void>;
  updateProfile: (patch: Partial<ChildProfile>) => Promise<void>;
  /** Makes an already-known child (by id) the active one everywhere in the app. */
  switchActiveChild: (childId: string) => Promise<void>;
  /** Creates a new child on the backend, stores it locally, and makes it active. */
  addChild: (input: NewChildInput) => Promise<StoredChildProfile>;
  /** Soft-deletes a child and, if it was the active one, switches to
   * whichever child is left. Refuses to remove an account's last child
   * (throws an Error with message "LAST_CHILD") — Nianza always needs at
   * least one child on the account, same invariant RequireAuth relies on. */
  removeChild: (childId: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Clears this device's locally stored session and profiles. This is a real,
  // complete local deletion — but Nianza has no backend account-deletion
  // endpoint yet, so any copy of this data already synced to the server is
  // NOT removed by this call. Screens using this must be honest about that
  // gap rather than claiming full account deletion.
  deleteLocalAccountData: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function safeEmailKey(email: string) {
  return normalizeEmail(email).replace(/[^A-Za-z0-9._-]/g, "_");
}

function legacyProfileKey(email: string) {
  return `${LEGACY_PROFILE_KEY}.${safeEmailKey(email)}`;
}

function childProfileKey(email: string, childId: string) {
  return `${PROFILE_KEY_PREFIX}.${safeEmailKey(email)}.${safeEmailKey(childId)}`;
}

function childIndexKey(email: string) {
  return `${CHILD_INDEX_KEY_PREFIX}.${safeEmailKey(email)}`;
}

function activeChildKey(email: string) {
  return `${ACTIVE_CHILD_KEY_PREFIX}.${safeEmailKey(email)}`;
}

function isProfileComplete(profile: ChildProfile | null | undefined): profile is ChildProfile {
  if (!profile) return false;
  return Boolean(
    profile.parentFirstName?.trim() &&
      profile.parentLastName?.trim() &&
      profile.parentName?.trim() &&
      profile.childName?.trim() &&
      profile.childBirthDate?.trim() &&
      profile.sexAtBirth &&
      profile.language &&
      profile.notificationCadence &&
      profile.privacyConsentAcceptedAt &&
      profile.onboardingCompletedAt
  );
}

async function readChildIndex(email: string): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(childIndexKey(email));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

async function writeChildIndex(email: string, childIds: string[]) {
  const unique = Array.from(new Set(childIds));
  await SecureStore.setItemAsync(childIndexKey(email), JSON.stringify(unique));
}

async function readChildProfile(email: string, childId: string): Promise<ChildProfile | null> {
  const raw = await SecureStore.getItemAsync(childProfileKey(email, childId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChildProfile;
  } catch {
    return null;
  }
}

async function writeChildProfile(email: string, profile: StoredChildProfile) {
  await SecureStore.setItemAsync(childProfileKey(email, profile.childId), JSON.stringify(profile));
}

/** One-time migration: an existing account's single pre-multi-child profile
 * (stored with no childId in the key) becomes childId === PRIMARY_CHILD_ID. */
async function migrateLegacyProfile(email: string): Promise<StoredChildProfile | null> {
  const raw = await SecureStore.getItemAsync(legacyProfileKey(email));
  if (!raw) return null;
  let parsed: ChildProfile | null = null;
  try {
    parsed = JSON.parse(raw) as ChildProfile;
  } catch {
    parsed = null;
  }
  if (!parsed || !isProfileComplete(parsed)) return null;

  const migrated: StoredChildProfile = { ...parsed, childId: parsed.childId || PRIMARY_CHILD_ID };
  await writeChildProfile(email, migrated);
  const index = await readChildIndex(email);
  if (!index.includes(migrated.childId)) {
    await writeChildIndex(email, [...index, migrated.childId]);
  }
  await SecureStore.deleteItemAsync(legacyProfileKey(email));
  return migrated;
}

/** Loads every child this device knows about locally, reconciling against
 * whatever the backend reports (best-effort — the local copy always wins on
 * conflict, since it may include settings-only fields the backend doesn't
 * understand yet). */
async function loadChildren(email: string): Promise<StoredChildProfile[]> {
  await migrateLegacyProfile(email).catch(() => null);

  let index = await readChildIndex(email);
  const localProfiles = new Map<string, StoredChildProfile>();
  for (const childId of index) {
    const found = await readChildProfile(email, childId);
    if (found) localProfiles.set(childId, { ...found, childId: found.childId || childId });
  }

  try {
    const backendChildren = await listChildren();
    for (const backendChild of backendChildren) {
      if (localProfiles.has(backendChild.childId)) continue;
      // Backend knows about a child this device has never seen locally
      // (e.g. added from another device). Hydrate a working local copy from
      // whatever parent-level fields we have on hand, falling back to
      // reasonable defaults for anything account-level we can't infer.
      const template = [...localProfiles.values()][0];
      const hydrated: StoredChildProfile = {
        childId: backendChild.childId,
        parentFirstName: template?.parentFirstName,
        parentLastName: template?.parentLastName,
        parentName: template?.parentName || "",
        childName: backendChild.childName,
        childBirthDate: backendChild.childBirthDate,
        sexAtBirth: backendChild.sexAtBirth,
        bornEarly: backendChild.bornEarly,
        weeksEarly: backendChild.weeksEarly,
        ageWindowMonths: template?.ageWindowMonths ?? 0,
        language: backendChild.language || template?.language || "en",
        notificationCadence: template?.notificationCadence,
        notificationsEnabled: template?.notificationsEnabled ?? true,
        vaccineRemindersEnabled: template?.vaccineRemindersEnabled,
        childPhotoUri: backendChild.photoUrl || null,
        privacyConsentAcceptedAt: template?.privacyConsentAcceptedAt,
        onboardingCompletedAt: backendChild.createdAt
      };
      localProfiles.set(backendChild.childId, hydrated);
      await writeChildProfile(email, hydrated);
    }
    index = [...localProfiles.keys()];
    await writeChildIndex(email, index);
  } catch {
    // Offline or backend unavailable — proceed with whatever is on-device.
  }

  return index.map((childId) => localProfiles.get(childId)).filter((p): p is StoredChildProfile => Boolean(p));
}

async function resolveActiveChildId(email: string, loadedChildren: StoredChildProfile[]): Promise<string | null> {
  const saved = await SecureStore.getItemAsync(activeChildKey(email));
  if (saved && loadedChildren.some((c) => c.childId === saved)) return saved;
  return loadedChildren[0]?.childId || null;
}

async function syncProfileToBackend(profile: StoredChildProfile | null) {
  if (!profile) return;
  await upsertChild(profile.childId, profile);
}

export function AuthProvider({ children: reactChildren }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [childrenState, setChildrenState] = useState<StoredChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  // The unauthorized-handler registered with the API client is set up once
  // and lives for the life of the app, but needs the *current* session (not
  // whatever it was when the effect ran) -- a ref sidesteps that staleness.
  const sessionRef = useRef<AuthSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const profile = useMemo(
    () => childrenState.find((c) => c.childId === activeChildId) || null,
    [childrenState, activeChildId]
  );

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const storedSession = await SecureStore.getItemAsync(SESSION_KEY);
      let parsedSession = storedSession ? (JSON.parse(storedSession) as AuthSession) : null;

      if (!mounted) return;

      // The ID token in a stored session is only good for about an hour, so
      // a session saved yesterday will almost always fail isSessionFresh --
      // that doesn't mean the parent needs to log in again, just that we
      // need a fresh ID token. Try the refresh token before giving up.
      if (parsedSession && !isSessionFresh(parsedSession)) {
        parsedSession = await refreshParentSession(parsedSession.email, parsedSession.refreshToken).catch(() => null);
      }

      if (!mounted) return;

      if (parsedSession) {
        setAuthToken(parsedSession.idToken);
        const loadedChildren = await loadChildren(parsedSession.email);
        const nextActiveId = await resolveActiveChildId(parsedSession.email, loadedChildren);
        if (!mounted) return;
        setSession(parsedSession);
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(parsedSession));
        setChildrenState(loadedChildren);
        setActiveChildId(nextActiveId);
        setStatus("authenticated");
      } else {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setAuthToken(null);
        setChildrenState([]);
        setActiveChildId(null);
        setStatus("unauthenticated");
      }
    }

    restore().catch(() => {
      setAuthToken(null);
      setChildrenState([]);
      setActiveChildId(null);
      setStatus("unauthenticated");
    });

    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = useCallback(async (nextSession: AuthSession) => {
    setAuthToken(nextSession.idToken);
    const loadedChildren = await loadChildren(nextSession.email);
    const nextActiveId = await resolveActiveChildId(nextSession.email, loadedChildren);
    const activeProfile = loadedChildren.find((c) => c.childId === nextActiveId) || null;
    await syncProfileToBackend(activeProfile).catch(() => undefined);
    setSession(nextSession);
    setChildrenState(loadedChildren);
    setActiveChildId(nextActiveId);
    setStatus("authenticated");
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
    return activeProfile;
  }, []);

  // Registered with the API client below so a 401 from any screen (Vaccines,
  // Milestones, wherever) can be resolved by silently minting a fresh ID
  // token instead of surfacing a dead-end "please sign in again" error.
  // Returns the new ID token on success, or null (after signing the parent
  // out, since the refresh token itself is no longer valid) on failure.
  const refreshAuthToken = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.refreshToken) return null;
    try {
      const refreshed = await refreshParentSession(current.email, current.refreshToken);
      setAuthToken(refreshed.idToken);
      setSession(refreshed);
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(refreshed));
      return refreshed.idToken;
    } catch {
      setSession(null);
      setAuthToken(null);
      setStatus("unauthenticated");
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return null;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(refreshAuthToken);
    return () => setUnauthorizedHandler(null);
  }, [refreshAuthToken]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      children: childrenState,
      activeChildId,
      signUp: signUpParent,
      confirmEmail: confirmParent,
      signIn: async (email, password) => {
        return persistSession(await signInParent(email, password));
      },
      requestReset: requestPasswordReset,
      confirmReset: confirmPasswordReset,
      completeOnboarding: async (nextProfile) => {
        if (!session?.email) throw new Error("Sign in before completing onboarding.");
        const childId = nextProfile.childId || PRIMARY_CHILD_ID;
        const completed: StoredChildProfile = { ...nextProfile, childId };
        await upsertChild(childId, completed);
        setChildrenState((prev) => {
          const withoutThis = prev.filter((c) => c.childId !== childId);
          return [...withoutThis, completed];
        });
        setActiveChildId(childId);
        await writeChildProfile(session.email, completed);
        const index = await readChildIndex(session.email);
        if (!index.includes(childId)) await writeChildIndex(session.email, [...index, childId]);
        await SecureStore.setItemAsync(activeChildKey(session.email), childId);
      },
      updateProfile: async (patch) => {
        if (!session?.email) throw new Error("Sign in before updating your profile.");
        if (!profile) throw new Error("No profile to update yet.");
        const nextProfile: StoredChildProfile = { ...profile, ...patch };
        // Persist locally first so the change always sticks even if the
        // backend call below fails or the field isn't backend-supported yet.
        setChildrenState((prev) => prev.map((c) => (c.childId === nextProfile.childId ? nextProfile : c)));
        await writeChildProfile(session.email, nextProfile);
        // Best-effort sync of whatever subset of fields the child-upsert
        // endpoint understands today (name, DOB, sex, language, born-early,
        // photo). Fields like allergies/pediatrician/notifications are
        // simply ignored by that endpoint's allow-list, so this is safe to
        // call unconditionally rather than tracking which fields changed.
        await upsertChild(nextProfile.childId, nextProfile).catch(() => undefined);
      },
      switchActiveChild: async (childId) => {
        if (!session?.email) throw new Error("Sign in before switching children.");
        if (!childrenState.some((c) => c.childId === childId)) {
          throw new Error("That child isn't on this account.");
        }
        setActiveChildId(childId);
        await SecureStore.setItemAsync(activeChildKey(session.email), childId);
      },
      addChild: async (input) => {
        if (!session?.email) throw new Error("Sign in before adding a child.");
        const template = profile || childrenState[0] || null;
        const created = await createChild(input);
        const now = new Date().toISOString();
        const inheritedParentFields = Object.fromEntries(
          PARENT_LEVEL_FIELDS.map((field) => [field, template?.[field]])
        );
        const nextProfile: StoredChildProfile = {
          ...inheritedParentFields,
          language: template?.language || "en",
          notificationsEnabled: template?.notificationsEnabled ?? true,
          childId: created.childId,
          childName: input.childName,
          childBirthDate: input.childBirthDate,
          sexAtBirth: input.sexAtBirth,
          bornEarly: input.bornEarly,
          weeksEarly: input.weeksEarly,
          childPhotoUri: input.childPhotoUri || null,
          allergies: input.allergies,
          ageWindowMonths: 0,
          onboardingCompletedAt: now,
          // Explicit fallback in case there's no template to inherit from
          // (shouldn't happen in practice — addChild is only reachable once
          // an account already has at least one child).
          parentName: template?.parentName || ""
        };
        setChildrenState((prev) => [...prev, nextProfile]);
        setActiveChildId(nextProfile.childId);
        await writeChildProfile(session.email, nextProfile);
        const index = await readChildIndex(session.email);
        await writeChildIndex(session.email, [...index, nextProfile.childId]);
        await SecureStore.setItemAsync(activeChildKey(session.email), nextProfile.childId);
        return nextProfile;
      },
      removeChild: async (childId) => {
        if (!session?.email) throw new Error("Sign in before removing a child.");
        if (childrenState.length <= 1) {
          throw new Error("LAST_CHILD");
        }
        await deleteChild(childId);
        const remaining = childrenState.filter((c) => c.childId !== childId);
        setChildrenState(remaining);
        await SecureStore.deleteItemAsync(childProfileKey(session.email, childId));
        const index = await readChildIndex(session.email);
        await writeChildIndex(session.email, index.filter((id) => id !== childId));
        if (activeChildId === childId) {
          const nextActiveId = remaining[0]?.childId || null;
          setActiveChildId(nextActiveId);
          if (nextActiveId) {
            await SecureStore.setItemAsync(activeChildKey(session.email), nextActiveId);
          } else {
            await SecureStore.deleteItemAsync(activeChildKey(session.email));
          }
        }
      },
      signOut: async () => {
        setSession(null);
        setAuthToken(null);
        setStatus("unauthenticated");
        await SecureStore.deleteItemAsync(SESSION_KEY);
      },
      deleteLocalAccountData: async () => {
        if (session?.email) {
          const index = await readChildIndex(session.email);
          await Promise.all(index.map((childId) => SecureStore.deleteItemAsync(childProfileKey(session.email, childId))));
          await SecureStore.deleteItemAsync(childIndexKey(session.email));
          await SecureStore.deleteItemAsync(activeChildKey(session.email));
          await SecureStore.deleteItemAsync(legacyProfileKey(session.email));
        }
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setSession(null);
        setChildrenState([]);
        setActiveChildId(null);
        setAuthToken(null);
        setStatus("unauthenticated");
      }
    }),
    [persistSession, profile, childrenState, activeChildId, session, status]
  );

  return <AuthContext.Provider value={value}>{reactChildren}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.status === "loading") return null;
  if (auth.status === "unauthenticated") return <Redirect href="/(auth)/welcome" />;
  if (!auth.profile) return <Redirect href="/(auth)/onboarding" />;
  return children;
}
