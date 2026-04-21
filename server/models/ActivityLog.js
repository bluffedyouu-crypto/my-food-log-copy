const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    dateString: { type: String, required: true, index: true }, // "YYYY-MM-DD"
    activityType: {
      type: String,
      enum: ["gym", "running", "walking", "cycling", "swimming", "sports", "yoga", "other"],
      required: true,
    },
    label: { type: String }, // custom label e.g. "Morning Run"
    durationMinutes: { type: Number, min: 1 },
    caloriesBurned: { type: Number, min: 0 },
    notes: { type: String },
  },
  { timestamps: true }
);

activityLogSchema.index({ userId: 1, dateString: 1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
