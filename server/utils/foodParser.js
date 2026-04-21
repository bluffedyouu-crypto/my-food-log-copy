/**
 * Food Data Parser
 * Normalizes food data from USDA FoodData Central and Open Food Facts
 * into a consistent internal FoodItem format.
 */

/**
 * Parse a USDA FoodData Central food item
 * @param {Object} usdaFood - Raw USDA API response food object
 * @returns {Object} Normalized food item
 */
function parseUSDAFood(usdaFood) {
  if (!usdaFood || !usdaFood.description) {
    throw new Error("Invalid USDA food data: missing description");
  }

  const nutrients = {};
  const nutrientList = usdaFood.foodNutrients || [];

  // USDA nutrient IDs
  const NUTRIENT_MAP = {
    1008: "calories",   // Energy (kcal)
    1003: "protein",    // Protein
    1005: "carbs",      // Carbohydrate, by difference
    1004: "fats",       // Total lipid (fat)
    1079: "fiber",      // Fiber, total dietary
    2000: "sugar",      // Sugars, total
    1093: "sodium",     // Sodium, Na
    1092: "potassium",  // Potassium, K
    1162: "vitaminC",   // Vitamin C
    1087: "calcium",    // Calcium, Ca
    1089: "iron",       // Iron, Fe
  };

  for (const n of nutrientList) {
    const key = NUTRIENT_MAP[n.nutrientId || n.nutrient?.id];
    if (key) {
      nutrients[key] = +(n.value || n.amount || 0).toFixed(2);
    }
  }

  // Serving info
  const servingSize = usdaFood.servingSize || 100;
  const servingUnit = (usdaFood.servingSizeUnit || "g").toLowerCase();

  // Normalize to per-100g if serving size differs
  const factor = servingUnit === "g" ? 100 / servingSize : 1;
  const per100g = {};
  for (const [key, val] of Object.entries(nutrients)) {
    per100g[key] = +(val * factor).toFixed(2);
  }

  return {
    fdcId: String(usdaFood.fdcId),
    name: usdaFood.description,
    brand: usdaFood.brandOwner || usdaFood.brandName || null,
    category: usdaFood.foodCategory?.description || usdaFood.foodCategoryLabel || null,
    per100g: {
      calories: per100g.calories || 0,
      protein: per100g.protein || 0,
      carbs: per100g.carbs || 0,
      fats: per100g.fats || 0,
      fiber: per100g.fiber || 0,
      sugar: per100g.sugar || 0,
      sodium: per100g.sodium || 0,
      potassium: per100g.potassium || 0,
      vitaminC: per100g.vitaminC || 0,
      calcium: per100g.calcium || 0,
      iron: per100g.iron || 0,
    },
    servingSize: servingUnit === "g" ? servingSize : 100,
    servingUnit: "g",
    servingDescription: usdaFood.householdServingFullText || null,
    source: "usda",
    searchTerms: [usdaFood.description.toLowerCase()],
  };
}

/**
 * Parse an Open Food Facts product
 * @param {Object} offProduct - Raw Open Food Facts product object
 * @returns {Object} Normalized food item
 */
function parseOpenFoodFactsProduct(offProduct) {
  if (!offProduct || !offProduct.product_name) {
    throw new Error("Invalid Open Food Facts data: missing product_name");
  }

  const n = offProduct.nutriments || {};

  return {
    openFoodFactsId: offProduct.code || offProduct._id,
    name: offProduct.product_name,
    brand: offProduct.brands || null,
    category: offProduct.categories_tags?.[0]?.replace("en:", "") || null,
    per100g: {
      calories: +(n["energy-kcal_100g"] || n["energy_100g"] / 4.184 || 0).toFixed(2),
      protein: +(n.proteins_100g || 0).toFixed(2),
      carbs: +(n.carbohydrates_100g || 0).toFixed(2),
      fats: +(n.fat_100g || 0).toFixed(2),
      fiber: +(n.fiber_100g || 0).toFixed(2),
      sugar: +(n.sugars_100g || 0).toFixed(2),
      sodium: +((n.sodium_100g || 0) * 1000).toFixed(2), // convert g to mg
      potassium: +(n.potassium_100g || 0).toFixed(2),
      vitaminC: +(n["vitamin-c_100g"] || 0).toFixed(2),
      calcium: +(n.calcium_100g || 0).toFixed(2),
      iron: +(n.iron_100g || 0).toFixed(2),
    },
    servingSize: offProduct.serving_quantity || 100,
    servingUnit: "g",
    servingDescription: offProduct.serving_size || null,
    source: "open_food_facts",
    searchTerms: [offProduct.product_name.toLowerCase()],
  };
}

/**
 * Convert quantity to grams
 * @param {number} quantity
 * @param {string} unit - "g" | "oz" | "serving"
 * @param {number} servingSizeG - grams per serving
 */
function quantityToGrams(quantity, unit, servingSizeG = 100) {
  switch (unit) {
    case "oz":
      return +(quantity * 28.3495).toFixed(1);
    case "serving":
      return +(quantity * servingSizeG).toFixed(1);
    case "g":
    default:
      return +quantity.toFixed(1);
  }
}

/**
 * Calculate nutrition for a given quantity
 * @param {Object} per100g - Nutrition per 100g
 * @param {number} grams - Quantity in grams
 */
function nutritionForGrams(per100g, grams) {
  const factor = grams / 100;
  return {
    calories: +(per100g.calories * factor).toFixed(1),
    protein: +(per100g.protein * factor).toFixed(1),
    carbs: +(per100g.carbs * factor).toFixed(1),
    fats: +(per100g.fats * factor).toFixed(1),
    fiber: +(per100g.fiber * factor).toFixed(1),
    sodium: +(per100g.sodium * factor).toFixed(1),
  };
}

module.exports = {
  parseUSDAFood,
  parseOpenFoodFactsProduct,
  quantityToGrams,
  nutritionForGrams,
};
