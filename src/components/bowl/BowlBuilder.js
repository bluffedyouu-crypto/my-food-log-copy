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
function DraggableFoodItem({ food, index }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `food-${food.fdcId || food.openFoodFactsId || index}`,
    data: { food },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`
        flex items-center gap-3 p-3 rounded-xl border cursor-grab active:cursor-grabbing
        transition-all duration-150 select-none
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
      <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
      </svg>
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
    setActiveFood(active.data.current?.food || null);
  };

  const handleDragOver = ({ over }) => {
    setIsOver(over?.id === "bowl-drop-zone");
  };

  const handleDragEnd = ({ active, over }) => {
    setIsOver(false);
    setActiveFood(null);
    if (over?.id === "bowl-drop-zone") {
      const food = active.data.current?.food;
      if (food) setQuantityModal(food);
    }
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
            Drag ingredients from the sidebar into your bowl
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {searching && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!searching && searchResults.map((food, i) => (
                  <DraggableFoodItem key={food.fdcId || i} food={food} index={i} />
                ))}
                {!searching && query.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-slate-500 text-sm py-4">No results found</p>
                )}
                {!query && (
                  <p className="text-center text-slate-600 text-xs py-6">
                    Search for ingredients to drag into your bowl
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
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
 * Takes the first word of each ingredient name and places them at
 * pseudo-random positions inside the circle using deterministic offsets
 * derived from the ingredient's index. Each word gently floats up/down
 * with a staggered Framer Motion animation.
 */
function FloatingIngredientNames({ ingredients }) {
  // Pre-computed positions (% from center) for up to 12 items.
  // Using a sunflower/spiral pattern so items spread naturally.
  const positions = [
    { x:  0,   y: -28 },
    { x:  24,  y: -12 },
    { x:  28,  y:  16 },
    { x:  6,   y:  30 },
    { x: -24,  y:  20 },
    { x: -30,  y: -6  },
    { x: -14,  y: -26 },
    { x:  18,  y: -24 },
    { x:  32,  y:  4  },
    { x:  10,  y:  28 },
    { x: -20,  y:  28 },
    { x: -28,  y:  10 },
  ];

  // Colour palette cycling through macro colours
  const colours = ["#818cf8", "#22d3ee", "#f59e0b", "#f472b6", "#a78bfa", "#34d399"];

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Bowl emoji anchor */}
      <span className="text-3xl select-none z-10">🥣</span>

      {ingredients.slice(0, 12).map((ing, i) => {
        const pos   = positions[i % positions.length];
        const color = colours[i % colours.length];
        const firstName = ing.name.split(" ")[0];
        // Stagger the float phase so items don't all move together
        const floatDelay = (i * 0.4) % 2;

        return (
          <motion.span
            key={ing.id}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -6, 0],
            }}
            transition={{
              opacity: { duration: 0.35, delay: i * 0.07 },
              scale:   { duration: 0.35, delay: i * 0.07, type: "spring", stiffness: 260 },
              y: {
                duration: 2.8,
                delay: floatDelay,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            className="absolute text-xs font-bold select-none pointer-events-none"
            style={{
              color,
              left:       `calc(50% + ${pos.x}%)`,
              top:        `calc(50% + ${pos.y}%)`,
              transform:  "translate(-50%, -50%)",
              textShadow: `0 0 12px ${color}80`,
              whiteSpace: "nowrap",
              fontSize:   "0.7rem",
            }}
          >
            {firstName}
          </motion.span>
        );
      })}
    </div>
  );
}

// ─── Quantity Modal ───────────────────────────────────────────────────────────
function QuantityModal({ isOpen, food, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");

  if (!food) return null;

  const gramsMap = { g: 1, oz: 28.3495, serving: food.servingSize || 100 };
  const grams = parseFloat(quantity || 0) * gramsMap[unit];
  const factor = grams / 100;
  const n = food.per100g || {};
  const calc = (v) => Math.round((v || 0) * factor * 10) / 10;

  const handleConfirm = () => {
    onConfirm({ quantity: parseFloat(quantity), unit, quantityInGrams: grams });
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
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="px-3 py-3 rounded-xl bg-[#111827] border border-white/10 text-slate-300 focus:border-indigo-500 transition-all"
          >
            <option value="g">grams</option>
            <option value="oz">oz</option>
            <option value="serving">serving</option>
          </select>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Calories", value: calc(n.calories), color: "text-indigo-400" },
            { label: "Protein", value: calc(n.protein), color: "text-cyan-400" },
            { label: "Carbs", value: calc(n.carbs), color: "text-amber-400" },
            { label: "Fats", value: calc(n.fats), color: "text-pink-400" },
          ].map((item) => (
            <div key={item.label} className="bg-white/3 rounded-xl p-2 text-center">
              <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleConfirm} className="flex-1">Add to Bowl</Button>
        </div>
      </div>
    </Modal>
  );
}
