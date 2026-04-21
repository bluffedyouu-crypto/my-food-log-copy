import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLog } from "../../context/LogContext";

export default function MealCategory({
  mealKey, label, emoji, time, entries, totals, onAddFood,
}) {
  const { deleteEntry } = useLog();
  const [expanded, setExpanded]   = useState(false);
  const [deleting, setDeleting]   = useState(null);

  const hasEntries = entries.length > 0;
  const totalCal   = Math.round(totals.calories || 0);

  const handleDelete = async (id) => {
    setDeleting(id);
    try { await deleteEntry(id); }
    finally { setDeleting(null); }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* ── Row header ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
      >
        {/* Emoji badge */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.15)" }}>
          {emoji}
        </div>

        {/* Name + time */}
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">{label}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">{time}</p>
        </div>

        {/* Calorie badge + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasEntries ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-400">{totalCal} kcal</span>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
                <span className="text-cyan-500">P:{Math.round(totals.protein || 0)}g</span>
                <span className="text-amber-500">C:{Math.round(totals.carbs || 0)}g</span>
                <span className="text-pink-500">F:{Math.round(totals.fats || 0)}g</span>
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-700 italic">empty</span>
          )}

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </div>
      </button>

      {/* ── Expanded body ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1.5 border-t border-white/[0.04] pt-3">
              {/* Logged entries */}
              {entries.map((entry) => (
                <motion.div
                  key={entry._id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between py-2 px-3 rounded-xl group"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{entry.name}</p>
                    <p className="text-[11px] text-slate-600">
                      {entry.quantity}{entry.unit}
                      <span className="mx-1 text-slate-700">·</span>
                      <span className="text-indigo-400 font-medium">
                        {Math.round(entry.nutrition?.calories || 0)} kcal
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <div className="hidden group-hover:flex items-center gap-1.5 text-[11px]">
                      <span className="text-cyan-500">P:{Math.round(entry.nutrition?.protein || 0)}g</span>
                      <span className="text-amber-500">C:{Math.round(entry.nutrition?.carbs || 0)}g</span>
                      <span className="text-pink-500">F:{Math.round(entry.nutrition?.fats || 0)}g</span>
                    </div>
                    <button
                      onClick={() => handleDelete(entry._id)}
                      disabled={deleting === entry._id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      {deleting === entry._id ? (
                        <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* Add food */}
              <button
                onClick={onAddFood}
                className="w-full py-2 rounded-xl border border-dashed border-white/8 text-slate-600 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-xs flex items-center justify-center gap-1.5 mt-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add food to {label}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed empty state — inline add */}
      {!expanded && !hasEntries && (
        <div className="px-4 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onAddFood(); }}
            className="w-full py-1.5 rounded-xl border border-dashed border-white/6 text-slate-700 hover:text-indigo-400 hover:border-indigo-500/25 transition-all text-xs flex items-center justify-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add food
          </button>
        </div>
      )}
    </div>
  );
}
