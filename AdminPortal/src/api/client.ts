import axios from "axios";

export const adminApiClient = axios.create({
  baseURL: import.meta.env.VITE_ADMIN_API_URL || "https://admin-api-dev.nianza.com/admin/v1",
  headers: { "Content-Type": "application/json" }
});

export function setAdminAuthToken(idToken: string | null) {
  if (idToken) {
    adminApiClient.defaults.headers.common.Authorization = `Bearer ${idToken}`;
  } else {
    delete adminApiClient.defaults.headers.common.Authorization;
  }
}
