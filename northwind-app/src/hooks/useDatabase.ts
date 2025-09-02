import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { DatabaseManager } from '../../../src/lib/database/connection'
import { MigrationRunner } from '../lib/database/MigrationRunner'
import type { QueryResult } from '../../../src/types'

interface DatabaseContextType {
  isConnected: boolean
  isInitialized: boolean
  isLoading: boolean
  error: string | null
  executeQuery: (sql: string, params?: any[]) => Promise<QueryResult>
  initializeDatabase: () => Promise<void>
  resetDatabase: () => Promise<void>
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined)

export function useDatabase() {
  const context = useContext(DatabaseContext)
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider')
  }
  return context
}

export function useDatabaseProvider(): DatabaseContextType {
  const [isConnected, setIsConnected] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dbManager = DatabaseManager.getInstance()
  const migrationRunner = MigrationRunner.getInstance()

  // Initialize database connection and check if Northwind data is available
  const initialize = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔌 Connecting to database...')
      await dbManager.initialize()
      setIsConnected(true)
      console.log('✅ Database connected')

      // Check if Northwind data is initialized
      console.log('🔍 Checking Northwind initialization...')
      const initialized = await migrationRunner.isNorthwindInitialized()
      setIsInitialized(initialized)

      if (!initialized) {
        console.log('📥 Northwind data not found, initializing...')
        await migrationRunner.initializeNorthwindData()
        setIsInitialized(true)
        console.log('✅ Northwind data initialized')
      } else {
        console.log('✅ Northwind data already available')
      }

    } catch (err: any) {
      console.error('❌ Database initialization failed:', err)
      setError(err.message || 'Database initialization failed')
      setIsConnected(false)
      setIsInitialized(false)
    } finally {
      setIsLoading(false)
    }
  }, [dbManager, migrationRunner])

  // Execute a query
  const executeQuery = useCallback(async (sql: string, params?: any[]): Promise<QueryResult> => {
    if (!isConnected) {
      throw new Error('Database not connected')
    }

    try {
      return await dbManager.query(sql, params)
    } catch (err: any) {
      console.error('Query execution failed:', err)
      throw new Error(`Query failed: ${err.message}`)
    }
  }, [dbManager, isConnected])

  // Initialize database (can be called manually)
  const initializeDatabase = useCallback(async () => {
    await initialize()
  }, [initialize])

  // Reset database (for development/testing)
  const resetDatabase = useCallback(async () => {
    if (!isConnected) {
      throw new Error('Database not connected')
    }

    setIsLoading(true)
    try {
      await migrationRunner.resetDatabase()
      await migrationRunner.initializeNorthwindData()
      setIsInitialized(true)
      console.log('✅ Database reset and reinitialized')
    } catch (err: any) {
      console.error('❌ Database reset failed:', err)
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [migrationRunner, isConnected])

  // Initialize on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  return {
    isConnected,
    isInitialized,
    isLoading,
    error,
    executeQuery,
    initializeDatabase,
    resetDatabase,
  }
}

export { DatabaseContext }