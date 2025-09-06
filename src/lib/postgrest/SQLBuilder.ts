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
  private dbManager: any

  constructor(dbManager?: any) {
    this.dbManager = dbManager
  }

  /**
   * Build SQL query from parsed PostgREST query
   */
  async buildQuery(table: string, query: ParsedQuery): Promise<SQLQuery> {
    this.paramIndex = 1
    this.parameters = []

    const { sql } = await this.buildSelectQuery(table, query)
    
    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Discover foreign key relationship between two tables
   */
  private async discoverForeignKeyRelationship(mainTable: string, embeddedTable: string, fkHint?: string): Promise<{ fromTable: string, fromColumn: string, toTable: string, toColumn: string } | null> {
    console.log(`🔍 Attempting to discover FK relationship: ${mainTable} <-> ${embeddedTable}`)
    console.log(`🔧 DbManager available:`, !!this.dbManager)
    console.log(`🔧 DbManager connected:`, this.dbManager ? this.dbManager.isConnected() : 'N/A')
    
    if (!this.dbManager) {
      console.log(`⚠️  No dbManager available for FK discovery`)
      return null
    }

    if (!this.dbManager.isConnected()) {
      console.log(`⚠️  DbManager not connected for FK discovery`)
      return null
    }

    try {
      // Strip quotes from table names for comparison
      const cleanMainTable = mainTable.replace(/^"(.*)"$/, '$1')
      const cleanEmbeddedTable = embeddedTable.replace(/^"(.*)"$/, '$1')
      
      // Query to find foreign key relationship in either direction
      // Use string literals safely escaped
      let query = `
        SELECT 
          tc.table_name AS referencing_table,
          kcu.column_name AS foreign_key_column,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu 
          ON ccu.constraint_name = tc.constraint_name 
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ((tc.table_name = '${cleanMainTable.replace(/'/g, "''")}' AND ccu.table_name = '${cleanEmbeddedTable.replace(/'/g, "''")}')
            OR (tc.table_name = '${cleanEmbeddedTable.replace(/'/g, "''")}' AND ccu.table_name = '${cleanMainTable.replace(/'/g, "''")}'))
      `
      
      // If a foreign key hint is provided, filter by constraint name
      if (fkHint) {
        query += ` AND tc.constraint_name = '${fkHint.replace(/'/g, "''")}'`
        console.log(`🎯 Using foreign key hint: ${fkHint}`)
      }
      
      console.log(`🗃️  Executing FK discovery query with tables: "${cleanMainTable}" <-> "${cleanEmbeddedTable}"${fkHint ? ` (FK hint: ${fkHint})` : ''}`)
      console.log(`🗃️  Query:`, query.trim())
      const result = await this.dbManager.query(query)
      console.log(`🗃️  FK discovery result:`, result)
      
      if (result.rows.length > 0) {
        const row = result.rows[0]
        const fkInfo = {
          fromTable: row.referencing_table,
          fromColumn: row.foreign_key_column,
          toTable: row.referenced_table,
          toColumn: row.referenced_column
        }
        console.log(`✅ Found FK relationship:`, fkInfo)
        return fkInfo
      }
      
      console.log(`❌ No FK relationship found between ${mainTable} and ${embeddedTable}`)
      
      // If no direct relationship, try to find a many-to-many relationship through a join table
      return await this.discoverManyToManyRelationship(cleanMainTable, cleanEmbeddedTable)
    } catch (error) {
      console.error(`💥 Failed to discover foreign key relationship between ${mainTable} and ${embeddedTable}:`, error)
    }

    return null
  }

  /**
   * Discover many-to-many relationship through a join table
   */
  private async discoverManyToManyRelationship(mainTable: string, embeddedTable: string): Promise<{ fromTable: string, fromColumn: string, toTable: string, toColumn: string, joinTable?: string, joinMainColumn?: string, joinEmbeddedColumn?: string } | null> {
    console.log(`🔍 Attempting to discover many-to-many relationship: ${mainTable} <-> ${embeddedTable}`)
    
    if (!this.dbManager || !this.dbManager.isConnected()) {
      return null
    }

    try {
      // Look for a join table that references both main table and embedded table
      const query = `
        SELECT 
          tc1.table_name AS join_table,
          kcu1.column_name AS main_fk_column,
          ccu1.table_name AS main_table,
          ccu1.column_name AS main_pk_column,
          kcu2.column_name AS embedded_fk_column,
          ccu2.table_name AS embedded_table,
          ccu2.column_name AS embedded_pk_column
        FROM information_schema.table_constraints AS tc1
        JOIN information_schema.key_column_usage AS kcu1 
          ON tc1.constraint_name = kcu1.constraint_name 
        JOIN information_schema.constraint_column_usage AS ccu1 
          ON ccu1.constraint_name = tc1.constraint_name 
        JOIN information_schema.table_constraints AS tc2
          ON tc1.table_name = tc2.table_name
          AND tc2.constraint_type = 'FOREIGN KEY'
          AND tc2.constraint_name != tc1.constraint_name
        JOIN information_schema.key_column_usage AS kcu2 
          ON tc2.constraint_name = kcu2.constraint_name 
        JOIN information_schema.constraint_column_usage AS ccu2 
          ON ccu2.constraint_name = tc2.constraint_name 
        WHERE tc1.constraint_type = 'FOREIGN KEY'
          AND ccu1.table_name = '${mainTable.replace(/'/g, "''")}' 
          AND ccu2.table_name = '${embeddedTable.replace(/'/g, "''")}'
      `
      
      console.log(`🗃️  Executing many-to-many discovery query`)
      console.log(`🗃️  Query:`, query.trim())
      const result = await this.dbManager.query(query)
      console.log(`🗃️  Many-to-many discovery result:`, result)
      
      if (result.rows.length > 0) {
        const row = result.rows[0]
        const m2mInfo = {
          fromTable: mainTable,
          fromColumn: row.main_pk_column,
          toTable: embeddedTable,
          toColumn: row.embedded_pk_column,
          joinTable: row.join_table,
          joinMainColumn: row.main_fk_column,
          joinEmbeddedColumn: row.embedded_fk_column
        }
        console.log(`✅ Found many-to-many relationship:`, m2mInfo)
        return m2mInfo
      }
      
      console.log(`❌ No many-to-many relationship found between ${mainTable} and ${embeddedTable}`)
    } catch (error) {
      console.error(`💥 Failed to discover many-to-many relationship between ${mainTable} and ${embeddedTable}:`, error)
    }

    return null
  }

  /**
   * Build main SELECT query
   */
  private async buildSelectQuery(table: string, query: ParsedQuery): Promise<{ sql: string, joins: JoinInfo[] }> {
    console.log(`🔍 Building SELECT query for table: ${table}`)
    console.log(`🔍 Query object:`, JSON.stringify(query, null, 2))
    
    const joins: JoinInfo[] = []
    
    // Check if we have embedded resources - use different approach
    if (query.embedded && query.embedded.length > 0) {
      return await this.buildSelectWithJoinAggregation(table, query)
    } else {
      // Simple query without embedded resources
      return await this.buildSimpleSelectQuery(table, query)
    }
  }

  /**
   * Build simple SELECT query without embedded resources
   */
  private async buildSimpleSelectQuery(table: string, query: ParsedQuery): Promise<{ sql: string, joins: JoinInfo[] }> {
    const joins: JoinInfo[] = []
    
    // Build SELECT clause
    const selectClause = this.buildSimpleSelectClause(table, query)
    
    // Build FROM clause
    let fromClause = `FROM ${table}`

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

    const finalSQL = parts.join(' ')
    console.log(`🗃️  Final simple SQL: ${finalSQL}`)

    return {
      sql: finalSQL,
      joins
    }
  }

  /**
   * Build simple SELECT clause without embedded resources
   */
  private buildSimpleSelectClause(table: string, query: ParsedQuery): string {
    const columns: string[] = []

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

    return columns.join(', ')
  }

  /**
   * Build SELECT query with embedded resources using correlated subqueries
   */
  private async buildSelectWithJoinAggregation(table: string, query: ParsedQuery): Promise<{ sql: string, joins: JoinInfo[] }> {
    console.log(`🔍 Building SELECT with correlated subqueries for: ${table}`)
    
    const joins: JoinInfo[] = []
    const selectColumns: string[] = []
    
    // Helper function to properly quote table names if they contain spaces
    const quoteTableName = (tableName: string): string => {
      // If table name is already quoted, return as-is
      if (tableName.startsWith('"') && tableName.endsWith('"')) {
        return tableName
      }
      // If table name contains spaces or special characters, quote it
      if (tableName.includes(' ') || /[^a-zA-Z0-9_]/.test(tableName)) {
        return `"${tableName}"`
      }
      return tableName
    }
    
    const quotedMainTable = quoteTableName(table)
    
    // Add main table columns, filtering out embedded table names
    const embeddedTableNames = (query.embedded || []).map(e => e.table)
    
    if (query.select && query.select.length > 0) {
      for (const col of query.select) {
        // Skip embedded table names - they'll be handled as subqueries
        if (embeddedTableNames.includes(col)) {
          continue
        }
        
        if (col === '*') {
          selectColumns.push(`${quotedMainTable}.*`)
        } else {
          selectColumns.push(`${quotedMainTable}.${col}`)
        }
      }
    } else {
      selectColumns.push(`${quotedMainTable}.*`)
    }
    
    // Add embedded resources as correlated subqueries
    for (const embedded of query.embedded || []) {
      const subquery = await this.buildEmbeddedSubquery(table, embedded)
      if (subquery) {
        // Use the original table name as alias, properly quoted for SQL but keeping original name for result
        const quotedAlias = quoteTableName(embedded.table)
        selectColumns.push(`(${subquery}) AS ${quotedAlias}`)
      }
    }
    
    // Build FROM clause
    const fromClause = `FROM ${quotedMainTable}`

    // Build WHERE clause
    const whereClause = this.buildWhereClause(query.filters)

    // Build ORDER BY clause
    const orderClause = this.buildOrderClause(query.order)

    // Build LIMIT and OFFSET
    const limitClause = query.limit ? `LIMIT ${query.limit}` : ''
    const offsetClause = query.offset ? `OFFSET ${query.offset}` : ''

    // Combine all parts
    const parts = [
      `SELECT ${selectColumns.join(', ')}`,
      fromClause,
      whereClause,
      orderClause,
      limitClause,
      offsetClause
    ].filter(Boolean)

    const finalSQL = parts.join(' ')
    console.log(`🗃️  Final embedded SQL: ${finalSQL}`)

    return {
      sql: finalSQL,
      joins
    }
  }

  /**
   * Build correlated subquery for embedded resource
   */
  private async buildEmbeddedSubquery(table: string, embedded: EmbeddedResource): Promise<string | null> {
    console.log(`🔍 Building subquery for: ${table} -> ${embedded.table}`)
    
    // Discover the foreign key relationship
    const fkRelationship = await this.discoverForeignKeyRelationship(table, embedded.table, embedded.fkHint)
    console.log(`🔗 Foreign key relationship found:`, fkRelationship)
    
    if (!fkRelationship) {
      console.log(`❌ No foreign key relationship found between ${table} and ${embedded.table}`)
      return null
    }
    
    // Helper function to properly quote table names if they contain spaces
    const quoteTableName = (tableName: string): string => {
      // If table name is already quoted, return as-is
      if (tableName.startsWith('"') && tableName.endsWith('"')) {
        return tableName
      }
      // If table name contains spaces or special characters, quote it
      if (tableName.includes(' ') || /[^a-zA-Z0-9_]/.test(tableName)) {
        return `"${tableName}"`
      }
      return tableName
    }
    
    const quotedEmbeddedTable = quoteTableName(embedded.table)
    const quotedMainTable = quoteTableName(table)
    
    // Build the SELECT columns for the embedded resource
    let selectClause: string
    if (embedded.select && embedded.select.length > 0) {
      // Build JSON object with specific columns
      const columnPairs = embedded.select.map(col => {
        if (col === '*') {
          // For *, return all columns as JSON - need to use row_to_json
          return `to_json(${quotedEmbeddedTable})`
        } else {
          return `'${col}', ${quotedEmbeddedTable}.${col}`
        }
      })
      
      if (embedded.select.includes('*')) {
        selectClause = `to_json(${quotedEmbeddedTable})`
      } else {
        selectClause = `json_build_object(${columnPairs.join(', ')})`
      }
    } else {
      // Select all columns as JSON object
      selectClause = `to_json(${quotedEmbeddedTable})`
    }
    
    // Quote the FK relationship table names for matching
    const quotedFromTable = quoteTableName(fkRelationship.fromTable)
    const quotedToTable = quoteTableName(fkRelationship.toTable)
    
    // Determine join condition based on relationship direction
    let subquery: string
    
    // Check if this is a many-to-many relationship (has joinTable property)
    if (fkRelationship.joinTable) {
      console.log(`🔗 Building many-to-many subquery through join table: ${fkRelationship.joinTable}`)
      
      // Many-to-many: use join table to connect main table and embedded table
      // SELECT json_agg(...) FROM embedded_table 
      // WHERE embedded_table.id IN (
      //   SELECT join_table.embedded_fk_column 
      //   FROM join_table 
      //   WHERE join_table.main_fk_column = main_table.id
      // )
      const joinTableQuoted = quoteTableName(fkRelationship.joinTable!)
      const whereCondition = `${quotedEmbeddedTable}.${fkRelationship.toColumn} IN (
        SELECT ${joinTableQuoted}.${fkRelationship.joinEmbeddedColumn} 
        FROM ${joinTableQuoted} 
        WHERE ${joinTableQuoted}.${fkRelationship.joinMainColumn} = ${quotedMainTable}.${fkRelationship.fromColumn}
      )`
      
      subquery = `SELECT COALESCE(json_agg(${selectClause}), '[]'::json) FROM ${quotedEmbeddedTable} WHERE ${whereCondition}`
    } else {
      // Direct relationship (one-to-many or many-to-one)
      let whereCondition: string
      if (fkRelationship.fromTable === embedded.table.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === table.replace(/^"(.*)"$/, '$1')) {
        // One-to-many: embedded table references main table
        // instruments.section_id = orchestral_sections.id
        whereCondition = `${quotedEmbeddedTable}.${fkRelationship.fromColumn} = ${quotedMainTable}.${fkRelationship.toColumn}`
      } else if (fkRelationship.fromTable === table.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === embedded.table.replace(/^"(.*)"$/, '$1')) {
        // Many-to-one: main table references embedded table
        // orchestral_sections.section_id = sections.id
        whereCondition = `${quotedMainTable}.${fkRelationship.fromColumn} = ${quotedEmbeddedTable}.${fkRelationship.toColumn}`
      } else {
        console.log(`❌ Invalid foreign key relationship direction`)
        return null
      }

      subquery = `SELECT COALESCE(json_agg(${selectClause}), '[]'::json) FROM ${quotedEmbeddedTable} WHERE ${whereCondition}`
    }
    
    console.log(`🗃️  Generated embedded subquery: ${subquery}`)
    return subquery
  }

  /**
   * Build JSON aggregation subquery for embedded resource
   */
  private async buildEmbeddedJSONAggregation(mainTable: string, embedded: EmbeddedResource): Promise<string | null> {
    console.log(`🔍 Building JSON aggregation for: ${mainTable} -> ${embedded.table}`)
    
    // Discover the foreign key relationship
    const fkRelationship = await this.discoverForeignKeyRelationship(mainTable, embedded.table, embedded.fkHint)
    console.log(`🔗 Foreign key relationship found:`, fkRelationship)
    
    if (!fkRelationship) {
      console.log(`❌ No foreign key relationship found between ${mainTable} and ${embedded.table}`)
      return null
    }
    
    // Determine join condition based on relationship direction
    let joinCondition: string
    if (fkRelationship.fromTable === embedded.table && fkRelationship.toTable === mainTable) {
      // One-to-many: embedded table references main table
      // instruments.section_id = orchestral_sections.id
      joinCondition = `${embedded.table}.${fkRelationship.fromColumn} = ${mainTable}.${fkRelationship.toColumn}`
      console.log(`📝 One-to-many join condition: ${joinCondition}`)
    } else if (fkRelationship.fromTable === mainTable && fkRelationship.toTable === embedded.table) {
      // Many-to-one: main table references embedded table
      // orchestral_sections.section_id = sections.id
      joinCondition = `${mainTable}.${fkRelationship.fromColumn} = ${embedded.table}.${fkRelationship.toColumn}`
      console.log(`📝 Many-to-one join condition: ${joinCondition}`)
    } else {
      console.log(`❌ Invalid foreign key relationship direction`)
      return null
    }

    // Build the column selection for embedded resource
    let selectColumns: string
    if (embedded.select && embedded.select.length > 0) {
      const columnList = embedded.select.map(col => {
        if (col === '*') {
          return `${embedded.table}.*`
        }
        return `'${col}', ${embedded.table}.${col}`
      }).join(', ')
      selectColumns = `json_build_object(${columnList})`
    } else {
      // Select all columns from embedded table
      selectColumns = `to_json(${embedded.table})`
    }

    // Build the subquery with aggregation - need to make it correlated
    // Replace table references with outer query references
    const correlatedJoinCondition = joinCondition.replace(
      new RegExp(`\\b${mainTable}\\.`, 'g'), 
      `${mainTable}_outer.`
    )
    
    const subquery = `
      SELECT COALESCE(json_agg(${selectColumns}), '[]'::json)
      FROM ${embedded.table}
      WHERE ${correlatedJoinCondition}
    `
    
    console.log(`🗃️  Generated embedded subquery: ${subquery.trim()}`)
    return subquery.trim()
  }

  /**
   * Build GROUP BY columns for main table when using embedded resources
   */
  private buildGroupByColumns(table: string, query: ParsedQuery): string {
    const columns: string[] = []
    
    // Add all main table columns that are selected
    if (query.select && query.select.length > 0) {
      const embeddedTableNames = (query.embedded || []).map(e => e.table)
      
      for (const col of query.select) {
        // Skip embedded table names
        if (embeddedTableNames.includes(col)) {
          continue
        }
        
        if (col === '*') {
          // For *, we need to discover actual column names
          // For now, group by primary key - this might need refinement
          columns.push(`${table}.id`)
        } else {
          columns.push(`${table}.${col}`)
        }
      }
    } else {
      // Default case: group by primary key
      columns.push(`${table}.id`)
    }

    return columns.join(', ')
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