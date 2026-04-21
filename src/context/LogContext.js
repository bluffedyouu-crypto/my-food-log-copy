import React, { createContext, useContext, useState, useCallback } from "react";
import { logsApi } from "../api/client";

const LogContext = createContext(null);

export function LogProvider({ children }) {
  const [activeLog, setActiveLog] = useState(null);   // log for the currently viewed date
  const [loading, setLoading]     = useState(false);

  // Keep todayLog as an alias so existing consumers don't break
  const todayLog = activeLog;

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logsApi.getToday();
      setActiveLog(data.log);
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
