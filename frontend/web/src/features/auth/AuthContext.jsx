import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./authContext";

import { getCurrentUser, logoutUser, refreshUserSession } from "./authService";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "../../services/api/tokenStorage";

// Prevent duplicate refresh requests during React development remounts.
let sessionRestorePromise = null;

async function restoreSession() {
  if (!sessionRestorePromise) {
    sessionRestorePromise = (async () => {
      try {
        const refreshToken = getRefreshToken();

        if (!refreshToken) {
          clearTokens();
          return null;
        }

        const response = await refreshUserSession(refreshToken);
        const tokens = response.data.tokens;

        // Save both rotated tokens.
        saveTokens(tokens);

        const userResponse = await getCurrentUser(tokens.accessToken);

        return userResponse.data;
      } catch {
        clearTokens();
        return null;
      }
    })();
  }

  return sessionRestorePromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      const restoredUser = await restoreSession();

      if (isMounted) {
        setUser(restoredUser);
        setIsLoading(false);
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
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
    }
  }, []);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
