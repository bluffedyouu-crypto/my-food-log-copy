import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/client";
import Button from "../ui/Button";
import Card from "../ui/Card";

const containerVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { appUser, updateAppUser } = useAuth();
  const profile = appUser?.profile || {};
  const targets = appUser?.dailyTargets || {};

  const [profileForm, setProfileForm] = useState({
    goal:           profile.goal           || "maintenance",
    currentWeight:  profile.currentWeight  || "",
    targetWeight:   profile.targetWeight   || "",
    activityLevel:  profile.activityLevel  || "sedentary",
    mealFrequency:  profile.mealFrequency  || 3,
  });

  const [manualTargets, setManualTargets] = useState({
    calories: targets.calories || "",
    protein:  targets.protein  || "",
    carbs:    targets.carbs    || "",
    fats:     targets.fats     || "",
  });

  const [useManual, setUseManual]           = useState(targets.isManualOverride || false);
  const [saving, setSaving]                 = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting]           = useState(false);
  const [success, setSuccess]               = useState("");
  const [error, setError]                   = useState("");

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  // ── Save manual override or recalculate ──────────────────────────────────
  const handleSaveManual = async () => {
    if (!useManual) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await userApi.updateSettings({
        ...profileForm,
        manualTargets,
      });
      updateAppUser(data.user);
      showSuccess("Manual targets saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Reset & Recalculate — wipes onboardingComplete, sends back to flow ───
  const handleResetRecalculate = async () => {
    setResetting(true);
    setError("");
    try {
      // Mark onboarding as incomplete so the guard redirects to /onboarding
      const { data } = await userApi.updateSettings({
        ...profileForm,
        resetOnboarding: true,   // server will set onboardingComplete = false
        recalculate: false,
      });
      updateAppUser({ ...data.user, onboardingComplete: false });
      navigate("/onboarding");
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-2xl mx-auto space-y-6 pb-10"
    >
      {/* ── Header ── */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your goals and nutritional targets</p>
      </motion.div>

      {/* ── Alerts ── */}
      <AnimatePresence>
        {success && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm"
          >
            ✓ {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

    {/* ── Profile & Goals (Read Only) ── */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Profile &amp; Goals</h2>
            <span className="text-xs text-slate-500 bg-white/5 px-2 py-1 rounded-md">Read-only</span>
          </div>
          <div className="space-y-4">

            {/* Goal & Activity Level */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-400 mb-1.5 block">Primary Goal</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-medium flex items-center gap-2">
                  {(() => {
                    const goals = {
                      fat_loss: { label: "Fat Loss", emoji: "🔥" },
                      muscle_gain: { label: "Muscle Gain", emoji: "💪" },
                      recomp: { label: "Recomp", emoji: "⚡" },
                      maintenance: { label: "Maintenance", emoji: "🎯" },
                    };
                    const g = goals[profile.goal] || goals.maintenance;
                    return <><span className="text-xl">{g.emoji}</span> {g.label}</>;
                  })()}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400 mb-1.5 block">Activity Level</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-medium flex items-center gap-2">
                  {(() => {
                    const levels = {
                      sedentary: { label: "Sedentary", emoji: "🛋️" },
                      lightly_active: { label: "Lightly Active", emoji: "🚶" },
                      moderately_active: { label: "Moderately Active", emoji: "🏋️" },
                      very_active: { label: "Very Active", emoji: "🏃" },
                      extremely_active: { label: "Extremely Active", emoji: "🔥" },
                    };
                    const l = levels[profile.activityLevel] || { label: profile.activityLevel, emoji: "⚡" };
                    return <><span className="text-xl">{l.emoji}</span> {l.label}</>;
                  })()}
                </div>
              </div>
            </div>

            {/* Weights */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-400 mb-1.5 block">
                  Current Weight
                </label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-medium">
                  {profile.currentWeight || "—"} <span className="text-slate-500 font-normal">{profile.weightUnit || "kg"}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-400 mb-1.5 block">
                  Target Weight
                </label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-medium">
                  {profile.targetWeight || "—"} <span className="text-slate-500 font-normal">{profile.weightUnit || "kg"}</span>
                </div>
              </div>
            </div>

            {/* Meal Frequency */}
            <div>
              <label className="text-sm font-medium text-slate-400 mb-1.5 block">Meal Frequency</label>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-indigo-300 font-medium">
                {profile.mealFrequency || 3} meals / day
              </div>
            </div>

          </div>
        </Card>
      </motion.div>

      {/* ── Daily Targets ── */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Daily Targets</h2>
            {/* Manual override toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm text-slate-400">Manual override</span>
              <div
                onClick={() => setUseManual(!useManual)}
                className={`w-10 h-5 rounded-full transition-all duration-200 relative cursor-pointer ${
                  useManual ? "bg-indigo-500" : "bg-white/10"
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                  useManual ? "left-5" : "left-0.5"
                }`} />
              </div>
            </label>
          </div>

          {useManual ? (
            <div className="space-y-3">
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                ⚠️ Manual override active — these values replace calculated targets.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "calories", label: "Calories", unit: "kcal", color: "text-indigo-400" },
                  { key: "protein",  label: "Protein",  unit: "g",    color: "text-cyan-400"   },
                  { key: "carbs",    label: "Carbs",    unit: "g",    color: "text-amber-400"  },
                  { key: "fats",     label: "Fats",     unit: "g",    color: "text-pink-400"   },
                ].map((item) => (
                  <div key={item.key}>
                    <label className={`text-sm font-medium mb-1.5 block ${item.color}`}>
                      {item.label} ({item.unit})
                    </label>
                    <input
                      type="number"
                      value={manualTargets[item.key]}
                      onChange={(e) => setManualTargets({ ...manualTargets, [item.key]: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#0d0f1e] border border-white/10 text-white focus:border-indigo-500 transition-all"
                    />
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveManual} loading={saving} fullWidth className="mt-2">
                Save Manual Targets
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Calories", value: targets.calories, unit: "kcal", color: "text-indigo-400" },
                  { label: "Protein",  value: targets.protein,  unit: "g",    color: "text-cyan-400"   },
                  { label: "Carbs",    value: targets.carbs,    unit: "g",    color: "text-amber-400"  },
                  { label: "Fats",     value: targets.fats,     unit: "g",    color: "text-pink-400"   },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <p className={`text-xl font-bold ${item.color}`}>{item.value || "—"}</p>
                    <p className="text-xs text-slate-500">{item.unit}</p>
                    <p className="text-xs text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* ── Reset & Recalculate ── */}
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-3 rounded-xl border border-indigo-500/30 bg-indigo-500/8 hover:bg-indigo-500/15 text-indigo-300 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reset &amp; Recalculate
              </button>
            </>
          )}
        </Card>
      </motion.div>

      {/* ── Reset confirmation modal ── */}
      <AnimatePresence>
        {showResetConfirm && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
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
                <div className="text-center mb-5">
                  <div className="text-4xl mb-3">🔄</div>
                  <h3 className="text-lg font-bold text-white">Reset &amp; Recalculate?</h3>
                  <p className="text-slate-400 text-sm mt-2">
                    This will restart the onboarding flow so you can enter fresh metrics.
                    Your food logs and custom bowls are kept.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowResetConfirm(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResetRecalculate}
                    loading={resetting}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600"
                  >
                    Let's go →
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Account Info ── */}
      <motion.div variants={itemVariants}>
        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Account</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white">
              {appUser?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="font-semibold text-white">{appUser?.name}</p>
              <p className="text-sm text-slate-400">{appUser?.email}</p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
