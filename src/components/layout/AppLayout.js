import React from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
import { LogProvider } from "../../context/LogContext";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function AppLayout() {
  return (
    <LogProvider>
      <div className="min-h-screen bg-black flex">
        <Sidebar />
        {/*
          Desktop: push content right of the 256px sidebar (ml-64)
          Mobile:  no left margin, add top padding for the fixed header (pt-16)
                   and bottom padding for the bottom nav bar (pb-20)

          `min-w-0` is critical: <main> is a flex child of the wrapper div
          above, and flex children default to `min-width: auto` which makes
          them grow to fit their intrinsic content size. Without `min-w-0`,
          any single overly-long string anywhere inside (e.g., a food-search
          result name without spaces) would push <main> past the viewport
          and balloon the whole page sideways. `overflow-x-hidden` is the
          safety net so even if a descendant manages to slip past min-w-0,
          the horizontal overflow gets clipped at <main>'s edge instead of
          forcing the viewport to scroll.
        */}
        <main className="flex-1 min-h-screen min-w-0 overflow-x-hidden md:ml-64">
          <motion.div
            key={window.location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="min-h-screen p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6 min-w-0"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </LogProvider>
  );
}
