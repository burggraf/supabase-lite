import { useState, useEffect, useCallback, useRef } from 'react';
import { dbManager } from '@/lib/database/connection';
import { projectManager } from '@/lib/projects/ProjectManager';
import type { QueryResult, ScriptResult, QueryHistory } from '@/types';

export function useDatabase() {
  console.log('🚀 useDatabase hook called');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string>(''); // Track database switches using database path
  const isConnectingRef = useRef(false);
  
  console.log('🚀 useDatabase state:', { isConnected, isConnecting, error, connectionId });

  const initialize = useCallback(async (customDataDir?: string) => {
    const targetDataDir = customDataDir || 'idb://supabase_lite_db';
    console.log('🚀 initialize called with dataDir:', targetDataDir);
    console.log('🚀 Current state:', { 
      isConnecting: isConnectingRef.current,
      currentConnectionId: connectionId 
    });
    
    // If we're already connected to this database, skip initialization
    if (connectionId === targetDataDir && isConnected) {
      console.log('🚀 Already connected to target database, skipping initialization');
      return;
    }
    
    // Prevent multiple simultaneous initialization attempts
    if (isConnectingRef.current) {
      console.log('🚀 Initialization already in progress, skipping');
      return;
    }
    
    console.log('🚀 Starting database initialization for:', targetDataDir);
    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log('🚀 Calling dbManager.initialize() with dataDir:', targetDataDir);
      await dbManager.initialize(targetDataDir);
      console.log('🚀 Database initialization successful');
      setIsConnected(true);
      setConnectionId(targetDataDir); // Use database path as connection ID
    } catch (err) {
      console.error('🚀 Database initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize database');
      setIsConnected(false);
      setConnectionId(''); // Clear connection ID on failure
    } finally {
      console.log('🚀 Database initialization cleanup');
      setIsConnecting(false);
      isConnectingRef.current = false;
    }
  }, [connectionId, isConnected]);

  useEffect(() => {
    console.log('🚀 useDatabase useEffect triggered - auto-initializing with active project database');
    
    // Get active project and initialize with its database path
    const activeProject = projectManager.getActiveProject();
    if (activeProject) {
      console.log('🚀 Auto-initializing with active project database:', activeProject.databasePath);
      initialize(activeProject.databasePath);
    } else {
      console.log('🚀 No active project found, initializing with default database');
      initialize();
    }
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

  const executeScript = useCallback(async (sql: string): Promise<ScriptResult> => {
    console.log('🚀 executeScript called:', { isConnected, sql: sql.slice(0, 100) + '...' });
    
    if (!isConnected) {
      console.log('🚀 executeScript failed - not connected');
      throw new Error('Database not connected');
    }

    try {
      setError(null);
      console.log('🚀 Executing script via dbManager');
      const result = await dbManager.execScript(sql);
      console.log('🚀 Script executed successfully, statements:', result.successCount);
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

  const switchToProject = useCallback(async (databasePath: string) => {
    console.log('🚀 switchToProject called:', { databasePath, currentConnectionId: connectionId });
    
    // If we're already connected to this database, skip the switch
    if (connectionId === databasePath && isConnected) {
      console.log('🚀 Already connected to target database, skipping switch');
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log('🚀 Switching database via dbManager to:', databasePath);
      await dbManager.switchDatabase(databasePath);
      console.log('🚀 Database switch successful');
      
      // Verify the switch worked by checking connection info
      const newConnectionInfo = dbManager.getConnectionInfo();
      console.log('🚀 New database connection info:', newConnectionInfo);
      
      setIsConnected(true);
      setConnectionId(databasePath); // Use database path as connection ID
      console.log('🚀 ConnectionId updated to:', databasePath);
    } catch (err) {
      console.error('🚀 Database switch failed:', err);
      const error = err instanceof Error ? err.message : 'Failed to switch database';
      setError(error);
      setIsConnected(false);
      setConnectionId(''); // Clear connection ID on failure
      throw err;
    } finally {
      console.log('🚀 Database switch cleanup');
      setIsConnecting(false);
    }
  }, [connectionId, isConnected]);

  return {
    isConnected,
    isConnecting,
    error,
    connectionId, // Expose connection ID for other hooks to track changes
    initialize,
    executeQuery,
    executeScript,
    getConnectionInfo,
    getDatabaseSize,
    getTableList,
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