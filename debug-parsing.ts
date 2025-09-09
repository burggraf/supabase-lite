// Debug script to test QueryParser parsing logic
import { QueryParser } from './src/lib/postgrest/QueryParser.ts'

// Test the exact query from the failing test
const url = new URL('http://localhost:5173/rest/v1/instruments?select=name,orchestral_sections(*)&orchestral_sections.name=eq.percussion')

console.log('Testing query parsing for URL:', url.toString())

const query = QueryParser.parseQuery(url, {})

console.log('Parsed query:', JSON.stringify(query, null, 2))
console.log('Has embedded resources:', query.embedded && query.embedded.length > 0)
console.log('Embedded resources:', query.embedded)