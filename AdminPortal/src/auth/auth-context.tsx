import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import {
  AdminSession,
  clearSession,
  completeNewPasswordChallenge,
  loadSession,
  NewPasswordChallenge,
  saveSession,
  signInAdmin
} from "../api/auth";
import { setAdminAuthToken } from "../api/client";

type AuthContextValue = {
  session: AdminSession | null;
  challenge: NewPasswordChallenge | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() => loadSession());
  const [challenge, setChallenge] = useState<NewPasswordChallenge | null>(null);

  useEffect(() => {
    setAdminAuthToken(session?.idToken || null);
  }, [session]);

  function applySession(nextSession: AdminSession) {
    saveSession(nextSession);
    setSession(nextSession);
    setChallenge(null);
  }

  const value = useMemo<AuthContextValue>(() => ({
    session,
    challenge,
    isAuthenticated: Boolean(session),
    signIn: async (email, password) => {
      const result = await signInAdmin(email, password);
      if ("challengeName" in result) {
        setChallenge(result);
        return;
      }
      applySession(result);
    },
    completeNewPassword: async (newPassword) => {
      if (!challenge) throw new Error("No password challenge is active.");
      applySession(await completeNewPasswordChallenge(challenge, newPassword));
    },
    signOut: () => {
      clearSession();
      setSession(null);
      setChallenge(null);
    }
  }), [challenge, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
