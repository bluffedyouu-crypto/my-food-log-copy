import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { bowlsApi, logsApi } from "../../api/client";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const MEAL_LABELS = {
  early_fuel:       "Early Fuel",
  daybreak_nourish: "Daybreak Nourish",
  morning_boost:    "Morning Boost",
  midday_reset:     "Midday Reset",
  afternoon_graze:  "Afternoon Graze",
  evening_fuel:     "Evening Fuel",
  twilight_graze:   "Twilight Graze",
};

export default function CustomBowlsPanel({ onLog }) {
  const [bowls, setBowls]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [logModal, setLogModal]     = useState(null);
  const [selectedMeal, setSelectedMeal] = useState("midday_reset");
  const [logging, setLogging]       = useState(false);

  useEffect(() => {
    bowlsApi.getAll()
      .then(({ data }) => setBowls(data.bowls || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogBowl = async () => {
    if (!logModal) return;
    setLogging(true);
    try {
      for (const ing of logModal.ingredients) {
        const cal100 = ing.quantityInGrams > 0
          ? (ing.nutrition.calories / ing.quantityInGrams) * 100 : 0;
        await logsApi.addEntry({
          name: ing.name,
          brand: ing.brand,
          mealCategory: selectedMeal,
          quantity: ing.quantityInGrams,
          unit: "g",
          per100g: {
            calories: cal100,
            protein:  ing.quantityInGrams > 0 ? (ing.nutrition.protein / ing.quantityInGrams) * 100 : 0,
            carbs:    ing.quantityInGrams > 0 ? (ing.nutrition.carbs   / ing.quantityInGrams) * 100 : 0,
            fats:     ing.quantityInGrams > 0 ? (ing.nutrition.fats    / ing.quantityInGrams) * 100 : 0,
            fiber: 0, sodium: 0,
          },
          customBowlId: logModal._id,
          isFromCustomBowl: true,
        });
      }
      setLogModal(null);
      onLog?.();
    } catch (err) {
      console.error("Failed to log bowl:", err);
    } finally {
      setLogging(false);
    }
  };

  if (loading) return null;

  return (
    <>
      <div>
        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            My Custom Bowls
          </h2>
          <Link
            to="/bowl-builder"
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Bowl
          </Link>
        </div>

        {/* Horizontal scroll strip */}
        <div className="scroll-strip">
          {/* "Build a bowl" CTA card — always first */}
          <Link to="/bowl-builder" className="flex-shrink-0">
            <motion.div
              whileHover={{ y: -3 }}
              className="w-44 h-36 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl">
                🥣
              </div>
              <span className="text-xs font-medium text-center leading-tight px-2">
                Build a new bowl
              </span>
            </motion.div>
          </Link>

          {/* Bowl cards */}
          {bowls.map((bowl, i) => (
            <motion.div
              key={bowl._id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -3 }}
              onClick={() => setLogModal(bowl)}
              className="flex-shrink-0 w-44 h-36 glass-card rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer"
            >
              {/* Top */}
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none">{bowl.emoji || "🥣"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate leading-tight">
                    {bowl.name}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {bowl.ingredients?.length || 0} ingredients
                  </p>
                </div>
              </div>

              {/* Macro pills */}
              <div className="space-y-1">
                <p className="text-sm font-bold text-indigo-400">
                  {Math.round(bowl.totals?.calories || 0)}
                  <span className="text-xs font-normal text-slate-500 ml-1">kcal</span>
                </p>
                <div className="flex gap-1.5 text-[10px]">
                  <span className="text-cyan-500">P:{Math.round(bowl.totals?.protein || 0)}g</span>
                  <span className="text-amber-500">C:{Math.round(bowl.totals?.carbs || 0)}g</span>
                  <span className="text-pink-500">F:{Math.round(bowl.totals?.fats || 0)}g</span>
                </div>
              </div>

              {/* Log hint */}
              <div className="flex items-center gap-1 text-[10px] text-slate-700">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tap to log
              </div>
            </motion.div>
          ))}

          {/* Empty state inline */}
          {bowls.length === 0 && (
            <p className="text-sm text-slate-600 self-center pl-2">
              No bowls yet — build your first one!
            </p>
          )}
        </div>
      </div>

      {/* ── Log Bowl Modal ── */}
      <Modal
        isOpen={!!logModal}
        onClose={() => setLogModal(null)}
        title={`Log "${logModal?.name}"`}
      >
        <div className="space-y-4">
          {/* Ingredients preview */}
          <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(255,255,255,0.03)" }}>
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Ingredients</p>
            {logModal?.ingredients?.map((ing, i) => (
              <div key={i} className="flex justify-between text-xs text-slate-400 py-0.5">
                <span className="truncate flex-1">{ing.name}</span>
                <span className="ml-2 flex-shrink-0 text-slate-600">
                  {ing.quantityInGrams}g · {Math.round(ing.nutrition?.calories || 0)} kcal
                </span>
              </div>
            ))}
            <div className="border-t border-white/5 pt-2 mt-2 flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Total</span>
              <span className="text-indigo-400 font-bold">
                {Math.round(logModal?.totals?.calories || 0)} kcal
              </span>
            </div>
          </div>

          {/* Meal selector */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Add to meal</label>
            <select
              value={selectedMeal}
              onChange={(e) => setSelectedMeal(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/10 text-white focus:border-indigo-500 transition-all"
              style={{ background: "rgba(22,24,45,0.8)" }}
            >
              {Object.entries(MEAL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setLogModal(null)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleLogBowl} loading={logging} className="flex-1">
              Log Bowl
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
