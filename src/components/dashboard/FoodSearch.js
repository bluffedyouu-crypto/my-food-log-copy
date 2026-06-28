import React, { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLog } from "../../context/LogContext";
import { useAuth } from "../../context/AuthContext";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { MEAL_LABEL_MAP, MEAL_SCHEDULES } from "../../constants/meals";
import client from "../../api/client";
import CustomFoodModal from "./CustomFoodModal"; // Added the missing import

// Flat label map for the meal selector pills
const MEAL_LABELS = MEAL_LABEL_MAP;

// ─── Local food search — hits our own MongoDB via /api/food/search ────────────
// Returns the raw API response so callers can render foods and bowls in two
// distinct sections. Bowls are search-matched against the user's own saved
// bowl names; foods come from the global Food database (plus the user's
// custom foods).
async function searchLocalFoods(query) {
  const { data } = await client.get(
    `/api/food/search?q=${encodeURIComponent(query)}&limit=20`
  );
  return {
    foods: data.foods || [],
    bowls: data.bowls || [],
  };
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
  const [bowlResults, setBowlResults]       = useState([]);
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
      setBowlResults([]);
      setHasSearched(false); // Reset search state if they clear the box
      return;
    }

    // Wait 300 ms after the user stops typing before firing the request
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { foods, bowls } = await searchLocalFoods(value.trim());
        setResults(foods);
        setBowlResults(bowls);
      } catch {
        setResults([]);
        setBowlResults([]);
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
  //
  // Two code paths depending on what the user selected:
  //
  //   • `type: "food"` — straight log into the daily diary as a single entry.
  //
  //   • `type: "bowl"` — fan out one log entry per ingredient (mirroring the
  //     CustomBowlsPanel "Log this bowl" flow). The QuantityModal returns a
  //     `servings` multiplier (e.g. 0.5, 1, 2 bowls) and we scale every
  //     ingredient's gram weight by that multiplier before logging. We tag
  //     each generated entry with `customBowlId` + `isFromCustomBowl: true`
  //     so the dashboard meal list can group them back together visually.
  const handleLogFood = async ({ quantity, unit, quantityInGrams, servings }) => {
    if (!selectedFood) return;

    if (selectedFood.type === "bowl" && selectedFood.bowl) {
      const multiplier = Math.max(0.01, Number(servings) || 1);
      const { _id: bowlId, ingredients } = selectedFood.bowl;

      // We deliberately await sequentially rather than Promise.all so the
      // dashboard's totals don't get computed mid-flight against a partial
      // entry set. The list is short (typical bowls have ≤ 8 ingredients).
      for (const ing of ingredients) {
        const ingGrams = (ing.quantityInGrams || 0) * multiplier;
        if (ingGrams <= 0) continue;
        // Reconstruct per100g for each ingredient from the stored snapshot
        // — bowl ingredients capture absolute nutrition at save time, so we
        // back-derive per100g for the log entry payload that the API
        // expects. Defaulting to 0 keeps the math safe even if a stored
        // nutrition field is missing.
        const g100 = ing.quantityInGrams > 0 ? (100 / ing.quantityInGrams) : 0;
        const per100g = {
          calories: (ing.nutrition?.calories ?? 0) * g100,
          protein:  (ing.nutrition?.protein  ?? 0) * g100,
          carbs:    (ing.nutrition?.carbs    ?? 0) * g100,
          fats:     (ing.nutrition?.fats     ?? 0) * g100,
          fiber:    (ing.nutrition?.fiber    ?? 0) * g100,
          sodium:   (ing.nutrition?.sodium   ?? 0) * g100,
        };

        await addEntry({
          name:             ing.name,
          brand:            ing.brand || undefined,
          mealCategory:     activeMeal,
          quantity:         +ingGrams.toFixed(1),
          unit:             "g",
          quantityInGrams:  +ingGrams.toFixed(1),
          per100g,
          servingSize:      100,
          date:             activeDate,
          customBowlId:     bowlId,
          isFromCustomBowl: true,
        });
      }
    } else {
      // Plain food — single entry, original behaviour.
      await addEntry({
        foodItemId:   selectedFood._id,
        name:         selectedFood.name,
        brand:        selectedFood.brand || undefined,
        mealCategory: activeMeal,
        quantity,
        unit,
        quantityInGrams,
        per100g:      selectedFood.per100g,
        servingSize:  selectedFood.servingSize || 100,
        date:         activeDate,
      });
    }

    setShowQuantityModal(false);
    setSelectedFood(null);
    onLogged?.();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
        `min-w-0 max-w-full overflow-hidden` on the FoodSearch outer card
        prevents any oversized result row from leaking horizontally up to
        the dashboard. Each individual scroll child below (the meal-pill
        row, the results list) still scrolls or truncates internally — but
        the card itself never gets wider than its grid/flex slot.
      */}
      <div className="glass rounded-2xl p-4 min-w-0 max-w-full overflow-hidden">

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
              onClick={() => { setQuery(""); setResults([]); setBowlResults([]); setHasSearched(false); }}
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

          {!searching && bowlResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 w-full min-w-0 max-w-full"
            >
              {/* Section header with purple glow accent so saved bowls are
                  clearly visually separated from generic food results. */}
              <div className="flex items-center gap-2 px-1 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    background: "linear-gradient(90deg, rgba(168,85,247,0.22), rgba(99,102,241,0.22))",
                    color: "#d8b4fe",
                    border: "1px solid rgba(168,85,247,0.35)",
                    textShadow: "0 0 8px rgba(168,85,247,0.6)",
                  }}
                >
                  <Icon name="utensils" size={11} />
                  My Bowls
                </span>
                <span className="text-[10px] text-slate-600">{bowlResults.length} match{bowlResults.length === 1 ? "" : "es"}</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {bowlResults.map((bowl, i) => {
                  const t = bowl.bowl?.totals || {};
                  return (
                    <motion.button
                      key={bowl._id || i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handleSelectFood(bowl)}
                      className="w-full max-w-full min-w-0 flex items-center justify-between p-3 rounded-xl text-left group transition-all"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(99,102,241,0.06))",
                        border: "1px solid rgba(168,85,247,0.28)",
                        boxShadow: "0 0 16px rgba(168,85,247,0.10)",
                      }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xl leading-none flex-shrink-0">{bowl.emoji || "🥣"}</span>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className="text-sm font-semibold text-white truncate text-glow-purple">
                            {bowl.name}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                            {bowl.bowl?.ingredients?.length || 0} ingredients · {Math.round(bowl.bowl?.totalGrams || 0)}g per bowl
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: "#d8b4fe" }}>
                            {Math.round(t.calories || 0)}
                          </p>
                          <p className="text-[10px] text-slate-500">kcal/bowl</p>
                        </div>
                        <svg
                          className="w-4 h-4 text-purple-400/70 group-hover:text-purple-300 transition-colors"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Subtle divider before food results */}
              {results.length > 0 && <div className="h-px bg-white/5 mt-3 mb-1" />}
            </motion.div>
          )}

          {!searching && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 space-y-1 max-h-64 overflow-y-auto w-full min-w-0 max-w-full"
            >
              {/* Foods section header — only shown when bowls are also present
                  so the two groups are clearly separated. */}
              {bowlResults.length > 0 && (
                <div className="flex items-center gap-2 px-1 mb-1 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Foods
                  </span>
                  <span className="text-[10px] text-slate-600">{results.length} match{results.length === 1 ? "" : "es"}</span>
                </div>
              )}

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
                    className="w-full max-w-full min-w-0 flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0 overflow-hidden">
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

                      {/*
                        Macro detail — visible on hover (pointer devices only).
                        The `[@media(hover:hover)]:` arbitrary variant gates
                        the reveal behind real pointer support, preventing
                        iOS Safari from latching :hover state on tap and
                        showing this row briefly before navigating — which
                        previously caused the layout jump that felt like
                        the UI "exploding".
                      */}
                      <div className="hidden [@media(hover:hover)]:group-hover:flex items-center gap-1 text-xs">
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

          {/* If searched, NOT searching currently, and NO results are found
              (foods AND bowls both empty), show the prompt */}
          {!searching && hasSearched && results.length === 0 && bowlResults.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-center py-8"
            >
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-slate-500"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Icon name="utensils" size={22} />
              </div>
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
  const [servings, setServings] = useState("1");   // bowl-mode: # of bowls
  const [logging, setLogging]   = useState(false);

  const isBowl = food?.type === "bowl";

  React.useEffect(() => {
    if (isOpen) {
      setQuantity("100");
      setUnit("g");
      setServings("1");
    }
  }, [isOpen, food]);

  if (!food) return null;

  // ── Bowl-mode preview math ────────────────────────────────────────────────
  // For bowls we don't pick a unit — we pick "how many bowls" (servings).
  // The displayed macros are the bowl's *absolute* totals scaled by the
  // servings multiplier, NOT a per-100g recalculation. This matches user
  // intent: "log 1 bowl" should mean exactly the totals shown in the bowl
  // builder.
  const bowlTotals    = food?.bowl?.totals || {};
  const bowlGrams     = food?.bowl?.totalGrams || 0;
  const servingsMult  = Math.max(0.01, parseFloat(servings) || 1);
  const bowlPreview   = (k) => +((bowlTotals[k] || 0) * servingsMult).toFixed(1);

  // ── Food-mode unit + math (unchanged) ─────────────────────────────────────
  const validQuantities = Object.entries(food.quantities || {})
    .filter(([_, val]) => val !== null && val !== undefined)
    .map(([key]) => key);

  const availableUnits = ["g", ...validQuantities];
  const safeUnit = availableUnits.includes(unit) ? unit : "g";

  let gramsPerUnit = 1;
  if (safeUnit === "g") {
    gramsPerUnit = 1;
  } else if (food.quantities && food.quantities[safeUnit]) {
    gramsPerUnit = 100 / food.quantities[safeUnit];
  }

  const grams = parseFloat(quantity || 0) * gramsPerUnit;
  const factor = grams / 100;

  const p = food.per100g || {};
  const calc = (v) => +(((v || 0) * factor).toFixed(1));

  const handleConfirm = async () => {
    setLogging(true);
    if (isBowl) {
      // Bowl: caller fans out per-ingredient entries — we just hand back
      // the servings multiplier. quantity/unit/grams are ignored.
      await onConfirm({ servings: servingsMult });
    } else {
      await onConfirm({
        quantity: parseFloat(quantity),
        unit:     safeUnit,
        quantityInGrams: grams,
      });
    }
    setLogging(false);
    setQuantity("100");
    setUnit("g");
    setServings("1");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isBowl ? "Log Bowl" : "Add to Log"}>
      <div className="space-y-4">

        {/* Header — visually distinct for bowls so users can tell at a glance */}
        <div
          className="rounded-xl p-3"
          style={
            isBowl
              ? {
                  background:
                    "linear-gradient(135deg, rgba(168,85,247,0.10), rgba(99,102,241,0.08))",
                  border: "1px solid rgba(168,85,247,0.30)",
                  boxShadow: "0 0 14px rgba(168,85,247,0.15)",
                }
              : { background: "rgba(255,255,255,0.03)" }
          }
        >
          <div className="flex items-center gap-2">
            {isBowl && <span className="text-2xl leading-none">{food.emoji || "🥣"}</span>}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white truncate">{food.name}</p>
              <p className={`text-xs mt-1 ${isBowl ? "text-purple-300" : "text-indigo-400"}`}>
                {isBowl && (
                  <span className="inline-block mr-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: "rgba(168,85,247,0.18)",
                      border:     "1px solid rgba(168,85,247,0.40)",
                      color:      "#d8b4fe",
                    }}
                  >Bowl</span>
                )}
                → {mealLabel}
              </p>
            </div>
          </div>
          {isBowl && (
            <p className="text-[11px] text-slate-500 mt-2">
              {food.bowl?.ingredients?.length || 0} ingredients · {Math.round(bowlGrams)}g per bowl ·{" "}
              logged as individual ingredients
            </p>
          )}
        </div>

        {/* Quantity / Servings input */}
        {isBowl ? (
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Bowls</label>
            <div className="flex gap-2 items-center">
              {/* Quick presets — minus / plus around an editable input */}
              <button
                type="button"
                onClick={() => setServings((s) => Math.max(0.25, +(parseFloat(s || 1) - 0.5).toFixed(2)).toString())}
                className="w-12 h-12 rounded-xl bg-[#111827] border border-white/10 text-white text-xl font-bold hover:border-purple-500/50 transition-all"
                aria-label="Fewer bowls"
              >−</button>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                min="0.25"
                step="0.25"
                inputMode="decimal"
                style={{ fontSize: "16px" }}
                className="flex-1 px-4 py-3 rounded-xl text-base bg-[#111827] border border-purple-500/30 text-white text-center focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setServings((s) => +(parseFloat(s || 0) + 0.5).toFixed(2).toString())}
                className="w-12 h-12 rounded-xl bg-[#111827] border border-white/10 text-white text-xl font-bold hover:border-purple-500/50 transition-all"
                aria-label="More bowls"
              >+</button>
            </div>
            <p className="text-[11px] text-slate-600 mt-1.5">
              ≈ {Math.round(bowlGrams * servingsMult)}g total
            </p>
          </div>
        ) : (
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
        )}

        {/* Macro preview */}
        <div className="grid grid-cols-4 gap-2">
          {(isBowl
            ? [
                { label: "Calories", value: bowlPreview("calories"), unit: "kcal", color: "text-indigo-400" },
                { label: "Protein",  value: bowlPreview("protein"),  unit: "g",    color: "text-cyan-400"   },
                { label: "Carbs",    value: bowlPreview("carbs"),    unit: "g",    color: "text-amber-400"  },
                { label: "Fats",     value: bowlPreview("fats"),     unit: "g",    color: "text-pink-400"   },
              ]
            : [
                { label: "Calories", value: calc(p.calories), unit: "kcal", color: "text-indigo-400" },
                { label: "Protein",  value: calc(p.protein),  unit: "g",    color: "text-cyan-400"   },
                { label: "Carbs",    value: calc(p.carbs),    unit: "g",    color: "text-amber-400"  },
                { label: "Fats",     value: calc(p.fats),     unit: "g",    color: "text-pink-400"   },
              ]
          ).map((item) => (
            <div key={item.label} className="rounded-xl p-2 text-center"
              style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-500">{item.unit}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Bowl-mode ingredient breakdown */}
        {isBowl && food.bowl?.ingredients?.length > 0 && (
          <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Ingredients (per bowl)</p>
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
              {food.bowl.ingredients.map((ing, i) => (
                <div key={i} className="flex justify-between text-[11px] text-slate-400">
                  <span className="truncate flex-1 pr-2">{ing.name}</span>
                  <span className="text-slate-600 flex-shrink-0">
                    {Math.round((ing.quantityInGrams || 0) * servingsMult)}g
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extended micros — food-mode only */}
        {!isBowl && (p.fiber > 0 || p.sodium > 0 || p.sugar > 0) && (
          <div className="flex gap-3 text-xs text-slate-500 px-1">
            {p.fiber  > 0 && <span>Fiber: <span className="text-emerald-400">{calc(p.fiber)}g</span></span>}
            {p.sugar  > 0 && <span>Sugar: <span className="text-pink-400">{calc(p.sugar)}g</span></span>}
            {p.sodium > 0 && <span>Sodium: <span className="text-orange-400">{calc(p.sodium)}mg</span></span>}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleConfirm} loading={logging} className="flex-1">
            {isBowl
              ? `Log ${servingsMult === 1 ? "Bowl" : `${servingsMult} Bowls`}`
              : `Add to ${mealLabel}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}