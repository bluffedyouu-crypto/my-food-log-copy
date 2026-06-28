// ─── Local-date helpers ───────────────────────────────────────────────────────
// `new Date().toISOString().split("T")[0]` returns a date in UTC, which causes
// two bugs for users east of UTC (e.g. IST = UTC+5:30):
//
//   • Late-night logging is filed under the previous calendar day in the user's
//     wallclock view, because the UTC date hasn't rolled over yet.
//   • A "today" pill computed once on mount stays on yesterday's UTC date
//     until the page is reloaded — which is the "date doesn't change after
//     12am" bug.
//
// These helpers always work in the browser's local timezone, and the React
// hook below auto-refreshes the returned date string when the local clock
// crosses midnight, so any component that renders a "Today" label or fetches
// the user's daily log will update without needing a manual reload.

import { useEffect, useState, useRef } from "react";

/** Format a Date in local time as `YYYY-MM-DD`. */
export function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Milliseconds remaining until the *next* local midnight (plus a 1s buffer). */
function msUntilNextMidnight() {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    1, // 1 second past midnight to defeat any clock-edge rounding
    0
  );
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * Returns the current local date string (YYYY-MM-DD) and auto-refreshes it
 * when the wallclock crosses midnight. Components that depend on "today"
 * (the date strip, weight log card, fitness tracker) will rerender and
 * pick up the new date without a manual reload.
 *
 * We additionally check on `visibilitychange` so that returning to a tab
 * that was backgrounded across midnight gets the updated date even if the
 * setTimeout was throttled by the browser.
 */
export function useLocalToday() {
  const [today, setToday] = useState(() => localDateString());
  // Keep a ref to the latest value so the visibility handler can compare
  // without re-binding every render.
  const todayRef = useRef(today);
  todayRef.current = today;

  useEffect(() => {
    let timeoutId;

    const refresh = () => {
      const next = localDateString();
      if (next !== todayRef.current) {
        setToday(next);
      }
      // Re-arm for the *next* midnight.
      timeoutId = setTimeout(refresh, msUntilNextMidnight());
    };

    // First arm — aligned to the upcoming midnight, not a fixed interval,
    // so the update fires within a second of the actual rollover.
    timeoutId = setTimeout(refresh, msUntilNextMidnight());

    // Tab-visibility safety net — browsers throttle background timers, so a
    // tab left open overnight may not fire the timeout exactly at midnight.
    // When the user comes back, immediately check whether the date changed.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const next = localDateString();
        if (next !== todayRef.current) {
          setToday(next);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
