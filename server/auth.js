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

      // Better Auth stores sessions in the `session` collection by default.
      // We rename to `sessions` for naming consistency with the rest of the
      // schema (every collection is the plural noun for what it stores).
      modelName: "sessions",
    },

    // ── Single source of truth for users ───────────────────────────────────
    //
    // Better Auth previously wrote to a `user` collection while our app's
    // Mongoose `User` model wrote a parallel `users` collection — every
    // sign-in produced two rows for the same person, joined manually via
    // `authUserId`. That split caused subtle bugs (data drift, race
    // conditions during onboarding) and made queries needlessly complex.
    //
    // Now Better Auth and the app share a single `users` collection. The
    // identity fields (name/email/emailVerified/image/createdAt/updatedAt)
    // are still owned by Better Auth via its adapter; the app-specific
    // fields (profile / dailyTargets / onboardingComplete) are declared as
    // `additionalFields` so Better Auth knows about them and includes them
    // in `getSession()` responses, while the actual writes happen through
    // the Mongoose `User` model in our routes.
    user: {
      modelName: "users",

      additionalFields: {
        // `onboardingComplete` gates whether the user is sent to /onboarding
        // or /dashboard after sign-in. Declared with `defaultValue: false`
        // so Better Auth ensures every new sign-up (email *and* OAuth) gets
        // a sensible starting value, and `input: false` so untrusted client
        // input can never flip it via the sign-up endpoint.
        onboardingComplete: {
          type:         "boolean",
          required:     false,
          defaultValue: false,
          input:        false,
        },

        // Profile + dailyTargets are nested objects, which Better Auth's
        // primitive type system doesn't natively support. Declaring them
        // with `type: "string"` (the most permissive primitive) gets them
        // round-tripped through `getSession()` without filterOutputFields
        // stripping them. In practice they're managed entirely by our own
        // /onboarding and /settings routes via Mongoose, never by Better
        // Auth — these declarations exist solely to surface the fields to
        // the client when it fetches the session.
        profile: {
          type:     "string",
          required: false,
          input:    false,
        },
        dailyTargets: {
          type:     "string",
          required: false,
          input:    false,
        },
      },
    },

    // Better Auth's OAuth provider links live in `account` by default. We
    // rename to `accounts` for consistency. This is where Google's refresh
    // token / access token / providerId etc. are stored — completely
    // separate from `users` because the data is auth-internal and a single
    // user can have many provider links (Google + email/password).
    account: {
      modelName: "accounts",
    },

    // Verification tokens (email-verification, password-reset, OAuth state)
    // live in the `verification` collection by default. Renamed for the
    // same naming-consistency reason. These rows are short-lived and get
    // garbage-collected on use or expiry.
    verification: {
      modelName: "verifications",
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

    // ── databaseHooks ───────────────────────────────────────────────────────
    //
    // Previously this hook upserted a SEPARATE Mongoose User document on
    // every sign-up to bridge between Better Auth's `user` collection and
    // our app's `users` collection. That whole bridge is gone now — the
    // two collections are one. Better Auth's `additionalFields` declaration
    // above is what guarantees a sensible `onboardingComplete: false` lands
    // on every new user, including OAuth sign-ups.
    //
    // We intentionally leave the `databaseHooks` block empty rather than
    // deleting it: it acts as a clearly-named extension point for any
    // future need (e.g. seeding a default `dailyTargets`, sending a
    // welcome email, recording sign-up analytics) without having to
    // rediscover the API surface.
    databaseHooks: {},
  });

  return authInstance;
}

function getAuth() {
  if (!authInstance) throw new Error("Auth not initialized. Call createAuth() first.");
  return authInstance;
}

module.exports = { createAuth, getAuth };
