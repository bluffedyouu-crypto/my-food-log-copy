import React, { useEffect, useState } from "react";

/**
 * Animated linear macro progress bar.
 * Fills from 0 → value on mount via CSS transition.
 */
export default function MacroBar({
  label,
  consumed = 0,
  target = 0,
  color = "#6366f1",
  glowClass = "glow-indigo",
  unit = "g",
}) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  const over = target > 0 && consumed > target;

  // Trigger fill animation after mount
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);

  const barColor = over ? "#ef4444" : color;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <span className="text-xs text-slate-500">
          <span style={{ color: barColor }} className="font-semibold">
            {Math.round(consumed)}
          </span>
          /{target}{unit}
        </span>
      </div>

      {/* Track */}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
            boxShadow: `0 0 8px ${barColor}60`,
          }}
        />
      </div>

      {/* Percentage */}
      <div className="flex justify-end">
        <span className="text-[10px]" style={{ color: over ? "#ef4444" : "#64748b" }}>
          {Math.round(pct)}%{over ? " · over" : ""}
        </span>
      </div>
    </div>
  );
}
