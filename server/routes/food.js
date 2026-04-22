const { Hono } = require("hono");
const Food = require("../models/Food");

const router = new Hono();

// ─── Auth middleware ──────────────────────────────────────────────────────────
async function requireAuth(c, next) {
  const { getAuth } = require("../auth");
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "Unauthorized" }, 401);
  c.set("authUser", session.user);
  await next();
}

// ─── Normalise a Food document into the flat per100g shape ───────────────────
// All values are per 100 g. This shape is what logs.js and the frontend expect.
function normaliseFoodDoc(doc) {
  const m  = doc.macros         || {};
  const v  = doc.vitamins       || {};
  const mn = doc.minerals       || {};
  const fb = doc.fats_breakdown || {};

  return {
    _id:  doc._id,
    id:   doc._id,
    name: doc.dish_name,
    brand: null,

    per100g: {
      calories:       doc.calories_kcal   ?? 0,
      protein:        m.protein_g         ?? 0,
      carbs:          m.carbohydrates_g   ?? 0,
      fats:           m.fat_total_g       ?? 0,
      fiber:          m.dietary_fiber_g   ?? 0,
      sugar:          m.sugars_g          ?? 0,
      sodium:         mn.sodium_mg        ?? 0,
      potassium:      mn.potassium_mg     ?? 0,
      calcium:        mn.calcium_mg       ?? 0,
      iron:           mn.iron_mg          ?? 0,
      vitaminC:       v.c_mg              ?? 0,
      saturated:      fb.saturated_g      ?? 0,
      cholesterol_mg: fb.cholesterol_mg   ?? 0,
    },

    servingSize:        100,
    servingUnit:        "g",
    servingDescription: "100g",

    macros:         doc.macros,
    fats_breakdown: doc.fats_breakdown,
    vitamins:       doc.vitamins,
    minerals:       doc.minerals,
  };
}

// ─── Escape special regex characters to prevent injection ─────────────────────
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── GET /api/food/search?q=chicken&limit=20 ─────────────────────────────────
//
// Uses an aggregation pipeline to score results by relevance BEFORE applying
// $limit, so the best matches are never cut off by the result cap.
//
// Relevance scoring (lower = better):
//   1  Exact match        "tea"         dish_name === query
//   2  Starts-with        "Tea leaves"  dish_name starts with query
//   3  Whole-word match   "Iced tea"    query is a standalone word in dish_name
//   4  Substring match    "Steak"       query appears anywhere (default)
//
router.get("/search", requireAuth, async (c) => {
  const raw   = (c.req.query("q") || "").trim();
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  if (raw.length < 2) {
    return c.json({ error: "Query must be at least 2 characters" }, 400);
  }

  const esc = escapeRegex(raw);

  try {
    const docs = await Food.aggregate([

      // Stage 1 — filter: keep only documents that contain the query anywhere.
      // This shrinks the working set before the more expensive scoring stages.
      {
        $match: {
          dish_name: { $regex: esc, $options: "i" },
        },
      },

      // Stage 2 — score: add a temporary relevanceScore field.
      // $switch evaluates branches in order and stops at the first match,
      // so the priority is enforced naturally.
      {
        $addFields: {
          relevanceScore: {
            $switch: {
              branches: [
                // 1 — exact match (full string, anchored both ends)
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "^" + esc + "$",
                      options: "i",
                    },
                  },
                  then: 1,
                },
                // 2 — starts-with (anchored at start only)
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "^" + esc,
                      options: "i",
                    },
                  },
                  then: 2,
                },
                // 3 — whole-word match (\b word boundaries)
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "\\b" + esc + "\\b",
                      options: "i",
                    },
                  },
                  then: 3,
                },
              ],
              // 4 — substring match (already guaranteed by Stage 1 $match)
              default: 4,
            },
          },
        },
      },

      // Stage 3 — sort: best relevance first; alphabetical as tiebreaker.
      {
        $sort: { relevanceScore: 1, dish_name: 1 },
      },

      // Stage 4 — limit: applied AFTER sorting so top matches are never lost.
      {
        $limit: limit,
      },

      // Stage 5 — project: return only the fields we need; drop the temp score.
      {
        $project: {
          dish_name:      1,
          calories_kcal:  1,
          macros:         1,
          fats_breakdown: 1,
          vitamins:       1,
          minerals:       1,
          // relevanceScore is intentionally omitted — $project whitelist drops it
        },
      },
    ]);

    const foods = docs.map(normaliseFoodDoc);

    return c.json({ foods, total: foods.length, source: "local_db" });
  } catch (err) {
    console.error("GET /api/food/search error:", err);
    return c.json({ error: "Food search failed", details: err.message }, 500);
  }
});

// ─── GET /api/food/:id — fetch a single food item by Mongo _id ───────────────
router.get("/:id", requireAuth, async (c) => {
  const { id } = c.req.param();

  try {
    const doc = await Food.findById(id).lean();
    if (!doc) return c.json({ error: "Food item not found" }, 404);
    return c.json({ food: normaliseFoodDoc(doc) });
  } catch (err) {
    return c.json({ error: "Food item not found" }, 404);
  }
});

module.exports = router;
