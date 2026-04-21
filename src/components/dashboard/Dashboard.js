import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useLog } from "../../context/LogContext";
import { userApi } from "../../api/client";
import CircularProgress from "../ui/CircularProgress";
import MacroBar from "../ui/MacroBar";
import FoodSearch from "./FoodSearch";
import MealCategory from "./MealCategory";

// ─── Constants ────────────────────────────────────────────────────────────────
const MEAL_LABELS = {
  early_fuel:       { label: "Early Fuel",      emoji: "🌙", time: "5–7 AM"   },
  daybreak_nourish: { label: "Daybreak Nourish", emoji: "🌅", time: "7–9 AM"   },
  morning_boost:    { label: "Morning Boost",    emoji: "☕", time: "10–11 AM" },
  midday_reset:     { label: "Midday Reset",     emoji: "🌞", time: "12–2 PM"  },
  afternoon_graze:  { label: "Afternoon Graze",  emoji: "🍃", time: "3–5 PM"   },
  evening_fuel:     { label: "Evening Fuel",     emoji: "🌆", time: "6–8 PM"   },
  twilight_graze:   { label: "Twilight Graze",   emoji: "🌙", time: "9–10 PM"  },
};

const MICROS = [
  { key: "fiber",  label: "Fiber",  unit: "g",  target: 25,   color: "#34d399" },
  { key: "sodium", label: "Sodium", unit: "mg", target: 2300, color: "#fb923c" },
  { key: "sugar",  label: "Sugar",  unit: "g",  target: 50,   color: "#e879f9" },
  { key: "iron",   label: "Iron",   unit: "mg", target: 18,   color: "#f87171" },
];

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

/** Returns "YYYY-MM-DD" for a Date object */
function toDateString(d) {
  return d.toISOString().split("T")[0];
}

/** Adds `days` days to a date string and returns a new date string */
function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Formats "YYYY-MM-DD" → "Mon, Jan 6" */
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Date Navigator ───────────────────────────────────────────────────────────
function DateNavigator({ activeDate, onChange }) {
  const todayStr = toDateString(new Date());
  const isToday  = activeDate === todayStr;

  // Build a 7-day window centred on today for the pill strip
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(todayStr, i - 3));

  return (
    <div className="glass-card rounded-2xl px-4 py-3 flex flex-col gap-3">
      {/* Arrow nav row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onChange(shiftDate(activeDate, -1))}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold text-white">
            {isToday ? "Today" : formatDateLabel(activeDate)}
          </p>
          {!isToday && (
            <button
              onClick={() => onChange(todayStr)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors mt-0.5"
            >
              Back to today
            </button>
          )}
        </div>

        <button
          onClick={() => onChange(shiftDate(activeDate, 1))}
          disabled={activeDate >= todayStr}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day pill strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {days.map((d) => {
          const isActive  = d === activeDate;
          const isFuture  = d > todayStr;
          const dayName   = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
          const dayNum    = new Date(d + "T12:00:00").getDate();

          return (
            <button
              key={d}
              onClick={() => !isFuture && onChange(d)}
              disabled={isFuture}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs transition-all duration-200 ${
                isActive
                  ? "bg-indigo-500/25 border border-indigo-500/50 text-indigo-300"
                  : isFuture
                    ? "text-slate-700 cursor-not-allowed"
                    : "text-slate-500 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <span className="font-medium">{dayName}</span>
              <span className={`text-base font-bold mt-0.5 ${isActive ? "text-white" : ""}`}>{dayNum}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weight Log Mini-Card ─────────────────────────────────────────────────────
function WeightLogCard({ weightUnit }) {
  const [weight, setWeight]   = useState("");
  const [unit, setUnit]       = useState(weightUnit || "kg");
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  const handleLog = async () => {
    if (!weight) return;
    setSaving(true);
    try {
      await userApi.logWeight(weight, unit);
      setWeight("");
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)" }}>
        ⚖️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-400 mb-1">Log Weight</p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder={`e.g. 75`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLog()}
            className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-sm bg-black/30 border border-white/10 text-white placeholder-slate-600 focus:border-indigo-500 transition-all"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs bg-black/30 border border-white/10 text-slate-400 focus:border-indigo-500 transition-all"
          >
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
          </select>
        </div>
      </div>
      <button
        onClick={handleLog}
        disabled={!weight || saving}
        className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
          done
            ? "bg-green-500/20 border border-green-500/30 text-green-400"
            : "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40"
        }`}
      >
        {done ? "✓" : saving ? "…" : "Log"}
      </button>
    </div>
  );
}

// ─── Micro Nutrient Bar ───────────────────────────────────────────────────────
function MicroBar({ label, consumed, target, unit, color }) {
  const p = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(p), 120);
    return () => clearTimeout(t);
  }, [p]);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-slate-500 w-12 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${width}%`,
            background: color,
            boxShadow: `0 0 6px ${color}60`,
          }}
        />
      </div>
      <span className="text-[11px] flex-shrink-0" style={{ color }}>
        {Math.round(consumed)}<span className="text-slate-600">/{target}{unit}</span>
      </span>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { appUser } = useAuth();
  const { activeLog, fetchToday, fetchByDate, addEntry, deleteEntry } = useLog();

  const todayStr = toDateString(new Date());
  const [activeDate, setActiveDate] = useState(todayStr);
  const [selectedMeal, setSelectedMeal]   = useState(null);
  const [showSearch, setShowSearch]       = useState(false);
  const isToday = activeDate === todayStr;

  // Fetch log whenever active date changes
  useEffect(() => {
    if (isToday) {
      fetchToday();
    } else {
      fetchByDate(activeDate);
    }
  }, [activeDate, isToday, fetchToday, fetchByDate]);

  const handleDateChange = useCallback((newDate) => {
    setShowSearch(false);
    setSelectedMeal(null);
    setActiveDate(newDate);
  }, []);

  const targets = appUser?.dailyTargets || { calories: 2000, protein: 150, carbs: 200, fats: 65 };
  const totals  = activeLog?.totals     || { calories: 0, protein: 0, carbs: 0, fats: 0 };

  // Aggregate micros from entries (server doesn't sum these yet)
  const microTotals = (activeLog?.entries || []).reduce(
    (acc, e) => ({
      fiber:  acc.fiber  + (e.nutrition?.fiber  || 0),
      sodium: acc.sodium + (e.nutrition?.sodium || 0),
      sugar:  acc.sugar  + (e.nutrition?.sugar  || 0),
      iron:   acc.iron   + (e.nutrition?.iron   || 0),
    }),
    { fiber: 0, sodium: 0, sugar: 0, iron: 0 }
  );

  const calPct    = pct(totals.calories, targets.calories);
  const remaining = Math.round(targets.calories - totals.calories);
  const isOver    = remaining < 0;

  const mealFrequency = appUser?.profile?.mealFrequency || 3;
  const activeMeals   = Object.keys(MEAL_LABELS).slice(0, mealFrequency + 1);

  const goalLabel = (appUser?.profile?.goal || "maintenance")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto space-y-4 pb-24"  // pb-24 leaves room for FAB
    >
      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
            Good {getGreeting()},{" "}
            <span className="gradient-text">{appUser?.name?.split(" ")[0] || "there"}</span> 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">Let's crush your goals today.</p>
        </div>
        <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 mt-1">
          {goalLabel}
        </span>
      </motion.div>

      {/* ── Date Navigator + Weight Log (side by side on md+) ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <DateNavigator activeDate={activeDate} onChange={handleDateChange} />
        </div>
        <div>
          <WeightLogCard weightUnit={appUser?.profile?.weightUnit} />
        </div>
      </motion.div>

      {/* ── Calorie + Macro Summary ── */}
      <motion.div variants={fadeUp}>
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          {/* Ambient blobs */}
          <div className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 bg-purple-600/8 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-8">
            {/* Calorie ring */}
            <div className="flex flex-col items-center flex-shrink-0">
              <CircularProgress
                value={calPct}
                size={164}
                strokeWidth={11}
                color="#6366f1"
                trackColor="rgba(99,102,241,0.1)"
              >
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">
                  Calories
                </span>
                <span className="text-3xl font-bold text-white leading-none mt-0.5">
                  {Math.round(totals.calories)}
                </span>
                <span className="text-xs text-slate-500 mt-0.5">
                  of {targets.calories} kcal
                </span>
              </CircularProgress>

              <div className={`mt-3 px-4 py-1.5 rounded-full text-xs font-semibold border ${
                isOver
                  ? "bg-red-500/10 border-red-500/25 text-red-400"
                  : "bg-green-500/10 border-green-500/25 text-green-400"
              }`}>
                {isOver ? `${Math.abs(remaining)} kcal over` : `${remaining} kcal left`}
              </div>
            </div>

            <div className="hidden md:block self-stretch w-px bg-white/5" />
            <div className="block md:hidden self-stretch h-px w-full bg-white/5" />

            {/* Macro bars + mini stats + micros */}
            <div className="flex-1 w-full space-y-4">
              <MacroBar label="Protein"       consumed={totals.protein} target={targets.protein} color="#22d3ee" unit="g" />
              <MacroBar label="Carbohydrates" consumed={totals.carbs}   target={targets.carbs}   color="#f59e0b" unit="g" />
              <MacroBar label="Fats"          consumed={totals.fats}    target={targets.fats}    color="#f472b6" unit="g" />

              {/* Mini stat chips */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: "Protein", value: Math.round(totals.protein), target: targets.protein, color: "#22d3ee" },
                  { label: "Carbs",   value: Math.round(totals.carbs),   target: targets.carbs,   color: "#f59e0b" },
                  { label: "Fats",    value: Math.round(totals.fats),    target: targets.fats,    color: "#f472b6" },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl p-2.5 text-center"
                    style={{ background: `${m.color}0d`, border: `1px solid ${m.color}20` }}>
                    <p className="text-sm font-bold" style={{ color: m.color }}>
                      {m.value}<span className="text-xs font-normal ml-0.5">g</span>
                    </p>
                    <p className="text-[10px] text-slate-500">{m.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Micronutrients ── */}
              <div className="pt-2 border-t border-white/5">
                <p className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">Micronutrients</p>
                <div className="space-y-2">
                  {MICROS.map((m) => (
                    <MicroBar
                      key={m.key}
                      label={m.label}
                      consumed={microTotals[m.key] || 0}
                      target={m.target}
                      unit={m.unit}
                      color={m.color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Food Search (inline, slides in) ── */}
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
              onLogged={() => {
                isToday ? fetchToday() : fetchByDate(activeDate);
                setShowSearch(false);
                setSelectedMeal(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Today's Meals ── */}
      <motion.div variants={fadeUp} className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {isToday ? "Today's Meals" : `Meals · ${formatDateLabel(activeDate)}`}
          </h2>
          <span className="text-xs text-slate-600">
            {activeLog?.entries?.length || 0} items
          </span>
        </div>

        {activeMeals.map((mealKey) => {
          const info       = MEAL_LABELS[mealKey];
          const entries    = activeLog?.entries?.filter((e) => e.mealCategory === mealKey) || [];
          const mealTotals = activeLog?.mealTotals?.[mealKey] || { calories: 0, protein: 0, carbs: 0, fats: 0 };

          return (
            <MealCategory
              key={mealKey}
              mealKey={mealKey}
              label={info.label}
              emoji={info.emoji}
              time={info.time}
              entries={entries}
              totals={mealTotals}
              onAddFood={() => {
                setSelectedMeal(mealKey);
                setShowSearch(true);
              }}
            />
          );
        })}
      </motion.div>

      {/* ── Floating Action Button ── */}
      <AnimatePresence>
        {!showSearch && (
          <motion.div
            key="fab"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20"
            style={{ left: "calc(50% + 128px)" }} // offset for 256px sidebar
          >
            <motion.button
              onClick={() => setShowSearch(true)}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #6366f1, #7c3aed)",
                boxShadow: "0 8px 32px rgba(99,102,241,0.45), 0 0 0 1px rgba(99,102,241,0.3)",
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Log Food
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">+</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
