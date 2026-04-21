import React, { createContext, useContext, useState, useCallback } from "react";
import { logsApi } from "../api/client";

const LogContext = createContext(null);

export function LogProvider({ children }) {
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logsApi.getToday();
      setTodayLog(data.log);
    } catch (err) {
      console.error("Failed to fetch today's log:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addEntry = async (entryData) => {
    const { data } = await logsApi.addEntry(entryData);
    setTodayLog(data.log);
    return data.log;
  };

  const deleteEntry = async (entryId) => {
    const date = todayLog?.dateString;
    const { data } = await logsApi.deleteEntry(entryId, date);
    setTodayLog(data.log);
  };

  return (
    <LogContext.Provider value={{ todayLog, loading, fetchToday, addEntry, deleteEntry }}>
      {children}
    </LogContext.Provider>
  );
}

export function useLog() {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLog must be used within LogProvider");
  return ctx;
}
