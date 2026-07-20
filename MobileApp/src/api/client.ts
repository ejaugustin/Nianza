import axios from "axios";
import Constants from "expo-constants";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || "https://api-dev.nianza.com/mobile/v1";

export const apiClient = axios.create({
  baseURL: apiUrl,
  headers: { "Content-Type": "application/json" }
});

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

export async function apiGet<T>(path: string, params?: Record<string, string | number | null | undefined>): Promise<T> {
  try {
    const response = await fetch(buildUrl(path, params), {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ApiError(body.message || `Request failed with status ${response.status}`, response.status, body.code);
    }

    return response.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Network error. Please check your connection.", 0, "NETWORK_ERROR");
  }
}

export function setAuthToken(idToken: string | null) {
  if (idToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${idToken}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}
