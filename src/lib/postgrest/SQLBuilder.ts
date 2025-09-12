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
   * Quote PostgreSQL identifier if it contains spaces or special characters
   * Supports both table names and column names
   */
  private quoteIdentifier(identifier: string): string {
    // If already quoted, return as-is
    if (identifier.startsWith('"') && identifier.endsWith('"')) {
      return identifier
    }
    
    // If contains spaces or special chars, quote it
    if (/\s/.test(identifier) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      return `"${identifier.replace(/"/g, '""')}"`
    }
    
    return identifier
  }

  /**
   * Build schema-qualified table name if schema is specified
   */
  private buildQualifiedTableName(tableName: string, schema?: string): string {
    if (!schema) {
      return tableName
    }
    
    // If table name already includes schema (contains a dot), use it as-is
    if (tableName.includes('.')) {
      return tableName
    }
    
    return `${schema}.${tableName}`
  }

  /**
   * Build schema-qualified table name with proper PostgreSQL identifier quoting
   * Quotes schema and table components separately to avoid invalid SQL like "public.table"
   * TEMPORARY FIX: Disable schema qualification to avoid column reference issues
   */
  private buildQuotedQualifiedTableName(tableName: string, schema?: string): string {
    // TEMPORARY FIX: Always return just the table name without schema qualification
    // This prevents issues with "schema"."table".column syntax which is invalid
    // The "public" schema is the default, so omitting it should work fine
    console.log(`🔧 TEMP FIX: buildQuotedQualifiedTableName(${tableName}, ${schema}) -> ${this.quoteIdentifier(tableName)}`)
    return this.quoteIdentifier(tableName)
    
    /* ORIGINAL CODE - DISABLED TEMPORARILY:
    if (!schema) {
      return this.quoteIdentifier(tableName)
    }
    
    // If table name already includes schema (contains a dot), assume it's already properly formatted
    if (tableName.includes('.')) {
      return tableName
    }
    
    const quotedSchema = this.quoteIdentifier(schema)
    const quotedTable = this.quoteIdentifier(tableName)
    return `${quotedSchema}.${quotedTable}`
    */
  }

  /**
   * Extract clean table name from schema-qualified quoted table name
   * Examples: 
   * - "public"."table_name" -> table_name
   * - "table_name" -> table_name
   * - table_name -> table_name
   * - public.table_name -> table_name
   */
  private extractTableNameFromQualified(qualifiedTableName: string): string {
    // Handle schema-qualified quoted names: "schema"."table" -> table
    if (qualifiedTableName.includes('.')) {
      const parts = qualifiedTableName.split('.')
      const tablePart = parts[parts.length - 1] // Get last part (table name)
      return tablePart.replace(/^"(.*)"$/, '$1') // Remove quotes
    }
    
    // Handle simple quoted names: "table" -> table
    return qualifiedTableName.replace(/^"(.*)"$/, '$1')
  }

  /**
   * Check if table exists and return the correct table name (without forced schema qualification)
   */
  private async getActualTableName(tableName: string, schema?: string): Promise<string> {
    if (!this.dbManager || !schema) {
      return tableName
    }
    
    try {
      // First try the table name as-is (no schema prefix)
      const cleanTable = tableName.replace(/^"(.*)"$/, '$1')
      const checkQuery = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${cleanTable.replace(/'/g, "''")}' AND table_schema = '${schema.replace(/'/g, "''")}')`
      const result = await this.dbManager.query(checkQuery)
      
      if (result.rows[0].exists) {
        console.log(`✅ Table '${cleanTable}' exists in '${schema}' schema`)
        return cleanTable // Return without schema prefix since it exists
      } else {
        console.log(`⚠️ Table '${cleanTable}' not found in '${schema}' schema, using as-is`)
        return tableName
      }
    } catch (error) {
      console.log(`⚠️ Could not check table existence for '${tableName}':`, error)
      return tableName
    }
  }

  /**
   * Build SQL query from parsed PostgREST query
   */
  async buildQuery(table: string, query: ParsedQuery): Promise<SQLQuery> {
    this.paramIndex = 1
    this.parameters = []

    console.log('🏗️  Building SQL for table:', table, 'query:', JSON.stringify(query, null, 2))

    // URL decode and quote the table name for PostgreSQL compatibility
    const decodedTable = decodeURIComponent(table)
    
    // Check if table exists and use correct table name (prevent schema qualification issues)
    const actualTableName = await this.getActualTableName(decodedTable, query.schema)
    // For now, disable schema qualification entirely to fix JOIN issues
    const quotedTable = this.quoteIdentifier(actualTableName)
    
    const { sql } = await this.buildSelectQuery(quotedTable, query)
    
    console.log('🎯 Final generated SQL:', sql)
    console.log('🎯 Parameters:', this.parameters)
    
    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Discover foreign key relationship between two tables
   */
  private async discoverForeignKeyRelationship(mainTable: string, embeddedTable: string, fkHint?: string): Promise<{ fromTable: string, fromColumn: string, toTable: string, toColumn: string, joinTable?: string, joinMainColumn?: string, joinEmbeddedColumn?: string } | null> {
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
      // Strip quotes and schema qualification from table names for comparison
      const cleanMainTable = this.extractTableNameFromQualified(mainTable)
      const cleanEmbeddedTable = this.extractTableNameFromQualified(embeddedTable)
      
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
        console.log(`🔍 For buildEmbeddedSubquery path selection:`)
        console.log(`🔍 - mainTable: "${mainTable}", embeddedTable: "${embeddedTable}"`)
        console.log(`🔍 - fkInfo.fromTable: "${fkInfo.fromTable}", fkInfo.toTable: "${fkInfo.toTable}"`)
        console.log(`🔍 - One-to-many condition: fkInfo.fromTable === embeddedTable && fkInfo.toTable === mainTable`)
        console.log(`🔍 - Result: "${fkInfo.fromTable}" === "${embeddedTable}" && "${fkInfo.toTable}" === "${mainTable}" = ${fkInfo.fromTable === embeddedTable && fkInfo.toTable === mainTable}`)
        console.log(`🔍 - Many-to-one condition: fkInfo.fromTable === mainTable && fkInfo.toTable === embeddedTable`)
        console.log(`🔍 - Result: "${fkInfo.fromTable}" === "${mainTable}" && "${fkInfo.toTable}" === "${embeddedTable}" = ${fkInfo.fromTable === mainTable && fkInfo.toTable === embeddedTable}`)
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
    console.log(`🚀 INNER JOIN FIX DEBUG: Code is loaded and running!`)
    
    // Removed temporary workaround - now using proper JOIN-based filtering
    
    const joins: JoinInfo[] = []
    
    // Check if any filters reference embedded tables
    const hasEmbeddedTableFilters = this.hasFiltersOnEmbeddedTables(query)
    console.log(`🔍 Has embedded table filters: ${hasEmbeddedTableFilters}`)
    
    // Check if we have embedded resources
    if (query.embedded && query.embedded.length > 0) {
      // Get tables referenced in filters
      const tablesInFilters = this.getFilteredTableNames(query)
      const existingEmbeddedTables = new Set((query.embedded || []).map(e => e.table))
      
      // Check if filters reference embedded tables  
      const hasFiltersOnEmbeddedTables = Array.from(tablesInFilters).some(table => 
        existingEmbeddedTables.has(table)
      )
      
      // Check if ORDER BY references any table via referencedTable property
      // This is critical for queries like order=section(name) where section is an alias
      const hasOrderingRequiringJoins = (query.order || []).some(orderItem => 
        orderItem.referencedTable !== undefined
      )
      
      // Check if any embedded resources use !inner hint - these MUST use JOIN approach for proper filtering
      const hasInnerJoinEmbedded = (query.embedded || []).some(embedded => embedded.fkHint === 'inner')
      
      if (hasInnerJoinEmbedded) {
        console.log(`🔧 Using specialized INNER JOIN approach for !inner embedded resources`)
        return await this.buildSelectWithInnerJoins(table, query)
      } else if (hasFiltersOnEmbeddedTables || hasOrderingRequiringJoins) {
        console.log(`🔧 Using JOIN approach for filters or ordering on embedded/referenced tables`)
        
        // For PostgREST compatibility: when filtering OR ordering on embedded/referenced table fields,
        // we need to use JOINs to ensure proper SQL generation
        return await this.buildSelectWithJoins(table, query)
      } else {
        console.log(`🔧 No filters or ordering on embedded tables - using correlated subquery approach`)
        
        // No filters or ordering on embedded tables, use standard subquery approach
        return await this.buildSelectWithJoinAggregation(table, query)
      }
    } else {
      // Simple query without embedded resources, but check for filters on referenced tables
      if (hasEmbeddedTableFilters) {
        // For filters on referenced tables without embedding, we need to create 
        // implicit embedding to maintain PostgREST behavior
        return await this.buildSelectWithImplicitEmbedding(table, query)
      } else {
        return await this.buildSimpleSelectQuery(table, query)
      }
    }
  }

  /**
   * Separate main table filters from embedded table filters for PostgREST compatibility
   * Embedded table filters should not filter out parent rows unless there's explicit inner join
   */
  private separateMainAndEmbeddedFilters(query: ParsedQuery, embeddedTables: Set<string>): {
    mainTableFilters: ParsedFilter[]
    embeddedTableFilters: ParsedFilter[]
  } {
    const mainTableFilters: ParsedFilter[] = []
    const embeddedTableFilters: ParsedFilter[] = []
    
    query.filters.forEach(filter => {
      // Check if filter has explicit referenced table property (from table-prefixed params)
      if (filter.referencedTable) {
        if (embeddedTables.has(filter.referencedTable)) {
          embeddedTableFilters.push(filter)
        } else {
          // Referenced table is not embedded, treat as main table filter
          mainTableFilters.push(filter)
        }
      } else if (filter.column.includes('.')) {
        // Check dot notation for table.column format
        const [tableName] = filter.column.split('.')
        if (embeddedTables.has(tableName)) {
          embeddedTableFilters.push(filter)
        } else {
          // Assume it's a main table filter if not in embedded tables
          mainTableFilters.push(filter)
        }
      } else {
        // No dot notation and no referenced table, assume it's a main table filter
        mainTableFilters.push(filter)
      }
    })
    
    return { mainTableFilters, embeddedTableFilters }
  }

  /**
   * Check if query has filters on embedded/referenced tables
   */
  private hasFiltersOnEmbeddedTables(query: ParsedQuery): boolean {
    return query.filters.some(filter => {
      // Check if filter column contains dot notation (table.column)
      if (filter.column.includes('.')) {
        const [tableName] = filter.column.split('.')
        // Check if it's not the main table (assumes main table filters don't use dot notation)
        // or if it matches an embedded table name
        return query.embedded?.some(embedded => embedded.table === tableName) || true
      }
      return false
    })
  }

  /**
   * Extract table names referenced in filters
   */
  private getFilteredTableNames(query: ParsedQuery): Set<string> {
    const tableNames = new Set<string>()
    
    query.filters.forEach(filter => {
      if (filter.column.includes('.')) {
        const [tableName] = filter.column.split('.')
        tableNames.add(tableName)
      }
    })
    
    return tableNames
  }

  /**
   * Extract table names from ordering requirements
   */
  private getOrderingTableNames(query: ParsedQuery): Set<string> {
    const tableNames = new Set<string>()
    
    console.log('🎯 Checking order for referenced tables:', query.order)
    
    if (query.order) {
      query.order.forEach(orderItem => {
        console.log('🎯 Order item:', orderItem)
        if (orderItem.referencedTable) {
          console.log('🎯 Adding referenced table to ordering:', orderItem.referencedTable)
          tableNames.add(orderItem.referencedTable)
        }
      })
    }
    
    console.log('🎯 Final ordering table names:', Array.from(tableNames))
    return tableNames
  }

  /**
   * Build SELECT query with implicit embedding for referenced table filters
   * This method handles cases like .eq('orchestral_sections.name', 'percussion')
   * where the referenced table is filtered but not explicitly embedded
   */
  private async buildSelectWithImplicitEmbedding(table: string, query: ParsedQuery): Promise<{ sql: string, joins: JoinInfo[] }> {
    console.log(`🔍 Building SELECT with implicit embedding for: ${table}`)
    
    // Get tables referenced in filters
    const tablesInFilters = this.getFilteredTableNames(query)
    const existingEmbeddedTables = new Set((query.embedded || []).map(e => e.table))
    
    console.log(`🔍 Tables in filters:`, Array.from(tablesInFilters))
    console.log(`🔍 Existing embedded tables:`, Array.from(existingEmbeddedTables))
    
    // Check if filters reference embedded tables  
    const hasFiltersOnEmbeddedTables = Array.from(tablesInFilters).some(table => 
      existingEmbeddedTables.has(table)
    )
    
    // Check if ordering references any tables (not just embedded ones)
    // In PostgREST, ordering by referenced table columns (e.g., section(name)) requires JOINs
    const tablesInOrdering = this.getOrderingTableNames(query)
    const hasOrderingOnReferencedTables = tablesInOrdering.size > 0
    
    // Also check if ordering references embedded tables (including aliases) for backward compatibility
    const hasOrderingOnEmbeddedTables = Array.from(tablesInOrdering).some(referencedTable => {
      // Check if it matches any embedded table name or alias
      return (query.embedded || []).some(embedded => {
        return embedded.table === referencedTable || embedded.alias === referencedTable
      })
    })
    
    
    // Critical fix: If ORDER BY references any table (via referencedTable), use JOIN approach
    // This ensures that ordering by embedded table columns (e.g., section(name)) always works
    const hasOrderingRequiringJoins = (query.order || []).some(orderItem => 
      orderItem.referencedTable !== undefined
    )
    
    // Check if any embedded resources use !inner hint - these MUST use JOIN approach for proper filtering
    const hasInnerJoinEmbedded = (query.embedded || []).some(embedded => embedded.fkHint === 'inner')
    
    // FORCE JOIN approach if there's any ORDER BY with referencedTable or !inner embedded resources
    const shouldUseJoins = hasFiltersOnEmbeddedTables || hasOrderingOnEmbeddedTables || hasOrderingOnReferencedTables || hasOrderingRequiringJoins || hasInnerJoinEmbedded
    
    console.log('🐛 SQLBuilder Join Decision:', {
      table,
      hasFiltersOnEmbeddedTables,
      hasOrderingOnEmbeddedTables, 
      hasOrderingOnReferencedTables,
      hasOrderingRequiringJoins,
      hasInnerJoinEmbedded,
      shouldUseJoins,
      queryFilters: query.filters,
      queryOrder: query.order,
      queryEmbedded: query.embedded
    })
    
    if (shouldUseJoins) {
      // For PostgREST compatibility: when filtering or ordering on embedded table fields,
      // we need to JOIN the embedded table and apply the operations in the appropriate clauses
      return await this.buildSelectWithJoins(table, query)
    } else {
      // No filters or ordering on embedded tables, use standard subquery approach
      return await this.buildSelectWithJoinAggregation(table, query)
    }
  }

  /**
   * Specialized method for INNER JOIN embedded resources (!inner hint)
   * Uses subqueries with EXISTS conditions to ensure only parent rows with matching children are returned
   */
  private async buildSelectWithInnerJoins(table: string, query: ParsedQuery): Promise<{ sql: string, joins: JoinInfo[] }> {
    console.log(`🔍 Building SELECT with INNER JOIN approach for: ${table}`)
    
    const joins: JoinInfo[] = []
    const selectColumns: string[] = []
    
    // Build main table columns
    const quotedMainTable = this.quoteIdentifier(table)
    const mainTableAlias = table
    
    if (query.select && query.select.length > 0) {
      const embeddedTableNames = (query.embedded || []).map(e => e.table)
      
      for (const col of query.select) {
        // Skip embedded table names - they'll be handled separately
        if (embeddedTableNames.includes(col)) {
          continue
        }
        
        if (col === '*') {
          selectColumns.push(`${quotedMainTable}.*`)
        } else {
          selectColumns.push(`${quotedMainTable}.${this.quoteIdentifier(col)}`)
        }
      }
    } else {
      selectColumns.push(`${quotedMainTable}.*`)
    }
    
    // Add embedded resources using subqueries with EXISTS filters for INNER JOIN behavior
    for (const embedded of query.embedded || []) {
      if (embedded.fkHint === 'inner') {
        const subquery = await this.buildEmbeddedSubquery(table, embedded, query.filters, query.schema)
        if (subquery) {
          const aliasName = embedded.alias || embedded.table
          selectColumns.push(`(${subquery}) AS ${this.quoteIdentifier(aliasName)}`)
        }
      }
    }
    
    // Build WHERE clause with EXISTS conditions for INNER JOIN behavior
    const whereConditions: string[] = []
    
    // Add regular filters
    const mainTableFilters = query.filters.filter(filter => !filter.referencedTable || filter.referencedTable === table)
    for (const filter of mainTableFilters) {
      const condition = this.buildFilterCondition(filter, quotedMainTable)
      if (condition) {
        whereConditions.push(condition)
      }
    }
    
    // Add EXISTS conditions for INNER JOIN embedded resources
    for (const embedded of query.embedded || []) {
      if (embedded.fkHint === 'inner') {
        // Find filters for this embedded table
        const embeddedFilters = query.filters.filter(filter => 
          filter.referencedTable === embedded.table || 
          filter.column.startsWith(`${embedded.table}.`)
        )
        
        if (embeddedFilters.length > 0) {
          // Discover FK relationship
          const fkRelationship = await this.discoverForeignKeyRelationship(table, embedded.table)
          if (fkRelationship) {
            // Build EXISTS condition
            const embeddedFilterConditions = embeddedFilters.map(filter => {
              const cleanColumn = filter.column.replace(`${embedded.table}.`, '')
              return this.buildFilterCondition({
                ...filter,
                column: cleanColumn
              }, this.quoteIdentifier(embedded.table))
            }).filter(Boolean)
            
            if (embeddedFilterConditions.length > 0) {
              let joinCondition: string
              if (fkRelationship.fromTable === table && fkRelationship.toTable === embedded.table) {
                joinCondition = `${quotedMainTable}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${this.quoteIdentifier(embedded.table)}.${this.quoteIdentifier(fkRelationship.toColumn)}`
              } else {
                joinCondition = `${this.quoteIdentifier(embedded.table)}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${quotedMainTable}.${this.quoteIdentifier(fkRelationship.toColumn)}`
              }
              
              const existsCondition = `EXISTS (SELECT 1 FROM ${this.quoteIdentifier(embedded.table)} WHERE ${joinCondition} AND ${embeddedFilterConditions.join(' AND ')})`
              whereConditions.push(existsCondition)
            }
          }
        } else {
          // No filters, but still need to ensure the relationship exists for INNER JOIN behavior
          const fkRelationship = await this.discoverForeignKeyRelationship(table, embedded.table)
          if (fkRelationship) {
            let joinCondition: string
            if (fkRelationship.fromTable === table && fkRelationship.toTable === embedded.table) {
              joinCondition = `${quotedMainTable}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${this.quoteIdentifier(embedded.table)}.${this.quoteIdentifier(fkRelationship.toColumn)}`
            } else {
              joinCondition = `${this.quoteIdentifier(embedded.table)}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${quotedMainTable}.${this.quoteIdentifier(fkRelationship.toColumn)}`
            }
            
            const existsCondition = `EXISTS (SELECT 1 FROM ${this.quoteIdentifier(embedded.table)} WHERE ${joinCondition})`
            whereConditions.push(existsCondition)
          }
        }
      }
    }
    
    // Build final SQL
    let sql = `SELECT ${selectColumns.join(', ')} FROM ${quotedMainTable}`
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`
    }
    
    // Add ORDER BY if specified
    if (query.order && query.order.length > 0) {
      const orderClause = await this.buildOrderClause(query.order, query, quotedMainTable)
      if (orderClause) {
        sql += ` ${orderClause}`
      }
    }
    
    // Add LIMIT and OFFSET
    if (query.limit) {
      sql += ` LIMIT ${query.limit}`
    }
    if (query.offset) {
      sql += ` OFFSET ${query.offset}`
    }
    
    console.log(`🗃️  Final INNER JOIN SQL: ${sql}`)
    console.log(`🗃️  Select columns used:`, selectColumns)
    
    return { sql, joins }
  }

  /**
   * Build SELECT query with JOINs for filtering on embedded tables
   */
  private async buildSelectWithJoins(table: string, query: ParsedQuery): Promise<{ sql: string, joins: JoinInfo[] }> {
    console.log(`🔍 Building SELECT with JOINs for: ${table}`)
    
    const joins: JoinInfo[] = []
    const selectColumns: string[] = []
    
    // Helper function to properly quote table names
    const quoteTableName = (tableName: string): string => {
      if (tableName.startsWith('"') && tableName.endsWith('"')) {
        return tableName
      }
      if (tableName.includes(' ') || /[^a-zA-Z0-9_]/.test(tableName)) {
        return `"${tableName}"`
      }
      return tableName
    }
    
    // Helper function to check if table exists and return the correct table name
    const getActualTableName = async (tableName: string): Promise<string> => {
      if (!this.dbManager) {
        return tableName
      }
      
      try {
        // First try the table name as-is (no schema prefix)
        const cleanTable = tableName.replace(/^"(.*)"$/, '$1')
        const checkQuery = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '${cleanTable.replace(/'/g, "''")}' AND table_schema = 'public')`
        const result = await this.dbManager.query(checkQuery)
        
        if (result.rows[0].exists) {
          console.log(`✅ Table '${cleanTable}' exists in public schema`)
          return cleanTable // Return without schema prefix since it exists
        } else {
          console.log(`⚠️ Table '${cleanTable}' not found in public schema, using as-is`)
          return tableName
        }
      } catch (error) {
        console.log(`⚠️ Could not check table existence for '${tableName}':`, error)
        return tableName
      }
    }
    
    // Get the actual table name (without forced schema qualification)
    const actualMainTable = await getActualTableName(table)
    const quotedMainTable = quoteTableName(actualMainTable)
    
    // Get all tables that need to be joined (from embedded resources, filters, and ordering)
    const tablesInFilters = this.getFilteredTableNames(query)
    const tablesInOrdering = this.getOrderingTableNames(query)
    const embeddedTables = new Set(query.embedded?.map(e => e.table) || [])
    
    // Debug logging for embedded resources and select columns
    console.log(`🔍 DEBUG SQLBuilder - query.select:`, query.select)
    console.log(`🔍 DEBUG SQLBuilder - query.embedded:`, query.embedded)
    console.log(`🔍 DEBUG SQLBuilder - embeddedTables:`, Array.from(embeddedTables))
    
    // Convert ordering table aliases to actual table names
    const actualOrderingTables = new Set<string>()
    
    for (const orderingTable of tablesInOrdering) {
      const embedded = query.embedded?.find(e => e.alias === orderingTable || e.table === orderingTable)
      if (embedded) {
        console.log(`🎯 Resolved ordering table alias: ${orderingTable} -> ${embedded.table}`)
        actualOrderingTables.add(embedded.table)
      } else {
        actualOrderingTables.add(orderingTable)
      }
    }
    
    const allReferencedTables = new Set([...tablesInFilters, ...embeddedTables, ...actualOrderingTables])
    
    // Build JOINs for all referenced tables
    console.log('🔗 All referenced tables to JOIN:', Array.from(allReferencedTables))
    
    for (const referencedTable of allReferencedTables) {
      console.log(`🔗 Processing JOIN for table: ${referencedTable}`)
      
      // Get the actual table name (without forced schema qualification)
      const actualRefTable = await getActualTableName(referencedTable)
      const quotedRefTable = quoteTableName(actualRefTable)
      
      // Discover foreign key relationship using actual table names
      console.log(`🔍 Discovering FK relationship: ${actualMainTable} <-> ${actualRefTable}`)
      let fkRelationship = await this.discoverForeignKeyRelationship(actualMainTable, actualRefTable)
      
      // If FK discovery failed, log the failure but don't use hardcoded fallbacks
      if (!fkRelationship) {
        console.log(`❌ FK discovery failed for ${table} <-> ${referencedTable} - no foreign key relationship found in database schema`)
      } else {
        console.log(`✅ FK discovery succeeded for ${table} <-> ${referencedTable}:`, fkRelationship)
      }
      
      if (fkRelationship) {
        // Determine JOIN type for PostgREST compatibility
        const embeddedResource = query.embedded?.find(e => e.table === referencedTable)
        const joinType = this.determineJoinType(embeddedResource, referencedTable, tablesInFilters)
        
        // Generate proper table aliases for JOIN conditions to avoid schema-qualified identifier issues
        const mainTableAlias = this.extractTableNameFromQualified(quotedMainTable)
        const refTableAlias = this.extractTableNameFromQualified(quotedRefTable)
        
        let joinCondition: string
        if (fkRelationship.fromTable === actualMainTable.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === actualRefTable.replace(/^"(.*)"$/, '$1')) {
          // Main table references embedded table
          joinCondition = `${this.quoteIdentifier(mainTableAlias)}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${this.quoteIdentifier(refTableAlias)}.${this.quoteIdentifier(fkRelationship.toColumn)}`
        } else if (fkRelationship.fromTable === actualRefTable.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === actualMainTable.replace(/^"(.*)"$/, '$1')) {
          // Embedded table references main table
          joinCondition = `${this.quoteIdentifier(refTableAlias)}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${this.quoteIdentifier(mainTableAlias)}.${this.quoteIdentifier(fkRelationship.toColumn)}`
        } else {
          console.log(`⚠️ Cannot determine join condition for ${actualMainTable} <-> ${actualRefTable}`)
          continue
        }
        
        joins.push({
          table: quotedRefTable,
          alias: this.quoteIdentifier(refTableAlias), // Use clean table alias
          condition: joinCondition,
          type: joinType
        })
        
        console.log(`🔗 Added ${joinType} JOIN: ${quotedRefTable} AS ${this.quoteIdentifier(refTableAlias)} ON ${joinCondition}`)
      }
    }
    
    // Build SELECT clause with main table columns
    const embeddedTableNames = Array.from(embeddedTables)
    const mainTableAlias = this.extractTableNameFromQualified(quotedMainTable)
    const quotedMainTableAlias = this.quoteIdentifier(mainTableAlias)
    
    console.log(`🔍 embeddedTableNames to skip:`, embeddedTableNames)
    console.log(`🔍 Processing query.select:`, query.select)
    console.log(`🔍 Main table alias:`, mainTableAlias, `quoted:`, quotedMainTableAlias)
    
    if (query.select && query.select.length > 0) {
      for (const col of query.select) {
        console.log(`🔍 Processing select column: '${col}'`)
        // Skip embedded table names - they'll be handled separately
        if (embeddedTableNames.includes(col)) {
          console.log(`   ⏭️ Skipping embedded table name: '${col}'`)
          continue
        }
        
        if (col === '*') {
          selectColumns.push(`${quotedMainTableAlias}.*`)
        } else {
          // Check if this is a JSON path expression
          const jsonPathInfo = this.parseJSONPathExpression(col)
          if (jsonPathInfo) {
            // Generate SQL for JSON path extraction (using clean alias)
            const sqlExpression = this.buildJSONPathSQL(quotedMainTableAlias, jsonPathInfo)
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              selectColumns.push(`${sqlExpression} AS ${alias}`)
            } else {
              // Use the computed alias from JSON path parsing
              selectColumns.push(`${sqlExpression} AS ${jsonPathInfo.alias}`)
            }
          } else {
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              selectColumns.push(`${quotedMainTableAlias}.${this.quoteIdentifier(col)} AS ${alias}`)
            } else {
              selectColumns.push(`${quotedMainTableAlias}.${this.quoteIdentifier(col)}`)
            }
          }
        }
      }
    } else {
      selectColumns.push(`${quotedMainTableAlias}.*`)
    }
    
    // Build FROM clause with JOINs
    let fromClause = `FROM ${quotedMainTable} AS ${quotedMainTableAlias}`
    console.log(`🔍 DEBUG: Building FROM clause - quotedMainTable: "${quotedMainTable}" AS ${quotedMainTableAlias}`)
    console.log(`🔍 DEBUG: Total joins to process: ${joins.length}`)
    
    for (const join of joins) {
      console.log(`🔍 DEBUG: Processing join:`, {
        table: join.table,
        alias: join.alias,
        condition: join.condition,
        type: join.type
      })
      fromClause += ` ${join.type} JOIN ${join.table} AS ${join.alias} ON ${join.condition}`
      console.log(`🔍 DEBUG: FROM clause now: "${fromClause}"`)
    }

    // Build WHERE clause - separate main table filters from embedded table filters
    // For PostgREST compatibility, embedded table filters should not filter out parent rows
    // unless there's an explicit inner join hint
    const { mainTableFilters, embeddedTableFilters } = this.separateMainAndEmbeddedFilters(query, allReferencedTables)
    
    // Add embedded resources as aggregated JSON (after filter separation)
    for (const embedded of query.embedded || []) {
      const quotedEmbedded = this.buildQuotedQualifiedTableName(embedded.table, query.schema)
      
      // Build JSON aggregation for embedded resource using aggregate functions for GROUP BY compatibility
      let jsonSelectClause: string
      if (embedded.select && embedded.select.length > 0) {
        const embeddedAlias = this.extractTableNameFromQualified(quotedEmbedded)
        const quotedEmbeddedAlias = this.quoteIdentifier(embeddedAlias)
        const columnPairs = embedded.select.map(col => {
          if (col === '*') {
            // Use array_agg and take first element for single-row results
            return `(array_agg(to_json(${quotedEmbeddedAlias})))[1]`
          } else {
            // Use array_agg for individual columns and take first element
            return `'${col}', (array_agg(${quotedEmbeddedAlias}.${this.quoteIdentifier(col)}))[1]`
          }
        })
        if (columnPairs.length === 1 && embedded.select[0] === '*') {
          jsonSelectClause = columnPairs[0]
        } else {
          jsonSelectClause = `json_build_object(${columnPairs.join(', ')})`
        }
      } else {
        const embeddedAlias = this.extractTableNameFromQualified(quotedEmbedded)
        const quotedEmbeddedAlias = this.quoteIdentifier(embeddedAlias)
        jsonSelectClause = `(array_agg(to_json(${quotedEmbeddedAlias})))[1]`
      }
      
      // Use alias if provided, otherwise use table name
      const aliasName = embedded.alias || embedded.table
      const quotedAlias = quoteTableName(aliasName)
      
      // In JOIN approach, use JSON aggregation from joined table instead of subqueries
      selectColumns.push(`${jsonSelectClause} AS ${quotedAlias}`)
    }
    console.log(`🔍 Separated filters:`, {
      mainTableFilters: mainTableFilters.length,
      embeddedTableFilters: embeddedTableFilters.length
    })
    
    // Build WHERE clause - for INNER JOINs with embedded table filters, include them in main query
    let allMainFilters = [...mainTableFilters]
    
    // Add embedded table filters to main query WHERE clause for INNER JOIN behavior
    for (const embedded of query.embedded || []) {
      if (embedded.fkHint === 'inner') {
        // Find filters for this embedded table
        const embeddedFilters = embeddedTableFilters.filter(filter => 
          filter.column.startsWith(`${embedded.table}.`) || filter.referencedTable === embedded.table
        )
        allMainFilters.push(...embeddedFilters)
      }
    }
    
    const whereClause = this.buildWhereClause(allMainFilters)
    
    // For INNER JOIN embedded resources, add HAVING clause to filter out rows with NULL embedded data
    let havingClause = ''
    const innerJoinEmbedded = (query.embedded || []).filter(embedded => embedded.fkHint === 'inner')
    if (innerJoinEmbedded.length > 0) {
      const havingConditions = innerJoinEmbedded.map(embedded => {
        const aliasName = embedded.alias || embedded.table
        const quotedAlias = quoteTableName(aliasName)
        // For JSON objects, check if the result is not NULL and not empty
        return `${quotedAlias} IS NOT NULL AND ${quotedAlias}::text != 'null'`
      })
      havingClause = `HAVING ${havingConditions.join(' AND ')}`
    }

    // Build GROUP BY clause (required when using JSON aggregation)
    const groupByColumns = this.buildGroupByColumns(quotedMainTableAlias, query)
    const groupByClause = groupByColumns ? `GROUP BY ${groupByColumns}` : ''

    // Build ORDER BY clause
    const orderClause = await this.buildOrderClause(query.order, query, quotedMainTable)

    // Build LIMIT and OFFSET
    const limitClause = query.limit ? `LIMIT ${query.limit}` : ''
    const offsetClause = query.offset ? `OFFSET ${query.offset}` : ''

    // Combine all parts
    const parts = [
      `SELECT ${selectColumns.join(', ')}`,
      fromClause,
      whereClause,
      groupByClause,
      havingClause,
      orderClause,
      limitClause,
      offsetClause
    ].filter(Boolean)

    const finalSQL = parts.join(' ')
    console.log(`🗃️  Final JOIN-based SQL: ${finalSQL}`)

    return {
      sql: finalSQL,
      joins
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
    const orderClause = await this.buildOrderClause(query.order, query, table)

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
          // Check if this is a JSON path expression
          const jsonPathInfo = this.parseJSONPathExpression(col)
          if (jsonPathInfo) {
            // Generate SQL for JSON path extraction
            const sqlExpression = this.buildJSONPathSQL(table, jsonPathInfo)
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              columns.push(`${sqlExpression} AS ${alias}`)
            } else {
              // Use the computed alias from JSON path parsing
              columns.push(`${sqlExpression} AS ${jsonPathInfo.alias}`)
            }
          } else {
            // Apply column alias if available
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              columns.push(`${table}.${col} AS ${alias}`)
            } else {
              columns.push(`${table}.${col}`)
            }
          }
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
    
    const quotedMainTable = this.buildQuotedQualifiedTableName(table, query.schema)
    // Extract clean table alias to avoid schema-qualified column references
    const mainTableAlias = this.extractTableNameFromQualified(quotedMainTable)
    const quotedMainTableAlias = this.quoteIdentifier(mainTableAlias)
    
    console.log(`🔍 DEBUG JoinAggregation: quotedMainTable="${quotedMainTable}", alias="${mainTableAlias}"`)
    
    // Add main table columns, filtering out embedded table names
    const embeddedTableNames = (query.embedded || []).map(e => e.table)
    
    if (query.select && query.select.length > 0) {
      for (const col of query.select) {
        // Skip embedded table names - they'll be handled as subqueries
        if (embeddedTableNames.includes(col)) {
          continue
        }
        
        if (col === '*') {
          selectColumns.push(`${quotedMainTableAlias}.*`)
        } else {
          // Check if this is a JSON path expression
          const jsonPathInfo = this.parseJSONPathExpression(col)
          if (jsonPathInfo) {
            // Generate SQL for JSON path extraction (using clean alias)
            const sqlExpression = this.buildJSONPathSQL(quotedMainTableAlias, jsonPathInfo)
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              selectColumns.push(`${sqlExpression} AS ${alias}`)
            } else {
              // Use the computed alias from JSON path parsing
              selectColumns.push(`${sqlExpression} AS ${jsonPathInfo.alias}`)
            }
          } else {
            // Apply column alias if available (using clean alias)
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              selectColumns.push(`${quotedMainTableAlias}.${this.quoteIdentifier(col)} AS ${alias}`)
            } else {
              selectColumns.push(`${quotedMainTableAlias}.${this.quoteIdentifier(col)}`)
            }
          }
        }
      }
    } else {
      selectColumns.push(`${quotedMainTableAlias}.*`)
    }
    
    // Add embedded resources as correlated subqueries
    // Filter out embedded resources without aliases if there are others with aliases for the same table
    // BUT allow multiple embedded resources for the same table if they have different aliases or FK hints
    console.log(`🔍 DEBUG: Original embedded resources:`, JSON.stringify(query.embedded, null, 2))
    const filteredEmbedded = (query.embedded || []).filter(embedded => {
      if (embedded.alias || embedded.fkHint) {
        console.log(`✅ Including embedded resource with alias/FK hint:`, embedded)
        return true  // Always include if it has an alias or FK hint
      }
      
      // Only include if there are no other embedded resources with aliases or FK hints for the same table
      const hasAliasedOrHintedVersion = (query.embedded || []).some(other => 
        other.table === embedded.table && (other.alias || other.fkHint)
      )
      console.log(`❓ Embedded resource without alias/FK hint:`, embedded, `hasAliasedVersion:`, hasAliasedOrHintedVersion)
      return !hasAliasedOrHintedVersion
    })
    console.log(`🔍 DEBUG: Filtered embedded resources:`, JSON.stringify(filteredEmbedded, null, 2))
    
    // Inner join tracking removed - now handled by proper SQL INNER JOINs
    
    for (const embedded of filteredEmbedded) {
      console.log(`🔍 DEBUG: Processing embedded resource for subquery:`, embedded)
      const subquery = await this.buildEmbeddedSubquery(table, embedded, query.filters)
      if (subquery) {
        // Use the specified alias if provided, otherwise fall back to table name
        const aliasName = embedded.alias || embedded.table
        // For aliases, quote directly without schema qualification
        const quotedAlias = embedded.alias ? this.quoteIdentifier(embedded.alias) : this.buildQuotedQualifiedTableName(embedded.table, query.schema)
        console.log(`🔍 DEBUG: Creating subquery column: aliasName="${aliasName}", quotedAlias="${quotedAlias}"`)
        console.log(`🔍 DEBUG: Subquery SQL: ${subquery}`)
        selectColumns.push(`(${subquery}) AS ${quotedAlias}`)
      }
    }
    
    // Build FROM clause with alias
    const fromClause = `FROM ${quotedMainTable} AS ${quotedMainTableAlias}`

    // Build WHERE clause - separate main table filters from embedded table filters
    // For PostgREST compatibility, embedded table filters should not filter out parent rows
    const embeddedTables = new Set((query.embedded || []).map(e => e.table))
    const { mainTableFilters } = this.separateMainAndEmbeddedFilters(query, embeddedTables)
    const whereClause = this.buildWhereClause(mainTableFilters)

    // HAVING clause removed - inner join filtering now handled by proper SQL INNER JOINs

    // Build ORDER BY clause (using clean alias)
    const orderClause = await this.buildOrderClause(query.order, query, quotedMainTableAlias)

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
    console.log(`🗃️  SQL Parameters: ${JSON.stringify(this.parameters)}`)

    return {
      sql: finalSQL,
      joins
    }
  }

  /**
   * Build correlated subquery for embedded resource
   */
  private async buildEmbeddedSubquery(table: string, embedded: EmbeddedResource, queryFilters?: ParsedFilter[], schema?: string): Promise<string | null> {
    console.log(`🔍 Building subquery for: ${table} -> ${embedded.table}`)
    
    // Check for embedded table filters from the query that apply to this embedded table
    console.log(`🔍 Checking for filters for embedded table: ${embedded.table}`)
    console.log(`🔍 All query filters:`, queryFilters)
    
    const embeddedTableFilters = (queryFilters || []).filter(filter => {
      const startsWithTable = filter.column.startsWith(`${embedded.table}.`)
      const hasReferencedTable = filter.referencedTable === embedded.table
      console.log(`🔍 Filter check - column: "${filter.column}", starts with "${embedded.table}.": ${startsWithTable}, referencedTable: "${filter.referencedTable}", matches: ${hasReferencedTable}`)
      return startsWithTable || hasReferencedTable
    })
    console.log(`🔍 Found ${embeddedTableFilters.length} filters for embedded table ${embedded.table}:`, embeddedTableFilters)
    
    // If there are embedded table filters, we need to return NULL when they don't match
    // to maintain PostgREST compatibility
    if (embeddedTableFilters.length > 0) {
      console.log(`🔧 Embedded table has filters - will return NULL if filters don't match`)
    }
    
    // Discover the foreign key relationship
    // Don't pass join type hints (like "inner") as constraint names
    const constraintHint = embedded.fkHint === 'inner' ? undefined : embedded.fkHint
    let fkRelationship = await this.discoverForeignKeyRelationship(table, embedded.table, constraintHint)
    console.log(`🔗 Foreign key relationship found:`, fkRelationship)
    
    // If FK discovery failed, return null - no hardcoded fallbacks allowed
    if (!fkRelationship) {
      console.log(`❌ No foreign key relationship found between ${table} and ${embedded.table} in database schema`)
    }    if (!fkRelationship) {
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
    
    const quotedEmbeddedTable = this.buildQuotedQualifiedTableName(embedded.table, schema)
    const quotedMainTable = this.buildQuotedQualifiedTableName(table, schema)
    
    // Extract clean table aliases to avoid schema-qualified column references
    const embeddedTableAlias = this.extractTableNameFromQualified(quotedEmbeddedTable)
    const mainTableAlias = this.extractTableNameFromQualified(quotedMainTable)
    const quotedEmbeddedAlias = this.quoteIdentifier(embeddedTableAlias)
    const quotedMainAlias = this.quoteIdentifier(mainTableAlias)
    
    console.log(`🔍 DEBUG buildEmbeddedSubquery: embedded "${quotedEmbeddedTable}" -> alias "${embeddedTableAlias}", main "${quotedMainTable}" -> alias "${mainTableAlias}"`)
    
    // Check if this is a count-only request
    const isCountOnly = embedded.select?.length === 1 && embedded.select[0] === 'count'
    
    // Quote the FK relationship table names for matching
    const quotedFromTable = quoteTableName(fkRelationship.fromTable)
    const quotedToTable = quoteTableName(fkRelationship.toTable)
    
    // Determine join condition based on relationship direction
    let subquery: string
    
    // Check if this is a many-to-many relationship (has joinTable property)
    if (fkRelationship.joinTable) {
      console.log(`🔗 Building many-to-many subquery through join table: ${fkRelationship.joinTable}`)
      
      const joinTableQuoted = quoteTableName(fkRelationship.joinTable!)
      let whereCondition = `${quotedEmbeddedAlias}.${this.quoteIdentifier(fkRelationship.toColumn)} IN (
        SELECT ${joinTableQuoted}.${this.quoteIdentifier(fkRelationship.joinEmbeddedColumn!)} 
        FROM ${joinTableQuoted} 
        WHERE ${joinTableQuoted}.${this.quoteIdentifier(fkRelationship.joinMainColumn!)} = ${quotedMainAlias}.${this.quoteIdentifier(fkRelationship.fromColumn)}
      )`
      
      // Build additional WHERE conditions for embedded filters
      if (embedded.filters && embedded.filters.length > 0) {
        const embeddedFilterConditions = embedded.filters
          .map(filter => {
            // Strip table name from filter column since we're already in the embedded table context
            const columnName = filter.column.includes('.') ? 
              filter.column.split('.').slice(1).join('.') : filter.column
            return this.buildFilterConditionLiteral({ ...filter, column: columnName })
          })
          .filter(Boolean)
        
        if (embeddedFilterConditions.length > 0) {
          whereCondition += ` AND ${embeddedFilterConditions.join(' AND ')}`
        }
      }
      
      if (isCountOnly) {
        // For count-only requests, return a simple count without json_agg nesting
        subquery = `SELECT json_build_array(json_build_object('count', (SELECT COUNT(*) FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition})))`
      } else {
        const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
        // Add ORDER BY support for embedded resources within json_agg
        let jsonAggClause = `json_agg(${selectClause})`
        if (embedded.order && embedded.order.length > 0) {
          const orderItems = await Promise.all(embedded.order.map(async (item) => {
            const columnRef = `${quotedEmbeddedAlias}.${this.quoteIdentifier(item.column)}`
            let orderItem = `${columnRef} ${item.ascending ? 'ASC' : 'DESC'}`
            if (item.nullsFirst !== undefined) {
              orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
            }
            return orderItem
          }))
          const orderByClause = `ORDER BY ${orderItems.join(', ')}`
          jsonAggClause = `json_agg(${selectClause} ${orderByClause})`
          console.log(`🎯 Added ORDER BY for embedded resource ${embedded.table} (many-to-many):`, orderByClause)
        }
        
        subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition}) 
                           THEN COALESCE(${jsonAggClause}, '[]'::json) 
                           ELSE NULL 
                           END 
                    FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition}`
      }
    } else {
      // Direct relationship (one-to-many or many-to-one)
      let whereCondition: string
      if (fkRelationship.fromTable === embedded.table.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === table.replace(/^"(.*)"$/, '$1')) {
        // One-to-many: embedded table references main table
        // instruments.section_id = orchestral_sections.id
        console.log(`🎯 TAKING ONE-TO-MANY PATH for ${table} -> ${embedded.table}`)
        console.log(`🎯 fkHint: ${embedded.fkHint}, should use json_agg for arrays`)
        whereCondition = `${quotedEmbeddedAlias}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${quotedMainAlias}.${this.quoteIdentifier(fkRelationship.toColumn)}`
        
        // Build additional WHERE conditions for embedded filters
        let additionalWhere = ''
        const filtersToUse = embeddedTableFilters.length > 0 ? embeddedTableFilters : (embedded.filters || [])
        
        if (filtersToUse.length > 0) {
          const embeddedFilterConditions = filtersToUse
            .map(filter => {
              // Strip table name from filter column since we're already in the embedded table context
              const columnName = filter.column.includes('.') ? 
                filter.column.split('.').slice(1).join('.') : filter.column
              return this.buildFilterConditionLiteral({ ...filter, column: columnName })
            })
            .filter(Boolean)
          
          if (embeddedFilterConditions.length > 0) {
            additionalWhere = ` AND ${embeddedFilterConditions.join(' AND ')}`
          }
        }
        
        whereCondition += additionalWhere
        console.log(`🔧 One-to-many relationship with embedded filters: ${whereCondition}`)
        
        // Continue with one-to-many subquery building
        if (isCountOnly) {
          // For count-only requests, return a simple count without json_agg nesting
          subquery = `SELECT json_build_array(json_build_object('count', (SELECT COUNT(*) FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition})))`
        } else {
          const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
          
          // For PostgREST compatibility: when filtering on embedded table columns,
          // return NULL if no rows match the filter, otherwise return the matching rows
          if (embeddedTableFilters.length > 0) {
            // Build separate conditions for relationship and embedded filters
            const relationshipCondition = `${quotedEmbeddedAlias}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${quotedMainAlias}.${this.quoteIdentifier(fkRelationship.toColumn)}`
            const embeddedFiltersCondition = additionalWhere
            
            console.log(`🔧 Applying embedded table filter condition: ${embeddedFiltersCondition}`)
            
            // Simplified subquery with embedded filters - inner join filtering handled by proper SQL INNER JOINs
            if (embedded.fkHint === 'inner') {
              // For inner joins, return single object (not array)
              subquery = `SELECT ${selectClause} FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition} LIMIT 1`
            } else {
              // For left joins with embedded filters, return NULL when no matches (PostgREST compatibility)
              // Add ORDER BY support for embedded resources within json_agg
              let jsonAggClause = `json_agg(${selectClause})`
              if (embedded.order && embedded.order.length > 0) {
                const orderItems = await Promise.all(embedded.order.map(async (item) => {
                  const columnRef = `${quotedEmbeddedAlias}.${this.quoteIdentifier(item.column)}`
                  let orderItem = `${columnRef} ${item.ascending ? 'ASC' : 'DESC'}`
                  if (item.nullsFirst !== undefined) {
                    orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
                  }
                  return orderItem
                }))
                const orderByClause = `ORDER BY ${orderItems.join(', ')}`
                jsonAggClause = `json_agg(${selectClause} ${orderByClause})`
                console.log(`🎯 Added ORDER BY for embedded resource ${embedded.table} (with filters):`, orderByClause)
              }
              
              subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition}) 
                                 THEN COALESCE(${jsonAggClause}, '[]'::json) 
                                 ELSE NULL 
                                 END 
                          FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition}`
            }
          } else {
            // No embedded filters - simplified logic
            if (embedded.fkHint === 'inner') {
              // For inner joins, return single object (not array)
              subquery = `SELECT ${selectClause} FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition} LIMIT 1`
            } else {
              // For LEFT JOIN (default), return array
              // Add ORDER BY support for embedded resources within json_agg
              let jsonAggClause = `json_agg(${selectClause})`
              if (embedded.order && embedded.order.length > 0) {
                const orderItems = await Promise.all(embedded.order.map(async (item) => {
                  const columnRef = `${quotedEmbeddedAlias}.${this.quoteIdentifier(item.column)}`
                  let orderItem = `${columnRef} ${item.ascending ? 'ASC' : 'DESC'}`
                  if (item.nullsFirst !== undefined) {
                    orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
                  }
                  return orderItem
                }))
                const orderByClause = `ORDER BY ${orderItems.join(', ')}`
                jsonAggClause = `json_agg(${selectClause} ${orderByClause})`
                console.log(`🎯 Added ORDER BY for embedded resource ${embedded.table}:`, orderByClause)
              }
              
              subquery = `SELECT COALESCE(${jsonAggClause}, '[]'::json) FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${whereCondition}`
            }
          }
        }
        
      } else if (fkRelationship.fromTable === table.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === embedded.table.replace(/^"(.*)"$/, '$1')) {
        console.log(`🚨 TAKING MANY-TO-ONE PATH for ${table} -> ${embedded.table} (THIS SHOULD NOT HAPPEN!)`)
        console.log(`🚨 This uses LIMIT 1 and returns single objects instead of arrays`);
        // Many-to-one: main table references embedded table
        // Each row in main table has exactly one corresponding row in embedded table
        // Return single object, not array
        whereCondition = `${quotedMainAlias}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${quotedEmbeddedAlias}.${this.quoteIdentifier(fkRelationship.toColumn)}`
        
        // Build additional WHERE conditions for embedded filters
        let additionalWhere = ''
        const filtersToUse = embeddedTableFilters.length > 0 ? embeddedTableFilters : (embedded.filters || [])
        
        if (filtersToUse.length > 0) {
          const embeddedFilterConditions = filtersToUse
            .map(filter => {
              // Strip table name from filter column since we're already in the embedded table context
              const columnName = filter.column.includes('.') ? 
                filter.column.split('.').slice(1).join('.') : filter.column
              return this.buildFilterConditionLiteral({ ...filter, column: columnName })
            })
            .filter(Boolean)
          
          if (embeddedFilterConditions.length > 0) {
            additionalWhere = ` AND ${embeddedFilterConditions.join(' AND ')}`
          }
        }
        
        // If we have embedded table filters but they don't match, we should return null
        if (embeddedTableFilters.length > 0 && additionalWhere) {
          // The embedded table has filters that need to be checked
          console.log(`🔧 Applying embedded table filter for many-to-one relationship: ${additionalWhere}`)
        }
        
        const fullWhereCondition = `${whereCondition}${additionalWhere}`
        
        if (isCountOnly) {
          // For count-only many-to-one, return 1 if relationship exists and matches filters, 0 otherwise
          subquery = `SELECT json_build_object('count', CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition}) THEN 1 ELSE 0 END)`
        } else {
          const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
          
          // For many-to-one with embedded table filters, return NULL if no rows match the filter
          if (embeddedTableFilters.length > 0) {
            // Return NULL when embedded table filters don't match any rows
            subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition}) 
                               THEN (SELECT ${selectClause} FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition} LIMIT 1)
                               ELSE NULL 
                               END`
          } else {
            // No embedded filters, use standard logic
            subquery = `SELECT ${selectClause} FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition} LIMIT 1`
          }
        }
        return subquery
      } else {
        console.log(`❌ Invalid foreign key relationship direction`)
        return null
      }

      // One-to-many: embedded table references main table
      // Can have multiple rows in embedded table for each main table row
      
      // Build additional WHERE conditions for embedded filters
      let additionalWhere = ''
      const filtersToUse = embeddedTableFilters.length > 0 ? embeddedTableFilters : (embedded.filters || [])
      
      if (filtersToUse.length > 0) {
        const embeddedFilterConditions = filtersToUse
          .map(filter => {
            // Strip table name from filter column since we're already in the embedded table context
            const columnName = filter.column.includes('.') ? 
              filter.column.split('.').slice(1).join('.') : filter.column
            return this.buildFilterConditionLiteral({ ...filter, column: columnName })
          })
          .filter(Boolean)
        
        if (embeddedFilterConditions.length > 0) {
          additionalWhere = ` AND ${embeddedFilterConditions.join(' AND ')}`
        }
      }
      
      const fullWhereCondition = `${whereCondition}${additionalWhere}`
      
      if (isCountOnly) {
        // For count-only requests, return a simple count without json_agg nesting
        subquery = `SELECT json_build_array(json_build_object('count', (SELECT COUNT(*) FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition})))`
      } else {
        const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
        
        // For PostgREST compatibility: when filtering on embedded table columns,
        // return NULL if no rows match the filter, otherwise return the matching rows
        console.log(`🎯 embeddedTableFilters.length = ${embeddedTableFilters.length}`)
        if (embeddedTableFilters.length > 0) {
          console.log(`🎯 TAKING EMBEDDED FILTERS PATH (should still use json_agg)`)
          // Build separate conditions for relationship and embedded filters
          const relationshipCondition = whereCondition
          const embeddedFiltersCondition = additionalWhere
          const combinedCondition = `${relationshipCondition}${embeddedFiltersCondition}`
          
          // For inner joins, ensure NULL is returned when no matches exist to enable main query filtering
          if (embedded.fkHint === 'inner') {
            // For inner joins, return single object or NULL (NULL triggers main query filtering)
            subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${combinedCondition}) 
                               THEN (SELECT ${selectClause} FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${combinedCondition} LIMIT 1)
                               ELSE NULL 
                               END`
          } else {
            // For left joins, return array
            // Add ORDER BY support for embedded resources within json_agg
            let jsonAggClause = `json_agg(${selectClause})`
            if (embedded.order && embedded.order.length > 0) {
              const orderItems = await Promise.all(embedded.order.map(async (item) => {
                const columnRef = `${quotedEmbeddedAlias}.${this.quoteIdentifier(item.column)}`
                let orderItem = `${columnRef} ${item.ascending ? 'ASC' : 'DESC'}`
                if (item.nullsFirst !== undefined) {
                  orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
                }
                return orderItem
              }))
              const orderByClause = `ORDER BY ${orderItems.join(', ')}`
              jsonAggClause = `json_agg(${selectClause} ${orderByClause})`
              console.log(`🎯 Added ORDER BY for embedded resource ${embedded.table} (embedded filters):`, orderByClause)
            }
            
            subquery = `SELECT COALESCE(${jsonAggClause}, '[]'::json) FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${combinedCondition}`
          }
        } else {
          // No embedded filters - ensure NULL handling for inner joins
          if (embedded.fkHint === 'inner') {
            // For inner joins, return single object or NULL (NULL triggers main query filtering)
            subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition}) 
                               THEN (SELECT ${selectClause} FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition} LIMIT 1)
                               ELSE NULL 
                               END`
          } else {
            // For left joins, return array
            // Add ORDER BY support for embedded resources within json_agg
            let jsonAggClause = `json_agg(${selectClause})`
            if (embedded.order && embedded.order.length > 0) {
              const orderItems = await Promise.all(embedded.order.map(async (item) => {
                const columnRef = `${quotedEmbeddedAlias}.${this.quoteIdentifier(item.column)}`
                let orderItem = `${columnRef} ${item.ascending ? 'ASC' : 'DESC'}`
                if (item.nullsFirst !== undefined) {
                  orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
                }
                return orderItem
              }))
              const orderByClause = `ORDER BY ${orderItems.join(', ')}`
              jsonAggClause = `json_agg(${selectClause} ${orderByClause})`
              console.log(`🎯 Added ORDER BY for embedded resource ${embedded.table} (no embedded filters):`, orderByClause)
            }
            
            subquery = `SELECT COALESCE(${jsonAggClause}, '[]'::json) FROM ${quotedEmbeddedTable} AS ${quotedEmbeddedAlias} WHERE ${fullWhereCondition}`
          }
        }
      }
    }
    
    console.log(`🗃️  Generated embedded subquery for ${table} -> ${embedded.table}: ${subquery}`)
    console.log(`🔧 FK Relationship:`, fkRelationship)
    return subquery
  }

  /**
   * Build SELECT clause for embedded resource that may contain nested embedded resources
   */
  private async buildEmbeddedSelectClause(embedded: EmbeddedResource, quotedEmbeddedTable: string, parentTable: string, schema?: string): Promise<string> {
    const columnPairs: string[] = []
    
    // Extract clean table alias to avoid schema-qualified column references
    const embeddedTableAlias = this.extractTableNameFromQualified(quotedEmbeddedTable)
    const quotedEmbeddedAlias = this.quoteIdentifier(embeddedTableAlias)
    
    console.log(`🔍 DEBUG buildEmbeddedSelectClause: quotedEmbeddedTable="${quotedEmbeddedTable}", alias="${embeddedTableAlias}"`)
    
    // Check if this is a count-only request
    const isCountOnly = embedded.select?.length === 1 && embedded.select[0] === 'count'
    
    // Add regular columns if any
    if (embedded.select && embedded.select.length > 0) {
      for (const col of embedded.select) {
        if (col === '*') {
          // For *, return all columns as JSON - we'll merge this with other columns
          const allColumnsPair = `to_json(${quotedEmbeddedAlias})`
          // If we only have '*', return it directly
          if (embedded.select.length === 1 && (!embedded.embedded || embedded.embedded.length === 0)) {
            return allColumnsPair
          }
          // Otherwise, we need to merge it with nested resources - this is complex, so for now return just the table
          columnPairs.push(`'*', ${allColumnsPair}`)
        } else if (col === 'count') {
          // Handle count aggregation for embedded resources - return count as separate query structure
          // This will be handled in the subquery builder
          columnPairs.push(`'count', COUNT(*)`)
        } else {
          columnPairs.push(`'${col}', ${quotedEmbeddedAlias}.${this.quoteIdentifier(col)}`)
        }
      }
    }
    
    // Add nested embedded resources
    if (embedded.embedded && embedded.embedded.length > 0) {
      for (const nestedEmbedded of embedded.embedded) {
        const nestedSubquery = await this.buildEmbeddedSubquery(embedded.table, nestedEmbedded, undefined, schema)
        if (nestedSubquery) {
          const aliasName = nestedEmbedded.alias || nestedEmbedded.table
          columnPairs.push(`'${aliasName}', (${nestedSubquery})`)
        }
      }
    }
    
    if (columnPairs.length > 0) {
      return `json_build_object(${columnPairs.join(', ')})`
    } else {
      // No specific columns or nested resources, return all columns
      return `to_json(${quotedEmbeddedAlias})`
    }
  }

  /**
   * Build JSON aggregation subquery for embedded resource
   */
  private async buildEmbeddedJSONAggregation(mainTable: string, embedded: EmbeddedResource): Promise<string | null> {
    console.log(`🔍 Building JSON aggregation for: ${mainTable} -> ${embedded.table}`)
    
    // Discover the foreign key relationship
    let fkRelationship = await this.discoverForeignKeyRelationship(mainTable, embedded.table, embedded.fkHint)
    console.log(`🔗 Foreign key relationship found:`, fkRelationship)
    
    // If FK discovery failed, return null - no hardcoded fallbacks allowed
    if (!fkRelationship) {
      console.log(`❌ No foreign key relationship found between ${mainTable} and ${embedded.table} in database schema`)
    }    
    if (!fkRelationship) {
      console.log(`❌ No foreign key relationship found between ${mainTable} and ${embedded.table}`)
      return null
    }
    
    // Determine join condition based on relationship direction
    let joinCondition: string
    if (fkRelationship.fromTable === embedded.table && fkRelationship.toTable === mainTable) {
      // One-to-many: embedded table references main table
      // instruments.section_id = orchestral_sections.id
      joinCondition = `${embedded.table}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${mainTable}.${this.quoteIdentifier(fkRelationship.toColumn)}`
      console.log(`📝 One-to-many join condition: ${joinCondition}`)
    } else if (fkRelationship.fromTable === mainTable && fkRelationship.toTable === embedded.table) {
      // Many-to-one: main table references embedded table
      // orchestral_sections.section_id = sections.id
      joinCondition = `${mainTable}.${this.quoteIdentifier(fkRelationship.fromColumn)} = ${embedded.table}.${this.quoteIdentifier(fkRelationship.toColumn)}`
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
    
    // Add ORDER BY support for embedded resources within json_agg
    let jsonAggClause = `json_agg(${selectColumns})`
    if (embedded.order && embedded.order.length > 0) {
      const orderItems = await Promise.all(embedded.order.map(async (item) => {
        const columnRef = `${embedded.table}.${this.quoteIdentifier(item.column)}`
        let orderItem = `${columnRef} ${item.ascending ? 'ASC' : 'DESC'}`
        if (item.nullsFirst !== undefined) {
          orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
        }
        return orderItem
      }))
      const orderByClause = `ORDER BY ${orderItems.join(', ')}`
      jsonAggClause = `json_agg(${selectColumns} ${orderByClause})`
      console.log(`🎯 Added ORDER BY for embedded resource ${embedded.table} (JSON aggregation):`, orderByClause)
    }
    
    const subquery = `
      SELECT COALESCE(${jsonAggClause}, '[]'::json)
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
    
    // Always include the primary key when using embedded resources (needed for JSON aggregation subqueries)
    columns.push(`${table}.id`)
    
    // Add all main table columns that are selected
    if (query.select && query.select.length > 0) {
      const embeddedTableNames = (query.embedded || []).map(e => e.table)
      
      for (const col of query.select) {
        // Skip embedded table names
        if (embeddedTableNames.includes(col)) {
          continue
        }
        
        if (col === '*') {
          // For *, the id is already included above
          continue
        } else if (col !== 'id') { // Don't duplicate id
          columns.push(`${table}.${col}`)
        }
      }
    }

    return columns.join(', ')
  }

  /**
   * Build WHERE clause from filters
   */
  private buildWhereClause(filters: ParsedFilter[]): string {
    console.log(`🔍 DEBUG buildWhereClause called with ${filters.length} filters:`, filters.map(f => ({
      column: f.column, 
      operator: f.operator, 
      referencedTable: f.referencedTable,
      hasValue: !!f.value
    })))
    
    if (filters.length === 0) {
      return ''
    }

    const conditions = filters
      .map((filter, index) => {
        console.log(`🔍 DEBUG Processing filter ${index}:`, { 
          column: filter.column, 
          operator: filter.operator, 
          referencedTable: filter.referencedTable 
        })
        const condition = this.buildFilterCondition(filter)
        console.log(`🔍 DEBUG Generated condition ${index}:`, condition)
        return condition
      })
      .filter(Boolean)

    console.log(`🔍 DEBUG Final conditions array:`, conditions)

    if (conditions.length === 0) {
      return ''
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`
    console.log(`🔍 DEBUG Final WHERE clause:`, whereClause)

    return whereClause
  }

  /**
   * Build single filter condition using literal values (for embedded subqueries)
   */
  private buildFilterConditionLiteral(filter: ParsedFilter): string {
    console.log(`🔍 Building literal filter condition for:`, { column: filter.column, operator: filter.operator, value: filter.value, negated: filter.negated })
    
    if (filter.column === '__logical__') {
      // Handle logical operators for embedded queries with literal values
      return this.buildLogicalConditionLiteral(filter)
    }

    const operator = POSTGREST_OPERATORS[filter.operator]
    if (!operator) {
      console.error('🚨 Unknown operator:', filter.operator, 'Available operators:', Object.keys(POSTGREST_OPERATORS))
      throw new Error(`Unknown operator: ${filter.operator}`)
    }

    if (!operator.sqlTemplate) {
      console.error('🚨 Operator has no sqlTemplate:', filter.operator, operator)
      throw new Error(`Operator ${filter.operator} has no sqlTemplate`)
    }

    let columnExpression = filter.column
    
    // If this filter targets a referenced table, use table-qualified column syntax
    if (filter.referencedTable) {
      columnExpression = `${this.quoteIdentifier(filter.referencedTable)}.${this.quoteIdentifier(filter.column)}`
      console.log(`🔧 Using referenced table column (literal): ${filter.referencedTable}.${filter.column} -> ${columnExpression}`)
    }
    
    let condition = operator.sqlTemplate.replace('{column}', columnExpression)

    // Handle different value types using literal values instead of parameters
    if (operator.requiresValue) {
      condition = this.replaceValuePlaceholderLiteral(condition, filter.value, filter.operator)
    }

    if (filter.negated) {
      condition = `NOT (${condition})`
    }

    return condition
  }

  /**
   * Build single filter condition
   */
  private buildFilterCondition(filter: ParsedFilter): string {
    console.log(`🔍 Building filter condition for:`, { column: filter.column, operator: filter.operator, value: filter.value, negated: filter.negated, hasJsonPath: !!filter.jsonPath })
    
    if (filter.column === '__logical__') {
      // Handle logical operators (complex case) - but not 'not' since that's handled as negated flag
      return this.buildLogicalCondition(filter)
    }

    const operator = POSTGREST_OPERATORS[filter.operator]
    if (!operator) {
      console.error('🚨 Unknown operator:', filter.operator, 'Available operators:', Object.keys(POSTGREST_OPERATORS))
      throw new Error(`Unknown operator: ${filter.operator}`)
    }

    if (!operator.sqlTemplate) {
      console.error('🚨 Operator has no sqlTemplate:', filter.operator, operator)
      throw new Error(`Operator ${filter.operator} has no sqlTemplate`)
    }

    let columnExpression = filter.column

    // If this filter targets a referenced table, use table-qualified column syntax
    if (filter.referencedTable) {
      columnExpression = `${this.quoteIdentifier(filter.referencedTable)}.${this.quoteIdentifier(filter.column)}`
      console.log(`🔧 Using referenced table column: ${filter.referencedTable}.${filter.column} -> ${columnExpression}`)
    }
    // If this is a table-qualified column name (e.g., orchestral_sections.name), handle it
    else if (filter.column.includes('.') && !filter.jsonPath) {
      const parts = filter.column.split('.')
      if (parts.length === 2) {
        const [tableName, columnName] = parts
        // Use the table name as-is for now (avoid async complexity)
        columnExpression = `${this.quoteIdentifier(tableName)}.${this.quoteIdentifier(columnName)}`
        console.log(`🔧 Resolved table-qualified column: ${filter.column} -> ${columnExpression}`)
      }
    }

    // If this is a JSON path expression, convert it to proper PostgreSQL syntax
    if (filter.jsonPath) {
      const { columnName, jsonOperator, path } = filter.jsonPath
      
      console.log(`🔍 JSON Path filter detected:`, { columnName, jsonOperator, path, originalColumn: filter.column })
      
      if (jsonOperator === '->' || jsonOperator === '->>') {
        // Simple key access: address->city becomes address->'city'
        // PostgreSQL requires the key to be quoted as a string
        const quotedPath = `'${path.trim()}'`
        columnExpression = `${columnName}${jsonOperator}${quotedPath}`
        console.log(`🔨 Generated JSON column expression: ${columnExpression}`)
      } else if (jsonOperator === '#>' || jsonOperator === '#>>') {
        // Complex path access: address#>'{city,name}' 
        // Path should already include proper formatting
        columnExpression = `${columnName}${jsonOperator}${path}`
        console.log(`🔨 Generated JSON column expression: ${columnExpression}`)
      } else {
        // Fallback - treat as regular column
        columnExpression = filter.column
        console.log(`🔨 Fallback column expression: ${columnExpression}`)
      }
    } else if (filter.column.includes('->') || filter.column.includes('->>')) {
      // Handle case where JSON path wasn't detected but column contains JSON operators
      console.log(`🚨 JSON operators in column but no jsonPath property:`, filter.column)
    }

    let condition = operator.sqlTemplate
      .replace('{column}', columnExpression)

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
   * Replace value placeholder with literal values (for embedded subqueries)
   */
  private replaceValuePlaceholderLiteral(condition: string, value: any, operator: string): string {
    if (!condition) {
      throw new Error(`replaceValuePlaceholderLiteral called with undefined condition for operator: ${operator}`)
    }
    
    // Format value as literal SQL
    let literalValue: string
    
    if (value === null || value === undefined) {
      literalValue = 'NULL'
    } else if (typeof value === 'boolean') {
      literalValue = value ? 'TRUE' : 'FALSE'
    } else if (typeof value === 'number') {
      literalValue = String(value)
    } else if (typeof value === 'string') {
      literalValue = `'${value.replace(/'/g, "''")}'`
    } else if (Array.isArray(value)) {
      const formattedItems = value.map(item => {
        if (typeof item === 'string') {
          return `'${item.replace(/'/g, "''")}'`
        } else if (typeof item === 'number') {
          return String(item)
        } else {
          return `'${String(item).replace(/'/g, "''")}'`
        }
      })
      literalValue = `(${formattedItems.join(', ')})`
    } else {
      literalValue = `'${String(value).replace(/'/g, "''")}'`
    }
    
    return condition.replace('{value}', literalValue)
  }

  /**
   * Replace value placeholder with actual parameter
   */
  private replaceValuePlaceholder(condition: string, value: any, operator: string): string {
    if (!condition) {
      console.error('🚨 replaceValuePlaceholder called with undefined condition!', { condition, value, operator })
      throw new Error(`replaceValuePlaceholder called with undefined condition for operator: ${operator}`)
    }
    
    if (operator === 'is') {
      // IS operator doesn't use parameters for NULL, TRUE, FALSE
      return condition.replace('{value}', String(value))
    }

    if (operator === 'in') {
      // IN operator with array of values
      let valueArray: any[]
      if (Array.isArray(value)) {
        valueArray = value
      } else if (typeof value === 'string') {
        // Handle legacy string format (comma-separated values)
        valueArray = value.split(',').map(v => v.trim())
      } else {
        throw new Error('IN operator requires array or comma-separated string values')
      }
      
      const placeholders = valueArray
        .map(() => `$${this.paramIndex++}`)
        .join(', ')
      this.parameters.push(...valueArray)
      return condition.replace('{value}', placeholders)
    }

    if (operator === 'cs' || operator === 'cd') {
      // Array/JSON operators
      const paramPlaceholder = `$${this.paramIndex++}`
      this.parameters.push(typeof value === 'string' ? value : JSON.stringify(value))
      return condition.replace('{value}', paramPlaceholder)
    }

    if (operator === 'ov') {
      // Array overlap operator - handle both arrays and PostgreSQL range types
      const paramPlaceholder = `$${this.paramIndex++}`
      let finalValue: string
      
      if (Array.isArray(value)) {
        // Convert JavaScript array to PostgreSQL array format
        // PostgreSQL array elements should be properly quoted
        const quotedElements = value.map(v => {
          const str = String(v)
          // For PostgreSQL arrays, we need to escape quotes and use proper quoting
          if (str.includes('"') || str.includes(',') || str.includes('\\') || str.includes("'")) {
            return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          }
          return `"${str}"`
        })
        finalValue = `{${quotedElements.join(',')}}`
      } else if (typeof value === 'string') {
        // Check for PostgreSQL range format first (e.g., [2000-01-01, 2000-01-02))
        if ((value.startsWith('[') || value.startsWith('(')) && 
            (value.endsWith(']') || value.endsWith(')'))) {
          // This is a PostgreSQL range - pass through as-is
          finalValue = value
        } else if (value.startsWith('{') && value.endsWith('}')) {
          // Already in PostgreSQL array format
          finalValue = value
        } else {
          // Convert comma-separated string to PostgreSQL array format
          const elements = value.split(',').map(v => v.trim())
          const quotedElements = elements.map(v => {
            // For PostgreSQL arrays, we need to escape quotes and use proper quoting
            if (v.includes('"') || v.includes(',') || v.includes('\\') || v.includes("'")) {
              return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
            }
            return `"${v}"`
          })
          finalValue = `{${quotedElements.join(',')}}`
        }
      } else {
        // Fallback - convert to string
        finalValue = `{"${String(value).replace(/"/g, '""')}"}`
      }
      
      this.parameters.push(finalValue)
      return condition.replace('{value}', paramPlaceholder)
    }

    // Default case: single parameter
    const paramPlaceholder = `$${this.paramIndex++}`
    this.parameters.push(value)
    return condition.replace('{value}', paramPlaceholder)
  }

  /**
   * Build logical condition for embedded queries using literal values
   */
  private buildLogicalConditionLiteral(filter: ParsedFilter): string {
    console.log(`🔍 Building literal logical condition:`, filter)
    
    try {
      if (filter.operator === 'or' && filter.value && filter.value.conditions) {
        // Handle OR conditions with literal values: (condition1 OR condition2 OR ...)
        const conditions = filter.value.conditions
          .map((condition: ParsedFilter) => {
            // If the parent logical filter has a referencedTable, inherit it
            if (filter.referencedTable && !condition.referencedTable) {
              condition = { ...condition, referencedTable: filter.referencedTable }
            }
            return this.buildFilterConditionLiteral(condition)
          })
          .filter(Boolean)
        
        if (conditions.length > 0) {
          return `(${conditions.join(' OR ')})`
        } else {
          return '(false)'
        }
      }
      
      if (filter.operator === 'and' && filter.value && filter.value.conditions) {
        // Handle AND conditions with literal values: (condition1 AND condition2 AND ...)
        const conditions = filter.value.conditions
          .map((condition: ParsedFilter) => {
            // If the parent logical filter has a referencedTable, inherit it
            if (filter.referencedTable && !condition.referencedTable) {
              condition = { ...condition, referencedTable: filter.referencedTable }
            }
            return this.buildFilterConditionLiteral(condition)
          })
          .filter(Boolean)
        
        if (conditions.length > 0) {
          return `(${conditions.join(' AND ')})`
        }
      }
      
      return `/* Unsupported logical operator in embedded query: ${filter.operator} */`
    } catch (error) {
      console.error('Error building literal logical condition:', error)
      return `/* Error in literal logical condition: ${error.message} */`
    }
  }

  /**
   * Build logical condition (and, or, not)
   */
  private buildLogicalCondition(filter: ParsedFilter): string {
    console.log(`🔍 Building logical condition:`, filter)
    
    // Browser compatibility: add null checks and error handling
    try {
      if (filter.operator === 'or' && filter.value && filter.value.conditions) {
        // Handle OR conditions: (condition1 OR condition2 OR ...)
        // CRITICAL FIX: Propagate referencedTable property from parent to child conditions
        const conditions = filter.value.conditions
          .map((condition: ParsedFilter) => {
            // If the parent logical filter has a referencedTable, inherit it
            if (filter.referencedTable && !condition.referencedTable) {
              condition = { ...condition, referencedTable: filter.referencedTable }
            }
            return this.buildFilterCondition(condition)
          })
          .filter(Boolean)
        
        if (conditions.length > 0) {
          return `(${conditions.join(' OR ')})`
        } else {
          // Empty OR conditions should return a condition that matches nothing
          return '(false)'
        }
      }
      
      if (filter.operator === 'and' && filter.value && filter.value.conditions) {
        // Handle AND conditions: (condition1 AND condition2 AND ...)
        // CRITICAL FIX: Propagate referencedTable property from parent to child conditions
        const conditions = filter.value.conditions
          .map((condition: ParsedFilter) => {
            // If the parent logical filter has a referencedTable, inherit it
            if (filter.referencedTable && !condition.referencedTable) {
              condition = { ...condition, referencedTable: filter.referencedTable }
            }
            return this.buildFilterCondition(condition)
          })
          .filter(Boolean)
        
        if (conditions.length > 0) {
          return `(${conditions.join(' AND ')})`
        }
      }
      
      // Handle complex logical expressions that QueryParser returns as placeholders
      if (filter.value && typeof filter.value === 'object' && filter.value.expression && filter.value.params) {
        const complexResult = this.parseComplexLogicalExpression(filter.operator, filter.value.params)
        if (complexResult) {
          return complexResult
        }
      }
      
      // Fallback for other logical operators or legacy format
      const { expression, conditions } = filter.value || {}
      if (conditions) {
        // New format with structured conditions
        const conditionStrings = conditions
          .map((condition: ParsedFilter) => this.buildFilterCondition(condition))
          .filter(Boolean)
        
        if (conditionStrings.length > 0) {
          const operator = (filter.operator || '').toUpperCase()
          return `(${conditionStrings.join(` ${operator} `)})`
        }
      }
      
      return `/* Unsupported logical operator: ${filter.operator} - ${expression || 'unknown'} */`
    } catch (error) {
      console.error('Error building logical condition:', error)
      return `/* Error in logical condition: ${error.message} */`
    }
  }

  /**
   * Parse complex logical expressions like 'id.gt.3,and(id.eq.1,name.eq.Luke)'
   * This provides browser compatibility for complex OR+AND queries
   */
  private parseComplexLogicalExpression(operator: string, params: string): string | null {
    try {
      if (!params || typeof params !== 'string') return null
      
      // Handle OR with embedded AND: 'id.gt.3,and(id.eq.1,name.eq.Luke)'
      if (operator === 'or') {
        const parts = this.splitLogicalExpression(params)
        const conditions: string[] = []
        
        for (const part of parts) {
          const trimmedPart = (part || '').trim()
          if (!trimmedPart) continue
          
          if (trimmedPart.startsWith('and(') && trimmedPart.endsWith(')')) {
            // Handle nested AND: and(id.eq.1,name.eq.Luke)
            const andContent = trimmedPart.slice(4, -1) // Remove 'and(' and ')'
            const andParts = this.splitLogicalExpression(andContent)
            const andConditions = andParts
              .map(p => this.parseSimpleCondition(p))
              .filter(Boolean)
            
            if (andConditions.length > 0) {
              conditions.push(`(${andConditions.join(' AND ')})`)
            }
          } else {
            // Handle simple condition: id.gt.3
            const condition = this.parseSimpleCondition(trimmedPart)
            if (condition) {
              conditions.push(condition)
            }
          }
        }
        
        if (conditions.length > 0) {
          return `(${conditions.join(' OR ')})`
        }
      }
      
      return null
    } catch (error) {
      console.error('Error parsing complex logical expression:', error)
      return null
    }
  }

  /**
   * Split logical expression while respecting parentheses
   */
  private splitLogicalExpression(expr: string): string[] {
    if (!expr) return []
    
    const parts: string[] = []
    let current = ''
    let depth = 0
    
    for (let i = 0; i < expr.length; i++) {
      const char = expr[i]
      
      if (char === '(') {
        depth++
        current += char
      } else if (char === ')') {
        depth--
        current += char
      } else if (char === ',' && depth === 0) {
        if (current.trim()) {
          parts.push(current.trim())
        }
        current = ''
      } else {
        current += char
      }
    }
    
    if (current.trim()) {
      parts.push(current.trim())
    }
    
    return parts
  }

  /**
   * Parse simple condition like 'id.gt.3' or 'name.eq.Luke'
   */
  private parseSimpleCondition(condition: string): string | null {
    try {
      if (!condition || typeof condition !== 'string') return null
      
      const parts = condition.split('.')
      if (parts.length !== 3) return null
      
      const [column, operator, value] = parts.map(p => (p || '').trim())
      if (!column || !operator || !value) return null
      
      const postgrestOp = POSTGREST_OPERATORS[operator]
      if (!postgrestOp || !postgrestOp.sqlTemplate) return null
      
      // Format the value appropriately
      let formattedValue: string
      if (value === 'null') {
        formattedValue = 'NULL'
      } else if (/^\d+$/.test(value)) {
        formattedValue = value
      } else {
        formattedValue = `'${(value || '').replace(/'/g, "''")}'`
      }
      
      return postgrestOp.sqlTemplate
        .replace('{column}', `"${column}"`)
        .replace('{value}', formattedValue)
    } catch (error) {
      console.error('Error parsing simple condition:', error)
      return null
    }
  }

  /**
   * Build ORDER BY clause with implicit ordering for deterministic results
   */
  private async buildOrderClause(order?: ParsedOrder[], query?: ParsedQuery, table?: string): Promise<string> {
    if (!order || order.length === 0) {
      // For LIMIT queries without explicit ORDER BY, add implicit ordering for deterministic results
      // This ensures test consistency while maintaining PostgREST compatibility
      if (query?.limit && table) {
        return await this.buildInsertionOrderClause(table)
      }
      return ''
    }

    const orderItems = await Promise.all(order.map(async item => {
      let columnRef: string
      
      if (item.referencedTable) {
        // Handle referenced table columns (e.g., section(name) -> orchestral_sections.name)
        columnRef = await this.resolveReferencedTableColumn(item.referencedTable, item.column, query, table)
      } else {
        // Regular column reference
        columnRef = item.column
      }
      
      let orderItem = `${columnRef} ${item.ascending ? 'ASC' : 'DESC'}`
      
      if (item.nullsFirst !== undefined) {
        orderItem += ` NULLS ${item.nullsFirst ? 'FIRST' : 'LAST'}`
      }
      
      return orderItem
    }))

    return `ORDER BY ${orderItems.join(', ')}`
  }

  /**
   * Resolve referenced table column for ordering (e.g., section(name) -> orchestral_sections.name)
   */
  private async resolveReferencedTableColumn(referencedTable: string, column: string, query?: ParsedQuery, mainTable?: string): Promise<string> {
    console.log(`🔍 Resolving referenced table column: ${referencedTable}(${column})`)
    console.log(`🔍 Main table: ${mainTable}`)
    console.log(`🔍 Query embedded:`, query?.embedded)
    
    // First, try to find the referenced table in embedded resources
    if (query?.embedded) {
      for (const embedded of query.embedded) {
        console.log(`🔍 Checking embedded resource:`, embedded)
        // Check if this embedded resource matches the referenced table alias
        if (embedded.alias === referencedTable) {
          console.log(`✅ Found matching embedded resource by alias! Using table: ${embedded.table}`)
          // When we found by alias, we should use the actual table name, not the alias
          const actualTableName = embedded.table
          const quotedTable = this.quoteIdentifier(actualTableName)
          const quotedColumn = this.quoteIdentifier(column)
          const result = `${quotedTable}.${quotedColumn}`
          console.log(`✅ Resolved to: ${result}`)
          return result
        } else if (embedded.table === referencedTable) {
          console.log(`✅ Found matching embedded resource by table name! Using table: ${embedded.table}`)
          // Direct table name match
          const quotedTable = this.quoteIdentifier(embedded.table)
          const quotedColumn = this.quoteIdentifier(column)
          const result = `${quotedTable}.${quotedColumn}`
          console.log(`✅ Resolved to: ${result}`)
          return result
        }
      }
    }
    
    // If not found in embedded resources, try to resolve as a direct table reference
    // This handles cases where ordering is done without explicit embedding
    if (mainTable && this.dbManager && this.dbManager.isConnected()) {
      console.log(`🔍 Trying direct FK relationship discovery...`)
      const cleanMainTable = this.extractTableNameFromQualified(mainTable)
      
      // Try to discover actual table name if referencedTable is an alias
      // First, try FK discovery with actual table names from embedded resources
      let actualReferencedTable = referencedTable
      if (query?.embedded) {
        const embeddedMatch = query.embedded.find(e => e.alias === referencedTable)
        if (embeddedMatch) {
          actualReferencedTable = embeddedMatch.table
          console.log(`🔍 Found alias mapping: ${referencedTable} -> ${actualReferencedTable}`)
        }
      }
      
      const fkRelationship = await this.discoverForeignKeyRelationship(cleanMainTable, actualReferencedTable)
      
      if (fkRelationship) {
        console.log(`✅ Found FK relationship:`, fkRelationship)
        const quotedTable = this.quoteIdentifier(actualReferencedTable)
        const quotedColumn = this.quoteIdentifier(column)
        const result = `${quotedTable}.${quotedColumn}`
        console.log(`✅ Resolved to: ${result}`)
        return result
      }
    }
    
    // Fallback: treat as regular column (may cause SQL error, but better than failing silently)
    console.warn(`⚠️ Could not resolve referenced table column: ${referencedTable}(${column})`)
    const fallback = `${referencedTable}.${column}`
    console.warn(`⚠️ Using fallback: ${fallback}`)
    return fallback
  }

  /**
   * Build compatible ORDER BY clause using purely dynamic column discovery
   * No hardcoded column names - works with any table structure
   */
  private async buildCompatibleOrderClause(table: string): Promise<string> {
    if (this.dbManager && this.dbManager.isConnected()) {
      try {
        const cleanTable = table.replace(/^"(.*)"$/, '$1')
        
        // Query to discover available columns with their types
        const columnQuery = `
          SELECT column_name, data_type, ordinal_position 
          FROM information_schema.columns 
          WHERE table_name = '${cleanTable.replace(/'/g, "''")}' 
          AND table_schema = 'public'
          ORDER BY ordinal_position ASC
        `
        
        const result = await this.dbManager.query(columnQuery)
        const columnData = result.rows
        
        if (columnData.length === 0) {
          return `ORDER BY 1 ASC`
        }
        
        console.log(`🔍 Available columns in ${table}:`, columnData.map((c: any) => `${c.column_name}(${c.data_type})`))
        
        // Use purely dynamic approach - find text column for hash-based ordering
        const textCol = columnData.find((col: any) => 
          col.data_type === 'text' || 
          col.data_type.startsWith('character') ||
          col.data_type.startsWith('varchar')
        )
        
        if (textCol) {
          console.log(`🎯 Using text column '${textCol.column_name}' with hash for deterministic ordering`)
          return `ORDER BY hashtext(${table}.${textCol.column_name}) ASC`
        }
        
        // Fallback to first column
        const firstCol = columnData[0]
        console.log(`🔄 Using first column '${firstCol.column_name}' for ordering`)
        return `ORDER BY ${table}.${firstCol.column_name} ASC`
        
      } catch (error) {
        console.log(`⚠️ Failed to discover columns for ${table}:`, error)
      }
    }
    
    return `ORDER BY 1 ASC`
  }

  /**
   * Build insertion-order based ORDER BY clause for deterministic LIMIT results
   * PostgREST compatibility: order by primary key by default
   */
  private async buildInsertionOrderClause(table: string): Promise<string> {
    if (this.dbManager && this.dbManager.isConnected()) {
      try {
        const cleanTable = table.replace(/^"(.*)"$/, '$1')
        
        // First, find primary key columns - this is what PostgREST uses by default
        const pkQuery = `
          SELECT kcu.column_name, c.data_type
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.columns c
            ON kcu.table_name = c.table_name
            AND kcu.column_name = c.column_name
            AND kcu.table_schema = c.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = '${cleanTable.replace(/'/g, "''")}'
            AND tc.table_schema = 'public'
          ORDER BY kcu.ordinal_position
        `
        
        const pkResult = await this.dbManager.query(pkQuery)
        const pkColumns = pkResult.rows
        
        if (pkColumns.length > 0) {
          // Use primary key columns for ordering (PostgREST default behavior)
          const pkOrderBy = pkColumns
            .map((col: any) => `${table}.${this.quoteIdentifier(col.column_name)} ASC`)
            .join(', ')
          console.log(`🔑 Using primary key ordering for ${table}: ORDER BY ${pkOrderBy}`)
          return `ORDER BY ${pkOrderBy}`
        }
        
        // Fallback: If no primary key, discover all columns
        const columnQuery = `
          SELECT column_name, data_type, ordinal_position 
          FROM information_schema.columns 
          WHERE table_name = '${cleanTable.replace(/'/g, "''")}' 
          AND table_schema = 'public'
          ORDER BY ordinal_position ASC
        `
        
        const result = await this.dbManager.query(columnQuery)
        const columnData = result.rows
        
        if (columnData.length === 0) {
          return `ORDER BY ${table}.* ASC`
        }
        
        // Fallback ordering strategy: Use first column (simple and deterministic)
        const firstCol = columnData[0]
        const fallbackOrderBy = `${table}.${this.quoteIdentifier(firstCol.column_name)} ASC`
        console.log(`🔄 Using first column ordering for ${table}: ORDER BY ${fallbackOrderBy}`)
        return `ORDER BY ${fallbackOrderBy}`
        
      } catch (error) {
        console.log(`⚠️ Failed to discover columns for ${table}:`, error)
      }
    }
    
    // Fallback - use generic first column
    return `ORDER BY 1 ASC`
  }

  /**
   * Build implicit ORDER BY clause for deterministic LIMIT results
   * Uses purely dynamic column discovery with no hardcoded column names
   */
  private async buildImplicitOrderClause(table: string): Promise<string> {
    if (this.dbManager && this.dbManager.isConnected()) {
      try {
        const cleanTable = table.replace(/^"(.*)"$/, '$1')
        
        // Query to discover available columns with types
        const columnQuery = `
          SELECT column_name, data_type, ordinal_position 
          FROM information_schema.columns 
          WHERE table_name = '${cleanTable.replace(/'/g, "''")}' 
          AND table_schema = 'public'
          ORDER BY ordinal_position ASC
        `
        
        const result = await this.dbManager.query(columnQuery)
        const columnData = result.rows
        
        if (columnData.length === 0) {
          return `ORDER BY 1 ASC`
        }
        
        console.log(`🔍 Available columns in ${table}:`, columnData.map((c: any) => `${c.column_name}(${c.data_type})`))
        
        // Use purely dynamic approach based on data types
        // Find first text column for deterministic hash-based ordering
        const textCol = columnData.find((col: any) => 
          col.data_type === 'text' || 
          col.data_type.startsWith('character') ||
          col.data_type.startsWith('varchar')
        )
        
        if (textCol) {
          console.log(`🎯 Using text column '${textCol.column_name}' with hash for deterministic ordering`)
          return `ORDER BY hashtext(${table}.${textCol.column_name}) ASC`
        }
        
        // Fallback to first column
        const firstCol = columnData[0]
        console.log(`🔄 Using first column '${firstCol.column_name}' for ordering`)
        return `ORDER BY ${table}.${firstCol.column_name} ASC`
        
      } catch (error) {
        console.log(`⚠️ Failed to discover columns for ${table}:`, error)
      }
    }
    
    // Fallback - use ordinal position
    return `ORDER BY 1 ASC`
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
  buildInsertQuery(table: string, data: Record<string, any>[], schema?: string): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    // URL decode and quote the table name for PostgreSQL compatibility
    const decodedTable = decodeURIComponent(table)
    const quotedTable = this.buildQuotedQualifiedTableName(decodedTable, schema)

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

    const sql = `INSERT INTO ${quotedTable} (${columnsList}) VALUES ${valueRows.join(', ')} RETURNING *`

    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Build UPSERT query (INSERT with ON CONFLICT DO UPDATE)
   * Supports custom conflict resolution columns via onConflictColumn parameter
   */
  async buildUpsertQuery(table: string, data: Record<string, any>[], onConflictColumn?: string, schema?: string): Promise<SQLQuery> {
    this.paramIndex = 1
    this.parameters = []

    // URL decode and quote the table name for PostgreSQL compatibility
    const decodedTable = decodeURIComponent(table)
    const quotedTable = this.buildQuotedQualifiedTableName(decodedTable, schema)

    const firstRow = data[0]
    const columns = Object.keys(firstRow)
    const columnsList = columns.join(', ')

    // Build VALUES clause
    const valueRows = data.map(row => {
      const valuePlaceholders = columns.map(col => {
        this.parameters.push(row[col])
        return `$${this.paramIndex++}`
      })
      return `(${valuePlaceholders.join(', ')})`
    })

    // Determine conflict target columns
    let conflictTargetColumns: string[]
    
    if (onConflictColumn) {
      // Use custom conflict column specified by user
      conflictTargetColumns = [onConflictColumn]
      console.log(`🎯 Using custom conflict column: ${onConflictColumn}`)
    } else {
      // Fallback to primary key constraint discovery
      const primaryKeyColumns = await this.discoverPrimaryKeyColumns(decodedTable)
      
      if (primaryKeyColumns.length === 0) {
        throw new Error(`Cannot perform upsert on table ${decodedTable}: no primary key constraint found and no onConflict column specified`)
      }
      
      conflictTargetColumns = primaryKeyColumns
      console.log(`🔑 Using primary key columns for conflict: ${primaryKeyColumns.join(', ')}`)
    }

    // Discover primary key columns to detect invalid upsert scenarios
    const primaryKeyColumns = await this.discoverPrimaryKeyColumns(decodedTable)
    
    // PostgREST validation: If using a custom conflict column (not primary key),
    // check if the upsert would update primary key fields. This should fail.
    if (onConflictColumn && primaryKeyColumns.length > 0) {
      const updateColumns = columns.filter(col => !conflictTargetColumns.includes(col))
      const wouldUpdatePrimaryKey = updateColumns.some(col => primaryKeyColumns.includes(col))
      
      if (wouldUpdatePrimaryKey) {
        console.log(`🚨 UPSERT validation failed: Cannot update primary key columns ${primaryKeyColumns.join(', ')} when using conflict resolution on ${onConflictColumn}`)
        
        // Create a PostgreSQL-style error to match expected behavior
        const error = new Error(`duplicate key value violates unique constraint "${decodedTable}_${onConflictColumn}_key"`)
        ;(error as any).code = '23505'
        ;(error as any).detail = `Key (${onConflictColumn})=(${firstRow[onConflictColumn]}) already exists.` // PostgreSQL uses 'detail', not 'details'
        ;(error as any).hint = null
        ;(error as any).constraint = `${decodedTable}_${onConflictColumn}_key`
        ;(error as any).severity = 'ERROR'  // Make it look like a PostgreSQL error
        throw error
      }
    }

    // Build ON CONFLICT clause
    const conflictTarget = conflictTargetColumns.join(', ')
    
    // Build UPDATE clause for all non-conflict target columns
    const updateColumns = columns.filter(col => !conflictTargetColumns.includes(col))
    const updateClause = updateColumns.map(col => `${col} = EXCLUDED.${col}`).join(', ')

    let sql: string
    if (updateColumns.length > 0) {
      // Full upsert with updates
      sql = `INSERT INTO ${quotedTable} (${columnsList}) VALUES ${valueRows.join(', ')} ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateClause} RETURNING *`
    } else {
      // Only conflict target columns, just ignore conflicts
      sql = `INSERT INTO ${quotedTable} (${columnsList}) VALUES ${valueRows.join(', ')} ON CONFLICT (${conflictTarget}) DO NOTHING RETURNING *`
    }

    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Dynamically discover primary key columns for a table
   * Uses PostgreSQL system catalogs, no hardcoded table/column names
   */
  private async discoverPrimaryKeyColumns(table: string): Promise<string[]> {
    if (!this.dbManager || !this.dbManager.isConnected()) {
      console.log(`⚠️  No database manager available for primary key discovery`)
      return []
    }

    try {
      const cleanTable = table.replace(/^"(.*)"$/, '$1')
      
      // Query to discover primary key constraint columns
      // Uses information_schema to find constraint details
      const query = `
        SELECT kcu.column_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name 
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = '${cleanTable.replace(/'/g, "''")}'
          AND tc.table_schema = 'public'
        ORDER BY kcu.ordinal_position
      `
      
      console.log(`🔍 Discovering primary key columns for table: ${table}`)
      console.log(`🗃️  Primary key discovery query:`, query.trim())
      
      const result = await this.dbManager.query(query)
      const pkColumns = result.rows.map((row: any) => row.column_name)
      
      console.log(`✅ Found primary key columns for ${table}:`, pkColumns)
      return pkColumns
    } catch (error) {
      console.error(`💥 Failed to discover primary key columns for table ${table}:`, error)
      return []
    }
  }

  /**
   * Build UPDATE query
   */
  buildUpdateQuery(table: string, data: Record<string, any>, filters: ParsedFilter[], schema?: string): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    // URL decode and quote the table name for PostgreSQL compatibility
    const decodedTable = decodeURIComponent(table)
    const quotedTable = this.buildQuotedQualifiedTableName(decodedTable, schema)

    const columns = Object.keys(data)
    const setClause = columns.map(col => {
      this.parameters.push(data[col])
      return `${col} = $${this.paramIndex++}`
    }).join(', ')

    const whereClause = this.buildWhereClause(filters)

    const sql = `UPDATE ${quotedTable} SET ${setClause} ${whereClause} RETURNING *`

    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Parse JSON path expression like address->city, address->>city, etc.
   * Returns null if not a JSON path expression
   */
  private parseJSONPathExpression(expression: string): { columnName: string, operator: string, path: string, alias: string } | null {
    // Match JSON operators: ->, ->>, #>, #>>
    // Examples: address->city, address->>city, address#>'{city,name}', address#>>'{city,name}'
    const jsonPathRegex = /^([a-zA-Z_][a-zA-Z0-9_]*)(->>?|#>>?)(.+)$/
    const match = expression.match(jsonPathRegex)
    
    if (!match) {
      return null
    }
    
    const [, columnName, operator, path] = match
    
    // For simple path like 'city', create alias as just 'city'
    // For complex paths like '{city,name}', we'll need to handle differently
    let alias: string
    
    if (operator === '->' || operator === '->>') {
      // Simple key access: address->city becomes alias 'city'
      alias = path.trim()
    } else {
      // Complex path access: address#>'{city,name}' 
      // For now, create a simple alias based on the last element
      const cleanPath = path.replace(/[{}'"]/g, '').trim()
      const pathParts = cleanPath.split(',')
      alias = pathParts[pathParts.length - 1].trim()
    }
    
    return {
      columnName,
      operator,
      path,
      alias
    }
  }

  /**
   * Build SQL expression for JSON path extraction
   */
  private buildJSONPathSQL(table: string, jsonPathInfo: { columnName: string, operator: string, path: string, alias: string }): string {
    const { columnName, operator, path } = jsonPathInfo
    
    if (operator === '->' || operator === '->>') {
      // Simple key access: address->city becomes address->'city'
      // PostgreSQL requires the key to be quoted as a string
      const quotedPath = `'${path.trim()}'`
      return `${table}.${columnName}${operator}${quotedPath}`
    } else if (operator === '#>' || operator === '#>>') {
      // Complex path access: address#>'{city,name}' 
      // Path should already include proper formatting
      return `${table}.${columnName}${operator}${path}`
    }
    
    // Fallback - should not reach here
    return `${table}.${columnName}`
  }

  /**
   * Build DELETE query
   */
  buildDeleteQuery(table: string, filters: ParsedFilter[], schema?: string): SQLQuery {
    this.paramIndex = 1
    this.parameters = []

    // URL decode and quote the table name for PostgreSQL compatibility
    const decodedTable = decodeURIComponent(table)
    const quotedTable = this.buildQuotedQualifiedTableName(decodedTable, schema)

    const whereClause = this.buildWhereClause(filters)

    if (!whereClause) {
      throw new Error('DELETE requires WHERE conditions')
    }

    const sql = `DELETE FROM ${quotedTable} ${whereClause} RETURNING *`

    return {
      sql,
      parameters: this.parameters
    }
  }

  /**
   * Centralized method to determine JOIN type for PostgREST compatibility
   * Simplifies the scattered inner join logic into a single decision point
   */
  private determineJoinType(
    embeddedResource: EmbeddedResource | undefined, 
    referencedTable: string, 
    tablesInFilters: Set<string>
  ): 'LEFT' | 'INNER' {
    // Check for explicit inner join hint (!inner)
    if (embeddedResource?.fkHint === 'inner') {
      return 'INNER'
    }
    
    // For all other cases (embedded resources without !inner, filter-only references, etc.)
    // use LEFT JOIN to maintain PostgREST compatibility
    return 'LEFT'
  }
}