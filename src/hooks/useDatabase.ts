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
    
    // Prevent multiple simultaneous initialization attempts (React StrictMode protection)
    if (isConnectingRef.current) {
      console.log('🚀 Initialization already in progress, skipping to prevent double initialization');
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
  }, []); // Remove circular dependencies!

  // Single useEffect to handle database initialization
  useEffect(() => {
    console.log('🚀🚀🚀 useDatabase useEffect triggered - checking for active project database');
    
    // Skip if already connecting or connected
    if (isConnectingRef.current || isConnecting) {
      console.log('🚀🚀🚀 Already connecting, skipping initialization');
      return;
    }
    
    // Get active project and initialize with its database path
    const activeProject = projectManager.getActiveProject();
    if (activeProject) {
      // Skip if already connected to this project's database
      if (connectionId === activeProject.databasePath && isConnected) {
        console.log('🚀🚀🚀 Already connected to active project database, skipping');
        return;
      }
      
      console.log('🚀🚀🚀 Active project found, initializing database:', {
        name: activeProject.name,
        id: activeProject.id,
        databasePath: activeProject.databasePath,
        currentConnectionId: connectionId,
        isConnected: isConnected
      });
      initialize(activeProject.databasePath);
    } else {
      console.log('🚀🚀🚀 No active project found, waiting for project creation');
      // Don't initialize with default database - wait for project creation
      // The Dashboard component will handle creating the first project and calling switchToProject
    }
  }, []); // Only run once on mount

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

  const close = useCallback(async () => {
    console.log('🔴 close called - closing database connection');
    setIsConnecting(true);
    try {
      await dbManager.close();
      setIsConnected(false);
      setConnectionId('');
      setError(null);
      console.log('🔴 Database connection closed successfully');
    } catch (err) {
      console.error('🔴 Failed to close database:', err);
      setError(err instanceof Error ? err.message : 'Failed to close database');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchToProject = useCallback(async (databasePath: string) => {
    console.log('🔴🔴🔴 switchToProject called:', { 
      databasePath, 
      currentConnectionId: connectionId,
      isConnected,
      isConnecting 
    });
    
    // If we're already connected to this database, skip the switch
    if (connectionId === databasePath && isConnected) {
      console.log('🔴🔴🔴 Already connected to target database, skipping switch');
      return;
    }
    
    // Check if database is already transitioning
    if (dbManager.isConnectionTransitioning()) {
      console.log('🔴🔴🔴 Database is already transitioning, waiting...');
      throw new Error('Database switch already in progress');
    }
    
    console.log('🔴🔴🔴 Proceeding with atomic database switch...');
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log('🔴🔴🔴 Calling dbManager.switchDatabase with:', databasePath);
      await dbManager.switchDatabase(databasePath);
      console.log('🔴🔴🔴 Atomic database switch completed successfully');
      
      // Validate the connection after switch
      const newConnectionInfo = dbManager.getConnectionInfo();
      console.log('🔴🔴🔴 New database connection info after switch:', newConnectionInfo);
      
      if (!newConnectionInfo || newConnectionInfo.id !== databasePath) {
        throw new Error('Database switch validation failed - connection mismatch');
      }
      
      // Validate the connection immediately - no timing delays needed
      try {
        const tableList = await dbManager.getTableList();
        console.log('🔴🔴🔴 Connection validated - tables found:', tableList.length);
      } catch (tableError) {
        console.error('🔴🔴🔴 Connection validation failed - cannot query tables:', tableError);
        throw new Error('Database switch validation failed - cannot query tables');
      }
      
      // Only update state after validation succeeds
      setIsConnected(true);
      setConnectionId(databasePath);
      console.log('🔴🔴🔴 Hook state updated - validated connectionId set to:', databasePath);
    } catch (err) {
      console.error('🔴🔴🔴 Atomic database switch failed:', err);
      const error = err instanceof Error ? err.message : 'Failed to switch database';
      setError(error);
      setIsConnected(false);
      setConnectionId('');
      throw err;
    } finally {
      console.log('🔴🔴🔴 Database switch cleanup, setting isConnecting to false');
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