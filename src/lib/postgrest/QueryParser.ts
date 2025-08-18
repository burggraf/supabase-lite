import { POSTGREST_OPERATORS, parseOperatorValue, isLogicalOperator } from './operators'

export interface ParsedFilter {
  column: string
  operator: string
  value: any
  negated?: boolean
}

export interface ParsedOrder {
  column: string
  ascending: boolean
  nullsFirst?: boolean
}

export interface EmbeddedResource {
  table: string
  alias?: string
  select?: string[]
  filters?: ParsedFilter[]
  order?: ParsedOrder[]
  limit?: number
  offset?: number
}

export interface ParsedQuery {
  select?: string[]
  filters: ParsedFilter[]
  order?: ParsedOrder[]
  limit?: number
  offset?: number
  embedded?: EmbeddedResource[]
  count?: 'exact' | 'planned' | 'estimated'
  preferReturn?: 'representation' | 'minimal' | 'headers-only'
  preferResolution?: 'merge-duplicates' | 'ignore-duplicates'
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
      query.select = this.parseSelect(select)
      query.embedded = this.parseEmbedded(select)
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

    // Parse order
    const order = params.get('order')
    if (order) {
      query.order = this.parseOrder(order)
    }

    // Parse pagination
    const limit = params.get('limit')
    if (limit) {
      query.limit = parseInt(limit, 10)
    }

    const offset = params.get('offset')
    if (offset) {
      query.offset = parseInt(offset, 10)
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

    return query
  }

  /**
   * Parse select parameter, including embedded resources
   */
  private static parseSelect(select: string): string[] {
    // Simple case: just column names
    if (!select.includes('(')) {
      return select.split(',').map(col => col.trim()).filter(Boolean)
    }

    // Complex case with embedded resources - return top-level columns only
    const columns: string[] = []
    let depth = 0
    let currentColumn = ''

    for (let i = 0; i < select.length; i++) {
      const char = select[i]
      
      if (char === ',' && depth === 0) {
        if (currentColumn.trim()) {
          columns.push(currentColumn.trim())
        }
        currentColumn = ''
      } else if (char === '(') {
        if (depth === 0) {
          // This is an embedded resource
          const resourceName = currentColumn.trim()
          if (resourceName && !resourceName.includes('*')) {
            columns.push(resourceName)
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
      columns.push(currentColumn.trim())
    }

    return columns.filter(Boolean)
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
          // Parse the embedded resource
          const resource: EmbeddedResource = {
            table: currentTable
          }

          if (embeddedContent.trim()) {
            resource.select = embeddedContent.split(',').map(col => col.trim()).filter(Boolean)
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
   * Parse a single filter parameter
   */
  private static parseFilter(key: string, value: string): ParsedFilter | null {
    // Handle logical operators (and, or, not)
    if (key.startsWith('and(') || key.startsWith('or(') || key.startsWith('not(')) {
      return this.parseLogicalFilter(key, value)
    }

    // Handle regular filters: column=operator.value
    const match = value.match(/^([a-z]+)\.(.*)$/i)
    if (!match) {
      // Default to equality if no operator specified
      return {
        column: key,
        operator: 'eq',
        value: value
      }
    }

    const [, operator, operatorValue] = match
    
    if (!POSTGREST_OPERATORS[operator]) {
      throw new Error(`Unknown operator: ${operator}`)
    }

    try {
      const { parsedValue } = parseOperatorValue(operator, operatorValue)
      return {
        column: key,
        operator,
        value: parsedValue
      }
    } catch (error) {
      console.error(`Error parsing filter ${key}=${value}:`, error)
      return null
    }
  }

  /**
   * Parse logical filters (and, or, not)
   */
  private static parseLogicalFilter(key: string, value: string): ParsedFilter | null {
    // This is a complex case that would need recursive parsing
    // For now, return a placeholder that will be handled by the SQL builder
    const operator = key.match(/^(and|or|not)/)?.[1]
    if (!operator) return null

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
   * Check if parameter is a filter (not select, limit, offset, order)
   */
  private static isFilterParam(key: string): boolean {
    const reservedParams = ['select', 'limit', 'offset', 'order']
    return !reservedParams.includes(key)
  }
}