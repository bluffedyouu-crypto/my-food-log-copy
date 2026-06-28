import axios from "axios";

// ─── Resolve the API base URL ─────────────────────────────────────────────────
// The Hono server serves both the API (/api/*) and the production React build
// from the same origin. When that's the case we *must* use a relative base —
// any absolute URL that points at a different host (even the LAN IP alias of
// the same machine) lands cookies on a different host, which breaks Better
// Auth's OAuth state cookie roundtrip with a `state_mismatch` error.
//
// Decision matrix:
//   • REACT_APP_API_URL unset                       → "" (relative, same-origin)
//   • REACT_APP_API_URL matches window.location.origin → "" (relative, same-origin)
//   • REACT_APP_API_URL differs from origin         → use as-is (separate dev server)
//
// This makes the typical local-dev case (React on :3000, API on :4000) keep
// working with the explicit env var, while the production build served by
// Hono is forced to use same-origin even if a stale env value got baked in.
function resolveApiBase() {
  const fromEnv = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

  if (typeof window === "undefined") {
    // SSR / pre-render — just return what we have; no origin to compare to.
    return fromEnv;
  }

  if (!fromEnv) return ""; // No env → same-origin relative paths.

  try {
    const envOrigin = new URL(fromEnv).origin;
    if (envOrigin === window.location.origin) {
      return ""; // Same origin → use relative paths to avoid CORS/cookie traps.
    }
  } catch {
    // Malformed env value — fall through and use it raw.
  }

  return fromEnv;
}

const API_BASE = resolveApiBase();

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send cookies for Better Auth sessions
  headers: { "Content-Type": "application/json" },
});

// Attach token if available (fallback for browsers blocking 3rd-party cookies)
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("better_auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error normalization
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error ||
      err.response?.data?.message ||
      err.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export default client;

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  signUp: (email, password, name) =>
    client.post("/api/auth/sign-up/email", { email, password, name }),
  signIn: (email, password) =>
    client.post("/api/auth/sign-in/email", { email, password }),
  signOut: () => client.post("/api/auth/sign-out"),
  getSession: () => client.get("/api/auth/get-session"),

  /**
   * Start the Google OAuth flow.
   *
   * Better Auth's social sign-in endpoint is `POST /api/auth/sign-in/social`
   * (verified in better-auth@1.6.5 dist/api/routes/sign-in.mjs). It expects
   * a JSON body `{ provider, callbackURL }` and returns `{ url }` — the
   * Google authorisation URL the browser must navigate to. The earlier
   * implementation set `window.location.href` directly to the endpoint,
   * which is a GET and results in 404/405 from Better Auth.
   *
   * Resolves with the redirect URL (caller does the navigation) so the
   * caller can show error UI if the provider isn't configured server-side.
   */
  googleSignIn: async () => {
    const callbackURL = `${window.location.origin}/auth/callback`;
    const { data } = await client.post("/api/auth/sign-in/social", {
      provider: "google",
      callbackURL,
    });
    if (!data?.url) {
      throw new Error(
        "Google sign-in is not available. Ask the admin to configure " +
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server."
      );
    }
    return data.url;
  },
};

// ─── User API ─────────────────────────────────────────────────────────────────
export const userApi = {
  getMe: () => client.get("/api/users/me"),
  completeOnboarding: (data) => client.post("/api/users/onboarding", data),
  updateSettings: (data) => client.patch("/api/users/settings", data),
  logWeight: (weight, unit, date) => client.post("/api/users/weight", { weight, unit, date }),
  getWeightForDate: (date) => client.get(`/api/users/weight?date=${date}`),
  deleteWeightEntry: (entryId) => client.delete(`/api/users/weight/${entryId}`),
};

// ─── Food API ─────────────────────────────────────────────────────────────────
export const foodApi = {
  search: (query, page = 1) => client.get(`/api/food/search?q=${encodeURIComponent(query)}&page=${page}`),
  getById: (fdcId) => client.get(`/api/food/${fdcId}`),
  createCustom: (data) => client.post("/api/food/custom", data),
};

// ─── Logs API ─────────────────────────────────────────────────────────────────
export const logsApi = {
  getToday: () => client.get("/api/logs/today"),
  getByDate: (date) => client.get(`/api/logs/${date}`),
  getRange: (from, to) => client.get(`/api/logs?from=${from}&to=${to}`),
  addEntry: (data) => client.post("/api/logs/entry", data),
  deleteEntry: (entryId, date) => client.delete(`/api/logs/entry/${entryId}?date=${date}`),
  getAnalytics: (days = 30) => client.get(`/api/logs/analytics/summary?days=${days}`),
};

// ─── Activity API ─────────────────────────────────────────────────────────────
export const activityApi = {
  getWeek: () => client.get("/api/activity/week"),
  getByDate: (date) => client.get(`/api/activity/date?date=${date}`),
  log: (data) => client.post("/api/activity", data),
  delete: (id) => client.delete(`/api/activity/${id}`),
};

// ─── Bowls API ────────────────────────────────────────────────────────────────
export const bowlsApi = {
  getAll: () => client.get("/api/bowls"),
  getById: (id) => client.get(`/api/bowls/${id}`),
  create: (data) => client.post("/api/bowls", data),
  update: (id, data) => client.patch(`/api/bowls/${id}`, data),
  delete: (id) => client.delete(`/api/bowls/${id}`),
};
