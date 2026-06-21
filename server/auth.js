const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { bearer } = require("better-auth/plugins");

let authInstance = null;

/**
 * Initialize Better Auth with MongoDB adapter.
 * Call this after MongoDB connection is established.
 */
// Helper to extract clean origin (protocol + host) from any URL
function getOrigin(urlStr) {
  if (!urlStr) return null;
  try {
    const url = new URL(urlStr);
    return url.origin;
  } catch (e) {
    return urlStr.replace(/\/$/, "");
  }
}

function createAuth(mongoDb) {
  authInstance = betterAuth({
    database: mongodbAdapter(mongoDb),
    secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-change-in-production",
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
    basePath: "/api/auth",
    trustHost: true,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },

    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24,      // refresh if older than 1 day
    },

    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:5000",
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, "") : null,
      getOrigin(process.env.FRONTEND_URL),
    ].filter(Boolean),
    plugins: [bearer()],
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
  });

  return authInstance;
}

function getAuth() {
  if (!authInstance) throw new Error("Auth not initialized. Call createAuth() first.");
  return authInstance;
}

module.exports = { createAuth, getAuth };
