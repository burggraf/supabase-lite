import { useState, useEffect, useCallback, useRef } from 'react'
import { useDatabase } from './useDatabase'
import type { DatabaseFunction, FunctionDetails } from '@/lib/utils/functionDiscovery'
import { generateFunctionDescription, parseArgumentTypes } from '@/lib/utils/functionDiscovery'

export interface FunctionInfo {
  name: string
  schema: string
  return_type: string
  argument_types: string
  description: string
  details?: FunctionDetails
}

export interface PaginatedFunctionsResult {
  functions: FunctionInfo[]
  hasMore: boolean
  isLoading: boolean
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  getTotalCount: () => number
}

const FUNCTIONS_PER_PAGE = 10
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  data: FunctionInfo[]
  timestamp: number
}

export function useDynamicFunctions(schema: string = 'public'): PaginatedFunctionsResult {
  const { isConnected, getFunctionList, getFunctionDetails, connectionId } = useDatabase()
  const [functions, setFunctions] = useState<FunctionInfo[]>([])
  const [allFunctions, setAllFunctions] = useState<FunctionInfo[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache to avoid repeated database calls
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const isInitializedRef = useRef(false)

  // Create cache key based on connection and schema
  const getCacheKey = useCallback(() => {
    return `${connectionId}-${schema}-functions`
  }, [connectionId, schema])

  // Check if cached data is still valid
  const isCacheValid = useCallback((cacheKey: string): boolean => {
    const cached = cacheRef.current.get(cacheKey)
    if (!cached) return false

    const now = Date.now()
    return (now - cached.timestamp) < CACHE_DURATION
  }, [])

  // Get cached data if valid
  const getCachedData = useCallback((cacheKey: string): FunctionInfo[] | null => {
    if (!isCacheValid(cacheKey)) return null
    return cacheRef.current.get(cacheKey)?.data || null
  }, [isCacheValid])

  // Store data in cache
  const setCachedData = useCallback((cacheKey: string, data: FunctionInfo[]) => {
    cacheRef.current.set(cacheKey, {
      data: [...data], // Create a copy to avoid mutations
      timestamp: Date.now()
    })
  }, [])

  // Fetch all functions from database
  const fetchAllFunctions = useCallback(async (): Promise<FunctionInfo[]> => {
    if (!isConnected) {
      throw new Error('Database not connected')
    }

    try {
      const functionList = await getFunctionList(schema)

      // Convert to FunctionInfo format with enhanced descriptions
      const functionsWithDescriptions = functionList.map(func => ({
        name: func.name,
        schema: func.schema,
        return_type: func.return_type,
        argument_types: func.argument_types,
        description: func.description || generateFunctionDescription(func)
      }))

      // Sort alphabetically
      return functionsWithDescriptions.sort((a, b) => a.name.localeCompare(b.name))
    } catch (err) {
      console.error('Failed to fetch functions:', err)
      throw err
    }
  }, [isConnected, getFunctionList, schema])

  // Load function details for a specific function
  const loadFunctionDetails = useCallback(async (functionName: string): Promise<FunctionDetails | null> => {
    try {
      return await getFunctionDetails(functionName, schema)
    } catch (err) {
      console.error(`Failed to load details for function ${functionName}:`, err)
      return null
    }
  }, [getFunctionDetails, schema])

  // Load functions with caching
  const loadFunctions = useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const cacheKey = getCacheKey()

      // Try to use cached data unless force refresh is requested
      if (!forceRefresh) {
        const cachedFunctions = getCachedData(cacheKey)
        if (cachedFunctions) {
          setAllFunctions(cachedFunctions)
          setFunctions(cachedFunctions.slice(0, FUNCTIONS_PER_PAGE))
          setCurrentPage(0)
          setIsLoading(false)
          return
        }
      }

      // Fetch fresh data from database
      const freshFunctions = await fetchAllFunctions()

      // Store in cache
      setCachedData(cacheKey, freshFunctions)

      // Update state
      setAllFunctions(freshFunctions)
      setFunctions(freshFunctions.slice(0, FUNCTIONS_PER_PAGE))
      setCurrentPage(0)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load functions'
      setError(errorMessage)
      setAllFunctions([])
      setFunctions([])
      setCurrentPage(0)
    } finally {
      setIsLoading(false)
    }
  }, [getCacheKey, getCachedData, setCachedData, fetchAllFunctions])

  // Load more functions (pagination)
  const loadMore = useCallback(async () => {
    if (isLoading) return

    const nextPage = currentPage + 1
    const startIndex = nextPage * FUNCTIONS_PER_PAGE
    const endIndex = startIndex + FUNCTIONS_PER_PAGE

    if (startIndex >= allFunctions.length) return

    setIsLoading(true)

    try {
      // Get next batch of functions
      const nextBatch = allFunctions.slice(startIndex, endIndex)

      // Load details for new functions (in background, don't block UI)
      nextBatch.forEach(async (func) => {
        if (!func.details) {
          try {
            func.details = await loadFunctionDetails(func.name) || undefined
          } catch (err) {
            console.warn(`Failed to load details for ${func.name}:`, err)
          }
        }
      })

      // Update displayed functions
      setFunctions(prev => [...prev, ...nextBatch])
      setCurrentPage(nextPage)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more functions'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, currentPage, allFunctions, loadFunctionDetails])

  // Refresh data (force reload from database)
  const refresh = useCallback(async () => {
    await loadFunctions(true)
  }, [loadFunctions])

  // Get total count of available functions
  const getTotalCount = useCallback(() => {
    return allFunctions.length
  }, [allFunctions.length])

  // Check if there are more functions to load
  const hasMore = useCallback(() => {
    const loadedCount = (currentPage + 1) * FUNCTIONS_PER_PAGE
    return loadedCount < allFunctions.length
  }, [currentPage, allFunctions.length])

  // Initialize data when connection changes
  useEffect(() => {
    if (!isConnected) {
      setAllFunctions([])
      setFunctions([])
      setCurrentPage(0)
      setError(null)
      isInitializedRef.current = false
      return
    }

    // Only load if not already initialized for this connection
    if (!isInitializedRef.current && connectionId) {
      isInitializedRef.current = true
      loadFunctions(false)
    }
  }, [isConnected, connectionId, loadFunctions])

  // Reset when schema changes
  useEffect(() => {
    if (isConnected) {
      isInitializedRef.current = false
      loadFunctions(false)
    }
  }, [schema]) // Only depend on schema, not loadFunctions to avoid infinite loops

  return {
    functions,
    hasMore: hasMore(),
    isLoading,
    error,
    loadMore,
    refresh,
    getTotalCount,
  }
}