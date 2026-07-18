import axios from "axios";
import Constants from "expo-constants";

const apiUrl = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || "https://api-dev.nianza.com/v1";

export const apiClient = axios.create({
  baseURL: apiUrl,
  headers: { "Content-Type": "application/json" }
});

export function setAuthToken(idToken: string | null) {
  if (idToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${idToken}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}
