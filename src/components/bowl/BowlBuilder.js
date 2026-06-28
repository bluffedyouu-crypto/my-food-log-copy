import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "react-router-dom";
import { foodApi, bowlsApi } from "../../api/client";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

/**
 * BowlBuilder — completely revamped with two distinct UX paths:
 *
 *   • Desktop (≥ lg / 1024px): 3-column drag-and-drop layout. Search the
 *     food library in the left column, drag results into the glowing bowl
 *     in the center, and see the ingredient list build up on the right.
 *
 *   • Mobile (< lg): no drag-drop (terrible UX on a tiny touch screen with
 *     a virtual keyboard in play). Instead, a single vertical flow with a
 *     hero bowl card at top, a search box that returns tap-to-add cards
 *     directly under it, and a collapsible bottom drawer for the
 *     ingredient list. The "Save Bowl" CTA floats at the bottom so it's
 *     always reachable.
 *
 * Both layouts share the same state, save flow, and quantity modal — only
 * the layout shell and interaction model differ. They live in this file as
 * two child components to keep the data flow obvious.
 *
 * Glow strategy: every "active" surface in this view pulses or has a
 * gradient halo. The classes come from src/index.css (.glow-indigo,
 * .glow-purple, .glow-pulse, .glow-pulse-purple) so visual weights are
 * consistent across the rest of the app.
 */

// ─── Shared hooks / helpers ─────────────────────────────────────────────────

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

function totalsOf(ingredients) {
  return ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.nutrition?.calories || 0),
      protein:  acc.protein  + (ing.nutrition?.protein  || 0),
      carbs:    acc.carbs    + (ing.nutrition?.carbs    || 0),
      fats:     acc.fats     + (ing.nutrition?.fats     || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

// ─── BowlVisual ─────────────────────────────────────────────────────────────
// The animated bowl graphic shown in both layouts. Glow intensity scales
// with ingredient count so the bowl "lights up" as the user fills it.
function BowlVisual({ ingredients, isOver, size = "lg" }) {
  const count   = ingredients.length;
  const isEmpty = count === 0;

  const dimClass = size === "sm"
    ? "w-44 h-44"
    : "w-full aspect-square max-w-sm mx-auto";

  // Glow strength grows non-linearly so the early ingredients have the
  // biggest visible impact, then it plateaus.
  const glowStrength = Math.min(0.65, 0.18 + count * 0.07);

  return (
    <div
      className={`${dimClass} relative rounded-full flex flex-col items-center justify-center transition-all duration-500`}
      style={{
        background: isOver
          ? "radial-gradient(circle at center, rgba(99,102,241,0.18), rgba(168,85,247,0.10) 60%, transparent 80%)"
          : isEmpty
          ? "radial-gradient(circle at center, rgba(255,255,255,0.03), transparent 70%)"
          : "radial-gradient(circle at center, rgba(168,85,247,0.16), rgba(99,102,241,0.10) 55%, transparent 80%)",
        border: isOver
          ? "2px solid rgba(99,102,241,0.9)"
          : isEmpty
          ? "2px dashed rgba(255,255,255,0.15)"
          : "2px solid rgba(168,85,247,0.45)",
        boxShadow: isOver
          ? "0 0 40px rgba(99,102,241,0.55), 0 0 80px rgba(99,102,241,0.25)"
          : isEmpty
          ? "none"
          : `0 0 ${28 + count * 4}px rgba(168,85,247,${glowStrength}), 0 0 ${56 + count * 4}px rgba(99,102,241,${glowStrength * 0.55})`,
        transform: isOver ? "scale(1.04)" : "scale(1)",
        transition: "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* Inner pulsing ring — only visible when bowl has ingredients */}
      {!isEmpty && !isOver && (
        <motion.div
          className="absolute inset-3 rounded-full pointer-events-none"
          style={{ border: "1px solid rgba(168,85,247,0.18)" }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {isEmpty ? (
        <div className="text-center px-8">
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [-3, 3, -3] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="text-6xl mb-3 drop-shadow-lg"
            style={{ filter: "drop-shadow(0 0 20px rgba(168,85,247,0.45))" }}
          >
            🥣
          </motion.div>
          <p className="text-slate-400 text-sm font-medium">
            {size === "sm" ? "Start filling" : "Your bowl is empty"}
          </p>
          <p className="text-slate-600 text-xs mt-1">
            {size === "sm" ? "Tap ingredients below" : "Search and tap (or drag) ingredients"}
          </p>
        </div>
      ) : (
        <FloatingIngredientNames ingredients={ingredients} />
      )}

      {/* Active drop indicator */}
      {isOver && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: "3px solid rgba(99,102,241,0.85)",
            boxShadow: "inset 0 0 30px rgba(99,102,241,0.35), 0 0 50px rgba(99,102,241,0.55)",
          }}
        />
      )}
    </div>
  );
}

// ─── Totals card ────────────────────────────────────────────────────────────
function TotalsCard({ ingredients }) {
  const totals = totalsOf(ingredients);
  if (ingredients.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full glass rounded-2xl p-4"
      style={{ boxShadow: "0 0 18px rgba(99,102,241,0.10)" }}
    >
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Bowl nutrition</p>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Calories", value: Math.round(totals.calories), unit: "kcal", color: "#818cf8", colorClass: "text-indigo-400" },
          { label: "Protein",  value: Math.round(totals.protein),  unit: "g",    color: "#22d3ee", colorClass: "text-cyan-400" },
          { label: "Carbs",    value: Math.round(totals.carbs),    unit: "g",    color: "#f59e0b", colorClass: "text-amber-400" },
          { label: "Fats",     value: Math.round(totals.fats),     unit: "g",    color: "#f472b6", colorClass: "text-pink-400" },
        ].map((item) => (
          <div
            key={item.label}
            className="text-center rounded-xl py-2"
            style={{
              background: `${item.color}10`,
              border:     `1px solid ${item.color}25`,
            }}
          >
            <p className={`text-lg font-bold ${item.colorClass}`} style={{ textShadow: `0 0 12px ${item.color}66` }}>
              {item.value}
            </p>
            <p className="text-[10px] text-slate-500">{item.unit}</p>
            <p className="text-[10px] text-slate-400">{item.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Ingredient row used in both list panes ────────────────────────────────
function IngredientRow({ ingredient, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="flex items-center gap-3 p-3 rounded-xl group transition-all"
      style={{
        background: "rgba(168,85,247,0.04)",
        border: "1px solid rgba(168,85,247,0.18)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{ingredient.name}</p>
        <p className="text-xs text-slate-500">
          {ingredient.quantity}{ingredient.unit} · {Math.round(ingredient.nutrition.calories)} kcal
        </p>
        <div className="flex gap-2 text-[11px] mt-0.5">
          <span className="text-cyan-400">P:{Math.round(ingredient.nutrition.protein)}g</span>
          <span className="text-amber-400">C:{Math.round(ingredient.nutrition.carbs)}g</span>
          <span className="text-pink-400">F:{Math.round(ingredient.nutrition.fats)}g</span>
        </div>
      </div>
      <button
        onClick={() => onRemove(ingredient.id)}
        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
        aria-label={`Remove ${ingredient.name}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </motion.div>
  );
}

// ─── Search result card (mobile) ────────────────────────────────────────────
// Tap anywhere on the card to add. Big touch target, glowing accent on press.
function MobileFoodCard({ food, index, onAdd }) {
  return (
    <motion.button
      onClick={() => onAdd(food)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
      whileTap={{ scale: 0.97 }}
      className="w-full flex items-center gap-3 p-3 rounded-xl text-left active:bg-indigo-500/10 transition-all"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{food.name}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{Math.round(food.per100g?.calories || 0)} kcal/100g</p>
      </div>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-indigo-300 flex-shrink-0"
        style={{
          background: "rgba(99,102,241,0.15)",
          border:     "1px solid rgba(99,102,241,0.35)",
          boxShadow:  "0 0 12px rgba(99,102,241,0.25)",
        }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </div>
    </motion.button>
  );
}

// ─── Draggable food row (desktop only) ──────────────────────────────────────
function DraggableFoodRow({ food, index }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `food-${food._id || food.fdcId || food.openFoodFactsId || index}`,
    data: { food },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isDragging ? 0.35 : 1, x: 0 }}
      transition={{ delay: index * 0.025 }}
      className={`
        flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 select-none cursor-grab active:cursor-grabbing
        ${isDragging
          ? "border-indigo-500/70 bg-indigo-500/10"
          : "border-white/10 bg-white/3 hover:border-indigo-500/40 hover:bg-indigo-500/5"
        }
      `}
      style={{
        ...style,
        boxShadow: isDragging ? "0 0 20px rgba(99,102,241,0.45)" : "none",
      }}
    >
      <svg className="w-4 h-4 text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{food.name}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{Math.round(food.per100g?.calories || 0)} kcal/100g</p>
      </div>
    </motion.div>
  );
}

// ─── Drop zone wrapper (desktop only) ───────────────────────────────────────
function DesktopDropZone({ children, isOver }) {
  const { setNodeRef } = useDroppable({ id: "bowl-drop-zone" });
  return (
    <div ref={setNodeRef} className="w-full">
      {children}
    </div>
  );
}

// ─── Main BowlBuilder component ─────────────────────────────────────────────
export default function BowlBuilder() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState([]);
  const [searching, setSearching] = useState(false);

  const [ingredients, setIngredients] = useState([]);

  // Drag state — desktop only
  const [activeFood, setActiveFood] = useState(null);
  const [isOver, setIsOver]         = useState(false);

  // Modal state
  const [quantityModal, setQuantityModal] = useState(null);
  const [saveModal, setSaveModal]         = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(false);   // mobile ingredient drawer
  const [bowlName, setBowlName]           = useState("");
  const [bowlEmoji, setBowlEmoji]         = useState("🥣");
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);

  const debounceRef = useRef(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleSearch = useCallback((value) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await foodApi.search(value);
        setResults(data.foods || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const handleAdd = (food) => setQuantityModal(food);

  // Desktop drag handlers — no-op on mobile (no drag possible)
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

  const handleAddQuantity = ({ quantity, unit, quantityInGrams }) => {
    if (!quantityModal) return;
    const n      = quantityModal.per100g || {};
    const factor = quantityInGrams / 100;
    const nutrition = {
      calories: +(n.calories * factor).toFixed(1),
      protein:  +(n.protein  * factor).toFixed(1),
      carbs:    +(n.carbs    * factor).toFixed(1),
      fats:     +(n.fats     * factor).toFixed(1),
      fiber:    +((n.fiber || 0) * factor).toFixed(1),
      sodium:   +((n.sodium || 0) * factor).toFixed(1),
    };

    setIngredients((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        food: quantityModal,
        quantity,
        unit,
        quantityInGrams,
        nutrition,
        name:        quantityModal.name,
        brand:       quantityModal.brand,
        fdcId:       quantityModal.fdcId,
        per100g:     quantityModal.per100g,
        servingSize: quantityModal.servingSize,
      },
    ]);
    setQuantityModal(null);
  };

  const removeIngredient = (id) =>
    setIngredients((prev) => prev.filter((i) => i.id !== id));

  const handleSave = async () => {
    if (!bowlName.trim() || ingredients.length === 0) return;
    setSaving(true);
    try {
      await bowlsApi.create({
        name:  bowlName,
        emoji: bowlEmoji,
        ingredients: ingredients.map((ing) => ({
          foodItemId:      ing.food._id,
          fdcId:           ing.fdcId,
          name:            ing.name,
          brand:           ing.brand,
          quantity:        ing.quantity,
          unit:            ing.unit,
          quantityInGrams: ing.quantityInGrams,
          per100g:         ing.per100g,
          servingSize:     ing.servingSize,
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

  const totals = totalsOf(ingredients);

  // ── Render path: choose the layout up-front so the entire render tree
  //    matches the platform. We still wrap in DndContext on both — it's
  //    harmless on mobile (no draggables registered there) and keeps the
  //    drag overlay code in one place.
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {isMobile ? (
        <MobileLayout
          ingredients={ingredients}
          query={query}
          results={results}
          searching={searching}
          totals={totals}
          drawerOpen={drawerOpen}
          onSearch={handleSearch}
          onClearSearch={() => { setQuery(""); setResults([]); }}
          onAdd={handleAdd}
          onRemove={removeIngredient}
          onOpenDrawer={() => setDrawerOpen(true)}
          onCloseDrawer={() => setDrawerOpen(false)}
          onSaveClick={() => setSaveModal(true)}
        />
      ) : (
        <DesktopLayout
          ingredients={ingredients}
          query={query}
          results={results}
          searching={searching}
          isOver={isOver}
          onSearch={handleSearch}
          onRemove={removeIngredient}
          onSaveClick={() => setSaveModal(true)}
        />
      )}

      {/* Drag overlay — desktop only, but cheap to leave registered */}
      <DragOverlay>
        {activeFood && (
          <div
            className="flex items-center gap-3 p-3 rounded-xl border border-indigo-500 bg-[#111827] w-64"
            style={{ boxShadow: "0 0 24px rgba(99,102,241,0.6)" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{activeFood.name}</p>
            </div>
            <p className="text-xs font-semibold text-indigo-400">
              {Math.round(activeFood.per100g?.calories || 0)} kcal
            </p>
          </div>
        )}
      </DragOverlay>

      {/* Quantity modal — shared */}
      <QuantityModal
        isOpen={!!quantityModal}
        food={quantityModal}
        onClose={() => setQuantityModal(null)}
        onConfirm={handleAddQuantity}
      />

      {/* Save modal — shared */}
      <Modal isOpen={saveModal} onClose={() => setSaveModal(false)} title="Save your bowl">
        <div className="space-y-4">
          {saved ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-6">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-white font-semibold">Bowl saved!</p>
              <p className="text-slate-400 text-sm">Redirecting to dashboard…</p>
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
                    style={{ fontSize: "16px" }}
                    className="w-16 px-3 py-3 rounded-xl bg-[#111827] border border-white/10 text-white text-center text-xl focus:border-indigo-500 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-300 mb-1.5 block">Bowl name</label>
                  <input
                    type="text"
                    placeholder="e.g. Post-Workout Power Bowl"
                    value={bowlName}
                    onChange={(e) => setBowlName(e.target.value)}
                    style={{ fontSize: "16px" }}
                    className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                <p className="text-xs text-slate-500 mb-2">
                  {ingredients.length} ingredients · {Math.round(totals.calories)} kcal total
                </p>
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
                  Save bowl
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </DndContext>
  );
}

// ─── Desktop layout ─────────────────────────────────────────────────────────
function DesktopLayout({
  ingredients, query, results, searching, isOver,
  onSearch, onRemove, onSaveClick,
}) {
  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-white">Custom Bowl Builder</h1>
        <p className="text-slate-400 text-sm mt-1">Drag ingredients into your glowing bowl</p>
      </motion.div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: search */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Food library</h2>
            <SearchInput query={query} onSearch={onSearch} placeholder="Search ingredients to drag…" />
            <div className="space-y-2 max-h-[calc(100vh-340px)] overflow-y-auto mt-3">
              {searching && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!searching && results.map((food, i) => (
                <DraggableFoodRow key={food._id || food.fdcId || i} food={food} index={i} />
              ))}
              {!searching && query.length >= 2 && results.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-4">No results found</p>
              )}
              {!query && (
                <p className="text-center text-slate-600 text-xs py-6">
                  Search and drag items into your bowl →
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Center: bowl */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col items-center gap-4"
        >
          <DesktopDropZone isOver={isOver}>
            <BowlVisual ingredients={ingredients} isOver={isOver} />
          </DesktopDropZone>

          <TotalsCard ingredients={ingredients} />

          {ingredients.length > 0 && (
            <motion.button
              onClick={onSaveClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-2xl font-bold text-white relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                boxShadow:  "0 0 32px rgba(168,85,247,0.45), 0 0 64px rgba(99,102,241,0.25)",
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5 13l4 4L19 7" />
                </svg>
                Save this bowl
              </span>
            </motion.button>
          )}
        </motion.div>

        {/* Right: ingredient list */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="glass rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">
              Ingredients ({ingredients.length})
            </h2>
            {ingredients.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-8">Your bowl is empty</p>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                <AnimatePresence>
                  {ingredients.map((ing) => (
                    <IngredientRow key={ing.id} ingredient={ing} onRemove={onRemove} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Mobile layout ──────────────────────────────────────────────────────────
function MobileLayout({
  ingredients, query, results, searching, totals, drawerOpen,
  onSearch, onClearSearch, onAdd, onRemove, onOpenDrawer, onCloseDrawer, onSaveClick,
}) {
  return (
    <div className="max-w-md mx-auto pb-32"> {/* pb to clear floating save bar */}
      {/* Hero: smaller bowl visualisation */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 text-center"
      >
        <h1 className="text-2xl font-bold text-white">Custom bowl</h1>
        <p className="text-slate-400 text-sm mt-1">Tap ingredients to add them</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex justify-center mb-5"
      >
        <BowlVisual ingredients={ingredients} isOver={false} size="sm" />
      </motion.div>

      {/* Quick totals row + open-drawer hint */}
      {ingredients.length > 0 && (
        <motion.button
          onClick={onOpenDrawer}
          whileTap={{ scale: 0.98 }}
          className="w-full glass rounded-2xl p-3 mb-4 flex items-center gap-3 text-left"
          style={{ boxShadow: "0 0 16px rgba(168,85,247,0.12)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">{ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"}</p>
            <div className="flex items-baseline gap-3 mt-0.5">
              <span className="text-lg font-bold text-indigo-400">
                {Math.round(totals.calories)}
                <span className="text-[11px] text-slate-500 font-normal ml-1">kcal</span>
              </span>
              <span className="text-[11px] text-cyan-400">P:{Math.round(totals.protein)}g</span>
              <span className="text-[11px] text-amber-400">C:{Math.round(totals.carbs)}g</span>
              <span className="text-[11px] text-pink-400">F:{Math.round(totals.fats)}g</span>
            </div>
          </div>
          <span className="text-[11px] text-indigo-400 font-medium flex items-center gap-1">
            Edit
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </motion.button>
      )}

      {/* Search */}
      <div className="glass rounded-2xl p-3">
        <SearchInput query={query} onSearch={onSearch} onClear={onClearSearch} placeholder="Search ingredients…" />

        {/* Inline results */}
        <div className="space-y-2 mt-3 min-h-[80px]">
          {searching && (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!searching && results.map((food, i) => (
            <MobileFoodCard key={food._id || food.fdcId || i} food={food} index={i} onAdd={onAdd} />
          ))}
          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-4">No results found</p>
          )}
          {!query && (
            <p className="text-center text-slate-600 text-xs py-6 px-4">
              Type at least 2 characters to search for ingredients
            </p>
          )}
        </div>
      </div>

      {/* Floating Save CTA */}
      <AnimatePresence>
        {ingredients.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed left-0 right-0 z-30 px-4 pointer-events-none"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)" }}
          >
            <motion.button
              onClick={onSaveClick}
              whileTap={{ scale: 0.97 }}
              className="w-full max-w-md mx-auto py-3.5 rounded-2xl font-bold text-white pointer-events-auto block"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                boxShadow:  "0 0 32px rgba(168,85,247,0.5), 0 0 64px rgba(99,102,241,0.3)",
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save bowl · {Math.round(totals.calories)} kcal
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ingredient drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseDrawer}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f1024] border-t border-white/10 rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
            >
              <div className="w-12 h-1 bg-white/15 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-white">Bowl ingredients</h3>
                <button onClick={onCloseDrawer} className="text-slate-400 text-2xl leading-none px-2">&times;</button>
              </div>

              {ingredients.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-8">No ingredients yet</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {ingredients.map((ing) => (
                      <IngredientRow key={ing.id} ingredient={ing} onRemove={onRemove} />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <TotalsCard ingredients={ingredients} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Search input — shared ──────────────────────────────────────────────────
function SearchInput({ query, onSearch, onClear, placeholder }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => onSearch(e.target.value)}
        style={{ fontSize: "16px" }}
        className="w-full pl-9 pr-9 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
      />
      {query && onClear && (
        <button
          onClick={onClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          aria-label="Clear search"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Floating ingredient names inside the bowl ───────────────────────────────
function FloatingIngredientNames({ ingredients }) {
  // Spiral-ish positions, well inside the ~50% radius circle.
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

  const fontSize = ingredients.length > 6 ? "0.6rem" : "0.68rem";

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-full">
      <span
        className="text-3xl select-none z-10 pointer-events-none"
        style={{ filter: "drop-shadow(0 0 16px rgba(168,85,247,0.5))" }}
      >🥣</span>
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
              y:       { duration: 2.8,  delay: floatDelay, repeat: Infinity, ease: "easeInOut" },
            }}
            className="absolute pointer-events-none select-none"
            style={{
              left:      `calc(50% + ${pos.x}%)`,
              top:       `calc(50% + ${pos.y}%)`,
              transform: "translate(-50%, -50%)",
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
                textShadow:   `0 0 12px ${color}aa`,
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

// ─── Quantity Modal ─────────────────────────────────────────────────────────
function QuantityModal({ isOpen, food, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit]         = useState("g");

  useEffect(() => {
    if (isOpen) {
      setQuantity("100");
      setUnit("g");
    }
  }, [isOpen, food]);

  if (!food) return null;

  // Dynamic units from the database
  const validQuantities = Object.entries(food.quantities || {})
    .filter(([, val]) => val !== null && val !== undefined)
    .map(([key]) => key);

  const availableUnits = ["g", ...validQuantities];
  const safeUnit = availableUnits.includes(unit) ? unit : "g";

  let gramsPerUnit = 1;
  if (safeUnit !== "g" && food.quantities?.[safeUnit]) {
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
    <Modal isOpen={isOpen} onClose={onClose} title="Set quantity">
      <div className="space-y-4">
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
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
            style={{ fontSize: "16px" }}
            className="flex-1 px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          <select
            value={safeUnit}
            onChange={(e) => {
              const newUnit = e.target.value;
              setUnit(newUnit);
              setQuantity(newUnit === "g" ? "100" : "1");
            }}
            style={{ fontSize: "16px" }}
            className="px-3 py-3 rounded-xl bg-[#111827] border border-white/10 text-slate-300 focus:border-indigo-500 transition-all"
          >
            {availableUnits.map((u) => (
              <option key={u} value={u}>{u === "g" ? "grams" : u}</option>
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
            <div key={item.label} className="rounded-xl p-2 text-center" style={{ background: "rgba(255,255,255,0.03)" }}>
              <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>

        {(n.fiber > 0 || n.sodium > 0 || n.sugar > 0) && (
          <div className="flex gap-3 text-xs text-slate-500 px-1">
            {n.fiber  > 0 && <span>Fiber: <span className="text-emerald-400">{calc(n.fiber)}g</span></span>}
            {n.sugar  > 0 && <span>Sugar: <span className="text-pink-400">{calc(n.sugar)}g</span></span>}
            {n.sodium > 0 && <span>Sodium: <span className="text-orange-400">{calc(n.sodium)}mg</span></span>}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleConfirm} className="flex-1">Add to bowl</Button>
        </div>
      </div>
    </Modal>
  );
}
