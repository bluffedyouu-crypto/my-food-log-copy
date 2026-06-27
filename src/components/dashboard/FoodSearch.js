import React, { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLog } from "../../context/LogContext";
import { useAuth } from "../../context/AuthContext";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { MEAL_LABEL_MAP, MEAL_SCHEDULES } from "../../constants/meals";
import client from "../../api/client";
import CustomFoodModal from "./CustomFoodModal"; // Added the missing import

// Flat label map for the meal selector pills
const MEAL_LABELS = MEAL_LABEL_MAP;

// ─── Local food search — hits our own MongoDB via /api/food/search ────────────
async function searchLocalFoods(query) {
  const { data } = await client.get(
    `/api/food/search?q=${encodeURIComponent(query)}&limit=20`
  );
  return data.foods || [];
}

// ─── FoodSearch ───────────────────────────────────────────────────────────────
export default function FoodSearch({ selectedMeal, onClose, onLogged, activeDate }) {
  const { addEntry } = useLog();
  const { appUser } = useAuth();

  // Resolve the user's actual meal schedule so the pill row matches the
  // "Today's Meals" list below (3–6 entries) instead of showing all 8 labels.
  const mealFrequency = appUser?.profile?.mealFrequency || 3;
  const userMealKeys  = useMemo(
    () => MEAL_SCHEDULES[mealFrequency] || MEAL_SCHEDULES[3],
    [mealFrequency]
  );

  const [query, setQuery]                   = useState("");
  const [results, setResults]               = useState([]);
  const [searching, setSearching]           = useState(false);
  const [selectedFood, setSelectedFood]     = useState(null);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  // Default to the meal the user tapped, or fall back to the first meal in their schedule.
  const [activeMeal, setActiveMeal]         = useState(
    selectedMeal && userMealKeys.includes(selectedMeal)
      ? selectedMeal
      : userMealKeys[0]
  );
  
  // Added the missing hasSearched state
  const [hasSearched, setHasSearched]       = useState(false); 
  const [showCustomModal, setShowCustomModal] = useState(false);

  // 300 ms debounce ref
  const debounceRef = useRef(null);

  // ── Search handler ──────────────────────────────────────────────────────────
  const handleSearch = useCallback((value) => {
    setQuery(value);
    clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setHasSearched(false); // Reset search state if they clear the box
      return;
    }

    // Wait 300 ms after the user stops typing before firing the request
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const foods = await searchLocalFoods(value.trim());
        setResults(foods);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
        setHasSearched(true); // Flag that a search just completed
      }
    }, 300);
  }, []);

  // ── Select a result ─────────────────────────────────────────────────────────
  const handleSelectFood = (food) => {
    setSelectedFood(food);
    setShowQuantityModal(true);
  };

  // ── Confirm quantity and log ────────────────────────────────────────────────
  const handleLogFood = async ({ quantity, unit, quantityInGrams }) => {
    if (!selectedFood) return;

    // per100g is already normalised by the backend's normaliseFoodDoc()
    await addEntry({
      foodItemId:  selectedFood._id,
      name:        selectedFood.name,
      brand:       selectedFood.brand || undefined,
      mealCategory: activeMeal,
      quantity,
      unit,
      quantityInGrams,
      per100g:     selectedFood.per100g,
      servingSize: selectedFood.servingSize || 100,
      date:        activeDate,  // pass the selected date so past-day logging works
    });

    setShowQuantityModal(false);
    setSelectedFood(null);
    onLogged?.();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="glass rounded-2xl p-4">

        {/* Meal selector pills — limited to the meals in the user's schedule */}
        <div
          className="flex gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1"
          style={{ scrollbarWidth: "none" }}
        >
          {userMealKeys.map((key) => {
            const label = MEAL_LABELS[key];
            const isActive = activeMeal === key;
            return (
              <button
                key={key}
                onClick={() => setActiveMeal(key)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[36px] ${
                  isActive
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            autoFocus
            type="text"
            placeholder={`Search food to add to ${MEAL_LABELS[activeMeal]}…`}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            // Explicit 16px font-size prevents iOS Safari from auto-zooming the
            // viewport on focus. Belt-and-suspenders with the global CSS rule.
            style={{ fontSize: "16px" }}
            className="w-full pl-10 pr-10 py-3 rounded-xl text-base bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setResults([]); setHasSearched(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results list */}
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
              {results.map((food, i) => {
                // per100g is the normalised flat object from normaliseFoodDoc()
                const p = food.per100g || {};

                return (
                  <motion.button
                    key={food._id || food.id || i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    onClick={() => handleSelectFood(food)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{food.name}</p>
                    </div>

                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      {/* Calorie badge — always visible */}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-indigo-400">
                          {Math.round(p.calories || 0)}
                        </p>
                        <p className="text-xs text-slate-500">kcal/100g</p>
                      </div>

                      {/* Macro detail — visible on hover */}
                      <div className="hidden group-hover:flex items-center gap-1 text-xs">
                        <span className="text-cyan-400">
                          P:{Math.round(p.protein || 0)}g
                        </span>
                        <span className="text-amber-400">
                          C:{Math.round(p.carbs || 0)}g
                        </span>
                        <span className="text-pink-400">
                          F:{Math.round(p.fats || 0)}g
                        </span>
                      </div>

                      <svg
                        className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          )}

          {/* If searched, NOT searching currently, and NO results are found, show the prompt */}
          {!searching && hasSearched && results.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-center py-8"
            >
              <div className="text-4xl mb-3">🍽️</div>
              <p className="text-slate-400 text-sm mb-4">We couldn't find "{query}" in our database.</p>
              <button 
                onClick={() => setShowCustomModal(true)}
                className="px-6 py-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-sm font-semibold hover:bg-indigo-500/30 transition-all"
              >
                + Add Your Own Food
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Close */}
        <div className="flex justify-end mt-3">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Close search
          </button>
        </div>
      </div>

      {/* Render the Custom Food Modal if triggered */}
      <AnimatePresence>
        {showCustomModal && (
          <CustomFoodModal 
            onClose={() => setShowCustomModal(false)}
            onSaved={(normalizedFood) => {
              setShowCustomModal(false);
              
              // Select it automatically so they can log it instantly!
              setResults([normalizedFood]); 
              setHasSearched(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Quantity + nutrition preview modal */}
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

// ─── Quantity Modal ───────────────────────────────────────────────────────────
function QuantityModal({ isOpen, food, onClose, onConfirm, mealLabel }) {
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit]         = useState("g");
  const [logging, setLogging]   = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setQuantity("100");
      setUnit("g");
    }
  }, [isOpen, food]);

  if (!food) return null;

  // Dynamic available units
  const validQuantities = Object.entries(food.quantities || {})
    .filter(([_, val]) => val !== null && val !== undefined)
    .map(([key]) => key);

  const availableUnits = ["g", ...validQuantities];
  const safeUnit = availableUnits.includes(unit) ? unit : "g";

  // Conversion logic
  let gramsPerUnit = 1;
  if (safeUnit === "g") {
    gramsPerUnit = 1;
  } else if (food.quantities && food.quantities[safeUnit]) {
    gramsPerUnit = 100 / food.quantities[safeUnit];
  }

  const grams = parseFloat(quantity || 0) * gramsPerUnit;
  const factor = grams / 100;

  // per100g is the normalised flat object — read directly
  const p = food.per100g || {};

  const calc = (v) => +(((v || 0) * factor).toFixed(1));

  const handleConfirm = async () => {
    setLogging(true);
    await onConfirm({ quantity: parseFloat(quantity), unit: safeUnit, quantityInGrams: grams });
    setLogging(false);
    setQuantity("100");
    setUnit("g");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to Log">
      <div className="space-y-4">

        {/* Food name */}
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p className="font-semibold text-white">{food.name}</p>
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
              style={{ fontSize: "16px" }}
              className="flex-1 px-4 py-3 rounded-xl text-base bg-[#111827] border border-white/10 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <select
              value={safeUnit}
              onChange={(e) => {
                const newUnit = e.target.value;
                setUnit(newUnit);
                if (newUnit === "g") {
                  setQuantity("100");
                } else {
                  setQuantity("1");
                }
              }}
              style={{ fontSize: "16px" }}
              className="px-3 py-3 rounded-xl text-base bg-[#111827] border border-white/10 text-slate-300 focus:border-indigo-500 transition-all"
            >
              {availableUnits.map((u) => (
                <option key={u} value={u}>
                  {u === "g" ? "grams" : u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Macro preview — reads from normalised per100g */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Calories", value: calc(p.calories), unit: "kcal", color: "text-indigo-400" },
            { label: "Protein",  value: calc(p.protein),  unit: "g",    color: "text-cyan-400"   },
            { label: "Carbs",    value: calc(p.carbs),    unit: "g",    color: "text-amber-400"  },
            { label: "Fats",     value: calc(p.fats),     unit: "g",    color: "text-pink-400"   },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-2 text-center"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-500">{item.unit}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Extended micros — shown if data exists */}
        {(p.fiber > 0 || p.sodium > 0 || p.sugar > 0) && (
          <div className="flex gap-3 text-xs text-slate-500 px-1">
            {p.fiber  > 0 && <span>Fiber: <span className="text-emerald-400">{calc(p.fiber)}g</span></span>}
            {p.sugar  > 0 && <span>Sugar: <span className="text-pink-400">{calc(p.sugar)}g</span></span>}
            {p.sodium > 0 && <span>Sodium: <span className="text-orange-400">{calc(p.sodium)}mg</span></span>}
          </div>
        )}

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