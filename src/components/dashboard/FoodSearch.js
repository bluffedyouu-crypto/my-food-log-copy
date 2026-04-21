import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { foodApi } from "../../api/client";
import { useLog } from "../../context/LogContext";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { MEAL_LABEL_MAP } from "../../constants/meals";

const MEAL_LABELS = MEAL_LABEL_MAP;

export default function FoodSearch({ selectedMeal, onClose, onLogged }) {
  const { addEntry } = useLog();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sourceWarning, setSourceWarning] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [activeMeal, setActiveMeal] = useState(selectedMeal || "daybreak_nourish");
  const debounceRef = useRef(null);

  const handleSearch = useCallback((value) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSourceWarning("");
      try {
        const { data } = await foodApi.search(value);
        setResults(data.foods || []);
        if (data.warning) setSourceWarning(data.warning);
      } catch (err) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setShowQuantityModal(true);
  };

  const handleLogFood = async ({ quantity, unit }) => {
    if (!selectedFood) return;
    await addEntry({
      fdcId: selectedFood.fdcId,
      name: selectedFood.name,
      brand: selectedFood.brand,
      mealCategory: activeMeal,
      quantity,
      unit,
      per100g: selectedFood.per100g,
      servingSize: selectedFood.servingSize || 100,
    });
    setShowQuantityModal(false);
    setSelectedFood(null);
    onLogged?.();
  };

  return (
    <>
      <div className="glass rounded-2xl p-4">
        {/* Meal selector */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {Object.entries(MEAL_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveMeal(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeMeal === key
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            type="text"
            placeholder={`Search food to add to ${MEAL_LABELS[activeMeal]}...`}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Warning */}
        {sourceWarning && (
          <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
            <span>⚠️</span> {sourceWarning}
          </p>
        )}

        {/* Results */}
        <AnimatePresence>
          {searching && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!searching && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 space-y-1 max-h-64 overflow-y-auto"
            >
              {results.map((food, i) => (
                <motion.button
                  key={food.fdcId || food.openFoodFactsId || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleSelectFood(food)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{food.name}</p>
                    {food.brand && <p className="text-xs text-slate-500 truncate">{food.brand}</p>}
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-indigo-400">{food.per100g?.calories || 0}</p>
                      <p className="text-xs text-slate-500">kcal/100g</p>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1 text-xs text-slate-400">
                      <span className="text-cyan-400">P:{food.per100g?.protein || 0}g</span>
                      <span className="text-amber-400">C:{food.per100g?.carbs || 0}g</span>
                      <span className="text-pink-400">F:{food.per100g?.fats || 0}g</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">No results found for "{query}"</p>
          )}
        </AnimatePresence>

        {/* Close */}
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Close search
          </button>
        </div>
      </div>

      {/* Quantity Modal */}
      <QuantityModal
        isOpen={showQuantityModal}
        food={selectedFood}
        onClose={() => { setShowQuantityModal(false); setSelectedFood(null); }}
        onConfirm={handleLogFood}
        mealLabel={MEAL_LABELS[activeMeal]}
      />
    </>
  );
}

function QuantityModal({ isOpen, food, onClose, onConfirm, mealLabel }) {
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");
  const [logging, setLogging] = useState(false);

  if (!food) return null;

  const gramsMap = { g: 1, oz: 28.3495, serving: food.servingSize || 100 };
  const grams = parseFloat(quantity || 0) * gramsMap[unit];
  const factor = grams / 100;
  const n = food.per100g || {};

  const calc = (v) => Math.round((v || 0) * factor * 10) / 10;

  const handleConfirm = async () => {
    setLogging(true);
    await onConfirm({ quantity: parseFloat(quantity), unit });
    setLogging(false);
    setQuantity("100");
    setUnit("g");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to Log">
      <div className="space-y-4">
        {/* Food info */}
        <div className="bg-white/3 rounded-xl p-3">
          <p className="font-semibold text-white">{food.name}</p>
          {food.brand && <p className="text-xs text-slate-400">{food.brand}</p>}
          <p className="text-xs text-indigo-400 mt-1">→ {mealLabel}</p>
        </div>

        {/* Quantity input */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Quantity</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0.1"
              step="0.1"
              className="flex-1 px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="px-3 py-3 rounded-xl bg-[#111827] border border-white/10 text-slate-300 focus:border-indigo-500 transition-all"
            >
              <option value="g">grams</option>
              <option value="oz">oz</option>
              <option value="serving">serving</option>
            </select>
          </div>
          {unit === "serving" && (
            <p className="text-xs text-slate-500 mt-1">1 serving = {food.servingSize || 100}g</p>
          )}
        </div>

        {/* Nutrition preview */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Calories", value: calc(n.calories), unit: "kcal", color: "text-indigo-400" },
            { label: "Protein", value: calc(n.protein), unit: "g", color: "text-cyan-400" },
            { label: "Carbs", value: calc(n.carbs), unit: "g", color: "text-amber-400" },
            { label: "Fats", value: calc(n.fats), unit: "g", color: "text-pink-400" },
          ].map((item) => (
            <div key={item.label} className="bg-white/3 rounded-xl p-2 text-center">
              <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-500">{item.unit}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleConfirm} loading={logging} className="flex-1">
            Add to {mealLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
