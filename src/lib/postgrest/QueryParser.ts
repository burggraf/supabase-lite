import { POSTGREST_OPERATORS, parseOperatorValue } from './operators'

export interface ParsedFilter {
  column: string
  operator: string
  value: any
  negated?: boolean
  jsonPath?: {
    columnName: string
    jsonOperator: string
    path: string
  }
}

export interface ParsedOrder {
  column: string
  ascending: boolean
  nullsFirst?: boolean
}

export interface EmbeddedResource {
  table: string
  alias?: string
  fkHint?: string  // Foreign key constraint hint for disambiguation
  select?: string[]
  embedded?: EmbeddedResource[]  // Support for nested embedded resources
  filters?: ParsedFilter[]
  order?: ParsedOrder[]
  limit?: number
  offset?: number
}

export interface ParsedQuery {
  select?: string[]
  columnAliases?: Record<string, string>  // Maps actual column names to aliases
  filters: ParsedFilter[]
  order?: ParsedOrder[]
  limit?: number
  offset?: number
  embedded?: EmbeddedResource[]
  count?: 'exact' | 'planned' | 'estimated'
  preferReturn?: 'representation' | 'minimal' | 'headers-only'
  preferResolution?: 'merge-duplicates' | 'ignore-duplicates'
  returnSingle?: boolean  // For .single() method support
  onConflict?: string  // Column(s) to use for ON CONFLICT resolution
  schema?: string  // Schema name for PostgREST schema switching
}

export class QueryParser {
  /**
   * Parse PostgREST query parameters into structured query object
   */
  static parseQuery(url: URL, headers: Record<string, string> = {}): ParsedQuery {
    const params = new URLSearchParams(url.search)
    const query: ParsedQuery = {
      filters: []
    }

    // Parse select parameter
    const select = params.get('select')
    if (select) {
      const { columns, aliases, embedded } = this.parseSelectWithAliases(select)
      query.select = columns
      query.columnAliases = aliases
      query.embedded = embedded
    }

    // Parse filters
    for (const [key, value] of params.entries()) {
      if (this.isFilterParam(key)) {
        const filter = this.parseFilter(key, value)
        if (filter) {
          query.filters.push(filter)
        }
      }
    }
    
    // Parse logical operators (or, and) as special query parameters
    const orParam = params.get('or')
    if (orParam) {
      const orFilter = this.parseOrOperator(orParam)
      if (orFilter) {
        query.filters.push(orFilter)
      }
    }
    
    const andParam = params.get('and')
    if (andParam) {
      const andFilter = this.parseAndOperator(andParam)
      if (andFilter) {
        query.filters.push(andFilter)
      }
    }
    
    const notParam = params.get('not')
    if (notParam) {
      const notFilter = this.parseNotOperator(notParam)
      if (notFilter) {
        query.filters.push(notFilter)
      }
    }

    // Parse order
    const order = params.get('order')
    if (order) {
      query.order = this.parseOrder(order)
    }

    // Parse on_conflict parameter for upserts
    const onConflict = params.get('on_conflict')
    if (onConflict) {
      query.onConflict = onConflict
    }

    // Parse pagination with validation
    const limit = params.get('limit')
    if (limit) {
      const parsedLimit = parseInt(limit, 10)
      if (isNaN(parsedLimit) || parsedLimit < 0) {
        throw new Error(`Invalid limit parameter: "${limit}". Must be a non-negative integer.`)
      }
      query.limit = parsedLimit
    }

    const offset = params.get('offset')
    if (offset) {
      const parsedOffset = parseInt(offset, 10)
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        throw new Error(`Invalid offset parameter: "${offset}". Must be a non-negative integer.`)
      }
      query.offset = parsedOffset
    }

    // Parse Prefer header
    const prefer = headers['prefer'] || headers['Prefer']
    if (prefer) {
      this.parsePreferHeader(prefer, query)
    }

    // Parse Range header for pagination
    const range = headers['range'] || headers['Range']
    if (range && !query.limit && !query.offset) {
      this.parseRangeHeader(range, query)
    }

    // Parse Accept header for single object response
    const accept = headers['accept'] || headers['Accept']
    if (accept && accept.includes('application/vnd.pgrst.object+json')) {
      query.returnSingle = true
    }

    // Parse Accept-Profile header for schema switching
    const acceptProfile = headers['accept-profile'] || headers['Accept-Profile']
    if (acceptProfile) {
      query.schema = acceptProfile.trim()
    }

    return query
  }

  /**
   * Parse select parameter, including embedded resources
   */
  private static parseSelect(select: string): string[] {
    // Simple case: just column names
    if (!select.includes('(')) {
      return select.split(',').map(col => {
        const trimmed = col.trim()
        // Handle column aliases (alias:column_name)
        if (trimmed.includes(':')) {
          return trimmed.split(':')[0].trim()
        }
        return trimmed
      }).filter(Boolean)
    }

    // Complex case with embedded resources - return top-level columns only
    const columns: string[] = []
    let depth = 0
    let currentColumn = ''

    for (let i = 0; i < select.length; i++) {
      const char = select[i]
      
      if (char === ',' && depth === 0) {
        if (currentColumn.trim()) {
          const trimmed = currentColumn.trim()
          // Handle column aliases (alias:column_name)
          if (trimmed.includes(':') && !trimmed.includes('(')) {
            columns.push(trimmed.split(':')[0].trim())
          } else {
            columns.push(trimmed)
          }
        }
        currentColumn = ''
      } else if (char === '(') {
        if (depth === 0) {
          // This is an embedded resource
          const resourceName = currentColumn.trim()
          if (resourceName && !resourceName.includes('*')) {
            // Handle aliases and foreign key hints for embedded resources
            let cleanResourceName = resourceName
            if (resourceName.includes(':')) {
              cleanResourceName = resourceName.split(':')[0].trim()
            }
            columns.push(cleanResourceName)
          }
        }
        depth++
        if (depth === 1) {
          currentColumn = ''
        } else {
          currentColumn += char
        }
      } else if (char === ')') {
        depth--
        if (depth > 0) {
          currentColumn += char
        }
      } else if (depth === 0) {
        currentColumn += char
      } else {
        currentColumn += char
      }
    }

    if (currentColumn.trim() && depth === 0) {
      const trimmed = currentColumn.trim()
      // Handle column aliases (alias:column_name)
      if (trimmed.includes(':') && !trimmed.includes('(')) {
        columns.push(trimmed.split(':')[0].trim())
      } else {
        columns.push(trimmed)
      }
    }

    return columns.filter(Boolean)
  }

  /**
   * Parse select parameter with alias support
   */
  private static parseSelectWithAliases(select: string): { columns: string[], aliases: Record<string, string>, embedded: EmbeddedResource[] } {
    const columns: string[] = []
    const aliases: Record<string, string> = {}
    const embedded = this.parseEmbedded(select)
    
    // Simple case: just column names
    if (!select.includes('(')) {
      select.split(',').forEach(col => {
        const trimmed = col.trim()
        if (trimmed.includes(':')) {
          const [alias, actualCol] = trimmed.split(':').map(s => s.trim())
          columns.push(actualCol)
          aliases[actualCol] = alias
        } else {
          // Check if this is a JSON path extraction (address->city, address->>city, etc.)
          const jsonPathInfo = this.parseJSONPathExpression(trimmed)
          if (jsonPathInfo) {
            // The original trimmed string IS the expression we want to keep
            columns.push(trimmed)
            aliases[trimmed] = jsonPathInfo.alias
          } else {
            columns.push(trimmed)
          }
        }
      })
      return { columns: columns.filter(Boolean), aliases, embedded }
    }

    // Complex case with embedded resources - parse top-level columns only
    let depth = 0
    let currentColumn = ''

    for (let i = 0; i < select.length; i++) {
      const char = select[i]
      
      if (char === ',' && depth === 0) {
        if (currentColumn.trim()) {
          const trimmed = currentColumn.trim()
          // Handle column aliases (alias:column_name)
          if (trimmed.includes(':') && !trimmed.includes('(')) {
            const [alias, actualCol] = trimmed.split(':').map(s => s.trim())
            columns.push(actualCol)
            aliases[actualCol] = alias
          } else {
            // Check if this is a JSON path extraction (address->city, address->>city, etc.)
            const jsonPathInfo = this.parseJSONPathExpression(trimmed)
            if (jsonPathInfo) {
              columns.push(trimmed)
              aliases[trimmed] = jsonPathInfo.alias
            } else {
              columns.push(trimmed)
            }
          }
        }
        currentColumn = ''
      } else if (char === '(') {
        if (depth === 0) {
          // This is an embedded resource - skip it from main columns
          // Don't add it to columns as it's handled separately by parseEmbedded
          currentColumn = ''
        }
        depth++
        if (depth > 1) {
          currentColumn += char
        }
      } else if (char === ')') {
        depth--
        if (depth > 0) {
          currentColumn += char
        } else if (depth === 0) {
          // Just exited an embedded resource, clear currentColumn
          // as its content belongs to the embedded resource, not main table
          currentColumn = ''
        }
      } else if (depth === 0) {
        currentColumn += char
      } else {
        currentColumn += char
      }
    }

    if (currentColumn.trim() && depth === 0) {
      const trimmed = currentColumn.trim()
      // Handle column aliases (alias:column_name)
      if (trimmed.includes(':') && !trimmed.includes('(')) {
        const [alias, actualCol] = trimmed.split(':').map(s => s.trim())
        columns.push(actualCol)
        aliases[actualCol] = alias
      } else {
        // Check if this is a JSON path extraction (address->city, address->>city, etc.)
        const jsonPathInfo = this.parseJSONPathExpression(trimmed)
        if (jsonPathInfo) {
          columns.push(trimmed)
          aliases[trimmed] = jsonPathInfo.alias
        } else {
          columns.push(trimmed)
        }
      }
    }

    return { columns: columns.filter(Boolean), aliases, embedded }
  }

  /**
   * Parse embedded resources from select parameter
   */
  private static parseEmbedded(select: string): EmbeddedResource[] {
    if (!select.includes('(')) {
      return []
    }

    const embedded: EmbeddedResource[] = []
    let depth = 0
    let currentTable = ''
    let embeddedContent = ''

    for (let i = 0; i < select.length; i++) {
      const char = select[i]
      
      if (char === ',' && depth === 0) {
        currentTable = ''
        embeddedContent = ''
      } else if (char === '(') {
        if (depth === 0) {
          currentTable = currentTable.trim()
        }
        depth++
        if (depth === 1) {
          embeddedContent = ''
        } else {
          embeddedContent += char
        }
      } else if (char === ')') {
        depth--
        if (depth === 0 && currentTable) {
          // Parse the embedded resource with alias and FK hint support
          let tableName = currentTable
          let alias: string | undefined
          let fkHint: string | undefined
          
          // Handle alias:table!fkey_hint syntax
          if (currentTable.includes(':')) {
            const parts = currentTable.split(':')
            alias = parts[0].trim()
            tableName = parts[1].trim()
          }
          
          // Handle foreign key hints (table!fkey_constraint)
          if (tableName.includes('!')) {
            const parts = tableName.split('!')
            tableName = parts[0].trim()
            fkHint = parts[1].trim()
          }
          
          const resource: EmbeddedResource = {
            table: tableName
          }
          
          if (alias) {
            resource.alias = alias
          }
          
          if (fkHint) {
            resource.fkHint = fkHint
          }

          if (embeddedContent.trim()) {
            // Check if the embedded content contains nested resources (parentheses)
            if (embeddedContent.includes('(')) {
              // Parse nested embedded resources
              const nestedEmbedded = this.parseEmbedded(embeddedContent)
              if (nestedEmbedded.length > 0) {
                resource.embedded = nestedEmbedded
              }
              
              // Also parse any top-level columns (those without parentheses)
              const topLevelColumns = this.extractTopLevelColumns(embeddedContent)
              if (topLevelColumns.length > 0) {
                resource.select = topLevelColumns
              }
            } else {
              // Simple case: just column names
              resource.select = embeddedContent.split(',').map(col => col.trim()).filter(Boolean)
            }
          }

          embedded.push(resource)
          currentTable = ''
          embeddedContent = ''
        } else if (depth > 0) {
          embeddedContent += char
        }
      } else if (depth === 0) {
        currentTable += char
      } else {
        embeddedContent += char
      }
    }

    return embedded
  }

  /**
   * Parse JSON path expression like address->city, address->>city, etc.
   * Returns null if not a JSON path expression
   */
  private static parseJSONPathExpression(expression: string): { columnName: string, operator: string, path: string, alias: string } | null {
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
   * Extract top-level columns from embedded content that contains nested resources
   */
  private static extractTopLevelColumns(content: string): string[] {
    const columns: string[] = []
    let depth = 0
    let currentColumn = ''

    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      
      if (char === ',' && depth === 0) {
        if (currentColumn.trim() && !currentColumn.includes('(')) {
          columns.push(currentColumn.trim())
        }
        currentColumn = ''
      } else if (char === '(') {
        depth++
        if (depth === 1) {
          // This starts an embedded resource, don't include in column
          currentColumn = ''
        } else {
          currentColumn += char
        }
      } else if (char === ')') {
        depth--
        if (depth > 0) {
          currentColumn += char
        } else {
          // End of embedded resource, reset
          currentColumn = ''
        }
      } else if (depth === 0) {
        currentColumn += char
      } else {
        currentColumn += char
      }
    }

    if (currentColumn.trim() && depth === 0 && !currentColumn.includes('(')) {
      columns.push(currentColumn.trim())
    }

    return columns.filter(Boolean)
  }

  /**
   * Parse a single filter parameter
   */
  private static parseFilter(key: string, value: string): ParsedFilter | null {
    // Handle logical operators (and, or, not)
    if (key.startsWith('and(') || key.startsWith('or(') || key.startsWith('not(')) {
      return this.parseLogicalFilter(key, value)
    }

    // Check if the column key contains JSON path operators
    const jsonPathInfo = this.parseJSONPathExpression(key)

    // Handle regular filters: column=operator.value
    const match = value.match(/^([a-z]+)\.(.*)$/i)
    if (!match) {
      // Default to equality if no operator specified
      const filter: ParsedFilter = {
        column: key,
        operator: 'eq',
        value: value
      }
      
      // Add JSON path information if detected
      if (jsonPathInfo) {
        filter.jsonPath = {
          columnName: jsonPathInfo.columnName,
          jsonOperator: jsonPathInfo.operator,
          path: jsonPathInfo.path
        }
      }
      
      return filter
    }

    const [, operator, operatorValue] = match
    
    if (!POSTGREST_OPERATORS[operator]) {
      throw new Error(`Unknown operator: ${operator}`)
    }

    try {
      const { parsedValue } = parseOperatorValue(operator, operatorValue)
      const filter: ParsedFilter = {
        column: key,
        operator,
        value: parsedValue
      }
      
      // Add JSON path information if detected
      if (jsonPathInfo) {
        filter.jsonPath = {
          columnName: jsonPathInfo.columnName,
          jsonOperator: jsonPathInfo.operator,
          path: jsonPathInfo.path
        }
      }
      
      return filter
    } catch (error) {
      console.error(`Error parsing filter ${key}=${value}:`, error)
      return null
    }
  }

  /**
   * Parse logical filters (and, or, not)
   */
  private static parseLogicalFilter(key: string, value: string): ParsedFilter | null {
    const operator = key.match(/^(and|or|not)/)?.[1]
    if (!operator) return null

    if (operator === 'not') {
      // Parse not() operator: not(column,operator,value)
      // Example: not(name,is,null) -> { column: 'name', operator: 'is', value: null, negated: true }
      
      // Extract the inner filter from not(...)
      const match = key.match(/^not\((.+)\)$/)
      if (!match) return null
      
      const innerExpression = match[1]
      
      // Parse inner expression: column,operator,value
      const parts = innerExpression.split(',')
      if (parts.length !== 3) return null
      
      const [column, innerOperator, innerValue] = parts.map(p => p.trim())
      
      // Validate that the operator exists
      if (!POSTGREST_OPERATORS[innerOperator]) {
        throw new Error(`Unknown operator in not() filter: ${innerOperator}`)
      }
      
      try {
        // Parse the value according to the operator
        const { parsedValue } = parseOperatorValue(innerOperator, innerValue)
        
        return {
          column: column,
          operator: innerOperator,
          value: parsedValue,
          negated: true
        }
      } catch (error) {
        console.error(`Error parsing not() filter ${key}:`, error)
        return null
      }
    }
    
    // For and/or operators, return a placeholder for now
    // These would need more complex recursive parsing
    return {
      column: '__logical__',
      operator,
      value: { expression: key, params: value }
    }
  }

  /**
   * Parse order parameter
   */
  private static parseOrder(order: string): ParsedOrder[] {
    return order.split(',').map(item => {
      const trimmed = item.trim()
      
      // Handle nullsfirst/nullslast
      const nullsMatch = trimmed.match(/^(.+?)\.(asc|desc)\.(nullsfirst|nullslast)$/i)
      if (nullsMatch) {
        return {
          column: nullsMatch[1],
          ascending: nullsMatch[2].toLowerCase() === 'asc',
          nullsFirst: nullsMatch[3].toLowerCase() === 'nullsfirst'
        }
      }

      // Handle asc/desc
      const dirMatch = trimmed.match(/^(.+?)\.(asc|desc)$/i)
      if (dirMatch) {
        return {
          column: dirMatch[1],
          ascending: dirMatch[2].toLowerCase() === 'asc'
        }
      }

      // Default to ascending
      return {
        column: trimmed,
        ascending: true
      }
    })
  }

  /**
   * Parse Prefer header
   */
  private static parsePreferHeader(prefer: string, query: ParsedQuery): void {
    const preferences = prefer.toLowerCase().split(',').map(p => p.trim())
    
    for (const pref of preferences) {
      if (pref.startsWith('return=')) {
        query.preferReturn = pref.split('=')[1] as any
      } else if (pref.startsWith('resolution=')) {
        query.preferResolution = pref.split('=')[1] as any
      } else if (pref.startsWith('count=')) {
        query.count = pref.split('=')[1] as any
      }
    }
  }

  /**
   * Parse Range header
   */
  private static parseRangeHeader(range: string, query: ParsedQuery): void {
    const match = range.match(/^(\d+)-(\d+)$/)
    if (match) {
      const start = parseInt(match[1], 10)
      const end = parseInt(match[2], 10)
      query.offset = start
      query.limit = end - start + 1
    }
  }

  /**
   * Parse OR operator: or=id.eq.2,name.eq.Han
   */
  private static parseOrOperator(orValue: string): ParsedFilter | null {
    try {
      // Remove parentheses if present: "(id.eq.1,name.eq.woodwinds)" -> "id.eq.1,name.eq.woodwinds"
      let cleanValue = orValue.trim()
      if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
        cleanValue = cleanValue.slice(1, -1)
      }
      
      const conditions = cleanValue.split(',')
      const parsedConditions: ParsedFilter[] = []
      
      for (const condition of conditions) {
        const trimmed = condition.trim()
        // Parse each condition as column.operator.value
        const match = trimmed.match(/^([^.]+)\.([^.]+)\.(.+)$/)
        if (match) {
          const [, column, operator, value] = match
          const { parsedValue } = parseOperatorValue(operator, value)
          parsedConditions.push({
            column,
            operator,
            value: parsedValue
          })
        }
      }
      
      if (parsedConditions.length > 0) {
        return {
          column: '__logical__',
          operator: 'or',
          value: { conditions: parsedConditions }
        }
      }
    } catch (error) {
      console.error('Error parsing OR operator:', error)
    }
    return null
  }
  
  /**
   * Parse AND operator: and=id.gt.1,name.like.*Alice*
   */
  private static parseAndOperator(andValue: string): ParsedFilter | null {
    try {
      // Remove parentheses if present: "(id.eq.1,name.eq.woodwinds)" -> "id.eq.1,name.eq.woodwinds"
      let cleanValue = andValue.trim()
      if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
        cleanValue = cleanValue.slice(1, -1)
      }
      
      const conditions = cleanValue.split(',')
      const parsedConditions: ParsedFilter[] = []
      
      for (const condition of conditions) {
        const trimmed = condition.trim()
        // Parse each condition as column.operator.value
        const match = trimmed.match(/^([^.]+)\.([^.]+)\.(.+)$/)
        if (match) {
          const [, column, operator, value] = match
          const { parsedValue } = parseOperatorValue(operator, value)
          parsedConditions.push({
            column,
            operator,
            value: parsedValue
          })
        }
      }
      
      if (parsedConditions.length > 0) {
        return {
          column: '__logical__',
          operator: 'and',
          value: { conditions: parsedConditions }
        }
      }
    } catch (error) {
      console.error('Error parsing AND operator:', error)
    }
    return null
  }
  
  /**
   * Parse NOT operator: not=name.eq.null or not=id.gt.5
   */
  private static parseNotOperator(notValue: string): ParsedFilter | null {
    try {
      // Remove parentheses if present: "(id.eq.1)" -> "id.eq.1"
      let cleanValue = notValue.trim()
      if (cleanValue.startsWith('(') && cleanValue.endsWith(')')) {
        cleanValue = cleanValue.slice(1, -1)
      }
      
      // Parse single condition as column.operator.value
      const match = cleanValue.match(/^([^.]+)\.([^.]+)\.(.+)$/)
      if (match) {
        const [, column, operator, value] = match
        const { parsedValue } = parseOperatorValue(operator, value)
        
        // Return a single condition with negated flag
        return {
          column,
          operator,
          value: parsedValue,
          negated: true
        }
      }
    } catch (error) {
      console.error('Error parsing NOT operator:', error)
    }
    return null
  }

  /**
   * Check if parameter is a filter (not select, limit, offset, order, or, and, not)
   */
  private static isFilterParam(key: string): boolean {
    const reservedParams = ['select', 'limit', 'offset', 'order', 'or', 'and', 'not']
    return !reservedParams.includes(key)
  }
}