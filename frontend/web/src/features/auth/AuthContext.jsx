import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./authContext";

import { getCurrentUser, logoutUser, refreshUserSession } from "./authService";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "../../services/api/tokenStorage";

let sessionRestorePromise = null;

async function restoreSession() {
  if (!sessionRestorePromise) {
    sessionRestorePromise = (async () => {
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearTokens();
        return { user: null, error: null };
      }

      try {
        const response = await refreshUserSession(refreshToken);
        const tokens = response.data.tokens;

        saveTokens(tokens);

        const userResponse = await getCurrentUser(tokens.accessToken);

        return { user: userResponse.data, error: null };
      } catch (error) {
        const status = error.response?.status;

        // Clear tokens only when the server confirms
        // that the authentication session is invalid.
        if (status === 401 || status === 403) {
          clearTokens();
          return { user: null, error: null };
        }

        // Preserve tokens for network and server errors.
        return {
          user: null,
          error: error.message || "Unable to connect to the server.",
        };
      }
    })().finally(() => {
      sessionRestorePromise = null;
    });
  }

  return sessionRestorePromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  const retrySessionRestore = useCallback(async () => {
    setIsRetrying(true);

    try {
      const [result] = await Promise.all([
        restoreSession(),
        new Promise((resolve) => window.setTimeout(resolve, 600)),
      ]);

      setUser(result.user);
      setAuthError(result.error || "");
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    function handleAuthExpired() {
      setUser(null);
      setAuthError("");
      setIsLoading(false);
    }

    window.addEventListener("retailflow:auth-expired", handleAuthExpired);

    async function initializeAuth() {
      const result = await restoreSession();

      if (isMounted) {
        setUser(result.user);
        setAuthError(result.error || "");
        setIsLoading(false);
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
      window.removeEventListener("retailflow:auth-expired", handleAuthExpired);
    };
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
    setAuthError("");
  }, []);

  const logout = useCallback(async () => {
    const accessToken = getAccessToken();

    try {
      if (accessToken) {
        await logoutUser(accessToken);
      }
    } catch {
      // Clear local authentication even if the server request fails.
    } finally {
      clearTokens();
      setUser(null);
      setAuthError("");
    }
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    isRetrying,
    retrySessionRestore,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
