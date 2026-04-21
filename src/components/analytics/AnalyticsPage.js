import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { logsApi, userApi } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Card from "../ui/Card";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 text-xs">
      <p className="text-slate-300 mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {Math.round(p.value)}
          {p.name.includes("kcal") || p.name === "Calories" || p.name === "Target" ? " kcal" : "g"}
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { appUser } = useAuth();
  const [calorieData, setCalorieData] = useState([]);
  const [weightData, setWeightData] = useState([]);
  const [macroData, setMacroData] = useState([]);
  const [, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, userRes] = await Promise.all([
        logsApi.getAnalytics(period),
        userApi.getMe(),
      ]);

      const summary = analyticsRes.data.summary || [];
      const user = userRes.data.user;

      // Calorie adherence data
      setCalorieData(
        summary.map((d) => ({
          date: formatDate(d.date),
          Calories: Math.round(d.calories),
          Target: d.targetCalories,
        }))
      );

      // Macro trend data
      setMacroData(
        summary.map((d) => ({
          date: formatDate(d.date),
          Protein: Math.round(d.protein),
          Carbs: Math.round(d.carbs),
          Fats: Math.round(d.fats),
        }))
      );

      // Weight history
      const weightHistory = user?.weightHistory || [];
      setWeightData(
        weightHistory
          .slice(-period)
          .map((w) => ({
            date: formatDate(new Date(w.date).toISOString().split("T")[0]),
            Weight: w.weight,
            unit: w.unit,
          }))
      );
    } catch (err) {
      console.error("Analytics load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const targets = appUser?.dailyTargets;

  // Averages
  const avg = (arr, key) => {
    const vals = arr.filter((d) => d[key] > 0);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((s, d) => s + d[key], 0) / vals.length);
  };

  const avgCalories = avg(calorieData, "Calories");
  const avgProtein = avg(macroData, "Protein");
  const avgCarbs = avg(macroData, "Carbs");
  const avgFats = avg(macroData, "Fats");

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 text-sm mt-0.5">Track your progress over time</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === d
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Calories", value: avgCalories, target: targets?.calories, unit: "kcal", color: "text-indigo-400" },
          { label: "Avg Protein", value: avgProtein, target: targets?.protein, unit: "g", color: "text-cyan-400" },
          { label: "Avg Carbs", value: avgCarbs, target: targets?.carbs, unit: "g", color: "text-amber-400" },
          { label: "Avg Fats", value: avgFats, target: targets?.fats, unit: "g", color: "text-pink-400" },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>
              {item.value}<span className="text-sm font-normal text-slate-500 ml-1">{item.unit}</span>
            </p>
            {item.target && (
              <p className="text-xs text-slate-500 mt-1">
                Target: {item.target}{item.unit} ·{" "}
                <span className={item.value >= item.target * 0.9 && item.value <= item.target * 1.1 ? "text-green-400" : "text-amber-400"}>
                  {item.target > 0 ? Math.round((item.value / item.target) * 100) : 0}%
                </span>
              </p>
            )}
          </Card>
        ))}
      </motion.div>

      {/* Calorie Adherence Chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Daily Calorie Adherence</h2>
          {calorieData.length < 2 ? (
            <EmptyChart message="Log at least 2 days to see your calorie trend" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={calorieData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                <ReferenceLine y={targets?.calories} stroke="#6366f1" strokeDasharray="4 4" label={{ value: "Target", fill: "#6366f1", fontSize: 11 }} />
                <Bar dataKey="Calories" fill="#6366f1" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      {/* Macro Trend Chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Macro Trends</h2>
          {macroData.length < 2 ? (
            <EmptyChart message="Log at least 2 days to see your macro trends" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={macroData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                <Line type="monotone" dataKey="Protein" stroke="#22d3ee" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Carbs" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Fats" stroke="#f472b6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>

      {/* Weight Trend Chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <h2 className="text-base font-semibold text-white mb-4">Weight Trend</h2>
          {weightData.length < 2 ? (
            <EmptyChart message="Log your weight in Settings to track your progress" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weightData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Weight"
                  stroke="#a78bfa"
                  strokeWidth={2.5}
                  dot={{ fill: "#a78bfa", r: 3 }}
                  activeDot={{ r: 5 }}
                />
                {appUser?.profile?.targetWeight && (
                  <ReferenceLine
                    y={appUser.profile.targetWeight}
                    stroke="#22d3ee"
                    strokeDasharray="4 4"
                    label={{ value: "Goal", fill: "#22d3ee", fontSize: 11 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-slate-500">
      <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  return `${month}/${day}`;
}
