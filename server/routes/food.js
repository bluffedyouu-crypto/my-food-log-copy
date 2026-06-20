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
      calories:       doc.calories_kcal ?? 0,
      protein:        m.protein_g       ?? 0,
      carbs:          m.carbohydrates_g ?? 0,
      fats:           m.fat_total_g     ?? 0,
      fiber:          m.dietary_fiber_g ?? 0,
      sugar:          m.sugars_g        ?? 0,
      sodium:         mn.sodium_mg      ?? 0,
      potassium:      mn.potassium_mg   ?? 0,
      calcium:        mn.calcium_mg     ?? 0,
      iron:           mn.iron_mg        ?? 0,
      vitaminC:       v.c_mg            ?? 0,
      saturated:      fb.saturated_g    ?? 0,
      cholesterol_mg: fb.cholesterol_mg ?? 0,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Escape every special regex metacharacter so user input is treated as a
 * literal string inside a MongoDB $regex / $regexMatch expression.
 */
function escapeRegex(str) {
  // Replace each special char with a backslash-escaped version.
  // The replacement string uses $& (the matched character) prefixed by \\.
  return str.replace(/[.*+?^${}()|[\]\\]/g, (ch) => "\\" + ch);
}

/**
 * Strip punctuation/symbols from a query string and split it into individual
 * words, filtering out any empty tokens.
 *
 * "apple raw"  → ["apple", "raw"]
 * "apple, raw" → ["apple", "raw"]   (comma stripped)
 * "green tea"  → ["green", "tea"]
 */
function queryToWords(str) {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, " ") // replace non-alphanumeric with space
    .split(/\s+/)                      // split on whitespace
    .filter(Boolean);                  // drop empty strings
}

router.post('/custom', requireAuth, async (c) => {
  try {
    // 1. Parse the JSON body in Hono
    const newFood = await c.req.json();
    
    // 2. Add the exact server-side timestamp
    newFood.createdAt = new Date();
    
    // 3. Insert into the database using your existing Mongoose 'Food' model
    const createdFood = await Food.create(newFood);
    
    // 4. Return a 201 (Created) status using Hono's c.json()
    // We also run it through normaliseFoodDoc so your frontend gets the exact 
    // same data shape it expects from your search endpoint!
    return c.json({
      success: true,
      food: normaliseFoodDoc(createdFood)
    }, 201);
    
  } catch (error) {
    console.error("Failed to create custom food:", error);
    return c.json({ error: "Internal server error while saving food" }, 500);
  }
});

// ─── GET /api/food/search?q=apple+raw&limit=20 ───────────────────────────────
//
// Aggregation pipeline — relevance scoring (lower = better):
//
//   1  Exact match       dish_name === full query          "apple"
//   2  Starts-with       dish_name starts with full query  "apple pie"
//   3  Whole-word        full query is a standalone word   "green apple"
//   4  All-words present every query word exists somewhere "apple, raw"  ← default
//
// Tie-breaking within the same score: shorter dish_name wins.
//
router.get("/search", requireAuth, async (c) => {
  const raw   = (c.req.query("q") || "").trim();
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);

  if (raw.length < 2) {
    return c.json({ error: "Query must be at least 2 characters" }, 400);
  }

  // ── Pre-process the query ──────────────────────────────────────────────────

  // Individual words used for the $match filter (punctuation-tolerant).
  const words = queryToWords(raw);

  if (words.length === 0) {
    return c.json({ error: "Query contains no searchable words" }, 400);
  }

  // Escaped full query used for the high-confidence scoring branches.
  // We also build a "cleaned" version (punctuation stripped) so that
  // "apple raw" and "apple, raw" both hit score-1/2/3 when appropriate.
  const escapedFull    = escapeRegex(raw);
  const cleanedQuery   = words.join(" ");          // "apple raw" → "apple raw"
  const escapedCleaned = escapeRegex(cleanedQuery);

  // $and array: every word must appear somewhere in dish_name.
  // This is what makes "apple raw" match "apple, raw" — the comma is ignored
  // because we test each word independently.
  const wordFilters = words.map((w) => ({
    dish_name: { $regex: escapeRegex(w), $options: "i" },
  }));

  try {
    const docs = await Food.aggregate([

      // ── Stage 1: filter ────────────────────────────────────────────────────
      // Keep only documents where EVERY query word appears in dish_name.
      // Using $and + per-word $regex is punctuation-agnostic: "apple, raw"
      // passes the filter for words ["apple", "raw"] because both words exist
      // in the string regardless of the comma between them.
      {
        $match: { $and: wordFilters },
      },

      // ── Stage 2: score + nameLength ────────────────────────────────────────
      {
        $addFields: {

          // nameLength is used as a secondary sort key so that among results
          // with the same relevanceScore, shorter names rank higher.
          // e.g. "apple pie" (9) beats "apple banana pie" (16) at score 4.
          nameLength: { $strLenCP: "$dish_name" },

          relevanceScore: {
            $switch: {
              branches: [
                // 1 — exact match against the original query (anchored ^ … $)
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "^" + escapedFull + "$",
                      options: "i",
                    },
                  },
                  then: 1,
                },
                // Also try the cleaned (punctuation-stripped) version so that
                // a DB entry "apple, raw" still scores 1 when the user types
                // "apple raw" (both reduce to the same words).
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "^" + escapedCleaned + "$",
                      options: "i",
                    },
                  },
                  then: 1,
                },

                // 2 — starts-with the full query
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "^" + escapedFull,
                      options: "i",
                    },
                  },
                  then: 2,
                },
                // 2 — starts-with the cleaned query
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "^" + escapedCleaned,
                      options: "i",
                    },
                  },
                  then: 2,
                },

                // 3 — whole-word match (\b boundaries) on the full query
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "\\b" + escapedFull + "\\b",
                      options: "i",
                    },
                  },
                  then: 3,
                },
                // 3 — whole-word match on the cleaned query
                {
                  case: {
                    $regexMatch: {
                      input:   "$dish_name",
                      regex:   "\\b" + escapedCleaned + "\\b",
                      options: "i",
                    },
                  },
                  then: 3,
                },
              ],

              // 4 — all words present (guaranteed by Stage 1), but no
              //     contiguous phrase match found above.
              default: 4,
            },
          },
        },
      },

      // ── Stage 3: sort ──────────────────────────────────────────────────────
      // Primary:   relevanceScore ascending (1 = best)
      // Secondary: nameLength ascending (shorter name wins ties)
      {
        $sort: { relevanceScore: 1, nameLength: 1 },
      },

      // ── Stage 4: limit — applied AFTER sort so best results are never lost ─
      {
        $limit: limit,
      },

      // ── Stage 5: project — return real fields only; drop temp fields ───────
      {
        $project: {
          dish_name:      1,
          calories_kcal:  1,
          macros:         1,
          fats_breakdown: 1,
          vitamins:       1,
          minerals:       1,
          // relevanceScore and nameLength are absent → MongoDB drops them
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
