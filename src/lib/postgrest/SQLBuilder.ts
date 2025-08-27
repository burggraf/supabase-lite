import type { ParsedQuery, ParsedFilter, ParsedOrder, EmbeddedResource } from './QueryParser'
import { POSTGREST_OPERATORS } from './operators'

export interface SQLQuery {
  sql: string
  parameters: any[]
}

export interface JoinInfo {
  table: string
  alias: string
  condition: string
  type: 'LEFT' | 'INNER'
}

export class SQLBuilder {
  private paramIndex = 1
  private parameters: any[] = []

  /**
   * Build SQL query from parsed PostgREST query
   */
  buildQuery(table: string, query: ParsedQuery): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    const { sql } = this.buildSelectQuery(table, query)
    
    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Build main SELECT query
   */
  private buildSelectQuery(table: string, query: ParsedQuery): { sql: string, joins: JoinInfo[] } {
    const joins: JoinInfo[] = []
    
    // Build SELECT clause
    const selectClause = this.buildSelectClause(table, query, joins)
    
    // Build FROM clause with JOINs
    let fromClause = `FROM ${table}`
    if (joins.length > 0) {
      fromClause += ' ' + joins.map(join => 
        `${join.type} JOIN ${join.table} AS ${join.alias} ON ${join.condition}`
      ).join(' ')
    }

    // Build WHERE clause
    const whereClause = this.buildWhereClause(query.filters)

    // Build ORDER BY clause
    const orderClause = this.buildOrderClause(query.order)

    // Build LIMIT and OFFSET
    const limitClause = query.limit ? `LIMIT ${query.limit}` : ''
    const offsetClause = query.offset ? `OFFSET ${query.offset}` : ''

    // Combine all parts
    const parts = [
      `SELECT ${selectClause}`,
      fromClause,
      whereClause,
      orderClause,
      limitClause,
      offsetClause
    ].filter(Boolean)

    return {
      sql: parts.join(' '),
      joins
    }
  }

  /**
   * Build SELECT clause with embedded resources
   */
  private buildSelectClause(table: string, query: ParsedQuery, joins: JoinInfo[]): string {
    const columns: string[] = []

    // Add main table columns
    if (query.select && query.select.length > 0) {
      for (const col of query.select) {
        if (col === '*') {
          columns.push(`${table}.*`)
        } else {
          columns.push(`${table}.${col}`)
        }
      }
    } else {
      columns.push(`${table}.*`)
    }

    // Add embedded resources
    if (query.embedded && query.embedded.length > 0) {
      for (const embedded of query.embedded) {
        this.addEmbeddedResource(table, embedded, columns, joins)
      }
    }

    return columns.join(', ')
  }

  /**
   * Add embedded resource to query
   */
  private addEmbeddedResource(
    mainTable: string, 
    embedded: EmbeddedResource, 
    columns: string[], 
    joins: JoinInfo[]
  ): void {
    const alias = embedded.alias || `${embedded.table}_embed`
    
    // For now, assume foreign key relationship based on naming convention
    // In a real implementation, this would use database metadata
    const joinCondition = `${mainTable}.${embedded.table}_id = ${alias}.id`
    
    joins.push({
      table: embedded.table,
      alias,
      condition: joinCondition,
      type: 'LEFT'
    })

    // Add embedded columns
    if (embedded.select && embedded.select.length > 0) {
      for (const col of embedded.select) {
        if (col === '*') {
          columns.push(`${alias}.*`)
        } else {
          columns.push(`${alias}.${col} AS ${alias}_${col}`)
        }
      }
    } else {
      columns.push(`${alias}.*`)
    }
  }

  /**
   * Build WHERE clause from filters
   */
  private buildWhereClause(filters: ParsedFilter[]): string {
    if (filters.length === 0) {
      return ''
    }

    const conditions = filters
      .map(filter => this.buildFilterCondition(filter))
      .filter(Boolean)

    if (conditions.length === 0) {
      return ''
    }

    return `WHERE ${conditions.join(' AND ')}`
  }

  /**
   * Build single filter condition
   */
  private buildFilterCondition(filter: ParsedFilter): string {
    if (filter.column === '__logical__') {
      // Handle logical operators (complex case)
      return this.buildLogicalCondition(filter)
    }

    const operator = POSTGREST_OPERATORS[filter.operator]
    if (!operator) {
      throw new Error(`Unknown operator: ${filter.operator}`)
    }

    let condition = operator.sqlTemplate
      .replace('{column}', filter.column)

    // Handle different value types
    if (operator.requiresValue) {
      condition = this.replaceValuePlaceholder(condition, filter.value, filter.operator)
    }

    if (filter.negated) {
      condition = `NOT (${condition})`
    }

    return condition
  }

  /**
   * Replace value placeholder with actual parameter
   */
  private replaceValuePlaceholder(condition: string, value: any, operator: string): string {
    if (operator === 'is') {
      // IS operator doesn't use parameters for NULL, TRUE, FALSE
      return condition.replace('{value}', String(value))
    }

    if (operator === 'in') {
      // IN operator with array of values
      const placeholders = (value as any[])
        .map(() => `$${this.paramIndex++}`)
        .join(', ')
      this.parameters.push(...(value as any[]))
      return condition.replace('{value}', placeholders)
    }

    if (operator === 'cs' || operator === 'cd') {
      // Array/JSON operators
      const paramPlaceholder = `$${this.paramIndex++}`
      this.parameters.push(typeof value === 'string' ? value : JSON.stringify(value))
      return condition.replace('{value}', paramPlaceholder)
    }

    if (operator === 'ov') {
      // Array overlap operator
      const paramPlaceholder = `$${this.paramIndex++}`
      const arrayValue = Array.isArray(value) ? `{${value.join(',')}}` : value
      this.parameters.push(arrayValue)
      return condition.replace('{value}', paramPlaceholder)
    }

    // Default case: single parameter
    const paramPlaceholder = `$${this.paramIndex++}`
    this.parameters.push(value)
    return condition.replace('{value}', paramPlaceholder)
  }

  /**
   * Build logical condition (and, or, not)
   */
  private buildLogicalCondition(filter: ParsedFilter): string {
    // This is a simplified implementation
    // A full implementation would need to parse the logical expression
    const { expression } = filter.value
    
    // For now, return a placeholder that indicates this needs more complex parsing
    return `/* Complex logical operator: ${expression} */`
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderClause(order?: ParsedOrder[]): string {
    if (!order || order.length === 0) {
      return ''
    }

    const orderItems = order.map(item => {
      let orderItem = `${item.column} ${item.ascending ? 'ASC' : 'DESC'}`
      
      if (item.nullsFirst !== undefined) {
        orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
      }
      
      return orderItem
    })

    return `ORDER BY ${orderItems.join(', ')}`
  }

  /**
   * Build RPC function call
   */
  buildRpcQuery(functionName: string, params: Record<string, any>): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    const paramNames = Object.keys(params)
    const paramPlaceholders = paramNames.map(name => {
      const value = params[name]
      this.parameters.push(value)
      return `${name} => $${this.paramIndex++}`
    })

    const sql = `SELECT * FROM ${functionName}(${paramPlaceholders.join(', ')})`

    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Build INSERT query
   */
  buildInsertQuery(table: string, data: Record<string, any>[]): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    const firstRow = data[0]
    const columns = Object.keys(firstRow)
    const columnsList = columns.join(', ')

    const valueRows = data.map(row => {
      const valuePlaceholders = columns.map(col => {
        this.parameters.push(row[col])
        return `$${this.paramIndex++}`
      })
      return `(${valuePlaceholders.join(', ')})`
    })

    const sql = `INSERT INTO ${table} (${columnsList}) VALUES ${valueRows.join(', ')} RETURNING *`

    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Build UPDATE query
   */
  buildUpdateQuery(table: string, data: Record<string, any>, filters: ParsedFilter[]): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    const columns = Object.keys(data)
    const setClause = columns.map(col => {
      this.parameters.push(data[col])
      return `${col} = $${this.paramIndex++}`
    }).join(', ')

    const whereClause = this.buildWhereClause(filters)

    const sql = `UPDATE ${table} SET ${setClause} ${whereClause} RETURNING *`

    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Build DELETE query
   */
  buildDeleteQuery(table: string, filters: ParsedFilter[]): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    const whereClause = this.buildWhereClause(filters)

    if (!whereClause) {
      throw new Error('DELETE requires WHERE conditions')
    }

    const sql = `DELETE FROM ${table} ${whereClause} RETURNING *`

    return {
      sql,
      parameters: this.parameters
    }
  }
}