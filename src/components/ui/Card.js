import React from "react";
import { motion } from "framer-motion";

/**
 * Premium glassmorphism card.
 * hover=true  → subtle lift + border glow on mouse-over
 * glow=true   → persistent indigo glow (for hero cards)
 */
export default function Card({
  children,
  className = "",
  hover = false,
  glow = false,
  onClick,
  ...props
}) {
  const base = [
    "rounded-2xl p-5 glass-card",
    glow ? "glow-indigo" : "",
    onClick || hover ? "cursor-pointer" : "",
    className,
  ].join(" ");

  if (hover || onClick) {
    return (
      <motion.div
        className={base}
        whileHover={{ y: -3, transition: { duration: 0.2 } }}
        whileTap={{ scale: 0.99 }}
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
