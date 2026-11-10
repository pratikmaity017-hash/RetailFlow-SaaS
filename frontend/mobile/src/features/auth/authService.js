import { apiRequest } from "../../services/api/apiClient";

export function registerUser({ name, email, password, organizationName }) {
  return apiRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      organizationName,
    }),
  });
}

export function loginUser({ email, password }) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export function refreshUserSession({ refreshToken }) {
  return apiRequest("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refreshToken,
    }),
  });
}

export function getCurrentUser(accessToken) {
  return apiRequest("/api/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function logoutUser(accessToken) {
  return apiRequest("/api/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
