const { Hono } = require("hono");
const axios = require("axios");
const FoodItem = require("../models/FoodItem");
const { parseUSDAFood, parseOpenFoodFactsProduct } = require("../utils/foodParser");

const router = new Hono();

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";
const OFF_BASE = "https://world.openfoodfacts.org/cgi/search.pl";

// ─── Middleware: require auth ─────────────────────────────────────────────────
async function requireAuth(c, next) {
  const { getAuth } = require("../auth");
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: "Unauthorized" }, 401);
  c.set("authUser", session.user);
  await next();
}

// GET /api/food/search?q=chicken&page=1
router.get("/search", requireAuth, async (c) => {
  const query = c.req.query("q");
  const page = parseInt(c.req.query("page") || "1");
  const pageSize = 20;

  if (!query || query.trim().length < 2) {
    return c.json({ error: "Query must be at least 2 characters" }, 400);
  }

  // 1. Try USDA FoodData Central
  try {
    const usdaKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const response = await axios.get(`${USDA_BASE}/foods/search`, {
      params: {
        query: query.trim(),
        api_key: usdaKey,
        pageSize,
        pageNumber: page,
        dataType: ["Branded", "Foundation", "SR Legacy"],
      },
      timeout: 5000,
    });

    const foods = (response.data.foods || []).map((f) => {
      try {
        return parseUSDAFood(f);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Cache results in MongoDB (fire and forget)
    cacheFoods(foods).catch(() => {});

    return c.json({
      foods,
      total: response.data.totalHits || foods.length,
      page,
      source: "usda",
    });
  } catch (usdaErr) {
    console.warn("USDA API failed, trying Open Food Facts:", usdaErr.message);
  }

  // 2. Try Open Food Facts
  try {
    const response = await axios.get(OFF_BASE, {
      params: {
        search_terms: query.trim(),
        search_simple: 1,
        action: "process",
        json: 1,
        page_size: pageSize,
        page,
      },
      timeout: 5000,
    });

    const products = (response.data.products || []).map((p) => {
      try {
        return parseOpenFoodFactsProduct(p);
      } catch {
        return null;
      }
    }).filter(Boolean);

    cacheFoods(products).catch(() => {});

    return c.json({
      foods: products,
      total: response.data.count || products.length,
      page,
      source: "open_food_facts",
    });
  } catch (offErr) {
    console.warn("Open Food Facts failed, using MongoDB cache:", offErr.message);
  }

  // 3. Fallback: MongoDB text search
  try {
    const foods = await FoodItem.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(pageSize)
      .skip((page - 1) * pageSize)
      .lean();

    return c.json({
      foods,
      total: foods.length,
      page,
      source: "cache",
      warning: "Using cached data — external food APIs are currently unavailable",
    });
  } catch (dbErr) {
    return c.json({ error: "Food search failed", details: dbErr.message }, 500);
  }
});

// GET /api/food/:fdcId — get single food item details
router.get("/:fdcId", requireAuth, async (c) => {
  const { fdcId } = c.req.param();

  // Check cache first
  const cached = await FoodItem.findOne({ fdcId }).lean();
  if (cached) return c.json({ food: cached, source: "cache" });

  try {
    const usdaKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const response = await axios.get(`${USDA_BASE}/food/${fdcId}`, {
      params: { api_key: usdaKey },
      timeout: 5000,
    });

    const food = parseUSDAFood(response.data);
    await FoodItem.findOneAndUpdate({ fdcId: food.fdcId }, food, { upsert: true, new: true });

    return c.json({ food, source: "usda" });
  } catch (err) {
    return c.json({ error: "Food item not found" }, 404);
  }
});

// POST /api/food/custom — create a custom food item
router.post("/custom", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json();

  if (!body.name || !body.per100g?.calories) {
    return c.json({ error: "Name and calories per 100g are required" }, 400);
  }

  try {
    const food = await FoodItem.create({
      ...body,
      source: "custom",
      isCustom: true,
      createdBy: authUser.id,
    });
    return c.json({ food }, 201);
  } catch (err) {
    return c.json({ error: "Failed to create custom food" }, 500);
  }
});

// ─── Helper: cache foods in MongoDB ──────────────────────────────────────────
async function cacheFoods(foods) {
  for (const food of foods) {
    const filter = food.fdcId
      ? { fdcId: food.fdcId }
      : { openFoodFactsId: food.openFoodFactsId };

    if (!filter.fdcId && !filter.openFoodFactsId) continue;

    await FoodItem.findOneAndUpdate(filter, { ...food, cachedAt: new Date() }, {
      upsert: true,
      new: true,
    }).catch(() => {});
  }
}

module.exports = router;
