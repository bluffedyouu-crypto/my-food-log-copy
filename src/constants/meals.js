/**
 * Single source of truth for meal category labels.
 * Import this everywhere instead of defining inline.
 */
export const MEAL_LABELS = {
  early_fuel:       { label: "Early Fuel",       emoji: "🌙", time: "5–7 AM"   },
  daybreak_nourish: { label: "Breakfast",        emoji: "🌅", time: "7–9 AM"   },
  morning_boost:    { label: "Morning Snack",    emoji: "☕", time: "10–11 AM" },
  midday_reset:     { label: "Lunch",            emoji: "🌞", time: "12–2 PM"  },
  afternoon_graze:  { label: "Afternoon Graze",  emoji: "🍃", time: "3–5 PM"   },
  evening_snack:    { label: "Evening Snack",    emoji: "🍪", time: "4–6 PM"   },
  evening_fuel:     { label: "Dinner",           emoji: "🌆", time: "6–8 PM"   },
  twilight_graze:   { label: "Late Night Graze", emoji: "🌙", time: "9–10 PM"  },
};

/** Exact meal mapping by frequency */
export const MEAL_SCHEDULES = {
  3: ["daybreak_nourish", "midday_reset", "evening_fuel"],
  4: ["daybreak_nourish", "midday_reset", "evening_snack", "evening_fuel"],
  5: ["daybreak_nourish", "morning_boost", "midday_reset", "evening_snack", "evening_fuel"],
  6: ["early_fuel", "daybreak_nourish", "midday_reset", "afternoon_graze", "evening_snack", "evening_fuel"],
};

/** Flat label map for selects / pills */
export const MEAL_LABEL_MAP = Object.fromEntries(
  Object.entries(MEAL_LABELS).map(([k, v]) => [k, v.label])
);
