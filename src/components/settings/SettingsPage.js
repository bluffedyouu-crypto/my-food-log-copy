import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { userApi } from "../../api/client";
import Button from "../ui/Button";
import Card from "../ui/Card";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function SettingsPage() {
  const { appUser, updateAppUser } = useAuth();
  const profile = appUser?.profile || {};
  const targets = appUser?.dailyTargets || {};

  const [profileForm, setProfileForm] = useState({
    goal: profile.goal || "maintenance",
    currentWeight: profile.currentWeight || "",
    targetWeight: profile.targetWeight || "",
    activityLevel: profile.activityLevel || "sedentary",
    mealFrequency: profile.mealFrequency || 3,
  });

  const [manualTargets, setManualTargets] = useState({
    calories: targets.calories || "",
    protein: targets.protein || "",
    carbs: targets.carbs || "",
    fats: targets.fats || "",
  });

  const [useManual, setUseManual] = useState(targets.isManualOverride || false);
  const [weightLog, setWeightLog] = useState({ weight: "", unit: profile.weightUnit || "kg" });
  const [saving, setSaving] = useState(false);
  const [savingWeight, setSavingWeight] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...profileForm,
        recalculate: !useManual,
        ...(useManual ? { manualTargets } : {}),
      };
      const { data } = await userApi.updateSettings(payload);
      updateAppUser(data.user);
      showSuccess("Settings saved successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogWeight = async () => {
    if (!weightLog.weight) return;
    setSavingWeight(true);
    try {
      await userApi.logWeight(weightLog.weight, weightLog.unit);
      setWeightLog({ ...weightLog, weight: "" });
      showSuccess("Weight logged!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWeight(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your goals and nutritional targets</p>
      </motion.div>

      {/* Success / Error */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/15 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm"
        >
          ✓ {success}
        </motion.div>
      )}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Profile */}
      <motion.div variants={itemVariants}>
        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Profile & Goals</h2>
          <div className="space-y-4">
            {/* Goal */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Primary Goal</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "fat_loss", label: "Fat Loss", emoji: "🔥" },
                  { value: "muscle_gain", label: "Muscle Gain", emoji: "💪" },
                  { value: "recomp", label: "Recomp", emoji: "⚡" },
                  { value: "maintenance", label: "Maintenance", emoji: "🎯" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setProfileForm({ ...profileForm, goal: opt.value })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      profileForm.goal === opt.value
                        ? "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                        : "border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Activity Level */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Activity Level</label>
              <select
                value={profileForm.activityLevel}
                onChange={(e) => setProfileForm({ ...profileForm, activityLevel: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white focus:border-indigo-500 transition-all"
              >
                <option value="sedentary">Sedentary</option>
                <option value="lightly_active">Lightly Active</option>
                <option value="moderately_active">Moderately Active</option>
                <option value="very_active">Very Active</option>
              </select>
            </div>

            {/* Weights */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Current Weight ({profile.weightUnit || "kg"})</label>
                <input
                  type="number"
                  value={profileForm.currentWeight}
                  onChange={(e) => setProfileForm({ ...profileForm, currentWeight: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Target Weight ({profile.weightUnit || "kg"})</label>
                <input
                  type="number"
                  value={profileForm.targetWeight}
                  onChange={(e) => setProfileForm({ ...profileForm, targetWeight: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Meal Frequency */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Meal Frequency: <span className="text-indigo-400">{profileForm.mealFrequency} meals/day</span>
              </label>
              <input
                type="range"
                min="3"
                max="6"
                value={profileForm.mealFrequency}
                onChange={(e) => setProfileForm({ ...profileForm, mealFrequency: parseInt(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>3</span><span>4</span><span>5</span><span>6</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Macro Targets */}
      <motion.div variants={itemVariants}>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">Daily Targets</h2>
            <label className="flex items-center gap-2 cursor-pointer">
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
                ⚠️ Manual override is active. These values will be used instead of calculated targets.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "calories", label: "Calories", unit: "kcal", color: "text-indigo-400" },
                  { key: "protein", label: "Protein", unit: "g", color: "text-cyan-400" },
                  { key: "carbs", label: "Carbs", unit: "g", color: "text-amber-400" },
                  { key: "fats", label: "Fats", unit: "g", color: "text-pink-400" },
                ].map((item) => (
                  <div key={item.key}>
                    <label className={`text-sm font-medium mb-1.5 block ${item.color}`}>
                      {item.label} ({item.unit})
                    </label>
                    <input
                      type="number"
                      value={manualTargets[item.key]}
                      onChange={(e) => setManualTargets({ ...manualTargets, [item.key]: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white focus:border-indigo-500 transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Calories", value: targets.calories, unit: "kcal", color: "text-indigo-400" },
                { label: "Protein", value: targets.protein, unit: "g", color: "text-cyan-400" },
                { label: "Carbs", value: targets.carbs, unit: "g", color: "text-amber-400" },
                { label: "Fats", value: targets.fats, unit: "g", color: "text-pink-400" },
              ].map((item) => (
                <div key={item.label} className="bg-white/3 rounded-xl p-3">
                  <p className={`text-xl font-bold ${item.color}`}>{item.value || "—"}</p>
                  <p className="text-xs text-slate-500">{item.unit}</p>
                  <p className="text-xs text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleSaveProfile}
            loading={saving}
            fullWidth
            className="mt-4"
          >
            {useManual ? "Save Manual Targets" : "Save & Recalculate"}
          </Button>
        </Card>
      </motion.div>

      {/* Log Weight */}
      <motion.div variants={itemVariants}>
        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Log Today's Weight</h2>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder={`Weight in ${weightLog.unit}`}
              value={weightLog.weight}
              onChange={(e) => setWeightLog({ ...weightLog, weight: e.target.value })}
              className="flex-1 px-4 py-3 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 transition-all"
            />
            <select
              value={weightLog.unit}
              onChange={(e) => setWeightLog({ ...weightLog, unit: e.target.value })}
              className="px-3 py-3 rounded-xl bg-[#111827] border border-white/10 text-slate-300 focus:border-indigo-500 transition-all"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
            <Button onClick={handleLogWeight} loading={savingWeight}>
              Log
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Account Info */}
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
