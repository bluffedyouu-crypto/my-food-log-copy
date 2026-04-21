import React from "react";

export default function Input({
  label,
  error,
  className = "",
  containerClassName = "",
  ...props
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-sm font-medium text-slate-300">{label}</label>
      )}
      <input
        className={`
          w-full px-4 py-3 rounded-xl
          bg-space-800 border border-white/10
          text-white placeholder-slate-500
          focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20
          transition-all duration-200
          ${error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20" : ""}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
