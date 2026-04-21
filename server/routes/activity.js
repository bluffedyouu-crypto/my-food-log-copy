const { Hono } = require("hono");
const ActivityLog = require("../models/ActivityLog");

const router = new Hono();

async function requireAuth(c, next) {
  const { getAuth } = require("../auth");
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "Unauthorized" }, 401);
  c.set("authUser", session.user);
  await next();
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

// Returns an array of the last N date strings (YYYY-MM-DD), most recent first
function lastNDays(n) {
  const days = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

// Count consecutive days going backwards from today that have at least one activity
function calculateStreak(activeDateStrings) {
  const activeSet = new Set(activeDateStrings);
  let streak = 0;
  let i = 0;
  while (true) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (activeSet.has(dateStr)) {
      streak++;
      i++;
    } else {
      break;
    }
  }
  return streak;
}

// GET /api/activity/week — last 7 days of activity logs, daysActive count, and streak
router.get("/week", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const days = lastNDays(7);
  const fromDate = days[days.length - 1]; // oldest
  const toDate = days[0]; // today

  try {
    const logs = await ActivityLog.find({
      userId: authUser.id,
      dateString: { $gte: fromDate, $lte: toDate },
    })
      .sort({ dateString: -1, createdAt: -1 })
      .lean();

    const activeDates = [...new Set(logs.map((l) => l.dateString))];
    const daysActive = activeDates.length;
    const streak = calculateStreak(activeDates);

    return c.json({ logs, daysActive, streak });
  } catch (err) {
    console.error("GET /api/activity/week error:", err);
    return c.json({ error: "Failed to fetch activity logs" }, 500);
  }
});

// POST /api/activity — log a new activity
router.post("/", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json();

  const { activityType, label, durationMinutes, caloriesBurned, notes, date } = body;

  if (!activityType) {
    return c.json({ error: "Missing required field: activityType" }, 400);
  }

  const dateStr = date
    ? new Date(date).toISOString().split("T")[0]
    : todayString();

  try {
    const log = await ActivityLog.create({
      userId: authUser.id,
      date: new Date(dateStr),
      dateString: dateStr,
      activityType,
      label: label || undefined,
      durationMinutes: durationMinutes || undefined,
      caloriesBurned: caloriesBurned !== undefined ? caloriesBurned : undefined,
      notes: notes || undefined,
    });

    return c.json({ log }, 201);
  } catch (err) {
    console.error("POST /api/activity error:", err);
    if (err.name === "ValidationError") {
      return c.json({ error: err.message }, 400);
    }
    return c.json({ error: "Failed to log activity" }, 500);
  }
});

// DELETE /api/activity/:id — delete an activity log entry
router.delete("/:id", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { id } = c.req.param();

  try {
    const log = await ActivityLog.findOneAndDelete({ _id: id, userId: authUser.id });
    if (!log) return c.json({ error: "Activity log not found" }, 404);

    return c.json({ message: "Activity deleted", log });
  } catch (err) {
    console.error("DELETE /api/activity/:id error:", err);
    return c.json({ error: "Failed to delete activity" }, 500);
  }
});

module.exports = router;
