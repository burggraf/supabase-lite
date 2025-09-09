// Debug script to test SQL generation
import { QueryParser } from './src/lib/postgrest/QueryParser.ts'
import { SQLBuilder } from './src/lib/postgrest/SQLBuilder.ts'

// Test the exact query from the failing test
const url = new URL('http://localhost:5173/rest/v1/instruments?select=name,orchestral_sections(*)&orchestral_sections.name=eq.percussion')

console.log('Testing SQL generation for URL:', url.toString())

const query = QueryParser.parseQuery(url, {})
console.log('Parsed query:', JSON.stringify(query, null, 2))

// Test SQL generation
const tableName = 'instruments'
const builder = new SQLBuilder()
const result = await builder.buildQuery(tableName, query)

console.log('\nGenerated SQL:')
console.log(result.sql)
console.log('\nParameters:')
console.log(result.parameters)