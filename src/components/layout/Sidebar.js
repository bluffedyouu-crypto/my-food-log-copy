import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import Icon from "../ui/Icon";

const navItems = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: "/bowl-builder",
    label: "Bowls",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
function DesktopSidebar({ appUser, onSignOut }) {
  return (
    <motion.aside
      className="hidden md:flex fixed left-0 top-0 h-full w-64 glass-strong border-r border-white/5 flex-col z-30"
      initial={{ x: -264 }}
      animate={{ x: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
    >
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <Icon name="salad" size={18} />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Shredd.fun</h1>
            <p className="text-slate-500 text-xs">Diet Tracker</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
            {appUser?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{appUser?.name || "User"}</p>
            <p className="text-xs text-slate-500 truncate">{appUser?.email}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </motion.aside>
  );
}

// ─── Mobile Header ────────────────────────────────────────────────────────────
function MobileHeader({ appUser, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-40 glass-strong border-b border-white/5 px-4 py-3 flex items-center justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
            <Icon name="salad" size={16} />
          </div>
          <span className="text-white font-bold text-base">Shredd</span>
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
              {appUser?.name?.[0]?.toUpperCase() || "U"}
            </div>
          )}
        </button>
      </div>

      {/* Slide-down user menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed left-0 right-0 z-30 glass-strong border-b border-white/5 px-4 py-4"
            style={{ top: "calc(57px + env(safe-area-inset-top, 0px))" }}
          >
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-base font-bold text-white">
                {appUser?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{appUser?.name || "User"}</p>
                <p className="text-xs text-slate-500 truncate">{appUser?.email}</p>
              </div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-red-400 bg-red-500/10 border border-red-500/20 font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Mobile Bottom Navigation ─────────────────────────────────────────────────
function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-white/5 flex items-center justify-around px-2"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 8px), 8px)", paddingTop: "8px" }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all duration-200 min-w-0 ${
              isActive ? "text-indigo-400" : "text-slate-500"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? "bg-indigo-500/20" : ""}`}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { appUser, signOut } = useAuth();
  const navigate = useNavigate();

  // Sign-out is best-effort end-to-end: the AuthContext already swallows
  // server-side errors and clears local state, so we also wrap the navigate
  // call in a finally to guarantee the user lands on /login no matter what.
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.warn("[auth] sign-out failed unexpectedly:", err?.message || err);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <>
      <DesktopSidebar appUser={appUser} onSignOut={handleSignOut} />
      <MobileHeader appUser={appUser} onSignOut={handleSignOut} />
      <MobileBottomNav />
    </>
  );
}
