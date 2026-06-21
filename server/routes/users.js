const { Hono } = require("hono");
const User = require("../models/User");
const { calculateDailyTargets } = require("../utils/macroCalculator");
const { requireAuth } = require("../middleware/requireAuth");

const router = new Hono();

// GET /api/users/me — get current user profile
router.get("/me", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  try {
    let user = await User.findOne({ authUserId: authUser.id });
    if (!user) {
      // Auto-create app user on first access
      user = await User.create({
        authUserId: authUser.id,
        email: authUser.email,
        name: authUser.name,
        avatar: authUser.image,
      });
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
    activityLevel, mealFrequency, weightUnit, heightUnit,
  } = body;

  // Validate required fields
  if (!goal || !age || !currentWeight || !height || !gender || !activityLevel) {
    return c.json({ error: "Missing required onboarding fields" }, 400);
  }

  try {
    const profile = {
      goal, age: +age,
      currentWeight: +currentWeight,
      targetWeight: targetWeight ? +targetWeight : +currentWeight,
      height: +height,
      gender, activityLevel,
      mealFrequency: mealFrequency ? +mealFrequency : 3,
      weightUnit: weightUnit || "kg",
      heightUnit: heightUnit || "cm",
    };

    const dailyTargets = calculateDailyTargets(profile);

    const user = await User.findOneAndUpdate(
      { authUserId: authUser.id },
      {
        profile,
        dailyTargets,
        onboardingComplete: true,
        $push: {
          weightHistory: {
            date: new Date(),
            weight: profile.currentWeight,
            unit: profile.weightUnit,
          },
        },
      },
      { returnDocument: "after", upsert: true }
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
      if (mt.calories !== undefined) setFields["dailyTargets.calories"]         = +mt.calories;
      if (mt.protein  !== undefined) setFields["dailyTargets.protein"]          = +mt.protein;
      if (mt.carbs    !== undefined) setFields["dailyTargets.carbs"]            = +mt.carbs;
      if (mt.fats     !== undefined) setFields["dailyTargets.fats"]             = +mt.fats;
      setFields["dailyTargets.isManualOverride"] = true;
    }

    // ── Recalculate from updated profile ────────────────────────────────────
    // We need the current profile to recalculate, so fetch it first (lean).
    if (body.recalculate) {
      const current = await User.findOne({ authUserId: authUser.id }).lean();
      if (current) {
        // Merge any incoming profile changes on top of the stored profile
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

    // ── Weight history entry (if weight changed) ────────────────────────────
    // Use $push separately via update operators — handled below.
    const updateOp = { $set: setFields };
    if (body.currentWeight) {
      updateOp.$push = {
        weightHistory: {
          date:   new Date(),
          weight: +body.currentWeight,
          unit:   body.weightUnit || "kg",
        },
      };
    }

    const user = await User.findOneAndUpdate(
      { authUserId: authUser.id },
      updateOp,
      { returnDocument: "after", runValidators: false }
    );

    if (!user) return c.json({ error: "User not found" }, 404);

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

  // Normalise the date to YYYY-MM-DD
  const dateStr = date
    ? new Date(date + "T12:00:00").toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  try {
    const user = await User.findOne({ authUserId: authUser.id }).lean();
    if (!user) return c.json({ error: "User not found" }, 404);

    // Enforce one weight entry per calendar day
    const alreadyLogged = (user.weightHistory || []).some(
      (e) => new Date(e.date).toISOString().split("T")[0] === dateStr
    );
    if (alreadyLogged) {
      return c.json({ error: "Weight already logged for this date" }, 409);
    }

    // Use findOneAndUpdate with $push so Mongoose only validates the pushed
    // subdocument — not the entire document (avoids required-field errors on
    // unrelated fields like dailyTargets).
    const updated = await User.findOneAndUpdate(
      { authUserId: authUser.id },
      {
        $push: {
          weightHistory: {
            date: new Date(dateStr + "T12:00:00"),
            weight: +weight,
            unit: unit || "kg",
          },
        },
        $set: { "profile.currentWeight": +weight },
      },
      { returnDocument: "after", runValidators: false }
    );

    return c.json({ weightHistory: updated.weightHistory });
  } catch (err) {
    console.error("POST /weight error:", err);
    return c.json({ error: "Failed to log weight", details: err.message }, 500);
  }
});

// GET /api/users/weight?date=YYYY-MM-DD — get weight entry for a specific date
router.get("/weight", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const dateStr  = c.req.query("date") || new Date().toISOString().split("T")[0];

  try {
    const user = await User.findOne({ authUserId: authUser.id }).lean();
    if (!user) return c.json({ entry: null });

    const entry = (user.weightHistory || []).find(
      (e) => new Date(e.date).toISOString().split("T")[0] === dateStr
    ) || null;

    return c.json({ entry });
  } catch (err) {
    return c.json({ error: "Failed to fetch weight entry" }, 500);
  }
});

// DELETE /api/users/weight/:entryId — remove a specific weight entry
router.delete("/weight/:entryId", requireAuth, async (c) => {
  const authUser    = c.get("authUser");
  const { entryId } = c.req.param();

  try {
    // Use $pull to remove the subdocument by _id — no full-document save needed
    const updated = await User.findOneAndUpdate(
      { authUserId: authUser.id },
      { $pull: { weightHistory: { _id: entryId } } },
      { returnDocument: "after", runValidators: false }
    );

    if (!updated) return c.json({ error: "User not found" }, 404);

    return c.json({ weightHistory: updated.weightHistory });
  } catch (err) {
    console.error("DELETE /weight error:", err);
    return c.json({ error: "Failed to delete weight entry", details: err.message }, 500);
  }
});

module.exports = router;
