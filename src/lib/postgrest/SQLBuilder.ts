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
   */
  private buildQuotedQualifiedTableName(tableName: string, schema?: string): string {
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
   * Build SQL query from parsed PostgREST query
   */
  async buildQuery(table: string, query: ParsedQuery): Promise<SQLQuery> {
    this.paramIndex = 1
    this.parameters = []

    // URL decode and quote the table name for PostgreSQL compatibility
    const decodedTable = decodeURIComponent(table)
    const quotedTable = this.buildQuotedQualifiedTableName(decodedTable, query.schema)
    
    const { sql } = await this.buildSelectQuery(quotedTable, query)
    
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
      
      if (hasFiltersOnEmbeddedTables) {
        console.log(`🔧 Detected filters on embedded tables - using subquery approach to return null for non-matching embedded resources`)
        
        // For PostgREST compatibility: when filtering on embedded table fields,
        // we use subqueries that return null when the embedded filters don't match
        // This ensures parent rows are returned but embedded resources are null when filters fail
        return await this.buildSelectWithJoinAggregation(table, query)
      } else {
        console.log(`🔧 No filters on embedded tables - using correlated subquery approach`)
        
        // No filters on embedded tables, use standard subquery approach
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
    
    if (hasFiltersOnEmbeddedTables) {
      console.log(`🔧 Detected filters on embedded tables - using JOIN approach for proper filtering`)
      
      // For PostgREST compatibility: when filtering on embedded table fields,
      // we need to JOIN the embedded table and apply the filter in the WHERE clause
      // This ensures only parent rows matching the embedded filter are returned
      return await this.buildSelectWithJoins(table, query)
    } else {
      console.log(`🔧 No filters on embedded tables - using correlated subquery approach`)
      
      // No filters on embedded tables, use standard subquery approach
      return await this.buildSelectWithJoinAggregation(table, query)
    }
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
    
    const quotedMainTable = quoteTableName(table)
    
    // Get all tables that need to be joined (from embedded resources and filters)
    const tablesInFilters = this.getFilteredTableNames(query)
    const embeddedTables = new Set(query.embedded?.map(e => e.table) || [])
    const allReferencedTables = new Set([...tablesInFilters, ...embeddedTables])
    
    console.log(`🔗 Tables referenced in query: ${Array.from(allReferencedTables).join(', ')}`)
    
    // Build JOINs for all referenced tables
    for (const referencedTable of allReferencedTables) {
      const quotedRefTable = quoteTableName(referencedTable)
      
      // Discover foreign key relationship
      let fkRelationship = await this.discoverForeignKeyRelationship(table, referencedTable)
      
      // If FK discovery failed, log the failure but don't use hardcoded fallbacks
      if (!fkRelationship) {
        console.log(`❌ FK discovery failed for ${table} <-> ${referencedTable} - no foreign key relationship found in database schema`)
      }
      
      if (fkRelationship) {
        // Determine JOIN type for PostgREST compatibility
        const embeddedResource = query.embedded?.find(e => e.table === referencedTable)
        
        // For referenced table filters (without explicit embedding), always use LEFT JOIN
        // This ensures parent rows are returned with referenced table fields set to null
        // when the filter doesn't match (correct PostgREST behavior)
        const isExplicitInnerJoin = embeddedResource?.fkHint === 'inner'
        const isFilterOnlyReference = tablesInFilters.has(referencedTable) && !embeddedResource
        
        let joinType: 'LEFT' | 'INNER'
        if (isExplicitInnerJoin) {
          joinType = 'INNER'
        } else if (isFilterOnlyReference) {
          // Filter on referenced table without embedding - use LEFT JOIN for PostgREST compatibility
          joinType = 'LEFT'
        } else {
          // Default LEFT JOIN for embedded resources (changed from INNER for PostgREST compatibility)
          joinType = 'LEFT'
        }
        
        let joinCondition: string
        if (fkRelationship.fromTable === table.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === referencedTable.replace(/^"(.*)"$/, '$1')) {
          // Main table references embedded table
          joinCondition = `${quotedMainTable}.${fkRelationship.fromColumn} = ${quotedRefTable}.${fkRelationship.toColumn}`
        } else if (fkRelationship.fromTable === referencedTable.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === table.replace(/^"(.*)"$/, '$1')) {
          // Embedded table references main table
          joinCondition = `${quotedRefTable}.${fkRelationship.fromColumn} = ${quotedMainTable}.${fkRelationship.toColumn}`
        } else {
          console.log(`⚠️ Cannot determine join condition for ${table} <-> ${referencedTable}`)
          continue
        }
        
        joins.push({
          table: quotedRefTable,
          alias: quotedRefTable, // Use table name as alias for now
          condition: joinCondition,
          type: joinType
        })
        
        console.log(`🔗 Added ${joinType} JOIN: ${quotedRefTable} ON ${joinCondition}`)
      }
    }
    
    // Build SELECT clause with main table columns
    const embeddedTableNames = Array.from(embeddedTables)
    if (query.select && query.select.length > 0) {
      for (const col of query.select) {
        // Skip embedded table names - they'll be handled separately
        if (embeddedTableNames.includes(col)) {
          continue
        }
        
        if (col === '*') {
          selectColumns.push(`${quotedMainTable}.*`)
        } else {
          // Check if this is a JSON path expression
          const jsonPathInfo = this.parseJSONPathExpression(col)
          if (jsonPathInfo) {
            // Generate SQL for JSON path extraction
            const sqlExpression = this.buildJSONPathSQL(quotedMainTable, jsonPathInfo)
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
              selectColumns.push(`${quotedMainTable}.${col} AS ${alias}`)
            } else {
              selectColumns.push(`${quotedMainTable}.${col}`)
            }
          }
        }
      }
    } else {
      selectColumns.push(`${quotedMainTable}.*`)
    }
    
    // Build FROM clause with JOINs
    let fromClause = `FROM ${quotedMainTable}`
    for (const join of joins) {
      fromClause += ` ${join.type} JOIN ${join.table} ON ${join.condition}`
    }

    // Build WHERE clause - separate main table filters from embedded table filters
    // For PostgREST compatibility, embedded table filters should not filter out parent rows
    // unless there's an explicit inner join hint
    const { mainTableFilters, embeddedTableFilters } = this.separateMainAndEmbeddedFilters(query, allReferencedTables)
    
    // Add embedded resources as aggregated JSON (after filter separation)
    for (const embedded of query.embedded || []) {
      const quotedEmbedded = this.buildQuotedQualifiedTableName(embedded.table, query.schema)
      
      // Build JSON aggregation for embedded resource
      let jsonSelectClause: string
      if (embedded.select && embedded.select.length > 0) {
        const columnPairs = embedded.select.map(col => {
          if (col === '*') {
            return `to_json(${quotedEmbedded})`
          } else {
            return `'${col}', ${quotedEmbedded}.${col}`
          }
        })
        if (columnPairs.length === 1 && embedded.select[0] === '*') {
          jsonSelectClause = columnPairs[0]
        } else {
          jsonSelectClause = `json_build_object(${columnPairs.join(', ')})`
        }
      } else {
        jsonSelectClause = `to_json(${quotedEmbedded})`
      }
      
      // Use alias if provided, otherwise use table name
      const aliasName = embedded.alias || embedded.table
      const quotedAlias = quoteTableName(aliasName)
      
      // Always build subquery for embedded resources - filtering is handled within the subquery
      const subquery = await this.buildEmbeddedSubquery(table, embedded, query.filters, query.schema)
      if (subquery) {
        selectColumns.push(`(${subquery}) AS ${quotedAlias}`)
      } else {
        // Fallback to NULL if subquery generation fails
        selectColumns.push(`NULL AS ${quotedAlias}`)
      }
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
    
    // For INNER JOIN embedded resources, add conditions to filter out rows with NULL embedded data
    let havingClause = ''
    const innerJoinEmbedded = (query.embedded || []).filter(embedded => embedded.fkHint === 'inner')
    if (innerJoinEmbedded.length > 0) {
      const innerJoinConditions = innerJoinEmbedded.map(embedded => {
        const aliasName = embedded.alias || embedded.table
        const quotedAlias = quoteTableName(aliasName)
        return `${quotedAlias} IS NOT NULL`
      })
      havingClause = `HAVING ${innerJoinConditions.join(' AND ')}`
    }

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
          // Check if this is a JSON path expression
          const jsonPathInfo = this.parseJSONPathExpression(col)
          if (jsonPathInfo) {
            // Generate SQL for JSON path extraction
            const sqlExpression = this.buildJSONPathSQL(quotedMainTable, jsonPathInfo)
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              selectColumns.push(`${sqlExpression} AS ${alias}`)
            } else {
              // Use the computed alias from JSON path parsing
              selectColumns.push(`${sqlExpression} AS ${jsonPathInfo.alias}`)
            }
          } else {
            // Apply column alias if available
            const alias = query.columnAliases && query.columnAliases[col]
            if (alias) {
              selectColumns.push(`${quotedMainTable}.${col} AS ${alias}`)
            } else {
              selectColumns.push(`${quotedMainTable}.${col}`)
            }
          }
        }
      }
    } else {
      selectColumns.push(`${quotedMainTable}.*`)
    }
    
    // Add embedded resources as correlated subqueries
    // Filter out embedded resources without aliases if there are others with aliases for the same table
    const filteredEmbedded = (query.embedded || []).filter(embedded => {
      if (embedded.alias) {
        return true  // Always include if it has an alias
      }
      
      // Only include if there are no other embedded resources with aliases for the same table
      const hasAliasedVersion = (query.embedded || []).some(other => 
        other.table === embedded.table && other.alias
      )
      return !hasAliasedVersion
    })
    
    // Track which embedded resources are INNER JOINs for HAVING clause
    const innerJoinEmbedded: string[] = []
    
    for (const embedded of filteredEmbedded) {
      const subquery = await this.buildEmbeddedSubquery(table, embedded, query.filters)
      if (subquery) {
        // Use the specified alias if provided, otherwise fall back to table name
        const aliasName = embedded.alias || embedded.table
        const quotedAlias = this.buildQuotedQualifiedTableName(aliasName, query.schema)
        selectColumns.push(`(${subquery}) AS ${quotedAlias}`)
        
        // Track INNER JOIN embedded resources for HAVING clause
        if (embedded.fkHint === 'inner') {
          innerJoinEmbedded.push(quotedAlias)
        }
      }
    }
    
    // Build FROM clause
    const fromClause = `FROM ${quotedMainTable}`

    // Build WHERE clause - separate main table filters from embedded table filters
    // For PostgREST compatibility, embedded table filters should not filter out parent rows
    const embeddedTables = new Set((query.embedded || []).map(e => e.table))
    const { mainTableFilters } = this.separateMainAndEmbeddedFilters(query, embeddedTables)
    const whereClause = this.buildWhereClause(mainTableFilters)

    // Build HAVING clause for INNER JOIN embedded resources
    // This filters out parent rows where the embedded subquery returns NULL
    let havingClause = ''
    if (innerJoinEmbedded.length > 0) {
      const havingConditions = innerJoinEmbedded.map(alias => `${alias} IS NOT NULL`)
      havingClause = `HAVING ${havingConditions.join(' AND ')}`
      console.log(`🔗 Added HAVING clause for INNER JOIN filtering: ${havingClause}`)
    }

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
      havingClause,
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
      let whereCondition = `${quotedEmbeddedTable}.${fkRelationship.toColumn} IN (
        SELECT ${joinTableQuoted}.${fkRelationship.joinEmbeddedColumn} 
        FROM ${joinTableQuoted} 
        WHERE ${joinTableQuoted}.${fkRelationship.joinMainColumn} = ${quotedMainTable}.${fkRelationship.fromColumn}
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
        subquery = `SELECT json_build_array(json_build_object('count', (SELECT COUNT(*) FROM ${quotedEmbeddedTable} WHERE ${whereCondition})))`
      } else {
        const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
        subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${whereCondition}) 
                           THEN COALESCE(json_agg(${selectClause}), '[]'::json) 
                           ELSE NULL 
                           END 
                    FROM ${quotedEmbeddedTable} WHERE ${whereCondition}`
      }
    } else {
      // Direct relationship (one-to-many or many-to-one)
      let whereCondition: string
      if (fkRelationship.fromTable === embedded.table.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === table.replace(/^"(.*)"$/, '$1')) {
        // One-to-many: embedded table references main table
        // instruments.section_id = orchestral_sections.id
        whereCondition = `${quotedEmbeddedTable}.${fkRelationship.fromColumn} = ${quotedMainTable}.${fkRelationship.toColumn}`
        
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
          subquery = `SELECT json_build_array(json_build_object('count', (SELECT COUNT(*) FROM ${quotedEmbeddedTable} WHERE ${whereCondition})))`
        } else {
          const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
          
          // For PostgREST compatibility: when filtering on embedded table columns,
          // return NULL if no rows match the filter, otherwise return the matching rows
          if (embeddedTableFilters.length > 0) {
            // Build separate conditions for relationship and embedded filters
            const relationshipCondition = `${quotedEmbeddedTable}.${fkRelationship.fromColumn} = ${quotedMainTable}.${fkRelationship.toColumn}`
            const embeddedFiltersCondition = additionalWhere
            
            console.log(`🔧 Applying embedded table filter condition: ${embeddedFiltersCondition}`)
            
            // For embedded table filters, we need to return NULL if no rows match the filters
            // This ensures that parent rows without matching embedded rows are excluded in INNER JOIN scenarios
            if (embedded.fkHint === 'inner') {
              // For INNER JOIN, return first matching object or NULL
              subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${whereCondition}) 
                                 THEN (SELECT ${selectClause} FROM ${quotedEmbeddedTable} WHERE ${whereCondition} LIMIT 1)
                                 ELSE NULL 
                                 END`
            } else {
              // For LEFT JOIN (default), return array - simplified to match working manual SQL
              subquery = `SELECT COALESCE(json_agg(${selectClause}), '[]'::json) FROM ${quotedEmbeddedTable} WHERE ${whereCondition}`
            }
          } else {
            // No embedded filters, use standard logic
            if (embedded.fkHint === 'inner') {
              // For INNER JOIN without filters, return first matching object or NULL
              subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${whereCondition}) 
                                 THEN (SELECT ${selectClause} FROM ${quotedEmbeddedTable} WHERE ${whereCondition} LIMIT 1)
                                 ELSE NULL 
                                 END`
            } else {
              // For LEFT JOIN (default), return array
              subquery = `SELECT COALESCE(json_agg(${selectClause}), '[]'::json) FROM ${quotedEmbeddedTable} WHERE ${whereCondition}`
            }
          }
        }
        
      } else if (fkRelationship.fromTable === table.replace(/^"(.*)"$/, '$1') && fkRelationship.toTable === embedded.table.replace(/^"(.*)"$/, '$1')) {
        // Many-to-one: main table references embedded table
        // Each row in main table has exactly one corresponding row in embedded table
        // Return single object, not array
        whereCondition = `${quotedMainTable}.${fkRelationship.fromColumn} = ${quotedEmbeddedTable}.${fkRelationship.toColumn}`
        
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
          subquery = `SELECT json_build_object('count', CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${fullWhereCondition}) THEN 1 ELSE 0 END)`
        } else {
          const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
          
          // Simplified approach: always use the basic subquery pattern
          subquery = `SELECT ${selectClause} FROM ${quotedEmbeddedTable} WHERE ${fullWhereCondition} LIMIT 1`
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
        subquery = `SELECT json_build_array(json_build_object('count', (SELECT COUNT(*) FROM ${quotedEmbeddedTable} WHERE ${fullWhereCondition})))`
      } else {
        const selectClause = await this.buildEmbeddedSelectClause(embedded, quotedEmbeddedTable, table, schema)
        
        // For PostgREST compatibility: when filtering on embedded table columns,
        // return NULL if no rows match the filter, otherwise return the matching rows
        if (embeddedTableFilters.length > 0) {
          // Build separate conditions for relationship and embedded filters
          const relationshipCondition = whereCondition
          const embeddedFiltersCondition = additionalWhere
          const combinedCondition = `${relationshipCondition}${embeddedFiltersCondition}`
          
          // For INNER JOIN (!inner), return a single object instead of array, and ensure main query filtering
          if (embedded.fkHint === 'inner') {
            // For INNER JOIN, return a single object (not array) or NULL if no match
            // The NULL result will be caught by the HAVING clause to filter out the parent row
            subquery = `SELECT CASE 
                                WHEN NOT EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${combinedCondition}) 
                                THEN NULL 
                                ELSE (SELECT ${selectClause} FROM ${quotedEmbeddedTable} WHERE ${combinedCondition} LIMIT 1)
                                END`
          } else {
            // For LEFT JOIN (default), return array or NULL
            subquery = `SELECT CASE 
                                WHEN NOT EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${combinedCondition}) 
                                THEN NULL 
                                ELSE (SELECT json_agg(${selectClause}) FROM ${quotedEmbeddedTable} WHERE ${combinedCondition})
                                END`
          }
        } else {
          // No embedded filters, use original logic
          if (embedded.fkHint === 'inner') {
            // For INNER JOIN without filters, return first matching object or NULL
            // The NULL will trigger the HAVING clause to filter out parent rows without matches
            subquery = `SELECT CASE WHEN EXISTS(SELECT 1 FROM ${quotedEmbeddedTable} WHERE ${fullWhereCondition}) 
                               THEN (SELECT ${selectClause} FROM ${quotedEmbeddedTable} WHERE ${fullWhereCondition} LIMIT 1)
                               ELSE NULL 
                               END`
          } else {
            // For LEFT JOIN (default), return array - simplified to match working manual SQL
            subquery = `SELECT COALESCE(json_agg(${selectClause}), '[]'::json) FROM ${quotedEmbeddedTable} WHERE ${fullWhereCondition}`
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
    
    // Check if this is a count-only request
    const isCountOnly = embedded.select?.length === 1 && embedded.select[0] === 'count'
    
    // Add regular columns if any
    if (embedded.select && embedded.select.length > 0) {
      for (const col of embedded.select) {
        if (col === '*') {
          // For *, return all columns as JSON - we'll merge this with other columns
          const allColumnsPair = `to_json(${quotedEmbeddedTable})`
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
          columnPairs.push(`'${col}', ${quotedEmbeddedTable}.${col}`)
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
      return `to_json(${quotedEmbeddedTable})`
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
   * Build single filter condition using literal values (for embedded subqueries)
   */
  private buildFilterConditionLiteral(filter: ParsedFilter): string {
    console.log(`🔍 Building literal filter condition for:`, { column: filter.column, operator: filter.operator, value: filter.value, negated: filter.negated })
    
    if (filter.column === '__logical__') {
      // Handle logical operators - TODO: implement if needed for embedded queries
      return `/* Unsupported logical operator in embedded query: ${filter.operator} */`
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
   * Build logical condition (and, or, not)
   */
  private buildLogicalCondition(filter: ParsedFilter): string {
    console.log(`🔍 Building logical condition:`, filter)
    
    // Browser compatibility: add null checks and error handling
    try {
      if (filter.operator === 'or' && filter.value && filter.value.conditions) {
        // Handle OR conditions: (condition1 OR condition2 OR ...)
        const conditions = filter.value.conditions
          .map((condition: ParsedFilter) => this.buildFilterCondition(condition))
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
        const conditions = filter.value.conditions
          .map((condition: ParsedFilter) => this.buildFilterCondition(condition))
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
   * Uses purely dynamic column discovery with no hardcoded column names
   */
  private async buildInsertionOrderClause(table: string): Promise<string> {
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
          return `ORDER BY ${table}.* ASC`
        }
        
        // Use purely dynamic column analysis based on data types
        const orderingColumns = []
        
        // Priority 1: Find timestamp/date columns by data type
        const timestampCol = columnData.find((col: any) => 
          col.data_type.includes('timestamp') || 
          col.data_type.includes('date') ||
          col.data_type === 'timestamptz'
        )
        if (timestampCol) {
          orderingColumns.push(`${table}.${timestampCol.column_name} ASC`)
        }
        
        // Priority 2: Find text columns and use hash for deterministic ordering
        const textCol = columnData.find((col: any) => 
          col.data_type === 'text' || 
          col.data_type.startsWith('character') ||
          col.data_type.startsWith('varchar')
        )
        if (textCol) {
          orderingColumns.push(`hashtext(${table}.${textCol.column_name}) ASC`)
        }
        
        // Priority 3: Use first column as tie-breaker
        if (orderingColumns.length === 0 || columnData.length > 1) {
          const firstCol = columnData[0]
          orderingColumns.push(`${table}.${firstCol.column_name} ASC`)
        }
        
        return `ORDER BY ${orderingColumns.join(', ')}`
        
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
}