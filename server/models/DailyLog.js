const mongoose = require("mongoose");

// ─── Meal Category Constants ──────────────────────────────────────────────────
const MEAL_CATEGORIES = [
  "early_fuel",        // Pre-breakfast  → "Early Fuel"
  "daybreak_nourish",  // Breakfast      → "Daybreak Nourish"
  "morning_boost",     // Mid snack      → "Morning Boost"
  "midday_reset",      // Lunch          → "Midday Reset"
  "afternoon_graze",   // Evening snack  → "Afternoon Graze"
  "evening_fuel",      // Dinner         → "Evening Fuel"
  "twilight_graze",    // Post-dinner    → "Twilight Graze"
];

const MEAL_CATEGORY_LABELS = {
  early_fuel: "Early Fuel",
  daybreak_nourish: "Daybreak Nourish",
  morning_boost: "Morning Boost",
  midday_reset: "Midday Reset",
  afternoon_graze: "Afternoon Graze",
  evening_fuel: "Evening Fuel",
  twilight_graze: "Twilight Graze",
};

// ─── Logged Food Entry Sub-Schema ─────────────────────────────────────────────
const loggedFoodSchema = new mongoose.Schema(
  {
    foodItemId: { type: mongoose.Schema.Types.ObjectId, ref: "FoodItem" },
    customBowlId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomBowl" },
    fdcId: { type: String },
    name: { type: String, required: true },
    brand: { type: String },

    mealCategory: {
      type: String,
      enum: MEAL_CATEGORIES,
      required: true,
    },

    quantity: { type: Number, required: true, min: 0.1 },
    unit: { type: String, enum: ["g", "oz", "serving", "piece", "cup", "bowl", "glass", "tablespoon", "teaspoon", "slice", "plate"], default: "g" },
    quantityInGrams: { type: Number, required: true },

    // Nutrition snapshot for this entry
    nutrition: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fats: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
      sodium: { type: Number, default: 0 },
    },

    loggedAt: { type: Date, default: Date.now },
    isFromCustomBowl: { type: Boolean, default: false },
  },
  { _id: true }
);

// ─── Daily Log Schema ─────────────────────────────────────────────────────────
const dailyLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    dateString: { type: String, required: true, index: true }, // "YYYY-MM-DD"

    entries: [loggedFoodSchema],

    // Denormalized daily totals
    totals: {
      calories: { type: Number, default: 0 },
      protein: { type: Number, default: 0 },
      carbs: { type: Number, default: 0 },
      fats: { type: Number, default: 0 },
      fiber: { type: Number, default: 0 },
      sodium: { type: Number, default: 0 },
    },

    // Per-meal totals (keyed by mealCategory)
    mealTotals: {
      type: Map,
      of: new mongoose.Schema(
        {
          calories: { type: Number, default: 0 },
          protein: { type: Number, default: 0 },
          carbs: { type: Number, default: 0 },
          fats: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: {},
    },

    // Snapshot of user's targets on this day
    targets: {
      calories: { type: Number },
      protein: { type: Number },
      carbs: { type: Number },
      fats: { type: Number },
    },

    notes: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound unique index: one log per user per day
dailyLogSchema.index({ userId: 1, dateString: 1 }, { unique: true });

// Pre-save: recalculate totals and per-meal totals
dailyLogSchema.pre("save", async function () {
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 };
  const mealTotals = {};

  for (const entry of this.entries) {
    const n = entry.nutrition;
    totals.calories += n.calories || 0;
    totals.protein += n.protein || 0;
    totals.carbs += n.carbs || 0;
    totals.fats += n.fats || 0;
    totals.fiber += n.fiber || 0;
    totals.sodium += n.sodium || 0;

    const cat = entry.mealCategory;
    if (!mealTotals[cat]) {
      mealTotals[cat] = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    }
    mealTotals[cat].calories += n.calories || 0;
    mealTotals[cat].protein += n.protein || 0;
    mealTotals[cat].carbs += n.carbs || 0;
    mealTotals[cat].fats += n.fats || 0;
  }

  this.totals = Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, +v.toFixed(1)])
  );
  this.mealTotals = mealTotals;
});

module.exports = mongoose.model("DailyLog", dailyLogSchema);
module.exports.MEAL_CATEGORIES = MEAL_CATEGORIES;
module.exports.MEAL_CATEGORY_LABELS = MEAL_CATEGORY_LABELS;
