import { DatabaseManager } from '../../../src/lib/database/connection'
import type { QueryResult } from '../../../src/types'

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
  protected dbManager: DatabaseManager
  protected tableName: string
  protected primaryKey: string

  constructor(tableName: string, primaryKey: string = 'id') {
    this.dbManager = DatabaseManager.getInstance()
    this.tableName = tableName
    this.primaryKey = primaryKey
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string | number): Promise<T | null> {
    const result = await this.dbManager.query(
      `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [id]
    )
    return result.rows[0] || null
  }

  /**
   * Find all records with optional filtering, sorting, and pagination
   */
  async findAll(options: QueryOptions = {}): Promise<RepositoryResult<T>> {
    const { pagination, sort, filters, search } = options
    
    let query = `SELECT * FROM ${this.tableName}`
    let countQuery = `SELECT COUNT(*) as total FROM ${this.tableName}`
    const params: any[] = []
    let paramIndex = 1

    // Build WHERE clause
    const whereConditions: string[] = []
    
    // Add filters
    if (filters) {
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          if (Array.isArray(value)) {
            whereConditions.push(`${field} = ANY($${paramIndex})`)
            params.push(value)
          } else if (typeof value === 'string' && value.includes('%')) {
            whereConditions.push(`${field} ILIKE $${paramIndex}`)
            params.push(value)
          } else {
            whereConditions.push(`${field} = $${paramIndex}`)
            params.push(value)
          }
          paramIndex++
        }
      }
    }

    // Add search
    if (search && search.query && search.fields.length > 0) {
      const searchConditions = search.fields.map(field => 
        `${field}::text ILIKE $${paramIndex}`
      ).join(' OR ')
      whereConditions.push(`(${searchConditions})`)
      params.push(`%${search.query}%`)
      paramIndex++
    }

    // Apply WHERE clause
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`
      query += whereClause
      countQuery += whereClause
    }

    // Add sorting
    if (sort && sort.length > 0) {
      const sortClauses = sort.map(s => `${s.field} ${s.direction}`).join(', ')
      query += ` ORDER BY ${sortClauses}`
    } else {
      // Default sort by primary key
      query += ` ORDER BY ${this.primaryKey}`
    }

    // Add pagination
    let page = 1
    let limit = 50
    if (pagination) {
      page = pagination.page || 1
      limit = pagination.limit || 50
      const offset = pagination.offset || (page - 1) * limit
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      params.push(limit, offset)
    }

    // Execute queries
    const [dataResult, countResult] = await Promise.all([
      this.dbManager.query(query, params),
      this.dbManager.query(countQuery, params.slice(0, paramIndex - (pagination ? 2 : 0)))
    ])

    const total = parseInt(countResult.rows[0].total)
    const totalPages = Math.ceil(total / limit)

    return {
      data: dataResult.rows,
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
    const fields = Object.keys(data).filter(key => data[key as keyof T] !== undefined)
    const values = fields.map(key => data[key as keyof T])
    const placeholders = fields.map((_, index) => `$${index + 1}`).join(', ')

    const query = `
      INSERT INTO ${this.tableName} (${fields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `

    const result = await this.dbManager.query(query, values)
    return result.rows[0]
  }

  /**
   * Update a record by ID
   */
  async update(id: string | number, data: Partial<T>): Promise<T | null> {
    const fields = Object.keys(data).filter(key => data[key as keyof T] !== undefined)
    const values = fields.map(key => data[key as keyof T])
    
    if (fields.length === 0) {
      return this.findById(id)
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ')
    values.push(id)

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${this.primaryKey} = $${fields.length + 1}
      RETURNING *
    `

    const result = await this.dbManager.query(query, values)
    return result.rows[0] || null
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string | number): Promise<boolean> {
    const result = await this.dbManager.query(
      `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`,
      [id]
    )
    return result.rowCount > 0
  }

  /**
   * Count records with optional filters
   */
  async count(filters?: FilterOptions): Promise<number> {
    let query = `SELECT COUNT(*) as total FROM ${this.tableName}`
    const params: any[] = []
    let paramIndex = 1

    if (filters) {
      const whereConditions: string[] = []
      
      for (const [field, value] of Object.entries(filters)) {
        if (value !== null && value !== undefined && value !== '') {
          whereConditions.push(`${field} = $${paramIndex}`)
          params.push(value)
          paramIndex++
        }
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`
      }
    }

    const result = await this.dbManager.query(query, params)
    return parseInt(result.rows[0].total)
  }

  /**
   * Check if a record exists by ID
   */
  async exists(id: string | number): Promise<boolean> {
    const result = await this.dbManager.query(
      `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = $1 LIMIT 1`,
      [id]
    )
    return result.rows.length > 0
  }

  /**
   * Execute a raw query on this table
   */
  protected async query(sql: string, params?: any[]): Promise<QueryResult> {
    return this.dbManager.query(sql, params)
  }

  /**
   * Execute multiple operations in a transaction
   */
  protected async transaction<R>(fn: () => Promise<R>): Promise<R> {
    return this.dbManager.transaction(fn)
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