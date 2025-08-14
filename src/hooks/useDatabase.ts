import { useState, useEffect, useCallback } from 'react';
import { dbManager } from '@/lib/database/connection';
import type { QueryResult, QueryHistory } from '@/types';

export function useDatabase() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    // Prevent multiple simultaneous initialization attempts
    if (isConnecting) {
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      await dbManager.initialize();
      setIsConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize database');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnecting]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const executeQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    if (!isConnected) {
      throw new Error('Database not connected');
    }

    try {
      setError(null);
      return await dbManager.query(sql);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Query execution failed';
      setError(error);
      throw err;
    }
  }, [isConnected]);

  const getConnectionInfo = useCallback(() => {
    return dbManager.getConnectionInfo();
  }, []);

  const getDatabaseSize = useCallback(async () => {
    return await dbManager.getDatabaseSize();
  }, []);

  const getTableList = useCallback(async () => {
    return await dbManager.getTableList();
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    initialize,
    executeQuery,
    getConnectionInfo,
    getDatabaseSize,
    getTableList,
  };
}

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistory[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('supabase_lite_query_history');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
      } catch (err) {
        console.warn('Failed to parse query history:', err);
      }
    }
  }, []);

  const addToHistory = useCallback((query: string, duration: number, success: boolean, error?: string) => {
    const historyItem: QueryHistory = {
      id: crypto.randomUUID(),
      query,
      timestamp: new Date(),
      duration,
      success,
      error,
    };

    setHistory(prev => {
      const newHistory = [historyItem, ...prev].slice(0, 100); // Keep last 100 queries
      localStorage.setItem('supabase_lite_query_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('supabase_lite_query_history');
  }, []);

  return {
    history,
    addToHistory,
    clearHistory,
  };
}