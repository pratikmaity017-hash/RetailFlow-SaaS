import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "retailflow_access_token";
const REFRESH_TOKEN_KEY = "retailflow_refresh_token";

export async function saveTokens({ accessToken, refreshToken }) {
  if (!accessToken || !refreshToken) {
    throw new Error("Both access and refresh tokens are required.");
  }

  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
