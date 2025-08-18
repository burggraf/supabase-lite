// Quick test of the PostgREST implementation
import { QueryParser } from './src/lib/postgrest/QueryParser.js'
import { SQLBuilder } from './src/lib/postgrest/SQLBuilder.js'
import { ResponseFormatter } from './src/lib/postgrest/ResponseFormatter.js'

// Test basic query parsing
const testUrl = new URL('http://localhost:3000/rest/v1/products?select=id,name,price&price=gte.10&category=eq.electronics&order=price.desc&limit=5')
const testHeaders = {
  'Prefer': 'count=exact'
}

console.log('Testing PostgREST Query Parser...')
try {
  const parsedQuery = QueryParser.parseQuery(testUrl, testHeaders)
  console.log('✅ Query parsed successfully:')
  console.log(JSON.stringify(parsedQuery, null, 2))

  console.log('\nTesting SQL Builder...')
  const sqlBuilder = new SQLBuilder()
  const sqlQuery = sqlBuilder.buildQuery('products', parsedQuery)
  console.log('✅ SQL generated successfully:')
  console.log('SQL:', sqlQuery.sql)
  console.log('Parameters:', sqlQuery.parameters)

  console.log('\nTesting Response Formatter...')
  const mockResults = [
    { id: 1, name: 'Laptop', price: 999.99, category: 'electronics' },
    { id: 2, name: 'Phone', price: 699.99, category: 'electronics' }
  ]
  
  const response = ResponseFormatter.formatSelectResponse(mockResults, parsedQuery, { count: 2 })
  console.log('✅ Response formatted successfully:')
  console.log('Status:', response.status)
  console.log('Headers:', response.headers)
  console.log('Data:', response.data)

  console.log('\n✅ All PostgREST modules working correctly!')
  
} catch (error) {
  console.error('❌ PostgREST test failed:', error)
  process.exit(1)
}