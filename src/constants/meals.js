/**
 * Single source of truth for meal category labels.
 * Import this everywhere instead of defining inline.
 *
 * Each entry exposes:
 *   • label : human-readable name
 *   • icon  : registry key for `<Icon name="…" />` — renders a platform-
 *             consistent SVG via lucide-react. Use this in new UI code.
 *   • emoji : legacy emoji glyph, retained for any data flow that still
 *             expects a string (e.g. notification subjects). Avoid using
 *             this in JSX — it renders differently per OS.
 *   • time  : a friendly time hint (5–7 AM, etc.) shown beneath the label.
 */
export const MEAL_LABELS = {
  early_fuel:       { label: "Early Fuel",       icon: "moon",    emoji: "🌙", time: "5–7 AM"   },
  daybreak_nourish: { label: "Breakfast",        icon: "sunrise", emoji: "🌅", time: "7–9 AM"   },
  morning_boost:    { label: "Morning Snack",    icon: "coffee",  emoji: "☕", time: "10–11 AM" },
  midday_reset:     { label: "Lunch",            icon: "sun",     emoji: "🌞", time: "12–2 PM"  },
  afternoon_graze:  { label: "Afternoon Graze",  icon: "leaf",    emoji: "🍃", time: "3–5 PM"   },
  evening_snack:    { label: "Evening Snack",    icon: "cookie",  emoji: "🍪", time: "4–6 PM"   },
  evening_fuel:     { label: "Dinner",           icon: "sunset",  emoji: "🌆", time: "6–8 PM"   },
  twilight_graze:   { label: "Late Night Graze", icon: "moon",    emoji: "🌙", time: "9–10 PM"  },
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
