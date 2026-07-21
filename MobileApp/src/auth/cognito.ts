import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession
} from "amazon-cognito-identity-js";

const region = process.env.EXPO_PUBLIC_COGNITO_REGION || "";
const userPoolId = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID || "";
const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID || "";

const memoryStorage = new Map<string, string>();

const storage = {
  setItem(key: string, value: string) {
    memoryStorage.set(key, value);
  },
  getItem(key: string) {
    return memoryStorage.get(key) || null;
  },
  removeItem(key: string) {
    memoryStorage.delete(key);
  },
  clear() {
    memoryStorage.clear();
  }
};

export const cognitoConfig = {
  region,
  userPoolId,
  clientId,
  isConfigured: Boolean(region && userPoolId && clientId)
};

function getPool() {
  if (!cognitoConfig.isConfigured) {
    throw new Error("Mobile Cognito is not configured yet.");
  }

  return new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: clientId,
    Storage: storage
  });
}

export type AuthSession = {
  email: string;
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(atob(normalized));
}

function toSession(email: string, session: CognitoUserSession): AuthSession {
  return {
    email,
    accessToken: session.getAccessToken().getJwtToken(),
    idToken: session.getIdToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
    expiresAt: session.getIdToken().getExpiration() * 1000
  };
}

export function getEmailFromIdToken(idToken: string) {
  const payload = decodeJwtPayload(idToken);
  return String(payload.email || payload["cognito:username"] || "");
}

export function isSessionFresh(session: AuthSession | null) {
  return Boolean(session && session.expiresAt > Date.now() + 60_000);
}

export function signUpParent(email: string, password: string, parentName: string, locale: string) {
  return new Promise<void>((resolve, reject) => {
    getPool().signUp(
      email.trim().toLowerCase(),
      password,
      [
        new CognitoUserAttribute({ Name: "email", Value: email.trim().toLowerCase() }),
        new CognitoUserAttribute({ Name: "custom:parent_name", Value: parentName.trim() }),
        new CognitoUserAttribute({ Name: "locale", Value: locale })
      ],
      [],
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export function confirmParent(email: string, code: string) {
  return new Promise<void>((resolve, reject) => {
    const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: getPool(), Storage: storage });
    user.confirmRegistration(code.trim(), true, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function signInParent(email: string, password: string) {
  return new Promise<AuthSession>((resolve, reject) => {
    const normalizedEmail = email.trim().toLowerCase();
    const user = new CognitoUser({ Username: normalizedEmail, Pool: getPool(), Storage: storage });
    const details = new AuthenticationDetails({ Username: normalizedEmail, Password: password });

    user.authenticateUser(details, {
      onSuccess: (session) => resolve(toSession(normalizedEmail, session)),
      onFailure: reject
    });
  });
}

export function requestPasswordReset(email: string) {
  return new Promise<void>((resolve, reject) => {
    const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: getPool(), Storage: storage });
    user.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: reject
    });
  });
}

export function confirmPasswordReset(email: string, code: string, newPassword: string) {
  return new Promise<void>((resolve, reject) => {
    const user = new CognitoUser({ Username: email.trim().toLowerCase(), Pool: getPool(), Storage: storage });
    user.confirmPassword(code.trim(), newPassword, {
      onSuccess: () => resolve(),
      onFailure: reject
    });
  });
}
