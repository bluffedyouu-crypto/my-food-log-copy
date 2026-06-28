import React, { createContext, useContext, useState, useCallback } from "react";
import { logsApi } from "../api/client";

const LogContext = createContext(null);

export function LogProvider({ children }) {
  const [activeLog, setActiveLog] = useState(null);   // log for the currently viewed date
  const [loading, setLoading]     = useState(false);

  // Keep todayLog as an alias so existing consumers don't break
  const todayLog = activeLog;

  // Fetch the "today" log. If a `dateString` is supplied the caller is
  // explicitly telling us which local date is "today" — we use the same
  // date-specific endpoint so the server doesn't have to guess the user's
  // timezone (its own `new Date()` is the *server's* local time, often UTC).
  // Falls back to `/today` for callers that don't have a date handy yet.
  const fetchToday = useCallback(async (dateString) => {
    setLoading(true);
    try {
      const { data } = dateString
        ? await logsApi.getByDate(dateString)
        : await logsApi.getToday();
      // The date-specific endpoint returns `{ log: null }` when no entries
      // exist for that date — wrap it in an empty placeholder so consumers
      // can still read totals/entries without null checks.
      setActiveLog(
        data.log || (dateString
          ? { dateString, entries: [], totals: {}, mealTotals: {} }
          : null)
      );
    } catch (err) {
      console.error("Failed to fetch today's log:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchByDate = useCallback(async (dateString) => {
    setLoading(true);
    try {
      const { data } = await logsApi.getByDate(dateString);
      // If no log exists for that date the server returns { log: null }
      setActiveLog(data.log || { dateString, entries: [], totals: {}, mealTotals: {} });
    } catch (err) {
      console.error("Failed to fetch log for", dateString, err);
      setActiveLog({ dateString, entries: [], totals: {}, mealTotals: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  const addEntry = async (entryData) => {
    const { data } = await logsApi.addEntry(entryData);
    setActiveLog(data.log);
    return data.log;
  };

  const deleteEntry = async (entryId) => {
    const date = activeLog?.dateString;
    const { data } = await logsApi.deleteEntry(entryId, date);
    setActiveLog(data.log);
  };

  return (
    <LogContext.Provider value={{
      todayLog,
      activeLog,
      loading,
      fetchToday,
      fetchByDate,
      addEntry,
      deleteEntry,
    }}>
      {children}
    </LogContext.Provider>
  );
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLog must be used within LogProvider");
  return ctx;
}
