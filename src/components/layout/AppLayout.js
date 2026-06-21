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
        */}
        <main className="flex-1 min-h-screen md:ml-64">
          <motion.div
            key={window.location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="min-h-screen p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </LogProvider>
  );
}
