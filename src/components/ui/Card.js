import React from "react";
import { motion } from "framer-motion";

export default function Card({ children, className = "", hover = false, onClick, ...props }) {
  const base = `
    rounded-2xl p-5
    bg-gradient-to-br from-[#111827] to-[#1a2235]
    border border-white/5
    ${hover ? "cursor-pointer hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300" : ""}
    ${className}
  `;

  if (hover || onClick) {
    return (
      <motion.div
        className={base}
        whileHover={{ y: -2 }}
        onClick={onClick}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={base} {...props}>
      {children}
    </div>
  );
}
