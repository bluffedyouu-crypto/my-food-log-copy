import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

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
  googleSignIn: () => {
    window.location.href = `${API_BASE}/api/auth/sign-in/social?provider=google&callbackURL=${window.location.origin}/dashboard`;
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
