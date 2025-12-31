import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "./api";
import type { User } from "../types";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: <T>(path: string, options?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ACCESS_TOKEN_KEY = "tm_access_token";

function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const setSession = useCallback((nextUser: User | null, token: string | null) => {
    setUser(nextUser);
    setAccessToken(token);
    setStoredToken(token);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ accessToken: string }>("/api/auth/refresh", { method: "POST" });
      setAccessToken(data.accessToken);
      setStoredToken(data.accessToken);
      return data.accessToken;
    } catch {
      setAccessToken(null);
      setStoredToken(null);
      return null;
    }
  }, []);

  const loadMe = useCallback(async (token: string) => {
    const data = await apiFetch<{ user: User }>("/api/auth/me", { method: "GET" }, token);
    setUser(data.user);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setStatus("loading");
      const stored = localStorage.getItem(ACCESS_TOKEN_KEY);

      if (stored) {
        setAccessToken(stored);
        try {
          await loadMe(stored);
          if (!cancelled) setStatus("authenticated");
          return;
        } catch {
          // fall through to refresh
        }
      }

      const refreshed = await refresh();
      if (refreshed) {
        try {
          await loadMe(refreshed);
          if (!cancelled) setStatus("authenticated");
          return;
        } catch {
          // fall through to unauthenticated
        }
      }

      if (!cancelled) {
        setSession(null, null);
        setStatus("unauthenticated");
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadMe, refresh, setSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<{ user: User; accessToken: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setSession(data.user, data.accessToken);
      setStatus("authenticated");
    },
    [setSession]
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      await apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" }, accessToken);
    } finally {
      setSession(null, null);
      setStatus("unauthenticated");
    }
  }, [accessToken, setSession]);

  const authFetch = useCallback(
    async <T,>(path: string, options: RequestInit = {}) => {
      let token = accessToken;
      if (!token) {
        token = await refresh();
      }
      if (!token) {
        throw new Error("Not authenticated");
      }

      try {
        return await apiFetch<T>(path, options, token);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          const refreshed = await refresh();
          if (refreshed) {
            return await apiFetch<T>(path, options, refreshed);
          }
        }
        throw error;
      }
    },
    [accessToken, refresh]
  );

  const value = useMemo(
    () => ({ status, user, accessToken, login, signup, logout, authFetch }),
    [status, user, accessToken, login, signup, logout, authFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
