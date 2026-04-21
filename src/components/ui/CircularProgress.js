import React from "react";
import { motion } from "framer-motion";

/**
 * Animated circular progress ring
 */
export default function CircularProgress({
  value = 0,       // 0–100
  size = 120,
  strokeWidth = 8,
  color = "#6366f1",
  trackColor = "#1a2235",
  label,
  sublabel,
  className = "",
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (clampedValue / 100) * circumference;

  // Color shifts to red when over 100%
  const displayColor = value > 100 ? "#ef4444" : color;

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={displayColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${displayColor}60)` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-white font-bold"
            style={{ fontSize: size * 0.18 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(clampedValue)}%
          </motion.span>
        </div>
      </div>
      {label && (
        <span className="text-sm font-semibold text-slate-300">{label}</span>
      )}
      {sublabel && (
        <span className="text-xs text-slate-500">{sublabel}</span>
      )}
    </div>
  );
}
