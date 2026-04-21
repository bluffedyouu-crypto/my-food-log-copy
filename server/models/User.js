const mongoose = require("mongoose");

// ─── Macro / Micro Targets Sub-Schema ────────────────────────────────────────
const macroTargetsSchema = new mongoose.Schema(
  {
    calories: { type: Number, required: true, min: 0 },
    protein: { type: Number, required: true, min: 0 },   // grams
    carbs: { type: Number, required: true, min: 0 },     // grams
    fats: { type: Number, required: true, min: 0 },      // grams
    // Micros (recommended daily values in mg or mcg)
    fiber: { type: Number, default: 25 },
    sodium: { type: Number, default: 2300 },
    potassium: { type: Number, default: 3500 },
    vitaminC: { type: Number, default: 90 },
    calcium: { type: Number, default: 1000 },
    iron: { type: Number, default: 18 },
    // Manual override flag
    isManualOverride: { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── User Profile Sub-Schema ──────────────────────────────────────────────────
const profileSchema = new mongoose.Schema(
  {
    goal: {
      type: String,
      enum: ["fat_loss", "muscle_gain", "recomp", "maintenance"],
      default: "maintenance",
    },
    age: { type: Number, min: 10, max: 120 },
    currentWeight: { type: Number, min: 20 },   // kg
    targetWeight: { type: Number, min: 20 },    // kg
    height: { type: Number, min: 50 },          // cm
    gender: { type: String, enum: ["male", "female", "other"] },
    activityLevel: {
      type: String,
      enum: ["sedentary", "lightly_active", "moderately_active", "very_active"],
      default: "sedentary",
    },
    mealFrequency: { type: Number, min: 3, max: 6, default: 3 },
    weightUnit: { type: String, enum: ["kg", "lbs"], default: "kg" },
    heightUnit: { type: String, enum: ["cm", "ft"], default: "cm" },
  },
  { _id: false }
);

// ─── Main User Schema ─────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // Better Auth manages its own user collection; this extends it with app data
    authUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    avatar: { type: String },
    profile: { type: profileSchema, default: () => ({}) },
    dailyTargets: { type: macroTargetsSchema },
    onboardingComplete: { type: Boolean, default: false },
    weightHistory: [
      {
        date: { type: Date, default: Date.now },
        weight: { type: Number, required: true },
        unit: { type: String, enum: ["kg", "lbs"], default: "kg" },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("User", userSchema);
