import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
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
import Icon from "./components/ui/Icon";
import useKeyboardScroll from "./hooks/useKeyboardScroll";

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
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white animate-pulse">
          <Icon name="salad" size={24} />
        </div>
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

// ─── Auth Callback (Google OAuth redirect) ────────────────────────────────────
// Better Auth's social-provider flow redirects the browser to whatever
// callbackURL we passed to `POST /api/auth/sign-in/social`. We point that at
// `/auth/callback`, this component re-fetches the session (cookie was set by
// the server during the OAuth handshake) and then bounces the user to the
// right place: onboarding if they're new, dashboard if returning. Without
// the navigation effect the user would sit on a blank loading screen forever
// because no route guard wraps this route.
function AuthCallback() {
  const navigate = useNavigate();
  const { refetch, loading, isAuthenticated, isOnboarded } = useAuth();
  const refetchedRef = React.useRef(false);

  React.useEffect(() => {
    // Only refetch once — preventing a loop if loading flips repeatedly.
    if (!refetchedRef.current) {
      refetchedRef.current = true;
      refetch();
    }
  }, [refetch]);

  React.useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      // Cookie wasn't set (likely a server-side OAuth error) — punt to login.
      navigate("/login", { replace: true });
    } else {
      navigate(isOnboarded ? "/dashboard" : "/onboarding", { replace: true });
    }
  }, [loading, isAuthenticated, isOnboarded, navigate]);

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
  // Mobile-only: keep a focused input visible above the soft keyboard.
  // Hooked in at the App root so it's active across login, register,
  // onboarding, and every post-auth page (food search, settings, etc.).
  useKeyboardScroll();

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
