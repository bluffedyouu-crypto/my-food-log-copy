import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { bowlsApi, logsApi } from "../../api/client";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const MEAL_LABELS = {
  early_fuel: "Early Fuel",
  daybreak_nourish: "Daybreak Nourish",
  morning_boost: "Morning Boost",
  midday_reset: "Midday Reset",
  afternoon_graze: "Afternoon Graze",
  evening_fuel: "Evening Fuel",
  twilight_graze: "Twilight Graze",
};

export default function CustomBowlsPanel({ onLog }) {
  const [bowls, setBowls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logModal, setLogModal] = useState(null); // bowl to log
  const [selectedMeal, setSelectedMeal] = useState("midday_reset");
  const [logging, setLogging] = useState(false);

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
      // Log each ingredient as a separate entry
      for (const ing of logModal.ingredients) {
        await logsApi.addEntry({
          name: ing.name,
          brand: ing.brand,
          mealCategory: selectedMeal,
          quantity: ing.quantityInGrams,
          unit: "g",
          per100g: { calories: (ing.nutrition.calories / ing.quantityInGrams) * 100, protein: (ing.nutrition.protein / ing.quantityInGrams) * 100, carbs: (ing.nutrition.carbs / ing.quantityInGrams) * 100, fats: (ing.nutrition.fats / ing.quantityInGrams) * 100, fiber: 0, sodium: 0 },
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
  if (bowls.length === 0) return (
    <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-[#111827] to-[#1a2235] p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">My Custom Bowls</h3>
        <Link to="/bowl-builder" className="text-xs text-indigo-400 hover:text-indigo-300">
          + Create Bowl
        </Link>
      </div>
      <p className="text-sm text-slate-500 text-center py-4">
        No custom bowls yet.{" "}
        <Link to="/bowl-builder" className="text-indigo-400 hover:underline">Build your first bowl →</Link>
      </p>
    </div>
  );

  return (
    <>
      <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-[#111827] to-[#1a2235] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">My Custom Bowls</h3>
          <Link to="/bowl-builder" className="text-xs text-indigo-400 hover:text-indigo-300">
            + New Bowl
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bowls.map((bowl, i) => (
            <motion.div
              key={bowl._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/3 border border-white/8 rounded-xl p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{bowl.emoji || "🥣"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{bowl.name}</p>
                  <p className="text-xs text-slate-500">{bowl.ingredients?.length || 0} ingredients</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-indigo-400 font-semibold">{Math.round(bowl.totals?.calories || 0)} kcal</span>
                <span className="text-cyan-400">P:{Math.round(bowl.totals?.protein || 0)}g</span>
                <span className="text-amber-400">C:{Math.round(bowl.totals?.carbs || 0)}g</span>
                <span className="text-pink-400">F:{Math.round(bowl.totals?.fats || 0)}g</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogModal(bowl)}
                className="w-full text-xs"
              >
                Log This Bowl
              </Button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Log Bowl Modal */}
      <Modal isOpen={!!logModal} onClose={() => setLogModal(null)} title={`Log "${logModal?.name}"`}>
        <div className="space-y-4">
          <div className="bg-white/3 rounded-xl p-3">
            <p className="text-sm text-slate-300 mb-2">Ingredients:</p>
            {logModal?.ingredients?.map((ing, i) => (
              <div key={i} className="flex justify-between text-xs text-slate-400 py-0.5">
                <span>{ing.name}</span>
                <span>{ing.quantityInGrams}g · {Math.round(ing.nutrition?.calories || 0)} kcal</span>
              </div>
            ))}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Add to meal</label>
            <select
              value={selectedMeal}
              onChange={(e) => setSelectedMeal(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white focus:border-indigo-500 transition-all"
            >
              {Object.entries(MEAL_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setLogModal(null)} className="flex-1">Cancel</Button>
            <Button onClick={handleLogBowl} loading={logging} className="flex-1">Log Bowl</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
