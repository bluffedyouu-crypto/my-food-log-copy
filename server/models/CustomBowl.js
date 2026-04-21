const mongoose = require("mongoose");

// ─── Bowl Ingredient Sub-Schema ───────────────────────────────────────────────
const bowlIngredientSchema = new mongoose.Schema(
  {
    foodItemId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodItem" },
    fdcId: { type: String },          // keep external ID for re-lookup
    name: { type: String, required: true },
    brand: { type: String },

    // Quantity as entered by user
    quantity: { type: Number, required: true, min: 0.1 },
    unit: { type: String, enum: ["g", "oz", "serving"], default: "g" },
    quantityInGrams: { type: Number, required: true }, // normalized

    // Snapshot of nutrition at time of adding (per entered quantity)
    nutrition: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fats: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
      sodium: { type: Number, default: 0 },
    },
  },
  { _id: true }
);

// ─── Custom Bowl Schema ───────────────────────────────────────────────────────
const customBowlSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true }, // authUserId
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    emoji: { type: String, default: "🥣" },

    ingredients: [bowlIngredientSchema],

    // Aggregated totals (denormalized for fast reads)
    totals: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fats: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
    },

    isPublic: { type: Boolean, default: false },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save: recalculate totals from ingredients
customBowlSchema.pre("save", function (next) {
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
  for (const ing of this.ingredients) {
    totals.calories += ing.nutrition.calories || 0;
    totals.protein += ing.nutrition.protein || 0;
    totals.carbs += ing.nutrition.carbs || 0;
    totals.fats += ing.nutrition.fats || 0;
    totals.fiber += ing.nutrition.fiber || 0;
  }
  // Round to 1 decimal
  this.totals = Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, +v.toFixed(1)])
  );
  next();
});

module.exports = mongoose.model("CustomBowl", customBowlSchema);
