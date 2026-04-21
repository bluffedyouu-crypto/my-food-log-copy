import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useLog } from "../../context/LogContext";
import CircularProgress from "../ui/CircularProgress";
import MacroBar from "../ui/MacroBar";
import FoodSearch from "./FoodSearch";
import MealCategory from "./MealCategory";
import CustomBowlsPanel from "./CustomBowlsPanel";

// ─── Meal metadata ────────────────────────────────────────────────────────────
const MEAL_LABELS = {
  early_fuel:       { label: "Early Fuel",       emoji: "🌙", time: "5–7 AM"   },
  daybreak_nourish: { label: "Daybreak Nourish",  emoji: "🌅", time: "7–9 AM"   },
  morning_boost:    { label: "Morning Boost",     emoji: "☕", time: "10–11 AM" },
  midday_reset:     { label: "Midday Reset",      emoji: "🌞", time: "12–2 PM"  },
  afternoon_graze:  { label: "Afternoon Graze",   emoji: "🍃", time: "3–5 PM"   },
  evening_fuel:     { label: "Evening Fuel",      emoji: "🌆", time: "6–8 PM"   },
  twilight_graze:   { label: "Twilight Graze",    emoji: "🌙", time: "9–10 PM"  },
};

// ─── Animation presets ────────────────────────────────────────────────────────
const stagger = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function pct(consumed, target) {
  return target > 0 ? Math.min(Math.round((consumed / target) * 100), 100) : 0;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { appUser } = useAuth();
  const { todayLog, fetchToday } = useLog();
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const targets = appUser?.dailyTargets || { calories: 2000, protein: 150, carbs: 200, fats: 65 };
  const totals  = todayLog?.totals      || { calories: 0, protein: 0, carbs: 0, fats: 0 };

  const calPct  = pct(totals.calories, targets.calories);
  const remaining = Math.round(targets.calories - totals.calories);
  const isOver    = remaining < 0;

  const mealFrequency = appUser?.profile?.mealFrequency || 3;
  const activeMeals   = Object.keys(MEAL_LABELS).slice(0, mealFrequency + 1);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const goalLabel = (appUser?.profile?.goal || "maintenance")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto space-y-6 pb-10"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-1">
            {today}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
            Good {getGreeting()},{" "}
            <span className="gradient-text">
              {appUser?.name?.split(" ")[0] || "there"}
            </span>{" "}
            👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Let's crush your goals today.
          </p>
        </div>

        {/* Goal badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider">Active goal</span>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 border border-indigo-500/25 text-indigo-300">
            {goalLabel}
          </span>
        </div>
      </motion.div>

      {/* ── Calorie + Macro Summary Card ───────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          {/* Ambient glow blobs */}
          <div className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 bg-purple-600/8 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-8">

            {/* ── Calorie ring (center hero) ── */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="relative">
                <CircularProgress
                  value={calPct}
                  size={164}
                  strokeWidth={11}
                  color="#6366f1"
                  trackColor="rgba(99,102,241,0.1)"
                />
                {/* Centered text overlay — absolutely positioned inside the SVG wrapper */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{ pointerEvents: "none" }}
                >
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mb-0.5">
                    Calories
                  </span>
                  <span className="text-3xl font-bold text-white leading-none">
                    {Math.round(totals.calories)}
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5">
                    of {targets.calories} kcal
                  </span>
                </div>
              </div>

              {/* Remaining pill */}
              <div
                className={`mt-3 px-4 py-1.5 rounded-full text-xs font-semibold border ${
                  isOver
                    ? "bg-red-500/10 border-red-500/25 text-red-400"
                    : "bg-green-500/10 border-green-500/25 text-green-400"
                }`}
              >
                {isOver ? `${Math.abs(remaining)} kcal over` : `${remaining} kcal left`}
              </div>
            </div>

            {/* Vertical divider */}
            <div className="hidden md:block self-stretch w-px bg-white/5" />
            <div className="block md:hidden self-stretch h-px w-full bg-white/5" />

            {/* ── Macro bars ── */}
            <div className="flex-1 w-full space-y-5">
              <MacroBar
                label="Protein"
                consumed={totals.protein}
                target={targets.protein}
                color="#22d3ee"
                unit="g"
              />
              <MacroBar
                label="Carbohydrates"
                consumed={totals.carbs}
                target={targets.carbs}
                color="#f59e0b"
                unit="g"
              />
              <MacroBar
                label="Fats"
                consumed={totals.fats}
                target={targets.fats}
                color="#f472b6"
                unit="g"
              />

              {/* Mini stat row */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: "Protein",  value: Math.round(totals.protein),  target: targets.protein,  color: "#22d3ee" },
                  { label: "Carbs",    value: Math.round(totals.carbs),    target: targets.carbs,    color: "#f59e0b" },
                  { label: "Fats",     value: Math.round(totals.fats),     target: targets.fats,     color: "#f472b6" },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: `${m.color}0d`, border: `1px solid ${m.color}20` }}
                  >
                    <p className="text-base font-bold" style={{ color: m.color }}>
                      {m.value}<span className="text-xs font-normal ml-0.5">g</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{m.label}</p>
                    <p className="text-[10px]" style={{ color: `${m.color}99` }}>
                      / {m.target}g
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Food Search ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <FoodSearch
              selectedMeal={selectedMeal}
              onClose={() => { setShowSearch(false); setSelectedMeal(null); }}
              onLogged={() => { fetchToday(); setShowSearch(false); setSelectedMeal(null); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick-add button ───────────────────────────────────────────────── */}
      {!showSearch && (
        <motion.div variants={fadeUp}>
          <motion.button
            onClick={() => setShowSearch(true)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3.5 rounded-2xl border border-dashed border-white/10 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search &amp; log food
          </motion.button>
        </motion.div>
      )}

      {/* ── Custom Bowls (horizontal scroll strip) ────────────────────────── */}
      <motion.div variants={fadeUp}>
        <CustomBowlsPanel onLog={fetchToday} />
      </motion.div>

      {/* ── Today's Meals ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Today's Meals
          </h2>
          <span className="text-xs text-slate-600">
            {todayLog?.entries?.length || 0} items logged
          </span>
        </div>

        {activeMeals.map((mealKey) => {
          const info       = MEAL_LABELS[mealKey];
          const entries    = todayLog?.entries?.filter((e) => e.mealCategory === mealKey) || [];
          const mealTotals = todayLog?.mealTotals?.[mealKey] || { calories: 0, protein: 0, carbs: 0, fats: 0 };

          return (
            <MealCategory
              key={mealKey}
              mealKey={mealKey}
              label={info.label}
              emoji={info.emoji}
              time={info.time}
              entries={entries}
              totals={mealTotals}
              onAddFood={() => { setSelectedMeal(mealKey); setShowSearch(true); }}
            />
          );
        })}
      </motion.div>
    </motion.div>
  );
}
