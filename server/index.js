require("dotenv").config({ path: __dirname + "/.env" });

const { serve } = require("@hono/node-server");
const { Hono } = require("hono");
const { cors } = require("hono/cors");
const { logger } = require("hono/logger");
const { connectDB, getMongoDb } = require("./db");
const { createAuth } = require("./auth");

// Route handlers
const userRoutes = require("./routes/users");
const foodRoutes = require("./routes/food");
const logRoutes = require("./routes/logs");
const bowlRoutes = require("./routes/bowls");
const activityRoutes = require("./routes/activity");

const app = new Hono();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use("*", logger());

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Reflect the requester's origin to ensure CORS passes for cross-domain credentials
      return origin || "http://localhost:3000";
    },
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "Accept"],
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Set-Cookie"],
    credentials: true,
    maxAge: 600,
  })
);

// ─── Health Check ─────────────────────────────────────────────────────────────
const healthHandler = (c) => {
  const mongoose = require("mongoose");
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  return c.json({
    status: "ok",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// ─── Better Auth Handler ──────────────────────────────────────────────────────
// Better Auth handles all /api/auth/* routes — must use app.all with wildcard
app.all("/api/auth/*", async (c) => {
  const { getAuth } = require("./auth");
  const auth = getAuth();
  return auth.handler(c.req.raw);
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.route("/api/users", userRoutes);
app.route("/api/food", foodRoutes);
app.route("/api/logs", logRoutes);
app.route("/api/bowls", bowlRoutes);
app.route("/api/activity", activityRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: "Route not found" }, 404));

// ─── Error Handler ────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error", message: err.message }, 500);
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    const { mongoDb } = await connectDB();
    createAuth(mongoDb);
    console.log("✅ Better Auth initialized");

    const port = parseInt(process.env.PORT || "4000");

    const server = serve({ fetch: app.fetch, port }, (info) => {
      console.log(`🚀 Hono server running on http://localhost:${info.port}`);
    });

    // Graceful port-conflict error
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `\n❌ Port ${port} is already in use.\n` +
          `   Run: lsof -ti :${port} | xargs kill -9\n` +
          `   Or change PORT in server/.env to a free port.\n`
        );
      } else {
        console.error("❌ Server error:", err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

bootstrap();
