/**
 * PostgREST operators and their SQL equivalents
 * Based on https://postgrest.org/en/stable/api.html#operators
 */

export interface OperatorDefinition {
  symbol: string
  sqlTemplate: string
  requiresValue: boolean
  description: string
}

export const POSTGREST_OPERATORS: Record<string, OperatorDefinition> = {
  // Equality
  eq: {
    symbol: 'eq',
    sqlTemplate: '{column} = {value}',
    requiresValue: true,
    description: 'equals'
  },
  neq: {
    symbol: 'neq',
    sqlTemplate: '{column} != {value}',
    requiresValue: true,
    description: 'not equals'
  },

  // Comparison
  gt: {
    symbol: 'gt',
    sqlTemplate: '{column} > {value}',
    requiresValue: true,
    description: 'greater than'
  },
  gte: {
    symbol: 'gte',
    sqlTemplate: '{column} >= {value}',
    requiresValue: true,
    description: 'greater than or equal'
  },
  lt: {
    symbol: 'lt',
    sqlTemplate: '{column} < {value}',
    requiresValue: true,
    description: 'less than'
  },
  lte: {
    symbol: 'lte',
    sqlTemplate: '{column} <= {value}',
    requiresValue: true,
    description: 'less than or equal'
  },

  // Pattern matching
  like: {
    symbol: 'like',
    sqlTemplate: '{column} LIKE {value}',
    requiresValue: true,
    description: 'LIKE operator (case sensitive)'
  },
  ilike: {
    symbol: 'ilike',
    sqlTemplate: '{column} ILIKE {value}',
    requiresValue: true,
    description: 'ILIKE operator (case insensitive)'
  },

  // Full-text search
  fts: {
    symbol: 'fts',
    sqlTemplate: 'to_tsvector({column}) @@ to_tsquery({value})',
    requiresValue: true,
    description: 'full-text search using to_tsquery'
  },
  plfts: {
    symbol: 'plfts',
    sqlTemplate: 'to_tsvector({column}) @@ plainto_tsquery({value})',
    requiresValue: true,
    description: 'full-text search using plainto_tsquery'
  },
  phfts: {
    symbol: 'phfts',
    sqlTemplate: 'to_tsvector({column}) @@ phraseto_tsquery({value})',
    requiresValue: true,
    description: 'full-text search using phraseto_tsquery'
  },
  wfts: {
    symbol: 'wfts',
    sqlTemplate: 'to_tsvector({column}) @@ websearch_to_tsquery({value})',
    requiresValue: true,
    description: 'full-text search using websearch_to_tsquery'
  },

  // NULL checks
  is: {
    symbol: 'is',
    sqlTemplate: '{column} IS {value}',
    requiresValue: true,
    description: 'checking for exact equality (null, true, false, unknown)'
  },

  // Array/JSON operators
  in: {
    symbol: 'in',
    sqlTemplate: '{column} IN ({value})',
    requiresValue: true,
    description: 'one of a list of values'
  },
  cs: {
    symbol: 'cs',
    sqlTemplate: '{column} @> {value}',
    requiresValue: true,
    description: 'contains (array/json)'
  },
  cd: {
    symbol: 'cd',
    sqlTemplate: '{column} <@ {value}',
    requiresValue: true,
    description: 'contained in (array/json)'
  },
  ov: {
    symbol: 'ov',
    sqlTemplate: '{column} && {value}',
    requiresValue: true,
    description: 'overlap (array)'
  },

  // Range operators
  sl: {
    symbol: 'sl',
    sqlTemplate: '{column} << {value}',
    requiresValue: true,
    description: 'strictly left of (range)'
  },
  sr: {
    symbol: 'sr',
    sqlTemplate: '{column} >> {value}',
    requiresValue: true,
    description: 'strictly right of (range)'
  },
  nxr: {
    symbol: 'nxr',
    sqlTemplate: '{column} &< {value}',
    requiresValue: true,
    description: 'does not extend to the right of (range)'
  },
  nxl: {
    symbol: 'nxl',
    sqlTemplate: '{column} &> {value}',
    requiresValue: true,
    description: 'does not extend to the left of (range)'
  },
  adj: {
    symbol: 'adj',
    sqlTemplate: '{column} -|- {value}',
    requiresValue: true,
    description: 'is adjacent to (range)'
  },

  // Logical operators (handled separately in query parsing)
  and: {
    symbol: 'and',
    sqlTemplate: 'AND',
    requiresValue: false,
    description: 'logical and'
  },
  or: {
    symbol: 'or',
    sqlTemplate: 'OR',
    requiresValue: false,
    description: 'logical or'
  },
  not: {
    symbol: 'not',
    sqlTemplate: 'NOT',
    requiresValue: false,
    description: 'logical not'
  }
}

export function parseOperatorValue(operator: string, value: string): { op: OperatorDefinition, parsedValue: any } {
  const op = POSTGREST_OPERATORS[operator]
  if (!op) {
    throw new Error(`Unknown operator: ${operator}`)
  }

  let parsedValue = value

  // Special handling for different operators
  switch (operator) {
    case 'is':
      // Handle special values for IS operator
      if (value.toLowerCase() === 'null') {
        parsedValue = 'NULL'
      } else if (value.toLowerCase() === 'true') {
        parsedValue = 'TRUE'
      } else if (value.toLowerCase() === 'false') {
        parsedValue = 'FALSE'
      } else if (value.toLowerCase() === 'unknown') {
        parsedValue = 'UNKNOWN'
      }
      break

    case 'in':
      // Parse comma-separated list for IN operator
      parsedValue = value.split(',').map(v => v.trim())
      break

    case 'cs':
    case 'cd':
      // Handle JSON/array values
      try {
        parsedValue = JSON.parse(value)
      } catch {
        // If not valid JSON, treat as string
        parsedValue = value
      }
      break

    case 'ov':
      // Parse array values
      if (value.startsWith('{') && value.endsWith('}')) {
        parsedValue = value.slice(1, -1).split(',').map(v => v.trim())
      }
      break
  }

  return { op, parsedValue }
}

export function isLogicalOperator(operator: string): boolean {
  return ['and', 'or', 'not'].includes(operator)
}

export function getOperatorPrecedence(operator: string): number {
  switch (operator) {
    case 'not': return 3
    case 'and': return 2
    case 'or': return 1
    default: return 0
  }
}