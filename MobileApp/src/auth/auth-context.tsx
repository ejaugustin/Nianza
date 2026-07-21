import * as SecureStore from "expo-secure-store";
import { Redirect } from "expo-router";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setAuthToken } from "@/api/client";
import {
  AuthSession,
  confirmParent,
  confirmPasswordReset,
  isSessionFresh,
  requestPasswordReset,
  signInParent,
  signUpParent
} from "@/auth/cognito";

const SESSION_KEY = "nianza.mobile.session";
const PROFILE_KEY = "nianza.mobile.profile";

export type ChildProfile = {
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
  privacyConsentAcceptedAt?: string;
  onboardingCompletedAt?: string;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  profile: ChildProfile | null;
  signUp: (email: string, password: string, parentName: string, locale: string) => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<ChildProfile | null>;
  requestReset: (email: string) => Promise<void>;
  confirmReset: (email: string, code: string, password: string) => Promise<void>;
  completeOnboarding: (profile: ChildProfile) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function profileKey(email: string) {
  const safeEmail = normalizeEmail(email).replace(/[^A-Za-z0-9._-]/g, "_");
  return `${PROFILE_KEY}.${safeEmail}`;
}

async function readProfile(email: string) {
  const storedProfile = await SecureStore.getItemAsync(profileKey(email));
  const parsedProfile = storedProfile ? (JSON.parse(storedProfile) as ChildProfile) : null;
  return parsedProfile && isProfileComplete(parsedProfile) ? parsedProfile : null;
}

function isProfileComplete(profile: ChildProfile) {
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<ChildProfile | null>(null);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const storedSession = await SecureStore.getItemAsync(SESSION_KEY);
      const parsedSession = storedSession ? (JSON.parse(storedSession) as AuthSession) : null;

      if (!mounted) return;

      if (parsedSession && isSessionFresh(parsedSession)) {
        const parsedProfile = await readProfile(parsedSession.email);
        if (!mounted) return;
        setSession(parsedSession);
        setAuthToken(parsedSession?.idToken || null);
        setProfile(parsedProfile);
        setStatus("authenticated");
      } else {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setAuthToken(null);
        setProfile(null);
        setStatus("unauthenticated");
      }
    }

    restore().catch(() => {
      setAuthToken(null);
      setProfile(null);
      setStatus("unauthenticated");
    });

    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = useCallback(async (nextSession: AuthSession) => {
    const nextProfile = await readProfile(nextSession.email);
    setSession(nextSession);
    setProfile(nextProfile);
    setAuthToken(nextSession.idToken);
    setStatus("authenticated");
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
    await SecureStore.deleteItemAsync(PROFILE_KEY);
    return nextProfile;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      signUp: signUpParent,
      confirmEmail: confirmParent,
      signIn: async (email, password) => {
        return persistSession(await signInParent(email, password));
      },
      requestReset: requestPasswordReset,
      confirmReset: confirmPasswordReset,
      completeOnboarding: async (nextProfile) => {
        if (!session?.email) throw new Error("Sign in before completing onboarding.");
        setProfile(nextProfile);
        await SecureStore.setItemAsync(profileKey(session.email), JSON.stringify(nextProfile));
        await SecureStore.deleteItemAsync(PROFILE_KEY);
      },
      signOut: async () => {
        setSession(null);
        setAuthToken(null);
        setStatus("unauthenticated");
        await SecureStore.deleteItemAsync(SESSION_KEY);
      }
    }),
    [persistSession, profile, session, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
