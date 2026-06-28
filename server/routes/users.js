const { Hono } = require("hono");
const User = require("../models/User");
const WeightLog = require("../models/WeightLog");
const { calculateDailyTargets } = require("../utils/macroCalculator");
const { requireAuth } = require("../middleware/requireAuth");

const router = new Hono();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a Date as a local-time YYYY-MM-DD string.
 *
 * We deliberately avoid `Date.prototype.toISOString().split("T")[0]` here
 * because that produces a UTC date — for users east of UTC (e.g. IST) a
 * weight logged at 1 AM local time would be filed under the *previous*
 * UTC calendar day. The frontend dashboard already had this bug fixed in
 * `src/utils/dateLocal.js`; the same reasoning applies on the server.
 *
 * The route accepts an optional `date` body field to override the
 * computation (used when the user logs a weight for a past date), and
 * passes that through here when present.
 */
function toLocalDateString(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/users/me — return the current user (unified document)
//
// Before the schema refactor we did `User.findOne({ authUserId })` to bridge
// the auth/user split, and lazy-created the row on first access. Now Better
// Auth and the app write to the same `users` row, so this becomes a plain
// `findById`. We also no longer need to upsert here — Better Auth's user
// adapter creates the row on sign-up.
router.get("/me", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  try {
    // `authUser.id` is the string form of the user `_id` (Better Auth
    // serialises ObjectId → string on read). Mongoose's `findById` accepts
    // either a string or an ObjectId, so no casting needed.
    const user = await User.findById(authUser.id);

    if (!user) {
      // This should be unreachable in practice — if `requireAuth` accepted
      // the request then Better Auth resolved a session pointing at a
      // user row. Returning 404 here surfaces the desync clearly rather
      // than auto-creating a half-formed row that hides the bug.
      return c.json({ error: "User record not found" }, 404);
    }

    return c.json({ user });
  } catch (err) {
    console.error("GET /me error:", err);
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// POST /api/users/onboarding — save onboarding data and calculate targets
router.post("/onboarding", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json();

  const {
    goal, age, currentWeight, targetWeight, height, gender,
    activityLevel, mealFrequency, weightUnit, heightUnit, weeksToGoal,
  } = body;

  if (!goal || !age || !currentWeight || !height || !gender || !activityLevel) {
    return c.json({ error: "Missing required onboarding fields" }, 400);
  }

  try {
    const profile = {
      goal,
      age: +age,
      currentWeight: +currentWeight,
      targetWeight: targetWeight ? +targetWeight : +currentWeight,
      height: +height,
      gender,
      activityLevel,
      mealFrequency: mealFrequency ? +mealFrequency : 3,
      weightUnit: weightUnit || "kg",
      heightUnit: heightUnit || "cm",
      weeksToGoal: weeksToGoal ? +weeksToGoal : null,
    };

    const dailyTargets = calculateDailyTargets(profile);

    // Patch the existing user row in place. We don't upsert: the row is
    // guaranteed to exist (Better Auth creates it on sign-up). Using
    // findByIdAndUpdate keeps the operation a single round-trip.
    const user = await User.findByIdAndUpdate(
      authUser.id,
      {
        $set: {
          profile,
          dailyTargets,
          onboardingComplete: true,
        },
      },
      { new: true, runValidators: false }
    );

    if (!user) return c.json({ error: "User not found" }, 404);

    // Also seed the first weight entry into the dedicated weightLogs
    // collection. Mirrors the original behaviour where onboarding pushed
    // an entry onto the user's nested `weightHistory` array.
    //
    // We use upsert-by-(userId, dateString) so re-running onboarding
    // (e.g. via the Settings reset flow) doesn't violate the unique
    // index when the user already has a weight entry for today.
    const today = new Date();
    const dateStr = toLocalDateString(today);
    await WeightLog.findOneAndUpdate(
      { userId: authUser.id, dateString: dateStr },
      {
        $setOnInsert: {
          userId:     authUser.id,
          date:       today,
          dateString: dateStr,
          weight:     profile.currentWeight,
          unit:       profile.weightUnit,
        },
      },
      { upsert: true, new: false, setDefaultsOnInsert: true }
    );

    return c.json({ user, dailyTargets });
  } catch (err) {
    console.error("POST /onboarding error:", err);
    return c.json({ error: "Failed to save onboarding data" }, 500);
  }
});

// PATCH /api/users/settings — update settings / override targets
router.patch("/settings", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json();

  try {
    // Build the $set payload incrementally so we only touch fields that
    // were actually sent — avoids triggering required-field validation on
    // unrelated subdocuments (e.g. dailyTargets when only profile changes).
    const setFields = {};

    // ── Profile fields ──────────────────────────────────────────────────────
    const profileFields = ["goal", "currentWeight", "targetWeight", "activityLevel", "mealFrequency"];
    for (const field of profileFields) {
      if (body[field] !== undefined) {
        setFields[`profile.${field}`] = body[field];
      }
    }

    // ── Onboarding reset ────────────────────────────────────────────────────
    if (body.resetOnboarding) {
      setFields.onboardingComplete = false;
    }

    // ── Manual target override ──────────────────────────────────────────────
    if (body.manualTargets) {
      const mt = body.manualTargets;
      if (mt.calories !== undefined) setFields["dailyTargets.calories"] = +mt.calories;
      if (mt.protein  !== undefined) setFields["dailyTargets.protein"]  = +mt.protein;
      if (mt.carbs    !== undefined) setFields["dailyTargets.carbs"]    = +mt.carbs;
      if (mt.fats     !== undefined) setFields["dailyTargets.fats"]     = +mt.fats;
      setFields["dailyTargets.isManualOverride"] = true;
    }

    // ── Recalculate from updated profile ────────────────────────────────────
    if (body.recalculate) {
      const current = await User.findById(authUser.id).lean();
      if (current) {
        const mergedProfile = { ...current.profile };
        for (const field of profileFields) {
          if (body[field] !== undefined) mergedProfile[field] = body[field];
        }
        const newTargets = calculateDailyTargets(mergedProfile);
        setFields["dailyTargets.calories"]         = newTargets.calories;
        setFields["dailyTargets.protein"]          = newTargets.protein;
        setFields["dailyTargets.carbs"]            = newTargets.carbs;
        setFields["dailyTargets.fats"]             = newTargets.fats;
        setFields["dailyTargets.isManualOverride"] = false;
      }
    }

    const user = await User.findByIdAndUpdate(
      authUser.id,
      { $set: setFields },
      { new: true, runValidators: false }
    );

    if (!user) return c.json({ error: "User not found" }, 404);

    // ── Weight log entry (if weight changed) ────────────────────────────────
    // Updating currentWeight is a "log a weight today" action by intent —
    // write a WeightLog row so the trend chart picks it up. Idempotent on
    // calendar day to match the original `weightHistory` semantics.
    if (body.currentWeight !== undefined) {
      const today = new Date();
      const dateStr = toLocalDateString(today);
      await WeightLog.findOneAndUpdate(
        { userId: authUser.id, dateString: dateStr },
        {
          $setOnInsert: {
            userId:     authUser.id,
            date:       today,
            dateString: dateStr,
            weight:     +body.currentWeight,
            unit:       body.weightUnit || "kg",
          },
        },
        { upsert: true, new: false, setDefaultsOnInsert: true }
      );
    }

    return c.json({ user });
  } catch (err) {
    console.error("PATCH /settings error:", err);
    return c.json({ error: "Failed to update settings", details: err.message }, 500);
  }
});

// POST /api/users/weight — log a weight entry
router.post("/weight", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { weight, unit, date } = await c.req.json();

  if (!weight) return c.json({ error: "Weight is required" }, 400);

  // Resolve the entry's calendar day. `date` is expected to be a
  // YYYY-MM-DD string; we anchor it at noon local time when building the
  // Date so daylight-saving transitions can't shift the calendar day.
  const dateStr = date
    ? toLocalDateString(new Date(date + "T12:00:00"))
    : toLocalDateString(new Date());
  const dateObj = new Date(dateStr + "T12:00:00");

  try {
    // Try to insert. The (userId, dateString) unique index guarantees one
    // entry per calendar day — if a row already exists, mongoose raises a
    // duplicate-key error (code 11000), which we translate into a 409 to
    // match the previous API contract.
    const entry = await WeightLog.create({
      userId:     authUser.id,
      date:       dateObj,
      dateString: dateStr,
      weight:     +weight,
      unit:       unit || "kg",
    });

    // Keep `profile.currentWeight` in sync so the dashboard, weight card,
    // and target recalculation always reflect the latest log.
    await User.findByIdAndUpdate(
      authUser.id,
      { $set: { "profile.currentWeight": +weight } },
      { runValidators: false }
    );

    return c.json({ entry });
  } catch (err) {
    if (err && err.code === 11000) {
      return c.json({ error: "Weight already logged for this date" }, 409);
    }
    console.error("POST /weight error:", err);
    return c.json({ error: "Failed to log weight", details: err.message }, 500);
  }
});

// GET /api/users/weight?date=YYYY-MM-DD — get weight entry for a specific date
router.get("/weight", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const dateStr = c.req.query("date") || toLocalDateString(new Date());

  try {
    const entry = await WeightLog.findOne({
      userId: authUser.id,
      dateString: dateStr,
    }).lean();

    return c.json({ entry });
  } catch (err) {
    console.error("GET /weight error:", err);
    return c.json({ error: "Failed to fetch weight entry" }, 500);
  }
});

// GET /api/users/weight/history — full weight history for the user, oldest → newest
//
// New endpoint exposing the dedicated weightLogs collection in one shot.
// AnalyticsPage previously walked the nested `user.weightHistory` array;
// now it can hit this endpoint directly without inflating the user payload.
router.get("/weight/history", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const limit = Math.min(parseInt(c.req.query("limit") || "365"), 1000);

  try {
    const entries = await WeightLog.find({ userId: authUser.id })
      .sort({ date: 1 })
      .limit(limit)
      .lean();

    return c.json({ entries });
  } catch (err) {
    console.error("GET /weight/history error:", err);
    return c.json({ error: "Failed to fetch weight history" }, 500);
  }
});

// DELETE /api/users/weight/:entryId — remove a specific weight entry
router.delete("/weight/:entryId", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { entryId } = c.req.param();

  try {
    // Guard the delete by both `_id` and `userId` so a malicious client
    // can't delete another user's row by guessing IDs.
    const deleted = await WeightLog.findOneAndDelete({
      _id: entryId,
      userId: authUser.id,
    });

    if (!deleted) return c.json({ error: "Entry not found" }, 404);

    return c.json({ success: true });
  } catch (err) {
    console.error("DELETE /weight error:", err);
    return c.json({ error: "Failed to delete weight entry", details: err.message }, 500);
  }
});

module.exports = router;
