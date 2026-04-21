import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Pages
import LoginPage from "./components/auth/LoginPage";
import RegisterPage from "./components/auth/RegisterPage";
import OnboardingScreen from "./components/onboarding/OnboardingScreen";
import AppLayout from "./components/layout/AppLayout";
import Dashboard from "./components/dashboard/Dashboard";
import BowlBuilder from "./components/bowl/BowlBuilder";
import AnalyticsPage from "./components/analytics/AnalyticsPage";
import SettingsPage from "./components/settings/SettingsPage";

// ─── Route Guards ─────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RequireOnboarding({ children }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isOnboarded) return <Navigate to="/onboarding" replace />;
  return children;
}

function RedirectIfAuth({ children }) {
  const { isAuthenticated, isOnboarded, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated) {
    return <Navigate to={isOnboarded ? "/dashboard" : "/onboarding"} replace />;
  }
  return children;
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl animate-pulse">
          🥗
        </div>
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

// ─── Auth Callback (Google OAuth redirect) ────────────────────────────────────
function AuthCallback() {
  const { refetch } = useAuth();
  React.useEffect(() => {
    refetch();
  }, [refetch]);
  return <LoadingScreen />;
}

// ─── App Router ───────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <AnimatePresence mode="wait">
      <Routes>
        {/* Public */}
        <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
        <Route path="/register" element={<RedirectIfAuth><RegisterPage /></RedirectIfAuth>} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Onboarding */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingScreen />
            </RequireAuth>
          }
        />

        {/* Protected App */}
        <Route
          path="/"
          element={
            <RequireOnboarding>
              <AppLayout />
            </RequireOnboarding>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="bowl-builder" element={<BowlBuilder />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
