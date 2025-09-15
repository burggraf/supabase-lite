/**
 * PostgreSQL function discovery utilities
 */

export interface DatabaseFunction {
  name: string
  schema: string
  return_type: string
  argument_types: string
  description: string | null
}

export interface FunctionDetails {
  name: string
  schema: string
  return_type: string
  argument_types: string
  argument_names: string[]
  argument_defaults: string[]
  description: string | null
  definition: string | null
}

/**
 * SQL query to get list of functions from information_schema
 */
export const getFunctionListQuery = (schema: string = 'public') => ({
  sql: `
    SELECT
      p.proname as name,
      n.nspname as schema,
      pg_catalog.pg_get_function_result(p.oid) as return_type,
      pg_catalog.pg_get_function_arguments(p.oid) as argument_types,
      d.description
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_catalog.pg_description d ON d.objoid = p.oid
    WHERE n.nspname = $1
      AND p.prokind = 'f'  -- Only functions, not procedures or aggregates
      AND p.proname NOT LIKE 'pg_%'  -- Exclude PostgreSQL internal functions
    ORDER BY p.proname;
  `,
  params: [schema]
})

/**
 * SQL query to get detailed information about a specific function
 */
export const getFunctionDetailsQuery = (functionName: string, schema: string = 'public') => ({
  sql: `
    SELECT
      p.proname as name,
      n.nspname as schema,
      pg_catalog.pg_get_function_result(p.oid) as return_type,
      pg_catalog.pg_get_function_arguments(p.oid) as argument_types,
      p.proargnames as argument_names,
      p.proargdefaults as argument_defaults,
      d.description,
      pg_catalog.pg_get_functiondef(p.oid) as definition
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_catalog.pg_description d ON d.objoid = p.oid
    WHERE p.proname = $1
      AND n.nspname = $2
      AND p.prokind = 'f'
    LIMIT 1;
  `,
  params: [functionName, schema]
})

/**
 * Parses PostgreSQL function argument types string into individual arguments
 */
export function parseArgumentTypes(argumentTypes: string): Array<{
  name?: string
  type: string
  hasDefault: boolean
}> {
  if (!argumentTypes || argumentTypes.trim() === '') {
    return []
  }

  // Split by comma, handling nested types like "category_name text, min_price numeric DEFAULT 0"
  const parts = argumentTypes.split(',').map(part => part.trim())

  return parts.map(part => {
    const hasDefault = part.toLowerCase().includes(' default ')
    const cleanPart = part.replace(/ DEFAULT .*/i, '').trim()

    // Split into name and type
    const spaceParts = cleanPart.split(/\s+/)
    if (spaceParts.length >= 2) {
      return {
        name: spaceParts[0],
        type: spaceParts.slice(1).join(' '),
        hasDefault
      }
    } else {
      return {
        type: cleanPart,
        hasDefault
      }
    }
  })
}

/**
 * Generates a user-friendly description for a function based on its properties
 */
export function generateFunctionDescription(func: DatabaseFunction): string {
  if (func.description) {
    return func.description
  }

  // Generate basic description based on function name patterns
  const name = func.name.toLowerCase()

  if (name.startsWith('get_')) {
    return `Retrieves ${name.replace('get_', '').replace(/_/g, ' ')}`
  }

  if (name.startsWith('create_')) {
    return `Creates ${name.replace('create_', '').replace(/_/g, ' ')}`
  }

  if (name.startsWith('update_')) {
    return `Updates ${name.replace('update_', '').replace(/_/g, ' ')}`
  }

  if (name.startsWith('delete_')) {
    return `Deletes ${name.replace('delete_', '').replace(/_/g, ' ')}`
  }

  if (name.includes('_by_')) {
    const parts = name.split('_by_')
    return `${parts[0].replace(/_/g, ' ')} filtered by ${parts[1].replace(/_/g, ' ')}`
  }

  if (name.includes('_count')) {
    return `Counts ${name.replace('_count', '').replace(/_/g, ' ')}`
  }

  if (name.includes('_stats')) {
    return `Statistics for ${name.replace('_stats', '').replace(/_/g, ' ')}`
  }

  if (name.includes('_summary')) {
    return `Summary of ${name.replace('_summary', '').replace(/_/g, ' ')}`
  }

  // Default description
  return `Database function: ${func.name}`
}