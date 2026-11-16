const ACCESS_TOKEN_KEY = "retailflow_access_token";
const OLD_REFRESH_TOKEN_KEY = "retailflow_refresh_token";

export function saveTokens(tokens) {
  if (!tokens?.accessToken) {
    throw new Error("Invalid authentication tokens.");
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);

  // Remove any refresh token saved by the previous authentication flow.
  sessionStorage.removeItem(OLD_REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(OLD_REFRESH_TOKEN_KEY);
}
