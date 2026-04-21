const { Hono } = require("hono");
const DailyLog = require("../models/DailyLog");
const User = require("../models/User");
const { quantityToGrams, nutritionForGrams } = require("../utils/foodParser");

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

// GET /api/logs/today — get today's log
router.get("/today", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const dateStr = todayString();

  try {
    let log = await DailyLog.findOne({ userId: authUser.id, dateString: dateStr });

    if (!log) {
      // Get user targets for snapshot
      const user = await User.findOne({ authUserId: authUser.id }).lean();
      const targets = user?.dailyTargets
        ? {
            calories: user.dailyTargets.calories,
            protein: user.dailyTargets.protein,
            carbs: user.dailyTargets.carbs,
            fats: user.dailyTargets.fats,
          }
        : null;

      log = await DailyLog.create({
        userId: authUser.id,
        date: new Date(),
        dateString: dateStr,
        entries: [],
        targets,
      });
    }

    return c.json({ log });
  } catch (err) {
    return c.json({ error: "Failed to fetch today's log" }, 500);
  }
});

// GET /api/logs/:date — get log for a specific date (YYYY-MM-DD)
router.get("/:date", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { date } = c.req.param();

  try {
    const log = await DailyLog.findOne({ userId: authUser.id, dateString: date });
    if (!log) return c.json({ log: null, message: "No log for this date" });
    return c.json({ log });
  } catch (err) {
    return c.json({ error: "Failed to fetch log" }, 500);
  }
});

// GET /api/logs — get logs for a date range
router.get("/", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { from, to } = c.req.query();

  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const toDate = to || todayString();

  try {
    const logs = await DailyLog.find({
      userId: authUser.id,
      dateString: { $gte: fromDate, $lte: toDate },
    }).sort({ dateString: 1 }).lean();

    return c.json({ logs });
  } catch (err) {
    return c.json({ error: "Failed to fetch logs" }, 500);
  }
});

// POST /api/logs/entry — add a food entry to today's log
router.post("/entry", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json();

  const {
    foodItemId, fdcId, name, brand,
    mealCategory, quantity, unit,
    per100g, servingSize,
    customBowlId, isFromCustomBowl,
    date,
  } = body;

  if (!name || !mealCategory || !quantity || !per100g) {
    return c.json({ error: "Missing required fields: name, mealCategory, quantity, per100g" }, 400);
  }

  const dateStr = date || todayString();
  const quantityInGrams = quantityToGrams(+quantity, unit || "g", servingSize || 100);
  const nutrition = nutritionForGrams(per100g, quantityInGrams);

  try {
    const user = await User.findOne({ authUserId: authUser.id }).lean();
    const targets = user?.dailyTargets
      ? { calories: user.dailyTargets.calories, protein: user.dailyTargets.protein, carbs: user.dailyTargets.carbs, fats: user.dailyTargets.fats }
      : null;

    const log = await DailyLog.findOneAndUpdate(
      { userId: authUser.id, dateString: dateStr },
      {
        $setOnInsert: {
          date: new Date(dateStr),
          dateString: dateStr,
          targets,
        },
        $push: {
          entries: {
            foodItemId: foodItemId || undefined,
            customBowlId: customBowlId || undefined,
            fdcId: fdcId || undefined,
            name,
            brand: brand || undefined,
            mealCategory,
            quantity: +quantity,
            unit: unit || "g",
            quantityInGrams,
            nutrition,
            loggedAt: new Date(),
            isFromCustomBowl: !!isFromCustomBowl,
          },
        },
      },
      { new: true, upsert: true }
    );

    // Trigger totals recalculation via save
    await log.save();

    return c.json({ log }, 201);
  } catch (err) {
    console.error("POST /entry error:", err);
    return c.json({ error: "Failed to log food entry" }, 500);
  }
});

// DELETE /api/logs/entry/:entryId — remove a food entry
router.delete("/entry/:entryId", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { entryId } = c.req.param();
  const dateStr = c.req.query("date") || todayString();

  try {
    const log = await DailyLog.findOne({ userId: authUser.id, dateString: dateStr });
    if (!log) return c.json({ error: "Log not found" }, 404);

    log.entries = log.entries.filter((e) => e._id.toString() !== entryId);
    await log.save();

    return c.json({ log });
  } catch (err) {
    return c.json({ error: "Failed to delete entry" }, 500);
  }
});

// GET /api/logs/analytics/summary — analytics data
router.get("/analytics/summary", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const days = parseInt(c.req.query("days") || "30");

  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  try {
    const logs = await DailyLog.find({
      userId: authUser.id,
      dateString: { $gte: fromDate },
    }).sort({ dateString: 1 }).lean();

    const user = await User.findOne({ authUserId: authUser.id }).lean();
    const targets = user?.dailyTargets;

    const summary = logs.map((log) => ({
      date: log.dateString,
      calories: log.totals.calories,
      protein: log.totals.protein,
      carbs: log.totals.carbs,
      fats: log.totals.fats,
      targetCalories: log.targets?.calories || targets?.calories || 2000,
      adherence: log.targets?.calories
        ? Math.round((log.totals.calories / log.targets.calories) * 100)
        : null,
    }));

    return c.json({ summary, days });
  } catch (err) {
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
});

module.exports = router;
