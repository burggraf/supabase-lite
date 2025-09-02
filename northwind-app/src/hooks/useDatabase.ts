import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import type { QueryResult } from '@/types'

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

  // Initialize Supabase connection
  const initialize = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔌 Connecting to Supabase...')
      
      // Test connection by trying to fetch a simple query
      const { data, error: testError } = await supabase
        .from('customers')
        .select('customer_id')
        .limit(1)

      if (testError && testError.code !== 'PGRST116') {
        throw new Error(`Connection test failed: ${testError.message}`)
      }

      setIsConnected(true)
      setIsInitialized(true)
      console.log('✅ Supabase connection established')

    } catch (err: any) {
      console.error('❌ Supabase connection failed:', err)
      setError(err.message || 'Database connection failed')
      setIsConnected(false)
      setIsInitialized(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Execute a query (for raw SQL if needed) - should use Supabase RPC instead
  const executeQuery = useCallback(async (sql: string, params?: any[]): Promise<QueryResult> => {
    if (!isConnected) {
      throw new Error('Database not connected')
    }

    // Raw SQL queries should be converted to Supabase RPC functions or PostgREST operations
    throw new Error('Raw SQL queries are not allowed. Use Supabase client methods or RPC functions instead.')
  }, [isConnected])

  // Initialize database (can be called manually)
  const initializeDatabase = useCallback(async () => {
    await initialize()
  }, [initialize])

  // Reset database (for development/testing) - not needed with Supabase
  const resetDatabase = useCallback(async () => {
    console.log('Reset not needed with Supabase - data persists in parent instance')
  }, [])

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

// DatabaseProvider component
interface DatabaseProviderProps {
  children: React.ReactNode
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const value = useDatabaseProvider()
  return (
    React.createElement(DatabaseContext.Provider, { value }, children)
  )
}