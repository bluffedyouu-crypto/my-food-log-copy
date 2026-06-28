const mongoose = require("mongoose");

/**
 * WeightLog — one document per weight measurement.
 *
 * Weight history used to live as a `weightHistory` array nested on the
 * User document. That worked for a tiny number of entries but had two
 * problems we wanted to design out:
 *
 *   1. Every read of the user (which happens on basically every request
 *      that hits requireAuth → getMe) hauled the entire weight history
 *      across the wire, even though most callers don't need it.
 *
 *   2. Per-entry operations (insert / delete / "did I log today?")
 *      required full-document mutation, which played poorly with
 *      Mongoose's validation, conflicted with Better Auth writing to
 *      the same document, and needed special-case `$pull` / `$push`
 *      handling everywhere.
 *
 * Moving to a dedicated `weightLogs` collection makes:
 *   • lookups by user + date trivial (`{ userId, dateString }`)
 *   • inserts atomic and validation-scoped to one entry
 *   • aggregations (weekly average, trend chart) straightforward
 *   • the User document smaller and cheaper to fetch
 *
 * `userId` is stored as a *string* — the Better-Auth-issued user `_id`
 * coerced via `.toString()` — matching the convention every other
 * "owned by a user" collection uses (DailyLog, ActivityLog, CustomBowl).
 * That makes raw `c.get("authUser").id` from the requireAuth middleware
 * directly usable as a query value without ObjectId casting.
 */
const weightLogSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    // Canonical entry date. Stored both as a Date (for chronological
    // queries / sorting) and as a "YYYY-MM-DD" string (for the
    // "one-entry-per-calendar-day" enforcement that the routes do via a
    // compound unique index).
    date:       { type: Date,   required: true },
    dateString: { type: String, required: true },

    weight: { type: Number, required: true, min: 0 },
    unit:   { type: String, enum: ["kg", "lbs"], default: "kg" },

    // Optional free-text annotation — leaving room for future "morning,
    // post-workout, fasted, etc." labels without a schema change.
    note: { type: String, trim: true },
  },
  {
    collection: "weightLogs",
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// One entry per (user, calendar day). The route layer enforces this with
// a friendly 409 error, but the DB-level unique index is the safety net
// that prevents a duplicate from sneaking in via a race.
weightLogSchema.index({ userId: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model("WeightLog", weightLogSchema);
