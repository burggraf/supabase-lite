import { useState, useEffect, useCallback, useRef } from 'react';
import { dbManager } from '@/lib/database/connection';
import type { QueryResult, QueryHistory } from '@/types';

export function useDatabase() {
  console.log('🚀 useDatabase hook called');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isConnectingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  
  console.log('🚀 useDatabase state:', { isConnected, isConnecting, error });

  const initialize = useCallback(async () => {
    console.log('🚀 initialize called, refs:', { 
      isConnecting: isConnectingRef.current, 
      hasInitialized: hasInitializedRef.current 
    });
    
    // Prevent multiple simultaneous initialization attempts or re-initialization
    if (isConnectingRef.current || hasInitializedRef.current) {
      console.log('🚀 Skipping initialization - already running or completed');
      return;
    }
    
    console.log('🚀 Starting database initialization');
    hasInitializedRef.current = true;
    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log('🚀 Calling dbManager.initialize()');
      await dbManager.initialize();
      console.log('🚀 Database initialization successful');
      setIsConnected(true);
    } catch (err) {
      console.error('🚀 Database initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize database');
      setIsConnected(false);
    } finally {
      console.log('🚀 Database initialization cleanup');
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, []);

  useEffect(() => {
    console.log('🚀 useDatabase useEffect triggered');
    initialize();
  }, [initialize]);

  const executeQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    console.log('🚀 executeQuery called:', { isConnected, sql: sql.slice(0, 100) + '...' });
    
    if (!isConnected) {
      console.log('🚀 executeQuery failed - not connected');
      throw new Error('Database not connected');
    }

    try {
      setError(null);
      console.log('🚀 Executing query via dbManager');
      const result = await dbManager.query(sql);
      console.log('🚀 Query executed successfully, rows:', result.rows.length);
      return result;
    } catch (err) {
      console.error('🚀 Query execution failed:', err);
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