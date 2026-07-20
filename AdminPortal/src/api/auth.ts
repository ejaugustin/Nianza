export type AdminUser = {
  userId: string;
  email: string;
  role: "super_admin" | "content_editor" | "operations" | string;
};

export type AdminSession = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  user: AdminUser;
  expiresAt: number;
};

export type NewPasswordChallenge = {
  challengeName: "NEW_PASSWORD_REQUIRED";
  session: string;
  username: string;
  email: string;
};

const storageKey = "nianza.admin.session";

const cognitoRegion = import.meta.env.VITE_ADMIN_COGNITO_REGION || "us-east-2";
const cognitoClientId = import.meta.env.VITE_ADMIN_COGNITO_CLIENT_ID || "";

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Malformed Cognito token");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(window.atob(padded));
}

async function cognitoRequest<T>(target: string, body: Record<string, unknown>): Promise<T> {
  if (!cognitoClientId) {
    throw new Error("Admin Cognito client ID is not configured.");
  }

  const response = await fetch(`https://cognito-idp.${cognitoRegion}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.__type || "Cognito request failed");
  return data;
}

function toAdminSession(authenticationResult: {
  IdToken: string;
  AccessToken: string;
  RefreshToken?: string;
  ExpiresIn?: number;
}): AdminSession {
  const payload = decodeJwtPayload(authenticationResult.IdToken);
  const expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + (authenticationResult.ExpiresIn || 3600) * 1000;

  return {
    idToken: authenticationResult.IdToken,
    accessToken: authenticationResult.AccessToken,
    refreshToken: authenticationResult.RefreshToken,
    expiresAt,
    user: {
      userId: payload.sub,
      email: payload.email,
      role: payload["custom:role"] || payload.role || "operations"
    }
  };
}

export function saveSession(session: AdminSession) {
  localStorage.setItem(storageKey, JSON.stringify(session));
}

export function loadSession(): AdminSession | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AdminSession;
    if (!session.idToken || Date.now() >= session.expiresAt) {
      localStorage.removeItem(storageKey);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(storageKey);
}

export async function signInAdmin(email: string, password: string): Promise<AdminSession | NewPasswordChallenge> {
  const data = await cognitoRequest<{
    AuthenticationResult?: Parameters<typeof toAdminSession>[0];
    ChallengeName?: string;
    Session?: string;
    ChallengeParameters?: Record<string, string>;
  }>("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: cognitoClientId,
    AuthParameters: { USERNAME: email, PASSWORD: password }
  });

  if (data.ChallengeName === "NEW_PASSWORD_REQUIRED" && data.Session) {
    return {
      challengeName: "NEW_PASSWORD_REQUIRED",
      session: data.Session,
      username: data.ChallengeParameters?.USER_ID_FOR_SRP || email,
      email
    };
  }

  if (!data.AuthenticationResult) throw new Error("Sign in did not return an admin session.");
  return toAdminSession(data.AuthenticationResult);
}

export async function completeNewPasswordChallenge(
  challenge: NewPasswordChallenge,
  newPassword: string
): Promise<AdminSession> {
  const data = await cognitoRequest<{ AuthenticationResult?: Parameters<typeof toAdminSession>[0] }>(
    "RespondToAuthChallenge",
    {
      ClientId: cognitoClientId,
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: challenge.session,
      ChallengeResponses: {
        USERNAME: challenge.username,
        NEW_PASSWORD: newPassword
      }
    }
  );

  if (!data.AuthenticationResult) throw new Error("Password change did not return an admin session.");
  return toAdminSession(data.AuthenticationResult);
}
