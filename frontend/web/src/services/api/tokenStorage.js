const ACCESS_TOKEN_KEY = "retailflow_access_token";
const REFRESH_TOKEN_KEY = "retailflow_refresh_token";

export function saveTokens(tokens) {
  if (!tokens?.accessToken || !tokens?.refreshToken) {
    throw new Error("Invalid authentication tokens.");
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}
