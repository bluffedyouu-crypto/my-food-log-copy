import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLog } from "../../context/LogContext";

export default function MealCategory({ mealKey, label, emoji, time, entries, totals, onAddFood }) {
  const { deleteEntry } = useLog();
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const hasEntries = entries.length > 0;

  const handleDelete = async (entryId) => {
    setDeleting(entryId);
    try {
      await deleteEntry(entryId);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-gradient-to-br from-[#111827] to-[#1a2235] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/3 transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{emoji}</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-slate-500">{time}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {hasEntries && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-indigo-400 font-semibold">{Math.round(totals.calories)} kcal</span>
              <span className="text-cyan-400">P:{Math.round(totals.protein)}g</span>
              <span className="text-amber-400">C:{Math.round(totals.carbs)}g</span>
              <span className="text-pink-400">F:{Math.round(totals.fats)}g</span>
            </div>
          )}
          <motion.svg
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {/* Entries */}
              {entries.map((entry) => (
                <motion.div
                  key={entry._id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/3 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{entry.name}</p>
                    <p className="text-xs text-slate-500">
                      {entry.quantity}{entry.unit} · {Math.round(entry.nutrition?.calories || 0)} kcal
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <div className="hidden group-hover:flex items-center gap-2 text-xs">
                      <span className="text-cyan-400">P:{Math.round(entry.nutrition?.protein || 0)}g</span>
                      <span className="text-amber-400">C:{Math.round(entry.nutrition?.carbs || 0)}g</span>
                      <span className="text-pink-400">F:{Math.round(entry.nutrition?.fats || 0)}g</span>
                    </div>
                    <button
                      onClick={() => handleDelete(entry._id)}
                      disabled={deleting === entry._id}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      {deleting === entry._id ? (
                        <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* Add food button */}
              <button
                onClick={onAddFood}
                className="w-full py-2 rounded-xl border border-dashed border-white/15 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-xs flex items-center justify-center gap-1.5"
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

      {/* Collapsed add button */}
      {!expanded && !hasEntries && (
        <div className="px-4 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); onAddFood(); }}
            className="w-full py-2 rounded-xl border border-dashed border-white/10 text-slate-600 hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-xs flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add food
          </button>
        </div>
      )}
    </div>
  );
}
