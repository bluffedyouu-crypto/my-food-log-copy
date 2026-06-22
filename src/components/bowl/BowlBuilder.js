import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { foodApi, bowlsApi } from "../../api/client";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

// ─── Draggable Food Item ──────────────────────────────────────────────────────
function DraggableFoodItem({ food, index, isMobile, onAdd }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `food-${food.fdcId || food.openFoodFactsId || index}`,
    data: { food },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <motion.div
      ref={!isMobile ? setNodeRef : null}
      style={!isMobile ? style : undefined}
      {...(!isMobile ? listeners : {})}
      {...(!isMobile ? attributes : {})}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`
        flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 select-none
        ${!isMobile ? "cursor-grab active:cursor-grabbing" : ""}
        ${isDragging
          ? "border-indigo-500/50 bg-indigo-500/10"
          : "border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5"
        }
      `}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{food.name}</p>
        {food.brand && <p className="text-xs text-slate-500 truncate">{food.brand}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-semibold text-indigo-400">{food.per100g?.calories || 0}</p>
        <p className="text-xs text-slate-500">kcal/100g</p>
      </div>
      {isMobile ? (
        <button
          onClick={() => onAdd(food)}
          className="ml-2 w-8 h-8 flex items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 flex-shrink-0 active:bg-indigo-500/30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      ) : (
        <svg className="w-4 h-4 text-slate-600 flex-shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      )}
    </motion.div>
  );
}

// ─── Bowl Drop Zone ───────────────────────────────────────────────────────────
function BowlDropZone({ ingredients, isOver, children }) {
  const { setNodeRef } = useDroppable({ id: "bowl-drop-zone" });

  return (
    <div
      ref={setNodeRef}
      className={`
        relative w-full aspect-square max-w-sm mx-auto rounded-full
        border-4 transition-all duration-300
        flex flex-col items-center justify-center
        ${isOver
          ? "border-indigo-500 bg-indigo-500/10 shadow-2xl shadow-indigo-500/30 scale-105"
          : ingredients.length > 0
            ? "border-indigo-500/40 bg-gradient-to-br from-indigo-500/5 to-purple-500/5"
            : "border-white/15 border-dashed bg-white/2"
        }
      `}
      style={{ transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
    >
      {children}
    </div>
  );
}

// ─── Main Bowl Builder ────────────────────────────────────────────────────────
export default function BowlBuilder() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [activeFood, setActiveFood] = useState(null);
  const [isOver, setIsOver] = useState(false);
  const [quantityModal, setQuantityModal] = useState(null);
  const [saveModal, setSaveModal] = useState(false);
  const [bowlName, setBowlName] = useState("");
  const [bowlEmoji, setBowlEmoji] = useState("🥣");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef(null);

  // Mobile detection for swapping drag layout with tap layout
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024); // lg breakpoint is 1024px

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleSearch = useCallback((value) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setSearchResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await foodApi.search(value);
        setSearchResults(data.foods || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleDragStart = ({ active }) => {
    if (isMobile) return;
    setActiveFood(active.data.current?.food || null);
  };

  const handleDragOver = ({ over }) => {
    if (isMobile) return;
    setIsOver(over?.id === "bowl-drop-zone");
  };

  const handleDragEnd = ({ active, over }) => {
    if (isMobile) return;
    setIsOver(false);
    setActiveFood(null);
    if (over?.id === "bowl-drop-zone") {
      const food = active.data.current?.food;
      if (food) setQuantityModal(food);
    }
  };

  const handleMobileAdd = (food) => {
    setQuantityModal(food);
  };

  const handleAddQuantity = ({ quantity, unit, quantityInGrams }) => {
    if (!quantityModal) return;
    const n = quantityModal.per100g || {};
    const factor = quantityInGrams / 100;
    const nutrition = {
      calories: +(n.calories * factor).toFixed(1),
      protein: +(n.protein * factor).toFixed(1),
      carbs: +(n.carbs * factor).toFixed(1),
      fats: +(n.fats * factor).toFixed(1),
      fiber: +((n.fiber || 0) * factor).toFixed(1),
      sodium: +((n.sodium || 0) * factor).toFixed(1),
    };

    setIngredients((prev) => [
      ...prev,
      {
        id: Date.now(),
        food: quantityModal,
        quantity,
        unit,
        quantityInGrams,
        nutrition,
        name: quantityModal.name,
        brand: quantityModal.brand,
        fdcId: quantityModal.fdcId,
        per100g: quantityModal.per100g,
        servingSize: quantityModal.servingSize,
      },
    ]);
    setQuantityModal(null);
  };

  const removeIngredient = (id) => {
    setIngredients((prev) => prev.filter((i) => i.id !== id));
  };

  const totals = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.nutrition.calories || 0),
      protein: acc.protein + (ing.nutrition.protein || 0),
      carbs: acc.carbs + (ing.nutrition.carbs || 0),
      fats: acc.fats + (ing.nutrition.fats || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const handleSave = async () => {
    if (!bowlName.trim() || ingredients.length === 0) return;
    setSaving(true);
    try {
      await bowlsApi.create({
        name: bowlName,
        emoji: bowlEmoji,
        ingredients: ingredients.map((ing) => ({
          foodItemId: ing.food._id,
          fdcId: ing.fdcId,
          name: ing.name,
          brand: ing.brand,
          quantity: ing.quantity,
          unit: ing.unit,
          quantityInGrams: ing.quantityInGrams,  // needed for non-standard units
          per100g: ing.per100g,
          servingSize: ing.servingSize,
        })),
      });
      setSaved(true);
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err) {
      console.error("Failed to save bowl:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold text-white">Custom Bowl Builder</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isMobile ? "Search and add ingredients to your bowl" : "Drag ingredients from the sidebar into your bowl"}
          </p>
        </motion.div>

        {/* Change layout from 3 cols on desktop to stacked on mobile */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
          {/* ── Sidebar: Food Search ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1 space-y-4"
          >
            <div className="glass rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Food Library</h2>

              {/* Search */}
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search ingredients..."
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {/* Results */}
              <div className="space-y-2 max-h-[calc(100vh-300px)] lg:max-h-[calc(100vh-300px)] overflow-y-auto">
                {searching && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!searching && searchResults.map((food, i) => (
                  <DraggableFoodItem key={food.fdcId || i} food={food} index={i} isMobile={isMobile} onAdd={handleMobileAdd} />
                ))}
                {!searching && query.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-4">No results found</p>
                )}
                {!query && (
                  <p className="text-center text-slate-600 text-xs py-6">
                    {isMobile ? "Search for ingredients to add" : "Search for ingredients to drag into your bowl"}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Center: Bowl ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-1 flex flex-col items-center gap-4"
          >
            <BowlDropZone ingredients={ingredients} isOver={isOver}>
              {ingredients.length === 0 ? (
                <div className="text-center px-8">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    className="text-5xl mb-3"
                  >
                    🥣
                  </motion.div>
                  <p className="text-slate-400 text-sm font-medium">Drop ingredients here</p>
                  <p className="text-slate-600 text-xs mt-1">Drag from the sidebar</p>
                </div>
              ) : (
                <FloatingIngredientNames ingredients={ingredients} />
              )}

              {/* Drop indicator */}
              {isOver && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-full border-4 border-indigo-500 pointer-events-none"
                  style={{ boxShadow: "0 0 40px rgba(99, 102, 241, 0.5)" }}
                />
              )}
            </BowlDropZone>

            {/* Totals */}
            {ingredients.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full glass rounded-2xl p-4"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Bowl Nutrition</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Calories", value: Math.round(totals.calories), unit: "kcal", color: "text-indigo-400" },
                    { label: "Protein", value: Math.round(totals.protein), unit: "g", color: "text-cyan-400" },
                    { label: "Carbs", value: Math.round(totals.carbs), unit: "g", color: "text-amber-400" },
                    { label: "Fats", value: Math.round(totals.fats), unit: "g", color: "text-pink-400" },
                  ].map((item) => (
                    <div key={item.label} className="text-center">
                      <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                      <p className="text-xs text-slate-500">{item.unit}</p>
                      <p className="text-xs text-slate-400">{item.label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Save button */}
            {ingredients.length > 0 && (
              <Button
                onClick={() => setSaveModal(true)}
                size="lg"
                className="w-full"
              >
                💾 Save This Bowl
              </Button>
            )}
          </motion.div>

          {/* ── Right: Ingredient List ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="glass rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">
                Ingredients ({ingredients.length})
              </h2>

              {ingredients.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-8">
                  Your bowl is empty
                </p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {ingredients.map((ing) => (
                      <motion.div
                        key={ing.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8 group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{ing.name}</p>
                          <p className="text-xs text-slate-500">
                            {ing.quantity}{ing.unit} · {Math.round(ing.nutrition.calories)} kcal
                          </p>
                          <div className="flex gap-2 text-xs mt-0.5">
                            <span className="text-cyan-400">P:{Math.round(ing.nutrition.protein)}g</span>
                            <span className="text-amber-400">C:{Math.round(ing.nutrition.carbs)}g</span>
                            <span className="text-pink-400">F:{Math.round(ing.nutrition.fats)}g</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeIngredient(ing.id)}
                          className={`${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"} p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeFood && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-indigo-500 bg-[#111827] shadow-2xl shadow-indigo-500/30 opacity-90 w-64">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{activeFood.name}</p>
            </div>
            <p className="text-xs font-semibold text-indigo-400">{activeFood.per100g?.calories || 0} kcal</p>
          </div>
        )}
      </DragOverlay>

      {/* Quantity Modal */}
      <QuantityModal
        isOpen={!!quantityModal}
        food={quantityModal}
        onClose={() => setQuantityModal(null)}
        onConfirm={handleAddQuantity}
      />

      {/* Save Modal */}
      <Modal isOpen={saveModal} onClose={() => setSaveModal(false)} title="Save Your Bowl">
        <div className="space-y-4">
          {saved ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-6"
            >
              <div className="text-5xl mb-3">✅</div>
              <p className="text-white font-semibold">Bowl saved!</p>
              <p className="text-slate-400 text-sm">Redirecting to dashboard...</p>
            </motion.div>
          ) : (
            <>
              <div className="flex gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Emoji</label>
                  <input
                    type="text"
                    value={bowlEmoji}
                    onChange={(e) => setBowlEmoji(e.target.value)}
                    maxLength={2}
                    className="w-16 px-3 py-3 rounded-xl bg-[#111827] border border-white/10 text-white text-center text-xl focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Bowl Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Post-Workout Chicken Bowl"
                    value={bowlName}
                    onChange={(e) => setBowlName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="bg-white/3 rounded-xl p-3">
                <p className="text-xs text-slate-500 mb-2">{ingredients.length} ingredients · {Math.round(totals.calories)} kcal total</p>
                <div className="flex gap-3 text-sm">
                  <span className="text-cyan-400">P: {Math.round(totals.protein)}g</span>
                  <span className="text-amber-400">C: {Math.round(totals.carbs)}g</span>
                  <span className="text-pink-400">F: {Math.round(totals.fats)}g</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setSaveModal(false)} className="flex-1">Cancel</Button>
                <Button
                  onClick={handleSave}
                  loading={saving}
                  disabled={!bowlName.trim()}
                  className="flex-1"
                >
                  Save Bowl
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </DndContext>
  );
}

// ─── Floating ingredient names inside the bowl circle ────────────────────────
/**
 * Displays the FULL name of each ingredient floating inside the circle.
 *
 * Boundary constraint: positions are expressed as % offsets from center.
 * The circle radius is 50% of the container. Each label is given a fixed
 * max-width so it cannot overflow the circle boundary. Text that is too
 * long is truncated with an ellipsis via CSS.
 *
 * Overlap handling: items are placed on a deterministic spiral so they
 * spread evenly. With many items the font shrinks slightly.
 */
function FloatingIngredientNames({ ingredients }) {
  // Spiral positions — (x, y) as % of container width/height from center.
  // Kept well inside the circle (max ~32% from center so labels stay inside
  // the ~50% radius boundary even accounting for label width).
  const positions = [
    { x:  0,   y: -30 },
    { x:  22,  y: -16 },
    { x:  26,  y:  12 },
    { x:  4,   y:  28 },
    { x: -22,  y:  18 },
    { x: -28,  y:  -8 },
    { x: -12,  y: -28 },
    { x:  16,  y: -26 },
    { x:  28,  y:   2 },
    { x:   8,  y:  26 },
    { x: -18,  y:  26 },
    { x: -26,  y:   8 },
  ];

  const colours = ["#818cf8", "#22d3ee", "#f59e0b", "#f472b6", "#a78bfa", "#34d399"];

  // Shrink font slightly when there are many items
  const fontSize = ingredients.length > 6 ? "0.6rem" : "0.68rem";

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full">
      {/* Bowl emoji anchor */}
      <span className="text-3xl select-none z-10 pointer-events-none">🥣</span>

      {ingredients.slice(0, 12).map((ing, i) => {
        const pos        = positions[i % positions.length];
        const color      = colours[i % colours.length];
        const floatDelay = (i * 0.4) % 2;

        return (
          <motion.div
            key={ing.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
            transition={{
              opacity: { duration: 0.35, delay: i * 0.07 },
              scale:   { duration: 0.35, delay: i * 0.07, type: "spring", stiffness: 260 },
              y: { duration: 2.8, delay: floatDelay, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute pointer-events-none select-none"
            style={{
              left:      `calc(50% + ${pos.x}%)`,
              top:       `calc(50% + ${pos.y}%)`,
              transform: "translate(-50%, -50%)",
              // Max width keeps the label inside the circle boundary
              maxWidth:  "28%",
            }}
          >
            <span
              style={{
                display:      "block",
                color,
                fontSize,
                fontWeight:   700,
                lineHeight:   1.2,
                textShadow:   `0 0 10px ${color}80`,
                // Ellipsis for long names
                whiteSpace:   "nowrap",
                overflow:     "hidden",
                textOverflow: "ellipsis",
                maxWidth:     "100%",
              }}
            >
              {ing.name}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Quantity Modal ───────────────────────────────────────────────────────────
function QuantityModal({ isOpen, food, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");

  // Reset to defaults whenever a new food is opened
  React.useEffect(() => {
    if (isOpen) {
      setQuantity("100");
      setUnit("g");
    }
  }, [isOpen, food]);

  if (!food) return null;

  // ── Dynamic units from the database quantities map ─────────────────────────
  // food.quantities is e.g. { "katori": 150, "cup": 200, "tbsp": 15 }
  // We filter out null/undefined values just like FoodSearch does.
  const validQuantities = Object.entries(food.quantities || {})
    .filter(([, val]) => val !== null && val !== undefined)
    .map(([key]) => key);

  const availableUnits = ["g", ...validQuantities];
  const safeUnit = availableUnits.includes(unit) ? unit : "g";

  // Conversion: for "g" → 1 g per unit; for DB quantities → 100g / quantityValue
  let gramsPerUnit = 1;
  if (safeUnit !== "g" && food.quantities?.[safeUnit]) {
    // DB quantities[key] stores the number of grams that 1 unit represents
    // (same convention the food search uses: 100 / quantities[key] = g per 1 unit)
    gramsPerUnit = 100 / food.quantities[safeUnit];
  }

  const grams  = parseFloat(quantity || 0) * gramsPerUnit;
  const factor = grams / 100;
  const n      = food.per100g || {};
  const calc   = (v) => +(((v || 0) * factor).toFixed(1));

  const handleConfirm = () => {
    onConfirm({ quantity: parseFloat(quantity), unit: safeUnit, quantityInGrams: grams });
    setQuantity("100");
    setUnit("g");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Quantity">
      <div className="space-y-4">
        <div className="bg-white/3 rounded-xl p-3">
          <p className="font-semibold text-white">{food.name}</p>
          {food.brand && <p className="text-xs text-slate-400">{food.brand}</p>}
        </div>

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
            value={safeUnit}
            onChange={(e) => {
              const newUnit = e.target.value;
              setUnit(newUnit);
              // Reset quantity to a sensible default for the chosen unit
              setQuantity(newUnit === "g" ? "100" : "1");
            }}
            className="px-3 py-3 rounded-xl bg-[#111827] border border-white/10 text-slate-300 focus:border-indigo-500 transition-all"
          >
            {availableUnits.map((u) => (
              <option key={u} value={u}>
                {u === "g" ? "grams" : u}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Calories", value: calc(n.calories), color: "text-indigo-400" },
            { label: "Protein",  value: calc(n.protein),  color: "text-cyan-400"   },
            { label: "Carbs",    value: calc(n.carbs),    color: "text-amber-400"  },
            { label: "Fats",     value: calc(n.fats),     color: "text-pink-400"   },
          ].map((item) => (
            <div key={item.label} className="bg-white/3 rounded-xl p-2 text-center">
              <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Extended micros if available */}
        {(n.fiber > 0 || n.sodium > 0 || n.sugar > 0) && (
          <div className="flex gap-3 text-xs text-slate-500 px-1">
            {n.fiber  > 0 && <span>Fiber: <span className="text-emerald-400">{calc(n.fiber)}g</span></span>}
            {n.sugar  > 0 && <span>Sugar: <span className="text-pink-400">{calc(n.sugar)}g</span></span>}
            {n.sodium > 0 && <span>Sodium: <span className="text-orange-400">{calc(n.sodium)}mg</span></span>}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleConfirm} className="flex-1">Add to Bowl</Button>
        </div>
      </div>
    </Modal>
  );
}
