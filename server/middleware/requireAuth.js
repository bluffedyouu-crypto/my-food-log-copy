/**
 * Shared requireAuth middleware.
 * With the Better Auth bearer() plugin enabled, auth.api.getSession
 * automatically checks both:
 *   1. Authorization: Bearer <token> header
 *   2. Session cookie (for local dev)
 */
async function requireAuth(c, next) {
  const { getAuth } = require("../auth");
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("authUser", session.user);
  await next();
}

module.exports = { requireAuth };
