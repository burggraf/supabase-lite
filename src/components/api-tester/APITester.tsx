import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface TestResult {
  operation: string
  data: any
  error: any
  status: number
  statusText: string
  count: number
}

export default function APITester() {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  const runTest = async (testName: string, operation: string) => {
    setLoading(testName)
    
    try {
      let response: Response
      let data: any

      switch (testName) {
        case 'basic-select':
          response = await fetch('/rest/v1/products?limit=5', {
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
            }
          })
          break
          
        case 'basic-insert':
          response = await fetch('/rest/v1/products', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              name: 'Test Product',
              price: 99.99,
              category: 'test'
            })
          })
          break
          
        case 'basic-filter':
          response = await fetch('/rest/v1/products?price=gte.50', {
            headers: {
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
            }
          })
          break
          
        case 'rpc-test':
          response = await fetch('/rest/v1/rpc/hello_world', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
            },
            body: JSON.stringify({})
          })
          break
          
        default:
          throw new Error(`Unknown test: ${testName}`)
      }

      if (response.ok) {
        data = await response.json()
      } else {
        data = null
      }

      const result: TestResult = {
        operation,
        data,
        error: response.ok ? null : { message: response.statusText },
        status: response.status,
        statusText: response.statusText,
        count: Array.isArray(data) ? data.length : (data ? 1 : 0)
      }

      setResults(prev => [result, ...prev])
      
    } catch (error: any) {
      const result: TestResult = {
        operation,
        data: null,
        error: { message: error.message },
        status: 0,
        statusText: '',
        count: 0
      }
      
      setResults(prev => [result, ...prev])
    } finally {
      setLoading(null)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Tester</h1>
          <p className="text-muted-foreground">
            Test PostgREST API compatibility with the local PGlite database
          </p>
        </div>
        <Button onClick={clearResults} variant="outline">
          Clear Results
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Basic CRUD</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              size="sm" 
              className="w-full"
              disabled={loading === 'basic-select'}
              onClick={() => runTest('basic-select', 'SELECT * FROM products LIMIT 5')}
            >
              {loading === 'basic-select' ? 'Testing...' : 'SELECT'}
            </Button>
            <Button 
              size="sm" 
              className="w-full"
              disabled={loading === 'basic-insert'}
              onClick={() => runTest('basic-insert', 'INSERT INTO products')}
            >
              {loading === 'basic-insert' ? 'Testing...' : 'INSERT'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filters & Queries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              size="sm" 
              className="w-full"
              disabled={loading === 'basic-filter'}
              onClick={() => runTest('basic-filter', 'SELECT with price >= 50')}
            >
              {loading === 'basic-filter' ? 'Testing...' : 'Price Filter'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">RPC Functions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              size="sm" 
              className="w-full"
              disabled={loading === 'rpc-test'}
              onClick={() => runTest('rpc-test', 'RPC hello_world()')}
            >
              {loading === 'rpc-test' ? 'Testing...' : 'Hello World'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Test Results</h2>
          {results.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{result.operation}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant={result.error ? 'destructive' : 'default'}>
                      {result.error ? 'Error' : 'Success'}
                    </Badge>
                    <Badge variant="outline">
                      Records: {result.count}
                    </Badge>
                    {result.status > 0 && (
                      <Badge variant="outline">
                        HTTP {result.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(
                    {
                      operation: result.operation,
                      data: result.data,
                      error: result.error,
                      status: result.status,
                      statusText: result.statusText,
                      count: result.count
                    },
                    null,
                    2
                  )}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}