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
        <main className="flex-1 ml-64 min-h-screen">
          <motion.div
            key={window.location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="min-h-screen p-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </LogProvider>
  );
}
