import { useState, useEffect, useCallback, useRef } from 'react';
import { dbManager } from '@/lib/database/connection';
import { projectManager } from '@/lib/projects/ProjectManager';
import type { QueryResult, ScriptResult, QueryHistory } from '@/types';

export function useDatabase() {
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string>(''); // Track database switches using database path
  const isConnectingRef = useRef(false);
  

  const initialize = useCallback(async (customDataDir?: string) => {
    const targetDataDir = customDataDir || 'idb://supabase_lite_db';
    
    // If we're already connected to this database, skip initialization
    if (connectionId === targetDataDir && isConnected) {
      return;
    }
    
    // Prevent multiple simultaneous initialization attempts (React StrictMode protection)
    if (isConnectingRef.current) {
      return;
    }
    
    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);
    
    try {
      await dbManager.initialize(targetDataDir);
      setIsConnected(true);
      setConnectionId(targetDataDir); // Use database path as connection ID
    } catch (err) {
      console.error('🚀 Database initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize database');
      setIsConnected(false);
      setConnectionId(''); // Clear connection ID on failure
    } finally {
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [connectionId, isConnected]); // Include state dependencies

  // Single useEffect to handle database initialization
  useEffect(() => {
    
    // Skip if already connecting or connected
    if (isConnectingRef.current || isConnecting) {
      return;
    }
    
    // Get active project and initialize with its database path
    const activeProject = projectManager.getActiveProject();
    if (activeProject) {
      // Skip if already connected to this project's database
      if (connectionId === activeProject.databasePath && isConnected) {
        return;
      }
      
      initialize(activeProject.databasePath);
    } else {
      // Don't initialize with default database - wait for project creation
      // The Dashboard component will handle creating the first project and calling switchToProject
    }
  }, [connectionId, initialize, isConnected, isConnecting]); // Dependencies for proper re-execution

  const executeQuery = useCallback(async (sql: string): Promise<QueryResult> => {
    
    if (!isConnected) {
      throw new Error('Database not connected');
    }

    try {
      setError(null);
      const result = await dbManager.query(sql);
      return result;
    } catch (err) {
      console.error('🚀 Query execution failed:', err);
      const error = err instanceof Error ? err.message : 'Query execution failed';
      setError(error);
      throw err;
    }
  }, [isConnected]);

  const executeScript = useCallback(async (sql: string): Promise<ScriptResult> => {
    
    if (!isConnected) {
      throw new Error('Database not connected');
    }

    try {
      setError(null);
      const result = await dbManager.execScript(sql);
      return result;
    } catch (err) {
      console.error('🚀 Script execution failed:', err);
      const error = err instanceof Error ? err.message : 'Script execution failed';
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

  const getTableSchema = useCallback(async (tableName: string, schema: string = 'public') => {
    return await dbManager.getTableSchema(tableName, schema);
  }, []);

  const close = useCallback(async () => {
    setIsConnecting(true);
    try {
      await dbManager.close();
      setIsConnected(false);
      setConnectionId('');
      setError(null);
    } catch (err) {
      console.error('🔴 Failed to close database:', err);
      setError(err instanceof Error ? err.message : 'Failed to close database');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchToProject = useCallback(async (databasePath: string) => {
    
    const currentConnectionInfo = dbManager.getConnectionInfo();
    
    // Check if database is already transitioning
    if (dbManager.isConnectionTransitioning()) {
      throw new Error('Database switch already in progress');
    }
    
    // Always check actual database state instead of relying on cached React state
    if (currentConnectionInfo && currentConnectionInfo.id === databasePath && isConnected) {
      // Already connected to the correct database - validate with a quick query
      try {
        await dbManager.getTableList();
        return; // Everything is working correctly, no switch needed
      } catch (validationError) {
        // Connection is stale, proceed with switch
        console.warn('Connection validation failed, proceeding with database switch:', validationError);
      }
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      await dbManager.switchDatabase(databasePath);
      
      // Validate the connection after switch
      const newConnectionInfo = dbManager.getConnectionInfo();
      
      if (!newConnectionInfo || newConnectionInfo.id !== databasePath) {
        throw new Error('Database switch validation failed - connection mismatch');
      }
      
      // Validate the connection immediately - no timing delays needed
      try {
        await dbManager.getTableList();
      } catch (tableError) {
        console.error('🔴🔴🔴 Connection validation failed - cannot query tables:', tableError);
        throw new Error('Database switch validation failed - cannot query tables');
      }
      
      // Only update state after validation succeeds
      setIsConnected(true);
      setConnectionId(databasePath);
    } catch (err) {
      console.error('🔴🔴🔴 Atomic database switch failed:', err);
      const error = err instanceof Error ? err.message : 'Failed to switch database';
      setError(error);
      setIsConnected(false);
      setConnectionId('');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectionId, isConnected]);

  return {
    isConnected,
    isConnecting,
    error,
    connectionId, // Expose connection ID for other hooks to track changes
    initialize, // Export initialize for new project creation
    close, // Export close for forcing reconnection cycles
    executeQuery,
    executeScript,
    getConnectionInfo,
    getDatabaseSize,
    getTableList,
    getTableSchema,
    switchToProject,
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