const mongoose = require("mongoose");

/**
 * Unified User schema.
 *
 * This is the single source of truth for everything about a person:
 *   • identity fields (name / email / image / emailVerified / timestamps)
 *     are owned by Better Auth's MongoDB adapter
 *   • app-domain fields (profile / dailyTargets / onboardingComplete) are
 *     owned by our routes via Mongoose
 *
 * Both writers point at the same `users` collection (configured here AND
 * in `server/auth.js` via `user.modelName: "users"`). The Mongoose schema
 * uses `strict: false` because Better Auth may add fields the schema
 * doesn't enumerate (e.g. provider-specific metadata) and we don't want
 * those silently dropped on a Mongoose save.
 *
 * Document `_id` is the canonical user identifier. All cross-collection
 * references (DailyLog.userId, ActivityLog.userId, CustomBowl.userId,
 * WeightLog.userId) store this same `_id` as a string. Previously the
 * app maintained a separate `authUserId` string pointer to bridge the
 * two-collection setup; that field is gone.
 */

// ─── Macro / Micro Targets Sub-Schema ────────────────────────────────────────
const macroTargetsSchema = new mongoose.Schema(
  {
    calories:  { type: Number, required: true, min: 0 },
    protein:   { type: Number, required: true, min: 0 },  // grams
    carbs:     { type: Number, required: true, min: 0 },  // grams
    fats:      { type: Number, required: true, min: 0 },  // grams
    // Micros (recommended daily values in mg or mcg)
    fiber:     { type: Number, default: 25 },
    sodium:    { type: Number, default: 2300 },
    potassium: { type: Number, default: 3500 },
    vitaminC:  { type: Number, default: 90 },
    calcium:   { type: Number, default: 1000 },
    iron:      { type: Number, default: 18 },
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
    age:           { type: Number, min: 10, max: 120 },
    currentWeight: { type: Number, min: 20 },   // kg
    targetWeight:  { type: Number, min: 20 },   // kg
    height:        { type: Number, min: 50 },   // cm
    gender:        { type: String, enum: ["male", "female", "other"] },
    activityLevel: {
      type: String,
      enum: ["sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"],
      default: "sedentary",
    },
    mealFrequency: { type: Number, min: 3, max: 6, default: 3 },
    weightUnit:    { type: String, enum: ["kg", "lbs"], default: "kg" },
    heightUnit:    { type: String, enum: ["cm", "ft"], default: "cm" },
    weeksToGoal:   { type: Number, min: 1 },
  },
  { _id: false }
);

// ─── Main User Schema ─────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Better Auth-managed identity fields ───────────────────────────────
    // These are written by Better Auth's MongoDB adapter on sign-up /
    // sign-in. We declare them here so Mongoose returns them on `.lean()`
    // queries and so our routes can read them through the typed model.
    name:          { type: String, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    image:         { type: String },   // profile picture URL (Google avatar etc.)

    // ── App-managed onboarding/state fields ───────────────────────────────
    profile:            { type: profileSchema, default: () => ({}) },
    dailyTargets:       { type: macroTargetsSchema },
    onboardingComplete: { type: Boolean, default: false },
  },
  {
    // Force the collection name so this matches Better Auth's
    // `user.modelName: "users"` setting. Without this, Mongoose would
    // pluralise "User" to "users" anyway, but being explicit prevents the
    // collection from drifting if anyone ever renames the model.
    collection: "users",

    // Better Auth writes its own `createdAt`/`updatedAt` Date fields; let
    // Mongoose drive them too so save/update through either path keeps
    // them current. Mongoose's timestamps option overwrites both fields,
    // matching Better Auth's behaviour exactly.
    timestamps: true,

    // Allow Better Auth (and the migration script) to write fields not
    // explicitly listed here without Mongoose stripping them. The schema
    // documents the *typed* fields; Better Auth's internals manage a few
    // adjacent ones (e.g. provider-specific keys via plugins) that we
    // don't want to enumerate here.
    strict: false,

    // We don't use Mongoose's __v concurrency token. Better Auth doesn't
    // know about it, and a stale __v on an update through Better Auth
    // would cause a VersionError. Omitting it keeps both writers compatible.
    versionKey: false,

    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model("User", userSchema);
