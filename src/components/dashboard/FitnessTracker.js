import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { activityApi } from "../../api/client";

// ─── Activity type config ─────────────────────────────────────────────────────
const ACTIVITY_TYPES = [
  { value: "gym",      label: "Gym",      emoji: "🏋️" },
  { value: "running",  label: "Running",  emoji: "🏃" },
  { value: "walking",  label: "Walking",  emoji: "🚶" },
  { value: "cycling",  label: "Cycling",  emoji: "🚴" },
  { value: "swimming", label: "Swimming", emoji: "🏊" },
  { value: "sports",   label: "Sports",   emoji: "⚽" },
  { value: "yoga",     label: "Yoga",     emoji: "🧘" },
  { value: "other",    label: "Other",    emoji: "💪" },
];

// Days-per-week target derived from activity level
const ACTIVITY_TARGETS = {
  sedentary:          2,
  lightly_active:     3,
  moderately_active:  4,
  very_active:        6,
};

export default function FitnessTracker({ activityLevel = "moderately_active" }) {
  const [weekData, setWeekData]     = useState(null);
  const [showLog, setShowLog]       = useState(false);
  const [loading, setLoading]       = useState(true);

  const weekTarget = ACTIVITY_TARGETS[activityLevel] || 4;

  const load = async () => {
    try {
      const { data } = await activityApi.getWeek();
      setWeekData(data);
    } catch {
      setWeekData({ logs: [], daysActive: 0, streak: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const daysActive = weekData?.daysActive ?? 0;
  const streak     = weekData?.streak     ?? 0;
  const pct        = Math.min((daysActive / weekTarget) * 100, 100);

  // Build last-7-days grid
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
  const activeDates = new Set((weekData?.logs || []).map((l) => l.dateString));

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
            style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.2)" }}>
            🏃
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Fitness</p>
            <p className="text-[11px] text-slate-600">Weekly activity</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowLog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: "rgba(52,211,153,0.12)",
            border: "1px solid rgba(52,211,153,0.25)",
            color: "#34d399",
            boxShadow: "0 0 12px rgba(52,211,153,0.15)",
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Log Activity
        </motion.button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Days active */}
            <div className="rounded-xl p-3 text-center"
              style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.15)" }}>
              <p className="text-xl font-bold text-emerald-400">
                {daysActive}<span className="text-sm font-normal text-slate-500">/{weekTarget}</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Days this week</p>
            </div>
            {/* Streak */}
            <div className="rounded-xl p-3 text-center"
              style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <p className="text-xl font-bold text-amber-400">
                {streak}
                <span className="text-sm ml-0.5">🔥</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Day streak</p>
            </div>
            {/* Target met */}
            <div className="rounded-xl p-3 text-center"
              style={{
                background: daysActive >= weekTarget ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.03)",
                border: daysActive >= weekTarget ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.06)",
              }}>
              <p className={`text-xl font-bold ${daysActive >= weekTarget ? "text-emerald-400" : "text-slate-500"}`}>
                {daysActive >= weekTarget ? "✓" : `${weekTarget - daysActive}`}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {daysActive >= weekTarget ? "Goal met!" : "days left"}
              </p>
            </div>
          </div>

          {/* Weekly progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-1.5">
              <span>Weekly progress</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{
                  background: "linear-gradient(90deg, #34d399, #10b981)",
                  boxShadow: "0 0 8px rgba(52,211,153,0.4)",
                }}
              />
            </div>
          </div>

          {/* 7-day dot grid */}
          <div className="flex gap-1.5 justify-between">
            {last7.map((d) => {
              const isActive  = activeDates.has(d);
              const isToday   = d === today.toISOString().split("T")[0];
              const dayLabel  = new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })[0];
              return (
                <div key={d} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className="w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all"
                    style={{
                      background: isActive
                        ? "rgba(52,211,153,0.25)"
                        : "rgba(255,255,255,0.04)",
                      border: isToday
                        ? "1px solid rgba(99,102,241,0.5)"
                        : isActive
                          ? "1px solid rgba(52,211,153,0.4)"
                          : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: isActive ? "0 0 8px rgba(52,211,153,0.2)" : "none",
                    }}
                  >
                    {isActive ? "✓" : ""}
                  </div>
                  <span className="text-[9px] text-slate-600">{dayLabel}</span>
                </div>
              );
            })}
          </div>

          {/* Recent activities */}
          {weekData?.logs?.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-white/5">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">Recent</p>
              {weekData.logs.slice(0, 3).map((log) => {
                const type = ACTIVITY_TYPES.find((t) => t.value === log.activityType);
                return (
                  <div key={log._id} className="flex items-center gap-2 py-1">
                    <span className="text-sm">{type?.emoji || "💪"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate">{log.label || type?.label}</p>
                      <p className="text-[10px] text-slate-600">
                        {log.dateString}
                        {log.durationMinutes ? ` · ${log.durationMinutes}min` : ""}
                      </p>
                    </div>
                    {log.caloriesBurned > 0 && (
                      <span className="text-[11px] text-emerald-500 flex-shrink-0">
                        -{log.caloriesBurned} kcal
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Log Activity Modal */}
      <AnimatePresence>
        {showLog && (
          <LogActivityModal
            onClose={() => setShowLog(false)}
            onSaved={() => { setShowLog(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Log Activity Modal ───────────────────────────────────────────────────────
function LogActivityModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    activityType: "gym",
    label: "",
    durationMinutes: "",
    caloriesBurned: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await activityApi.log({
        ...form,
        durationMinutes: form.durationMinutes ? +form.durationMinutes : undefined,
        caloriesBurned:  form.caloriesBurned  ? +form.caloriesBurned  : undefined,
      });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-sm glass-strong rounded-2xl p-6 shadow-2xl"
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-white">Log Activity</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Activity type grid */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">Activity Type</label>
              <div className="grid grid-cols-4 gap-2">
                {ACTIVITY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setForm({ ...form, activityType: t.value })}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs transition-all ${
                      form.activityType === t.value
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-white/8 text-slate-500 hover:border-white/20"
                    }`}
                  >
                    <span className="text-lg">{t.emoji}</span>
                    <span className="text-[10px]">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Label (optional)</label>
              <input
                type="text"
                placeholder="e.g. Morning Run"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder-slate-600 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Duration + Calories */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Duration (min)</label>
                <input
                  type="number"
                  placeholder="45"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder-slate-600 focus:border-emerald-500 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Calories burned</label>
                <input
                  type="number"
                  placeholder="300"
                  value={form.caloriesBurned}
                  onChange={(e) => setForm({ ...form, caloriesBurned: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder-slate-600 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #34d399, #10b981)",
                  boxShadow: "0 4px 16px rgba(52,211,153,0.3)",
                }}
              >
                {saving ? "Saving…" : "Log It"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
