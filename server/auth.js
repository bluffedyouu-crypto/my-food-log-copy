const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { bearer } = require("better-auth/plugins");
const User = require("./models/User");

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
  // ── Resolve the public base URL and derive cookie attributes from it. ──
  // Cookie attribute choice is the most common source of OAuth `state_mismatch`
  // errors in Better Auth, so we set it explicitly here:
  //
  //   • `secure: true` is *required* for `sameSite: "none"`. Browsers ALSO
  //     refuse to store any `Secure` cookie sent over plain HTTP (including
  //     http://localhost). If we leave secure=true on an http:// deploy, the
  //     OAuth state cookie is silently dropped → Google redirect comes back
  //     with no state cookie to compare against → `state_mismatch`.
  //
  //   • `sameSite: "lax"` is the right default for development. It lets the
  //     cookie ride along on the top-level GET that Google performs when
  //     redirecting the user back to our /api/auth/callback/google URL.
  //
  // Therefore: if the baseURL is HTTPS we keep the cross-site-friendly
  // (none/secure) config production needs; if it's HTTP we drop both flags
  // so the cookie can actually be stored.
  const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:5000";
  const isHttps = baseURL.startsWith("https://");

  const cookieAttributes = isHttps
    ? { sameSite: "none", secure: true }
    : { sameSite: "lax",  secure: false };

  // Conditionally register the Google provider only when both credentials
  // are present. Better Auth has no `enabled` flag on social providers — if
  // you register Google with empty client id/secret, the OAuth flow will
  // start and then fail at the token-exchange step with a cryptic Google
  // error. Omitting the provider entirely makes the failure mode clean: the
  // POST /sign-in/social call returns a "Provider not found" 4xx instead of
  // a half-redirect to broken Google consent.
  const socialProviders = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
    console.log(
      `✅ Google OAuth provider registered (baseURL=${baseURL}, ` +
      `cookies: sameSite=${cookieAttributes.sameSite}, secure=${cookieAttributes.secure})`
    );
  } else {
    console.warn(
      "⚠️  Google OAuth disabled: GOOGLE_CLIENT_ID and/or GOOGLE_CLIENT_SECRET " +
      "are not set. Add them to server/.env to enable 'Continue with Google'."
    );
  }

  authInstance = betterAuth({
    database: mongodbAdapter(mongoDb),
    secret: process.env.BETTER_AUTH_SECRET || "fallback-secret-change-in-production",
    baseURL,
    basePath: "/api/auth",
    trustHost: true,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },

    socialProviders,

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24,      // refresh if older than 1 day
    },

    trustedOrigins: [
      // Common local-dev origins for the React app + Hono server.
      "http://localhost:3000",
      "http://localhost:4000",
      "http://localhost:5000",
      // Whatever FRONTEND_URL is set to, normalised in a few different ways
      // so trailing-slash / path inclusion bugs don't lock us out.
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, "") : null,
      getOrigin(process.env.FRONTEND_URL),
      // Also include the baseURL itself — same-origin requests need to be
      // trusted, and on prod the API and SPA may share a host.
      getOrigin(baseURL),
    ].filter(Boolean),
    plugins: [bearer()],
    advanced: {
      defaultCookieAttributes: cookieAttributes,
    },

    // ── databaseHooks: provision the app-level User document ────────────────
    // Better Auth manages its own `user` collection (credentials, sessions,
    // accounts). Our app has a separate `User` model that holds the macro
    // profile, daily targets, weight history, etc. We need a row in there
    // for every Better Auth user — regardless of whether they signed up by
    // email/password or Google OAuth.
    //
    // GET /api/users/me already lazy-creates the row on first access, which
    // covers the typical "user just logged in and the SPA fetches their
    // profile" flow. But hooking the create event here is belt-and-braces:
    //   • It guarantees the row exists the instant Better Auth registers
    //     the user, so any later request that bypasses /me (e.g. an
    //     analytics call) won't see a missing User.
    //   • It makes the Google OAuth path explicitly match the email/password
    //     path — same User document, same fields, same time.
    //   • It captures the avatar/image Google provides on first sign-in.
    databaseHooks: {
      user: {
        create: {
          async after(authUser) {
            try {
              // Upsert so duplicate-key races (e.g. concurrent /me hit
              // racing with this hook) don't throw. We only fill in fields
              // that don't already exist — never clobber profile data.
              await User.findOneAndUpdate(
                { authUserId: authUser.id },
                {
                  $setOnInsert: {
                    authUserId: authUser.id,
                    email:      authUser.email,
                    name:       authUser.name   || null,
                    avatar:     authUser.image  || null,
                    onboardingComplete: false,
                  },
                },
                { upsert: true, new: false, runValidators: false }
              );
            } catch (err) {
              // Don't block the sign-up flow if our side-table write fails —
              // /me will retry the create on first access. Just log it.
              console.error("[auth] Failed to provision app User document:", err?.message || err);
            }
          },
        },
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
