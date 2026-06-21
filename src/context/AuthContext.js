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
    const { data } = await authApi.signIn(email, password);
    if (data?.token) localStorage.setItem("better_auth_token", data.token);
    setSession(data);
    const { data: userData } = await userApi.getMe();
    setAppUser(userData.user);
    return userData.user;
  };

  const signUp = async (email, password, name) => {
    setError(null);
    const { data } = await authApi.signUp(email, password, name);
    if (data?.token) localStorage.setItem("better_auth_token", data.token);
    setSession(data);
    const { data: userData } = await userApi.getMe();
    setAppUser(userData.user);
    return userData.user;
  };

  const signOut = async () => {
    await authApi.signOut();
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
