import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, userApi } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);       // Better Auth session
  const [appUser, setAppUser] = useState(null);       // Our app User document
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSession = useCallback(async () => {
    try {
      const { data } = await authApi.getSession();
      if (data?.user) {
        setSession(data);
        // Fetch app-level user profile
        const { data: userData } = await userApi.getMe();
        setAppUser(userData.user);
      } else {
        setSession(null);
        setAppUser(null);
      }
    } catch {
      setSession(null);
      setAppUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signIn = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await authApi.signIn(email, password);
      if (data?.token) localStorage.setItem("better_auth_token", data.token);
      const { data: userData } = await userApi.getMe();
      // Set BOTH atomically so route guards never see "authenticated but no appUser"
      setSession(data);
      setAppUser(userData.user);
      return userData.user;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, name) => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await authApi.signUp(email, password, name);
      if (data?.token) localStorage.setItem("better_auth_token", data.token);
      const { data: userData } = await userApi.getMe();
      setSession(data);
      setAppUser(userData.user);
      return userData.user;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // Belt-and-braces sign-out. `authApi.signOut` now performs a two-stage
    // revocation: first hits `/api/auth/revoke-sessions` (bearer-aware — kills
    // the DB session row), then `/api/auth/sign-out` (best-effort cookie
    // expiry). Both errors are swallowed inside authApi.signOut itself, so
    // the call below should never throw — but we keep the try/catch as a
    // defensive net in case axios surfaces something unexpected.
    //
    // Local cleanup runs unconditionally afterwards so the route guards
    // redirect to /login no matter what happened on the network.
    try {
      await authApi.signOut();
    } catch (err) {
      console.warn("[auth] sign-out request flow failed:", err?.message || err);
    }
    // Remove the bearer token first — even if a stale session cookie is
    // somehow still valid on the next refresh, getSession without the bearer
    // header AND without a matching cookie will return null.
    localStorage.removeItem("better_auth_token");
    setSession(null);
    setAppUser(null);
  };

  const updateAppUser = (updatedUser) => {
    setAppUser(updatedUser);
  };

  const value = {
    session,
    appUser,
    loading,
    error,
    isAuthenticated: !!session?.user,
    isOnboarded: appUser?.onboardingComplete === true,
    signIn,
    signUp,
    signOut,
    updateAppUser,
    refetch: fetchSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
