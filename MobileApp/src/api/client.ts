import axios from "axios";
import Constants from "expo-constants";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || "https://api-dev.nianza.com/mobile/v1";

export const apiClient = axios.create({
  baseURL: apiUrl,
  headers: { "Content-Type": "application/json" }
});

let authToken: string | null = null;

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

function buildUrl(path: string, params?: Record<string, string | number | null | undefined>) {
  const base = apiUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

// Cognito ID tokens are short-lived and this app doesn't otherwise poll for
// expiry, so a session that outlives one token (about an hour) will start
// getting 401s from every screen. Auth-context registers a handler here that
// uses the stored refresh token to mint a fresh ID token silently; on a 401
// we call it once and retry the request before surfacing an error to the UI.
let unauthorizedHandler: (() => Promise<string | null>) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<string | null>) | null) {
  unauthorizedHandler = handler;
}

async function withUnauthorizedRetry<T>(execute: () => Promise<T>): Promise<T> {
  try {
    return await execute();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403) && unauthorizedHandler) {
      const refreshedToken = await unauthorizedHandler().catch(() => null);
      if (refreshedToken) return execute();
    }
    throw err;
  }
}

function authHeader(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

export function apiGet<T>(path: string, params?: Record<string, string | number | null | undefined>): Promise<T> {
  return withUnauthorizedRetry(async () => {
    try {
      const response = await fetch(buildUrl(path, params), {
        headers: {
          Accept: "application/json",
          ...authHeader()
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(body.message || body.error || `Request failed with status ${response.status}`, response.status, body.code);
      }

      return response.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Network error. Please check your connection.", 0, "NETWORK_ERROR");
    }
  });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return withUnauthorizedRetry(async () => {
    try {
      const response = await fetch(buildUrl(path), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify(body || {})
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => ({}));
        throw new ApiError(responseBody.message || responseBody.error || `Request failed with status ${response.status}`, response.status, responseBody.code);
      }

      return response.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Network error. Please check your connection.", 0, "NETWORK_ERROR");
    }
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return withUnauthorizedRetry(async () => {
    try {
      const response = await fetch(buildUrl(path), {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeader()
        },
        body: JSON.stringify(body || {})
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => ({}));
        throw new ApiError(responseBody.message || responseBody.error || `Request failed with status ${response.status}`, response.status, responseBody.code);
      }

      return response.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Network error. Please check your connection.", 0, "NETWORK_ERROR");
    }
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return withUnauthorizedRetry(async () => {
    try {
      const response = await fetch(buildUrl(path), {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...authHeader()
        }
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => ({}));
        throw new ApiError(responseBody.message || responseBody.error || `Request failed with status ${response.status}`, response.status, responseBody.code);
      }

      if (response.status === 204) return undefined as T;
      return response.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError("Network error. Please check your connection.", 0, "NETWORK_ERROR");
    }
  });
}

export function setAuthToken(idToken: string | null) {
  authToken = idToken;
  if (idToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${idToken}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}
