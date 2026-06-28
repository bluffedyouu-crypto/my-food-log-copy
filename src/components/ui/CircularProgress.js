import React from "react";
import { motion } from "framer-motion";

/**
 * Animated SVG circular progress ring.
 *
 * The SVG is rotated -90° so the arc starts at 12 o'clock.
 * The center-text slot is rendered as a sibling div using
 * absolute positioning inside a `position:relative` wrapper —
 * this is the only reliable way to center content over an SVG
 * without fighting the SVG coordinate system.
 */
export default function CircularProgress({
  value = 0,
  size = 120,
  strokeWidth = 8,
  color = "#6366f1",
  trackColor = "rgba(99,102,241,0.1)",
  children,        // optional: custom center content
  className = "",
}) {
  const radius       = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped      = Math.min(Math.max(value || 0, 0), 100);
  const offset       = circumference - (clamped / 100) * circumference;
  const displayColor = value > 100 ? "#ef4444" : color;

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* SVG ring — rotated so arc starts at top */}
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        className="absolute inset-0"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Animated fill */}
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
          transition={{ duration: 1.1, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${displayColor}70)` }}
        />
      </svg>

      {/* Center content — sits on top of the SVG, perfectly centered */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
