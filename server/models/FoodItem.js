const mongoose = require("mongoose");

/**
 * FoodItem — fallback / cache collection for food database entries.
 * Populated from USDA FoodData Central API responses or user-created custom foods.
 */
const foodItemSchema = new mongoose.Schema(
  {
    // External API identifiers
    fdcId: { type: String, index: true },           // USDA FoodData Central ID
    openFoodFactsId: { type: String, index: true }, // Open Food Facts barcode

    name: { type: String, required: true, trim: true, index: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true },

    // Nutrition per 100g
    per100g: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fats: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
      sugar: { type: Number, default: 0 },
      sodium: { type: Number, default: 0 },
      potassium: { type: Number, default: 0 },
      vitaminC: { type: Number, default: 0 },
      calcium: { type: Number, default: 0 },
      iron: { type: Number, default: 0 },
    },

    // Standard serving info
    servingSize: { type: Number, default: 100 },    // grams
    servingUnit: { type: String, default: "g" },
    servingDescription: { type: String },

    // Source tracking
    source: {
      type: String,
      enum: ["usda", "open_food_facts", "custom", "cache"],
      default: "custom",
    },
    isCustom: { type: Boolean, default: false },
    createdBy: { type: String }, // authUserId for custom foods

    // Cache management
    cachedAt: { type: Date, default: Date.now },
    searchTerms: [{ type: String }], // for text search
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Text index for search
foodItemSchema.index({ name: "text", brand: "text", searchTerms: "text" });

// Virtual: nutrition for a given quantity in grams
foodItemSchema.methods.nutritionForQuantity = function (grams) {
  const factor = grams / 100;
  const n = this.per100g;
  return {
    calories: +(n.calories * factor).toFixed(1),
    protein: +(n.protein * factor).toFixed(1),
    carbs: +(n.carbs * factor).toFixed(1),
    fats: +(n.fats * factor).toFixed(1),
    fiber: +(n.fiber * factor).toFixed(1),
    sugar: +(n.sugar * factor).toFixed(1),
    sodium: +(n.sodium * factor).toFixed(1),
  };
};

module.exports = mongoose.model("FoodItem", foodItemSchema);
