import apiClient from "../../services/api/apiClient";

// Register a new user and organization.
export async function registerUser(userData) {
  const response = await apiClient.post("/api/auth/register", userData);
  return response.data;
}

// Login an existing user.
export async function loginUser(credentials) {
  const response = await apiClient.post("/api/auth/login", credentials);
  return response.data;
}

// Refresh the access token using the refresh token.
export async function refreshUserSession(refreshToken) {
  const response = await apiClient.post("/api/auth/refresh", {
    refreshToken,
  });

  return response.data;
}

// Get the currently authenticated user's session.
export async function getCurrentUser(accessToken) {
  const response = await apiClient.get("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

// Logout the current session.
export async function logoutUser(accessToken) {
  const response = await apiClient.post(
    "/api/auth/logout",
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  return response.data;
}
