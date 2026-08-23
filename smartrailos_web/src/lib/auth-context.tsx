import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { apiFetch, ApiError } from "./api/client";

export interface UserProfile {
  id: string;
  user_id_code: string | null;
  email: string;
  full_name: string;
  role: "admin" | "operator" | "passenger" | string;
  station_id: string | null;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isPassenger: boolean;
  stationId: string | null;
  login: (identifier: string, password: string) => Promise<UserProfile>;
  register: (payload: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    user_id_code?: string;
    station_id?: string;
  }) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "smartrail_auth_token";
const USER_KEY = "smartrail_auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  });

  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as UserProfile;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  // Sync / validate user profile from backend with JWT token
  useEffect(() => {
    let mounted = true;
    async function validateAuth() {
      if (!token) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const currentUser = await apiFetch<UserProfile>("/auth/me");
        if (mounted) {
          setUser(currentUser);
          localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        }
      } catch (err) {
        console.warn("Auth token expired or invalid:", err);
        if (mounted) {
          // If token is invalid on backend, clear stale token
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            setToken(null);
            setUser(null);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    validateAuth();
    return () => {
      mounted = false;
    };
  }, [token]);

  const login = async (identifier: string, password: string): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const res = await apiFetch<{
        access_token: string;
        refresh_token: string;
        token_type: string;
        user: UserProfile;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });

      const authToken = res.access_token;
      const userProfile = res.user;

      setToken(authToken);
      setUser(userProfile);
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userProfile));

      return userProfile;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    email: string;
    full_name: string;
    password: string;
    role: string;
    user_id_code?: string;
    station_id?: string;
  }): Promise<UserProfile> => {
    setIsLoading(true);
    try {
      const createdUser = await apiFetch<UserProfile>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Automatically login after successful registration
      return await login(payload.user_id_code || payload.email, payload.password);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const isAdmin = useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    return r === "admin" || r === "it_admin" || r === "administrator";
  }, [user]);

  const isOperator = useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    return r === "operator" || r === "station_operator";
  }, [user]);

  const isPassenger = useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    return r === "passenger";
  }, [user]);

  const stationId = useMemo(() => {
    return user?.station_id || null;
  }, [user]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAdmin,
    isOperator,
    isPassenger,
    stationId,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function useCurrentUser() {
  return useAuth().user;
}

export function useIsAdmin() {
  return useAuth().isAdmin;
}

export function useIsOperator() {
  return useAuth().isOperator;
}

export function useOperatorStation() {
  return useAuth().stationId;
}
