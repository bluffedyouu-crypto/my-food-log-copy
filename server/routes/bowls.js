const { Hono } = require("hono");
const CustomBowl = require("../models/CustomBowl");
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

// GET /api/bowls — list user's custom bowls
router.get("/", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  try {
    const bowls = await CustomBowl.find({ userId: authUser.id }).sort({ updatedAt: -1 }).lean();
    return c.json({ bowls });
  } catch (err) {
    return c.json({ error: "Failed to fetch bowls" }, 500);
  }
});

// GET /api/bowls/:id — get a single bowl
router.get("/:id", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { id } = c.req.param();
  try {
    const bowl = await CustomBowl.findOne({ _id: id, userId: authUser.id });
    if (!bowl) return c.json({ error: "Bowl not found" }, 404);
    return c.json({ bowl });
  } catch (err) {
    return c.json({ error: "Failed to fetch bowl" }, 500);
  }
});

// POST /api/bowls — create a new custom bowl
router.post("/", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const body = await c.req.json();

  const { name, description, emoji, ingredients, tags } = body;

  if (!name) return c.json({ error: "Bowl name is required" }, 400);
  if (!ingredients || ingredients.length === 0) {
    return c.json({ error: "Bowl must have at least one ingredient" }, 400);
  }

  // Normalize ingredients
  const normalizedIngredients = ingredients.map((ing) => {
    const quantityInGrams = quantityToGrams(
      +ing.quantity,
      ing.unit || "g",
      ing.servingSize || 100
    );
    const nutrition = nutritionForGrams(ing.per100g || {}, quantityInGrams);
    return {
      foodItemId: ing.foodItemId || undefined,
      fdcId: ing.fdcId || undefined,
      name: ing.name,
      brand: ing.brand || undefined,
      quantity: +ing.quantity,
      unit: ing.unit || "g",
      quantityInGrams,
      nutrition,
    };
  });

  try {
    const bowl = await CustomBowl.create({
      userId: authUser.id,
      name,
      description: description || "",
      emoji: emoji || "🥣",
      ingredients: normalizedIngredients,
      tags: tags || [],
    });
    return c.json({ bowl }, 201);
  } catch (err) {
    console.error("POST /bowls error:", err);
    return c.json({ error: "Failed to create bowl" }, 500);
  }
});

// PATCH /api/bowls/:id — update a bowl
router.patch("/:id", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { id } = c.req.param();
  const body = await c.req.json();

  try {
    const bowl = await CustomBowl.findOne({ _id: id, userId: authUser.id });
    if (!bowl) return c.json({ error: "Bowl not found" }, 404);

    if (body.name) bowl.name = body.name;
    if (body.description !== undefined) bowl.description = body.description;
    if (body.emoji) bowl.emoji = body.emoji;
    if (body.tags) bowl.tags = body.tags;

    if (body.ingredients) {
      bowl.ingredients = body.ingredients.map((ing) => {
        const quantityInGrams = quantityToGrams(+ing.quantity, ing.unit || "g", ing.servingSize || 100);
        const nutrition = nutritionForGrams(ing.per100g || {}, quantityInGrams);
        return { ...ing, quantityInGrams, nutrition };
      });
    }

    await bowl.save();
    return c.json({ bowl });
  } catch (err) {
    return c.json({ error: "Failed to update bowl" }, 500);
  }
});

// DELETE /api/bowls/:id — delete a bowl
router.delete("/:id", requireAuth, async (c) => {
  const authUser = c.get("authUser");
  const { id } = c.req.param();
  try {
    await CustomBowl.findOneAndDelete({ _id: id, userId: authUser.id });
    return c.json({ message: "Bowl deleted" });
  } catch (err) {
    return c.json({ error: "Failed to delete bowl" }, 500);
  }
});

module.exports = router;
