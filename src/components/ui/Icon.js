/**
 * Icon — central registry for all platform-consistent SVG icons.
 * ────────────────────────────────────────────────────────────────────────────
 *  Why: rendering emojis (🥗 🌙 ⚖️ …) means each OS (iOS, Android, Windows,
 *  Linux, Chrome OS) shows its own font's glyph, so the same character looks
 *  completely different across devices. Lucide ships flat, monochrome SVG
 *  icons that look identical everywhere.
 *
 *  Usage:
 *      <Icon name="moon" className="w-5 h-5 text-indigo-400" />
 *      <Icon name="dumbbell" size={20} />
 *
 *  Names are *registry keys* — we map them to lucide-react components so the
 *  data layer (e.g. constants/meals.js, server responses) can ship plain
 *  strings rather than React components.
 * ────────────────────────────────────────────────────────────────────────────
 */
import React from "react";
import {
  // Meal categories
  Moon, Sunrise, Coffee, Sun, Leaf, Cookie, Sunset, Soup,
  // Goals
  Flame, Dumbbell, Zap, Target,
  // Activity levels
  Sofa, PersonStanding, Activity, Mountain, Footprints,
  // Fitness exercise types
  Bike, Waves, FlameKindling,
  // App-wide
  Salad, Scale, Ruler, UtensilsCrossed, RefreshCw, Trash2, Check,
  AlertTriangle, ChevronLeft, ChevronRight, Plus, X, Search,
  ChevronDown, LogOut, Settings, BarChart3, Home, ChefHat,
  HelpCircle,
} from "lucide-react";

// Registry — keep keys lowercase-kebab so they're URL/JSON friendly.
const REGISTRY = {
  // ── Meal categories ──
  moon:        Moon,
  sunrise:     Sunrise,
  coffee:      Coffee,
  sun:         Sun,
  leaf:        Leaf,
  cookie:      Cookie,
  sunset:      Sunset,
  soup:        Soup,
  // ── Goals ──
  flame:       Flame,
  dumbbell:    Dumbbell,
  zap:         Zap,
  target:      Target,
  // ── Activity levels ──
  sofa:        Sofa,
  "person-standing": PersonStanding,
  footprints:  Footprints,
  activity:    Activity,
  mountain:    Mountain,
  // ── Fitness exercise types ──
  bike:        Bike,
  waves:       Waves,
  "flame-kindling": FlameKindling,
  // ── App-wide ──
  salad:       Salad,
  scale:       Scale,
  ruler:       Ruler,
  utensils:    UtensilsCrossed,
  refresh:     RefreshCw,
  trash:       Trash2,
  check:       Check,
  warning:     AlertTriangle,
  "chevron-left":  ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-down":  ChevronDown,
  plus:        Plus,
  close:       X,
  search:      Search,
  logout:      LogOut,
  settings:    Settings,
  analytics:   BarChart3,
  home:        Home,
  chef:        ChefHat,
  help:        HelpCircle,
};

/**
 * Render an icon by registry key.
 * If the name is unknown we fall back to a small "help" glyph so missing
 * icons are visually obvious in dev, but the app never crashes.
 */
export default function Icon({ name, size = 20, className = "", strokeWidth = 2, ...rest }) {
  const Component = REGISTRY[name] || REGISTRY.help;
  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  );
}

// Export the registry keys so other files can do introspection / typecheck-y
// things like asserting an icon name exists.
export const ICON_NAMES = Object.keys(REGISTRY);
