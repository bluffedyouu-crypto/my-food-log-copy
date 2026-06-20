const mongoose = require("mongoose");

/**
 * Food — the primary food database populated from our own data.
 * All nutritional values are per 100g of the food item.
 * No timestamps — matches the existing data format exactly.
 */
const foodSchema = new mongoose.Schema({
  dish_name: { type: String, required: true, trim: true, index: true },
  calories_kcal: { type: Number, default: null },

  // Group 1: Core Macros
  macros: {
    protein_g:        { type: Number, default: null },
    carbohydrates_g:  { type: Number, default: null },
    sugars_g:         { type: Number, default: null },
    dietary_fiber_g:  { type: Number, default: null },
    fat_total_g:      { type: Number, default: null },
    water_g:          { type: Number, default: null },
  },

  // Group 2: Detailed Fat Breakdown
  fats_breakdown: {
    saturated_g:      { type: Number, default: null },
    monounsaturated_g:{ type: Number, default: null },
    polyunsaturated_g:{ type: Number, default: null },
    cholesterol_mg:   { type: Number, default: null },
  },

  // Group 3: Vitamins
  vitamins: {
    a_mcg:   { type: Number, default: null },
    b1_mg:   { type: Number, default: null },
    b2_mg:   { type: Number, default: null },
    b3_mg:   { type: Number, default: null },
    b5_mg:   { type: Number, default: null },
    b6_mg:   { type: Number, default: null },
    b11_mcg: { type: Number, default: null },
    b12_mcg: { type: Number, default: null },
    c_mg:    { type: Number, default: null },
    d_mcg:   { type: Number, default: null },
    e_mg:    { type: Number, default: null },
    k_mcg:   { type: Number, default: null },
  },

  // Group 4: Minerals
  minerals: {
    sodium_mg:     { type: Number, default: null },
    calcium_mg:    { type: Number, default: null },
    iron_mg:       { type: Number, default: null },
    magnesium_mg:  { type: Number, default: null },
    manganese_mg:  { type: Number, default: null },
    phosphorus_mg: { type: Number, default: null },
    potassium_mg:  { type: Number, default: null },
    selenium_mcg:  { type: Number, default: null },
    zinc_mg:       { type: Number, default: null },
    copper_mg:     { type: Number, default: null },
  },
  // Group 5: Quantities
  quantities: {
    piece: { type: Number, default: null },
    cup: { type: Number, default: null },
    bowl: { type: Number, default: null },
    glass: { type: Number, default: null },
    tablespoon: { type: Number, default: null },
    teaspoon: { type: Number, default: null },
    slice: { type: Number, default: null },
    plate: { type: Number, default: null },
  },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String }
});

// Text index for full-text search fallback
foodSchema.index({ dish_name: "text" });

module.exports = mongoose.model("Food", foodSchema);
