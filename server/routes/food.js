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

/**
 * Normalise a Food document into the flat `per100g` shape that the rest of
 * the app (logs route, frontend quantity modal) already understands.
 * All values are per 100 g of the food item.
 */
function normaliseFoodDoc(doc) {
  const m = doc.macros        || {};
  const v = doc.vitamins      || {};
  const min = doc.minerals    || {};
  const fb = doc.fats_breakdown || {};

  return {
    // Stable internal id — use Mongo _id as string
    _id:      doc._id,
    id:       doc._id,

    // Display fields
    name:     doc.dish_name,
    brand:    null,           // our DB has no brand field

    // Flat per-100g nutrition block (matches what logs.js / foodParser expect)
    per100g: {
      calories:  doc.calories_kcal          ?? 0,
      protein:   m.protein_g                ?? 0,
      carbs:     m.carbohydrates_g          ?? 0,
      fats:      m.fat_total_g              ?? 0,
      fiber:     m.dietary_fiber_g          ?? 0,
      sugar:     m.sugars_g                 ?? 0,
      sodium:    min.sodium_mg              ?? 0,
      potassium: min.potassium_mg           ?? 0,
      calcium:   min.calcium_mg             ?? 0,
      iron:      min.iron_mg                ?? 0,
      vitaminC:  v.c_mg                     ?? 0,
      // Extended fat detail
      saturated:      fb.saturated_g        ?? 0,
      cholesterol_mg: fb.cholesterol_mg     ?? 0,
    },

    // Serving defaults (our DB is per-100g, so servingSize = 100)
    servingSize:        100,
    servingUnit:        "g",
    servingDescription: "100g",

    // Pass through the full nested data for any consumer that wants it
    macros:         doc.macros,
    fats_breakdown: doc.fats_breakdown,
    vitamins:       doc.vitamins,
    minerals:       doc.minerals,
  };
}

// ─── GET /api/food/search?q=chicken&limit=20 ─────────────────────────────────
router.get("/search", requireAuth, async (c) => {
  const raw   = c.req.query("q") || "";
  const query = raw.trim();
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  if (query.length < 2) {
    return c.json({ error: "Query must be at least 2 characters" }, 400);
  }

  try {
    // Case-insensitive partial match on dish_name using $regex.
    // The `i` flag makes it case-insensitive.
    // We escape special regex characters to prevent injection.
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const docs = await Food.find(
      { dish_name: { $regex: escaped, $options: "i" } },
      // Project only the fields we need — keeps the payload lean
      {
        dish_name:      1,
        calories_kcal:  1,
        macros:         1,
        fats_breakdown: 1,
        vitamins:       1,
        minerals:       1,
      }
    )
      .limit(limit)
      .lean();

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
