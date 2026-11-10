import { createContext, useContext, useEffect, useRef, useState } from "react";

import { getCurrentUser, refreshUserSession, logoutUser } from "./authService";

import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from "../../services/api/tokenStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const restorationStarted = useRef(false);

  useEffect(() => {
    if (restorationStarted.current) return;

    restorationStarted.current = true;

    const restoreSession = async () => {
      try {
        // 1. Read the saved refresh token.
        const refreshToken = await getRefreshToken();

        if (!refreshToken) {
          await clearTokens();
          return;
        }

        // 2. Request new access and refresh tokens.
        const refreshResponse = await refreshUserSession({
          refreshToken,
        });

        const tokens = refreshResponse?.data?.tokens;

        if (!tokens?.accessToken || !tokens?.refreshToken) {
          throw new Error("Invalid refresh response.");
        }

        // 3. Save the rotated tokens.
        await saveTokens({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });

        // 4. Verify the new access token.
        const userResponse = await getCurrentUser(tokens.accessToken);

        const currentUser = userResponse?.data;

        if (!currentUser?.userId || !currentUser?.sessionId) {
          throw new Error("Invalid authentication response.");
        }

        // 5. Restore the authenticated session.
        setUser(currentUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.log("Session restoration failed:", error.message);

        await clearTokens();
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      const accessToken = await getAccessToken();

      if (accessToken) {
        await logoutUser(accessToken);
      }
    } catch (error) {
      console.log("Backend logout failed:", error.message);
    } finally {
      try {
        await clearTokens();
      } finally {
        setUser(null);
        setIsAuthenticated(false);
      }
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
