import { supabase } from '@/lib/supabase'
import type { QueryResult } from '@/types'

export interface PaginationOptions {
  page: number
  limit: number
  offset?: number
}

export interface SortOptions {
  field: string
  direction: 'ASC' | 'DESC'
}

export interface FilterOptions {
  [key: string]: any
}

export interface QueryOptions {
  pagination?: PaginationOptions
  sort?: SortOptions[]
  filters?: FilterOptions
  search?: {
    fields: string[]
    query: string
  }
}

export interface RepositoryResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export abstract class BaseRepository<T> {
  protected tableName: string
  protected primaryKey: string

  constructor(tableName: string, primaryKey: string = 'id') {
    this.tableName = tableName
    this.primaryKey = primaryKey
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string | number): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq(this.primaryKey, id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to find record: ${error.message}`)
    }

    return data || null
  }

  /**
   * Find all records with optional filtering, sorting, and pagination
   */
  async findAll(options: QueryOptions = {}): Promise<RepositoryResult<T>> {
    const { pagination = { page: 1, limit: 20 }, sort, filters, search } = options
    
    // Start with base query
    let query = supabase.from(this.tableName).select('*', { count: 'exact' })

    // Apply filters
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(field, value)
          } else if (typeof value === 'string' && value.includes('%')) {
            query = query.ilike(field, value)
          } else {
            query = query.eq(field, value)
          }
        }
      }
    }

    // Apply search
    if (search && search.query && search.fields.length > 0) {
      // For multiple fields, we'll use or() with individual ilike conditions
      const searchConditions = search.fields.map(field => `${field}.ilike.%${search.query}%`)
      if (searchConditions.length === 1) {
        query = query.ilike(search.fields[0], `%${search.query}%`)
      } else {
        query = query.or(searchConditions.join(','))
      }
    }

    // Apply sorting
    if (sort && sort.length > 0) {
      for (const s of sort) {
        query = query.order(s.field, { ascending: s.direction === 'ASC' })
      }
    } else {
      // Default sort by primary key
      query = query.order(this.primaryKey)
    }

    // Apply pagination
    const page = pagination.page || 1
    const limit = pagination.limit || 20
    const offset = (page - 1) * limit
    
    query = query.range(offset, offset + limit - 1)

    // Execute query
    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch records: ${error.message}`)
    }

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return {
      data: data || [],
      total,
      page,
      limit,
      totalPages,
    }
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    const { data: result, error } = await supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create record: ${error.message}`)
    }

    return result
  }

  /**
   * Update a record by ID
   */
  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    if (Object.keys(data).length === 0) {
      return this.findById(id)
    }

    const { data: result, error } = await supabase
      .from(this.tableName)
      .update(data)
      .eq(this.primaryKey, id)
      .select()
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to update record: ${error.message}`)
    }

    return result || null
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string | number): Promise<boolean> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq(this.primaryKey, id)

    if (error) {
      throw new Error(`Failed to delete record: ${error.message}`)
    }

    return true
  }

  /**
   * Count records with optional filters
   */
  async count(filters?: FilterOptions): Promise<number> {
    let query = supabase.from(this.tableName).select('*', { count: 'exact', head: true })

    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          query = query.eq(field, value)
        }
      }
    }

    const { count, error } = await query

    if (error) {
      throw new Error(`Failed to count records: ${error.message}`)
    }

    return count || 0
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string | number): Promise<boolean> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(this.primaryKey)
      .eq(this.primaryKey, id)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check existence: ${error.message}`)
    }

    return !!data
  }

  /**
   * Execute a raw SQL query using Supabase RPC
   * For complex queries that can't be done with PostgREST
   */
  protected async query(sql: string, params?: any[]): Promise<QueryResult> {
    // For complex queries, we'll need to use Supabase RPC functions
    // This is a placeholder - specific implementations should override this method
    // or convert complex queries to PostgREST equivalents
    throw new Error('Raw SQL queries should be converted to PostgREST operations or use Supabase RPC functions')
  }

  /**
   * Build WHERE clause from filters (can be overridden by subclasses)
   */
  protected buildWhereClause(filters: FilterOptions): { clause: string; params: any[]; paramIndex: number } {
    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    for (const [field, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          conditions.push(`${field} = ANY($${paramIndex})`)
          params.push(value)
        } else if (typeof value === 'string' && value.includes('%')) {
          conditions.push(`${field} ILIKE $${paramIndex}`)
          params.push(value)
        } else {
          conditions.push(`${field} = $${paramIndex}`)
          params.push(value)
        }
        paramIndex++
      }
    }

    return {
      clause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
      params,
      paramIndex
    }
  }
}