import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { useLog } from "../../context/LogContext";
import CircularProgress from "../ui/CircularProgress";
import Card from "../ui/Card";
import FoodSearch from "./FoodSearch";
import MealCategory from "./MealCategory";
import CustomBowlsPanel from "./CustomBowlsPanel";

const MEAL_LABELS = {
  early_fuel: { label: "Early Fuel", emoji: "🌙", time: "5–7 AM" },
  daybreak_nourish: { label: "Daybreak Nourish", emoji: "🌅", time: "7–9 AM" },
  morning_boost: { label: "Morning Boost", emoji: "☕", time: "10–11 AM" },
  midday_reset: { label: "Midday Reset", emoji: "🌞", time: "12–2 PM" },
  afternoon_graze: { label: "Afternoon Graze", emoji: "🍃", time: "3–5 PM" },
  evening_fuel: { label: "Evening Fuel", emoji: "🌆", time: "6–8 PM" },
  twilight_graze: { label: "Twilight Graze", emoji: "🌙", time: "9–10 PM" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function Dashboard() {
  const { appUser } = useAuth();
  const { todayLog, fetchToday } = useLog();
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const targets = appUser?.dailyTargets || { calories: 2000, protein: 150, carbs: 200, fats: 65 };
  const totals = todayLog?.totals || { calories: 0, protein: 0, carbs: 0, fats: 0 };

  const pct = (consumed, target) =>
    target > 0 ? Math.round((consumed / target) * 100) : 0;

  const caloriesPct = pct(totals.calories, targets.calories);
  const proteinPct = pct(totals.protein, targets.protein);
  const carbsPct = pct(totals.carbs, targets.carbs);
  const fatsPct = pct(totals.fats, targets.fats);

  // Get active meal categories based on user's frequency preference
  const mealFrequency = appUser?.profile?.mealFrequency || 3;
  const allMeals = Object.keys(MEAL_LABELS);
  const activeMeals = allMeals.slice(0, mealFrequency + 1); // always include a few key ones

  const handleAddFood = (mealCategory) => {
    setSelectedMeal(mealCategory);
    setShowSearch(true);
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {getGreeting()}, {appUser?.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">{today}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Goal</p>
          <p className="text-sm font-semibold text-indigo-400 capitalize">
            {(appUser?.profile?.goal || "maintenance").replace("_", " ")}
          </p>
        </div>
      </motion.div>

      {/* Calorie Overview */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Calorie ring */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <CircularProgress
                  value={caloriesPct}
                  size={160}
                  strokeWidth={10}
                  color="#6366f1"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white">{Math.round(totals.calories)}</span>
                  <span className="text-xs text-slate-400">of {targets.calories}</span>
                  <span className="text-xs text-slate-500">kcal</span>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-300 mt-2">Calories</p>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-32 bg-white/10" />

            {/* Macro rings */}
            <div className="flex gap-6 flex-1 justify-center">
              <MacroRing
                label="Protein"
                value={proteinPct}
                consumed={totals.protein}
                target={targets.protein}
                color="#22d3ee"
                unit="g"
              />
              <MacroRing
                label="Carbs"
                value={carbsPct}
                consumed={totals.carbs}
                target={targets.carbs}
                color="#f59e0b"
                unit="g"
              />
              <MacroRing
                label="Fats"
                value={fatsPct}
                consumed={totals.fats}
                target={targets.fats}
                color="#f472b6"
                unit="g"
              />
            </div>

            {/* Remaining */}
            <div className="hidden md:flex flex-col gap-3 min-w-[140px]">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Remaining</p>
                <p className={`text-xl font-bold ${targets.calories - totals.calories < 0 ? "text-red-400" : "text-green-400"}`}>
                  {Math.abs(Math.round(targets.calories - totals.calories))} kcal
                </p>
                <p className="text-xs text-slate-500">
                  {targets.calories - totals.calories < 0 ? "over target" : "left today"}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Food Search */}
      {showSearch && (
        <motion.div
          variants={itemVariants}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <FoodSearch
            selectedMeal={selectedMeal}
            onClose={() => { setShowSearch(false); setSelectedMeal(null); }}
            onLogged={() => { fetchToday(); setShowSearch(false); setSelectedMeal(null); }}
          />
        </motion.div>
      )}

      {/* Quick Add Button */}
      {!showSearch && (
        <motion.div variants={itemVariants}>
          <button
            onClick={() => setShowSearch(true)}
            className="w-full py-3 rounded-2xl border border-dashed border-white/20 text-slate-400 hover:text-white hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all duration-200 flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search and log food
          </button>
        </motion.div>
      )}

      {/* Meal Categories */}
      <motion.div variants={itemVariants} className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Today's Meals</h2>
        {activeMeals.map((mealKey) => {
          const mealInfo = MEAL_LABELS[mealKey];
          const mealEntries = todayLog?.entries?.filter((e) => e.mealCategory === mealKey) || [];
          const mealTotals = todayLog?.mealTotals?.[mealKey] || { calories: 0, protein: 0, carbs: 0, fats: 0 };

          return (
            <MealCategory
              key={mealKey}
              mealKey={mealKey}
              label={mealInfo.label}
              emoji={mealInfo.emoji}
              time={mealInfo.time}
              entries={mealEntries}
              totals={mealTotals}
              onAddFood={() => handleAddFood(mealKey)}
            />
          );
        })}
      </motion.div>

      {/* Custom Bowls */}
      <motion.div variants={itemVariants}>
        <CustomBowlsPanel onLog={fetchToday} />
      </motion.div>
    </motion.div>
  );
}

function MacroRing({ label, value, consumed, target, color, unit }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <CircularProgress value={value} size={90} strokeWidth={7} color={color} />
      <p className="text-sm font-semibold text-slate-300">{label}</p>
      <p className="text-xs text-slate-500">
        {Math.round(consumed)}/{target}{unit}
      </p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
