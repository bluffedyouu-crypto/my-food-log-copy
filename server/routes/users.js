const { Hono } = require("hono");
const User = require("../models/User");
const { calculateDailyTargets } = require("../utils/macroCalculator");

const router = new Hono();

// ─── Middleware: require auth session ─────────────────────────────────────────
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
      { new: true, upsert: true }
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
    const user = await User.findOne({ authUserId: authUser.id });
    if (!user) return c.json({ error: "User not found" }, 404);

    // Update profile fields if provided
    const profileFields = ["goal", "currentWeight", "targetWeight", "activityLevel", "mealFrequency"];
    for (const field of profileFields) {
      if (body[field] !== undefined) {
        user.profile[field] = body[field];
      }
    }

    // Reset onboarding flag (re-triggers onboarding flow)
    if (body.resetOnboarding) {
      user.onboardingComplete = false;
    }

    // Manual override of targets
    if (body.manualTargets) {
      user.dailyTargets = {
        ...user.dailyTargets.toObject(),
        ...body.manualTargets,
        isManualOverride: true,
      };
    } else if (body.recalculate) {
      // Recalculate from updated profile
      user.dailyTargets = calculateDailyTargets(user.profile);
    }

    // Log new weight if provided
    if (body.currentWeight) {
      user.weightHistory.push({
        date: new Date(),
        weight: body.currentWeight,
        unit: user.profile.weightUnit || "kg",
      });
    }

    await user.save();
    return c.json({ user });
  } catch (err) {
    console.error("PATCH /settings error:", err);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

// POST /api/users/weight — log a weight entry
router.post("/weight", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { weight, unit, date } = await c.req.json();

  if (!weight) return c.json({ error: "Weight is required" }, 400);

  try {
    const user = await User.findOneAndUpdate(
      { authUserId: authUser.id },
      {
        $push: {
          weightHistory: {
            date: date ? new Date(date) : new Date(),
            weight: +weight,
            unit: unit || "kg",
          },
        },
        "profile.currentWeight": +weight,
      },
      { new: true }
    );
    return c.json({ weightHistory: user.weightHistory });
  } catch (err) {
    return c.json({ error: "Failed to log weight" }, 500);
  }
});

module.exports = router;
