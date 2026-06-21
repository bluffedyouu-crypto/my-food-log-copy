/**
 * Shared requireAuth middleware.
 * Supports two authentication methods:
 *   1. Bearer token in Authorization header (for cross-origin deployments where
 *      3rd-party cookies are blocked by the browser).
 *   2. Session cookie set by Better Auth (for same-origin / local dev).
 */
async function requireAuth(c, next) {
  const { getAuth } = require("../auth");
  const auth = getAuth();

  // Method 1: Try Bearer token from Authorization header first
  const authHeader = c.req.raw.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const session = await auth.api.getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      });
      if (session?.user) {
        c.set("authUser", session.user);
        return await next();
      }
    } catch (_) {
      // fall through to cookie method
    }
  }

  // Method 2: Fallback to cookie-based session
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("authUser", session.user);
  await next();
}

module.exports = { requireAuth };
