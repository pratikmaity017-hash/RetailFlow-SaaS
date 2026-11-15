import axios from "axios";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "./tokenStorage";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Share one refresh request between simultaneous API failures.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error("Refresh token is unavailable.");
  }

  const baseURL = import.meta.env.VITE_API_URL.replace(/\/+$/, "");

  const response = await axios.post(
    `${baseURL}/api/auth/refresh`,
    { refreshToken },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: 15000,
    },
  );

  const tokens = response.data?.data?.tokens;

  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error("Invalid token refresh response.");
  }

  // Save both tokens because the backend rotates refresh tokens.
  saveTokens(tokens);

  return tokens.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    const errorCode =
      error.response?.data?.error?.code || error.response?.data?.code;

    if (
      error.response?.status === 401 &&
      errorCode === "INVALID_ACCESS_TOKEN" &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const newAccessToken = await refreshPromise;

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();

        window.dispatchEvent(new Event("retailflow:auth-expired"));

        return Promise.reject(refreshError);
      }
    }

    const message =
      error.response?.data?.error?.message ||
      error.message ||
      "Something went wrong.";

    const apiError = new Error(message);

    apiError.status = error.response?.status;
    apiError.code = errorCode || "REQUEST_FAILED";

    return Promise.reject(apiError);
  },
);

export default apiClient;
