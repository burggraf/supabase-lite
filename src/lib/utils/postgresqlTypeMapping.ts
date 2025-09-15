/**
 * PostgreSQL to JavaScript type mapping utilities for API documentation
 */

export interface DatabaseColumn {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
  is_primary_key: boolean
}

export interface APIColumn {
  name: string
  type: string      // JavaScript type
  format: string    // PostgreSQL format
  required: boolean
  description: string
}

/**
 * Maps PostgreSQL data types to JavaScript types
 */
export function mapPostgreSQLTypeToJavaScript(dataType: string): string {
  const typeMap: Record<string, string> = {
    // Integer types
    'smallint': 'number',
    'integer': 'number',
    'bigint': 'number',
    'serial': 'number',
    'bigserial': 'number',

    // Floating point types
    'real': 'number',
    'double precision': 'number',
    'numeric': 'number',
    'decimal': 'number',

    // String types
    'character varying': 'string',
    'varchar': 'string',
    'character': 'string',
    'char': 'string',
    'text': 'string',

    // Boolean type
    'boolean': 'boolean',

    // Date/time types
    'timestamp': 'string',
    'timestamp without time zone': 'string',
    'timestamp with time zone': 'string',
    'timestamptz': 'string',
    'date': 'string',
    'time': 'string',
    'time without time zone': 'string',
    'time with time zone': 'string',
    'interval': 'string',

    // UUID type
    'uuid': 'string',

    // JSON types
    'json': 'object',
    'jsonb': 'object',

    // Array types
    'ARRAY': 'array',

    // Binary types
    'bytea': 'string',

    // Network types
    'inet': 'string',
    'cidr': 'string',
    'macaddr': 'string',

    // Geometric types
    'point': 'object',
    'line': 'object',
    'lseg': 'object',
    'box': 'object',
    'path': 'object',
    'polygon': 'object',
    'circle': 'object',
  }

  // Handle array types (e.g., "integer[]" -> "array")
  if (dataType.endsWith('[]')) {
    return 'array'
  }

  return typeMap[dataType.toLowerCase()] || 'string'
}

/**
 * Gets a user-friendly format string for display in documentation
 */
export function getDisplayFormat(dataType: string): string {
  const formatMap: Record<string, string> = {
    'smallint': 'smallint',
    'integer': 'integer',
    'bigint': 'bigint',
    'serial': 'serial',
    'bigserial': 'bigserial',
    'real': 'real',
    'double precision': 'double precision',
    'numeric': 'decimal',
    'decimal': 'decimal',
    'character varying': 'text',
    'varchar': 'text',
    'character': 'text',
    'char': 'text',
    'text': 'text',
    'boolean': 'boolean',
    'timestamp': 'timestamp',
    'timestamp without time zone': 'timestamp without time zone',
    'timestamp with time zone': 'timestamp with time zone',
    'timestamptz': 'timestamp with time zone',
    'date': 'date',
    'time': 'time',
    'time without time zone': 'time without time zone',
    'time with time zone': 'time with time zone',
    'interval': 'interval',
    'uuid': 'uuid',
    'json': 'json',
    'jsonb': 'jsonb',
    'bytea': 'bytea',
    'inet': 'inet',
    'cidr': 'cidr',
    'macaddr': 'macaddr',
    'point': 'point',
    'line': 'line',
    'lseg': 'lseg',
    'box': 'box',
    'path': 'path',
    'polygon': 'polygon',
    'circle': 'circle',
  }

  // Handle array types
  if (dataType.endsWith('[]')) {
    const baseType = dataType.slice(0, -2)
    const baseFormat = formatMap[baseType.toLowerCase()] || baseType
    return `${baseFormat}[]`
  }

  return formatMap[dataType.toLowerCase()] || dataType
}

/**
 * Generates a user-friendly description for a column based on its properties
 */
export function generateColumnDescription(column: DatabaseColumn): string {
  const { column_name, data_type, is_primary_key, column_default } = column

  if (is_primary_key) {
    return 'Primary key'
  }

  // Foreign key detection (basic heuristic)
  if (column_name.endsWith('_id') && data_type === 'uuid') {
    const tableName = column_name.replace('_id', '')
    return `Foreign key to ${tableName} table`
  }

  if (column_name.endsWith('_id') && (data_type === 'integer' || data_type === 'bigint')) {
    const tableName = column_name.replace('_id', '')
    return `Foreign key to ${tableName} table`
  }

  // Common column patterns
  if (column_name === 'created_at' || column_name === 'updated_at') {
    return column_name === 'created_at' ? 'Creation timestamp' : 'Last update timestamp'
  }

  if (column_name === 'email') {
    return 'Email address'
  }

  if (column_name === 'password' || column_name === 'password_hash') {
    return 'Password hash'
  }

  if (column_name === 'name' || column_name === 'title') {
    return `${column_name.charAt(0).toUpperCase() + column_name.slice(1)}`
  }

  if (column_name === 'description') {
    return 'Description'
  }

  if (column_name === 'status') {
    return 'Status'
  }

  if (column_name === 'price' || column_name === 'amount') {
    return column_name.charAt(0).toUpperCase() + column_name.slice(1)
  }

  if (column_name === 'quantity' || column_name === 'count') {
    return column_name.charAt(0).toUpperCase() + column_name.slice(1)
  }

  // Default description based on data type
  const jsType = mapPostgreSQLTypeToJavaScript(data_type)
  const typeDescriptions: Record<string, string> = {
    'string': 'Text value',
    'number': 'Numeric value',
    'boolean': 'Boolean value',
    'object': 'JSON object',
    'array': 'Array value',
  }

  return typeDescriptions[jsType] || 'Column value'
}

/**
 * Converts a database column schema to API documentation format
 */
export function convertDatabaseColumnToAPIColumn(dbColumn: DatabaseColumn): APIColumn {
  return {
    name: dbColumn.column_name,
    type: mapPostgreSQLTypeToJavaScript(dbColumn.data_type),
    format: getDisplayFormat(dbColumn.data_type),
    required: dbColumn.is_nullable === 'NO' || dbColumn.is_primary_key,
    description: generateColumnDescription(dbColumn),
  }
}

/**
 * Converts an array of database columns to API documentation format
 */
export function convertTableSchemaToAPIColumns(dbColumns: DatabaseColumn[]): APIColumn[] {
  return dbColumns.map(convertDatabaseColumnToAPIColumn)
}