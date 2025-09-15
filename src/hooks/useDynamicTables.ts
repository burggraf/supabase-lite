import { useState, useEffect, useCallback, useRef } from 'react'
import { useDatabase } from './useDatabase'
import type { APIColumn } from '@/lib/utils/postgresqlTypeMapping'
import { convertTableSchemaToAPIColumns } from '@/lib/utils/postgresqlTypeMapping'

export interface TableInfo {
  name: string
  schema: string
  rows: number
  columns?: APIColumn[]
}

export interface PaginatedTablesResult {
  tables: TableInfo[]
  hasMore: boolean
  isLoading: boolean
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  getTotalCount: () => number
}

const TABLES_PER_PAGE = 10
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  data: TableInfo[]
  timestamp: number
}

export function useDynamicTables(schema: string = 'public'): PaginatedTablesResult {
  const { isConnected, getTableList, getTableSchema, connectionId } = useDatabase()
  const [tables, setTables] = useState<TableInfo[]>([])
  const [allTables, setAllTables] = useState<TableInfo[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache to avoid repeated database calls
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const isInitializedRef = useRef(false)

  // Create cache key based on connection and schema
  const getCacheKey = useCallback(() => {
    return `${connectionId}-${schema}`
  }, [connectionId, schema])

  // Check if cached data is still valid
  const isCacheValid = useCallback((cacheKey: string): boolean => {
    const cached = cacheRef.current.get(cacheKey)
    if (!cached) return false

    const now = Date.now()
    return (now - cached.timestamp) < CACHE_DURATION
  }, [])

  // Get cached data if valid
  const getCachedData = useCallback((cacheKey: string): TableInfo[] | null => {
    if (!isCacheValid(cacheKey)) return null
    return cacheRef.current.get(cacheKey)?.data || null
  }, [isCacheValid])

  // Store data in cache
  const setCachedData = useCallback((cacheKey: string, data: TableInfo[]) => {
    cacheRef.current.set(cacheKey, {
      data: [...data], // Create a copy to avoid mutations
      timestamp: Date.now()
    })
  }, [])

  // Fetch all tables from database
  const fetchAllTables = useCallback(async (): Promise<TableInfo[]> => {
    if (!isConnected) {
      throw new Error('Database not connected')
    }

    try {
      const tableList = await getTableList()

      // Filter by schema and convert to TableInfo format
      const filteredTables = tableList
        .filter(table => table.schema === schema)
        .map(table => ({
          name: table.name,
          schema: table.schema,
          rows: table.rows || 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically

      return filteredTables
    } catch (err) {
      console.error('Failed to fetch tables:', err)
      throw err
    }
  }, [isConnected, getTableList, schema])

  // Load table schema for a specific table
  const loadTableSchema = useCallback(async (tableName: string): Promise<APIColumn[]> => {
    try {
      const dbColumns = await getTableSchema(tableName, schema)
      return convertTableSchemaToAPIColumns(dbColumns)
    } catch (err) {
      console.error(`Failed to load schema for table ${tableName}:`, err)
      return []
    }
  }, [getTableSchema, schema])

  // Load tables with caching
  const loadTables = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const cacheKey = getCacheKey()

      // Try to use cached data unless force refresh is requested
      if (!forceRefresh) {
        const cachedTables = getCachedData(cacheKey)
        if (cachedTables) {
          setAllTables(cachedTables)
          setTables(cachedTables.slice(0, TABLES_PER_PAGE))
          setCurrentPage(0)
          setIsLoading(false)
          return
        }
      }

      // Fetch fresh data from database
      const freshTables = await fetchAllTables()

      // Store in cache
      setCachedData(cacheKey, freshTables)

      // Update state
      setAllTables(freshTables)
      setTables(freshTables.slice(0, TABLES_PER_PAGE))
      setCurrentPage(0)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tables'
      setError(errorMessage)
      setAllTables([])
      setTables([])
      setCurrentPage(0)
    } finally {
      setIsLoading(false)
    }
  }, [getCacheKey, getCachedData, setCachedData, fetchAllTables])

  // Load more tables (pagination)
  const loadMore = useCallback(async () => {
    if (isLoading) return

    const nextPage = currentPage + 1
    const startIndex = nextPage * TABLES_PER_PAGE
    const endIndex = startIndex + TABLES_PER_PAGE

    if (startIndex >= allTables.length) return

    setIsLoading(true)

    try {
      // Get next batch of tables
      const nextBatch = allTables.slice(startIndex, endIndex)

      // Load schemas for new tables (in background, don't block UI)
      nextBatch.forEach(async (table) => {
        if (!table.columns) {
          try {
            table.columns = await loadTableSchema(table.name)
          } catch (err) {
            console.warn(`Failed to load schema for ${table.name}:`, err)
          }
        }
      })

      // Update displayed tables
      setTables(prev => [...prev, ...nextBatch])
      setCurrentPage(nextPage)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more tables'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, currentPage, allTables, loadTableSchema])

  // Refresh data (force reload from database)
  const refresh = useCallback(async () => {
    await loadTables(true)
  }, [loadTables])

  // Get total count of available tables
  const getTotalCount = useCallback(() => {
    return allTables.length
  }, [allTables.length])

  // Check if there are more tables to load
  const hasMore = useCallback(() => {
    const loadedCount = (currentPage + 1) * TABLES_PER_PAGE
    return loadedCount < allTables.length
  }, [currentPage, allTables.length])

  // Initialize data when connection changes
  useEffect(() => {
    if (!isConnected) {
      setAllTables([])
      setTables([])
      setCurrentPage(0)
      setError(null)
      isInitializedRef.current = false
      return
    }

    // Only load if not already initialized for this connection
    if (!isInitializedRef.current && connectionId) {
      isInitializedRef.current = true
      loadTables(false)
    }
  }, [isConnected, connectionId, loadTables])

  // Reset when schema changes
  useEffect(() => {
    if (isConnected) {
      isInitializedRef.current = false
      loadTables(false)
    }
  }, [schema]) // Only depend on schema, not loadTables to avoid infinite loops

  return {
    tables,
    hasMore: hasMore(),
    isLoading,
    error,
    loadMore,
    refresh,
    getTotalCount,
  }
}