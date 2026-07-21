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
  parentName: string;
  childName: string;
  childBirthDate: string;
  sexAtBirth: "girl" | "boy";
  ageWindowMonths: number;
  language: "en" | "es" | "fr" | "ar";
  notificationsEnabled: boolean;
};

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  profile: ChildProfile | null;
  signUp: (email: string, password: string, parentName: string, locale: string) => Promise<void>;
  confirmEmail: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  confirmReset: (email: string, code: string, password: string) => Promise<void>;
  completeOnboarding: (profile: ChildProfile) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<ChildProfile | null>(null);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const [storedSession, storedProfile] = await Promise.all([
        SecureStore.getItemAsync(SESSION_KEY),
        SecureStore.getItemAsync(PROFILE_KEY)
      ]);
      const parsedSession = storedSession ? (JSON.parse(storedSession) as AuthSession) : null;
      const parsedProfile = storedProfile ? (JSON.parse(storedProfile) as ChildProfile) : null;

      if (!mounted) return;

      if (isSessionFresh(parsedSession)) {
        setSession(parsedSession);
        setAuthToken(parsedSession?.idToken || null);
        setStatus("authenticated");
      } else {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setAuthToken(null);
        setStatus("unauthenticated");
      }

      setProfile(parsedProfile);
    }

    restore().catch(() => {
      setAuthToken(null);
      setStatus("unauthenticated");
    });

    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = useCallback(async (nextSession: AuthSession) => {
    setSession(nextSession);
    setAuthToken(nextSession.idToken);
    setStatus("authenticated");
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(nextSession));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      profile,
      signUp: signUpParent,
      confirmEmail: confirmParent,
      signIn: async (email, password) => {
        await persistSession(await signInParent(email, password));
      },
      requestReset: requestPasswordReset,
      confirmReset: confirmPasswordReset,
      completeOnboarding: async (nextProfile) => {
        setProfile(nextProfile);
        await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(nextProfile));
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
