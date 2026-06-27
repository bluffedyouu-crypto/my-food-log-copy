import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useLog } from "../../context/LogContext";
import { userApi } from "../../api/client";
import CircularProgress from "../ui/CircularProgress";
import MacroBar from "../ui/MacroBar";
import FoodSearch from "./FoodSearch";
import MealCategory from "./MealCategory";
import FitnessTracker from "./FitnessTracker";
import Icon from "../ui/Icon";
import { MEAL_LABELS, MEAL_SCHEDULES } from "../../constants/meals";

// ─── Micro config ─────────────────────────────────────────────────────────────
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

function toDateString(d) {
  return d.toISOString().split("T")[0];
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─── Date Navigator ───────────────────────────────────────────────────────────
// Horizontally scrollable strip of the last N days ending at Today.
// User can drag/scroll left to access older dates; the strip auto-scrolls
// to Today on mount so the most-recent days are visible by default.
function DateNavigator({ activeDate, onChange }) {
  const todayStr = toDateString(new Date());
  const isToday  = activeDate === todayStr;

  // Show ~60 past days + today by default. The strip is horizontally
  // scrollable, so the user can drag back through any of these. We chose
  // 60 days because it covers the vast majority of "look at what I logged"
  // queries without paying the cost of rendering thousands of buttons.
  const NUM_DAYS = 60;
  const days = useMemo(
    () => Array.from({ length: NUM_DAYS }, (_, i) => shiftDate(todayStr, i - (NUM_DAYS - 1))),
    [todayStr]
  );

  // Ref to the scroll container so we can keep Today/active date visible.
  const stripRef = useRef(null);
  const activeRef = useRef(null);

  // On mount → snap to the rightmost (Today) pill.
  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth;
    }
  }, []);

  // When the active date changes (e.g. via arrow buttons), scroll the
  // active pill into view smoothly.
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeDate]);

  return (
    <div className="glass-card rounded-2xl px-4 py-3 flex flex-col gap-3 h-full w-full min-w-0 overflow-hidden">
      {/* Arrow nav row */}
      <div className="flex items-center justify-between min-w-0">
        <button
          onClick={() => onChange(shiftDate(activeDate, -1))}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
          aria-label="Previous day"
        >
          <Icon name="chevron-left" size={16} />
        </button>

        <div className="text-center min-w-0 px-2 flex-1">
          <p className="text-sm font-semibold text-white truncate">
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

        {/* Right arrow — disabled when already on today */}
        <button
          onClick={() => { if (!isToday) onChange(shiftDate(activeDate, 1)); }}
          disabled={isToday}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
          aria-label="Next day"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      {/* Horizontally scrollable day-pill strip — Today is rightmost. */}
      {/*
        `w-full min-w-0 max-w-full` triple-guards the strip so it can never
        push past its parent: w-full sets the preferred width to 100%, min-w-0
        defeats the flex-item's default min-width:auto, and max-w-full clips
        any residual overflow. `overflow-x-auto` then turns the 60-pill row
        into a horizontally swipable strip inside that constrained box.

        `scrollPaddingRight` is the key to keeping the Today pill from being
        chopped by the card's overflow-hidden edge. Without it, `snap-end` on
        Today would align the pill's right border *exactly* with the strip's
        right edge — leaving its highlight ring flush against the card's
        clip rect. The 14px scroll-padding moves the snap target inward, so
        Today comes to rest with a clean ~14px buffer between its right edge
        and the card edge. We also bump the right *visual* padding to match
        so the layout looks balanced regardless of snap state.
      */}
      <div
        ref={stripRef}
        className="flex gap-1.5 overflow-x-auto pb-1 -ml-1 pl-1 pr-3 snap-x snap-mandatory w-full min-w-0 max-w-full"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorX: "contain",
          scrollPaddingRight: "14px",
          scrollPaddingLeft:  "4px",
        }}
      >
        {days.map((d) => {
          const isActive = d === activeDate;
          const dateObj  = new Date(d + "T12:00:00");
          const dayName  = dateObj.toLocaleDateString("en-US", { weekday: "short" });
          const dayNum   = dateObj.getDate();
          const isT      = d === todayStr;

          return (
            <button
              key={d}
              ref={isActive ? activeRef : null}
              onClick={() => onChange(d)}
              className={`flex-shrink-0 w-12 flex flex-col items-center px-1 py-2 rounded-xl text-xs transition-all duration-200 snap-end ${
                isActive
                  ? "bg-indigo-500/25 border border-indigo-500/50 text-indigo-300"
                  : "text-slate-500 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <span className="font-medium truncate w-full text-center">{isT ? "Today" : dayName}</span>
              <span className={`text-base font-bold mt-0.5 ${isActive ? "text-white" : ""}`}>{dayNum}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weight Log Card ──────────────────────────────────────────────────────────
// Fetches the weight entry for `activeDate` on mount/date change.
// Shows input form when no entry exists; shows logged value + Remove button when one does.
function WeightLogCard({ weightUnit, activeDate }) {
  const todayStr   = new Date().toISOString().split("T")[0];
  const dateToShow = activeDate || todayStr;
  const isToday    = dateToShow === todayStr;

  const [entry, setEntry]   = useState(null);   // { _id, weight, unit, date } | null
  const [fetching, setFetching] = useState(true);
  const [weight, setWeight] = useState("");
  const [unit, setUnit]     = useState(weightUnit || "kg");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError]   = useState("");

  // Fetch entry for the active date whenever it changes
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    setError("");
    userApi.getWeightForDate(dateToShow)
      .then(({ data }) => { if (!cancelled) setEntry(data.entry || null); })
      .catch(() => { if (!cancelled) setEntry(null); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [dateToShow]);

  const handleLog = async () => {
    if (!weight) return;
    setSaving(true);
    setError("");
    try {
      await userApi.logWeight(weight, unit, dateToShow);
      // Refresh to get the new entry with its _id
      const { data } = await userApi.getWeightForDate(dateToShow);
      setEntry(data.entry || null);
      setWeight("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!entry?._id) return;
    setRemoving(true);
    setError("");
    try {
      await userApi.deleteWeightEntry(entry._id);
      setEntry(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl px-4 py-3 flex flex-col justify-between h-full gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-violet-300 flex-shrink-0"
          style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <Icon name="scale" size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Weight</p>
          <p className="text-[10px] text-slate-600">
            {isToday ? "Today" : new Date(dateToShow + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
      </div>

      {fetching ? (
        <div className="flex justify-center py-2">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entry ? (
        /* ── Already logged — show value + Remove button ── */
        <>
          <div className="flex items-baseline gap-1.5 justify-center py-1">
            <span className="text-3xl font-bold text-white">{entry.weight}</span>
            <span className="text-sm text-slate-400">{entry.unit || unit}</span>
          </div>

          {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRemove}
            disabled={removing}
            className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
            style={{
              background: "rgba(185,28,28,0.15)",
              border: "1px solid rgba(185,28,28,0.35)",
              color: "#f87171",
              boxShadow: "0 0 10px rgba(185,28,28,0.2)",
            }}
          >
            {removing ? (
              "Removing…"
            ) : (
              <>
                <Icon name="trash" size={14} />
                Remove Log
              </>
            )}
          </motion.button>
        </>
      ) : (
        /* ── Not logged yet — show input form ── */
        <>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="e.g. 75"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLog()}
              disabled={false}
              // 16px font prevents iOS zoom-on-focus. Visually identical on
              // desktop since the field already renders ~14–16px elsewhere.
              style={{ fontSize: "16px" }}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-600 focus:border-violet-500 transition-all disabled:opacity-40"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={false}
              style={{ fontSize: "16px" }}
              className="px-2 py-2 rounded-xl bg-black/30 border border-white/10 text-slate-400 focus:border-violet-500 transition-all disabled:opacity-40"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </div>

          {error && <p className="text-[10px] text-red-400">{error}</p>}

          {!entry && (
            <button
              onClick={handleLog}
              disabled={!weight || saving}
              className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200
                         bg-violet-500/15 border border-violet-500/25 text-violet-300
                         hover:bg-violet-500/25 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Log Weight"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Micro Bar ────────────────────────────────────────────────────────────────
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
          style={{ width: `${width}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
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
  const { activeLog, fetchToday, fetchByDate } = useLog();

  const todayStr = toDateString(new Date());
  const [activeDate, setActiveDate]     = useState(todayStr);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showSearch, setShowSearch]     = useState(false);
  const isToday = activeDate === todayStr;

  // Responsive ring size — smaller on phones so the macro stack fits beside it.
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const ringSize = isNarrow ? 144 : 164;

  useEffect(() => {
    if (isToday) fetchToday();
    else fetchByDate(activeDate);
  }, [activeDate, isToday, fetchToday, fetchByDate]);

  const handleDateChange = useCallback((newDate) => {
    // Guard: never allow future dates
    if (newDate > todayStr) return;
    setShowSearch(false);
    setSelectedMeal(null);
    setActiveDate(newDate);
  }, [todayStr]);

  const targets = appUser?.dailyTargets || { calories: 2000, protein: 150, carbs: 200, fats: 65 };
  const totals  = activeLog?.totals     || { calories: 0, protein: 0, carbs: 0, fats: 0 };

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
  const activeMeals   = MEAL_SCHEDULES[mealFrequency] || MEAL_SCHEDULES[3];

  const goalLabel = (appUser?.profile?.goal || "maintenance")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="max-w-5xl mx-auto space-y-4 pb-10"
    >
      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight">
            Good {getGreeting()},{" "}
            <span className="gradient-text">{appUser?.name?.split(" ")[0] || "there"}</span> 👋
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">Let's crush your goals today.</p>
        </div>
        <span className="flex-shrink-0 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 mt-1 whitespace-nowrap">
          {goalLabel}
        </span>
      </motion.div>

      {/* ── Date Navigator + Weight Log — equal height via items-stretch ── */}
      {/*
        `min-w-0` is critical on every wrapper below. By default a grid/flex
        item has `min-width: auto`, which means it refuses to shrink below its
        content's intrinsic width. The DateNavigator contains 60 fixed-width
        day pills (~2900 px total), so without `min-w-0` the grid column will
        balloon out past the viewport instead of letting the inner strip
        scroll. With `min-w-0` the column stays at its grid-defined width and
        the strip's `overflow-x-auto` finally takes effect.
      */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
        <div className="md:col-span-2 flex min-w-0">
          <div className="flex-1 min-w-0">
            <DateNavigator activeDate={activeDate} onChange={handleDateChange} />
          </div>
        </div>
        <div className="flex min-w-0">
          <div className="flex-1 min-w-0">
            <WeightLogCard weightUnit={appUser?.profile?.weightUnit} activeDate={activeDate} />
          </div>
        </div>
      </motion.div>

      {/* ── Calorie + Macro Summary ── */}
      <motion.div variants={fadeUp}>
        <div className="glass-card rounded-2xl p-4 sm:p-6 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 bg-purple-600/8 rounded-full blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-6 sm:gap-8">
            {/* Calorie ring */}
            <div className="flex flex-col items-center flex-shrink-0">
              <CircularProgress
                value={calPct}
                size={ringSize}
                strokeWidth={11}
                color="#6366f1"
                trackColor="rgba(99,102,241,0.1)"
              >
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Calories</span>
                <span className="text-3xl font-bold text-white leading-none mt-0.5">
                  {Math.round(totals.calories)}
                </span>
                <span className="text-xs text-slate-500 mt-0.5">of {targets.calories} kcal</span>
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

            <div className="flex-1 w-full space-y-4">
              <MacroBar label="Protein"       consumed={totals.protein} target={targets.protein} color="#22d3ee" unit="g" />
              <MacroBar label="Carbohydrates" consumed={totals.carbs}   target={targets.carbs}   color="#f59e0b" unit="g" />
              <MacroBar label="Fats"          consumed={totals.fats}    target={targets.fats}    color="#f472b6" unit="g" />

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { label: "Protein", value: Math.round(totals.protein), color: "#22d3ee" },
                  { label: "Carbs",   value: Math.round(totals.carbs),   color: "#f59e0b" },
                  { label: "Fats",    value: Math.round(totals.fats),    color: "#f472b6" },
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

              {/* Micros */}
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

      {/* ── Fitness Tracker widget ── */}
      <motion.div variants={fadeUp}>
        <FitnessTracker
          activityLevel={appUser?.profile?.activityLevel}
          activeDate={activeDate}
        />
      </motion.div>

      {/* ── Food Search (inline) ── */}
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
              activeDate={activeDate}
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

      {/* ── Meals ── */}
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
              icon={info.icon}
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
    </motion.div>
  );
}
