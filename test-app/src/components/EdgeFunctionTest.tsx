import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js'

interface TestResult {
  data?: any
  error?: string
  duration?: number
  timestamp?: string
}

export default function EdgeFunctionTest() {
  const [functionName, setFunctionName] = useState('hello')
  const [requestBody, setRequestBody] = useState('{\n  "name": "Developer"\n}')
  const [result, setResult] = useState<TestResult | null>(null)
  const [loading, setLoading] = useState(false)

  const testFunction = async () => {
    setLoading(true)
    setResult(null)
    
    const startTime = Date.now()
    
    try {
      let body: any = null
      
      // Parse request body if it's provided
      if (requestBody.trim()) {
        try {
          body = JSON.parse(requestBody)
        } catch (parseError) {
          setResult({
            error: 'Invalid JSON in request body',
            timestamp: new Date().toISOString()
          })
          setLoading(false)
          return
        }
      }

      // Call the Edge Function using Supabase.js
      const { data, error } = await supabase.functions.invoke(functionName, {
        body
      })
      
      const duration = Date.now() - startTime

      if (error) {
        let errorMessage = 'Unknown error'
        
        if (error instanceof FunctionsHttpError) {
          try {
            const errorData = await error.context.json()
            errorMessage = `HTTP ${error.context.status}: ${JSON.stringify(errorData, null, 2)}`
          } catch {
            errorMessage = `HTTP ${error.context.status}: ${error.message}`
          }
        } else if (error instanceof FunctionsRelayError) {
          errorMessage = `Relay error: ${error.message}`
        } else if (error instanceof FunctionsFetchError) {
          errorMessage = `Network error: ${error.message}`
        } else {
          errorMessage = error.message
        }
        
        setResult({
          error: errorMessage,
          duration,
          timestamp: new Date().toISOString()
        })
      } else {
        setResult({
          data,
          duration,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime
      setResult({
        error: `Unexpected error: ${(error as Error).message}`,
        duration,
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  const testGET = async () => {
    setLoading(true)
    setResult(null)
    
    const startTime = Date.now()
    
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        method: 'GET'
      })
      
      const duration = Date.now() - startTime

      if (error) {
        setResult({
          error: error.message,
          duration,
          timestamp: new Date().toISOString()
        })
      } else {
        setResult({
          data,
          duration,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime
      setResult({
        error: `Unexpected error: ${(error as Error).message}`,
        duration,
        timestamp: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Edge Functions Test</h2>
        <p className="text-gray-600 mb-6">
          Test Edge Functions using the Supabase.js client library with <code>supabase.functions.invoke()</code>
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Request Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Request Configuration</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Function Name
              </label>
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="hello"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Body (JSON)
              </label>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder='{\n  "name": "Developer"\n}'
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={testFunction}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Testing...' : 'POST Request'}
              </button>
              
              <button
                onClick={testGET}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Testing...' : 'GET Request'}
              </button>
            </div>
          </div>

          {/* Response */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Response</h3>
            
            {result ? (
              <div className="space-y-4">
                {result.duration && (
                  <div className="text-sm text-gray-600">
                    <strong>Duration:</strong> {result.duration}ms
                  </div>
                )}
                
                {result.timestamp && (
                  <div className="text-sm text-gray-600">
                    <strong>Timestamp:</strong> {result.timestamp}
                  </div>
                )}

                {result.error ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <h4 className="font-semibold text-red-800 mb-2">Error</h4>
                    <pre className="text-sm text-red-700 whitespace-pre-wrap overflow-x-auto">
                      {result.error}
                    </pre>
                  </div>
                ) : (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                    <h4 className="font-semibold text-green-800 mb-2">Success</h4>
                    <pre className="text-sm text-green-700 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-center text-gray-500">
                Click "POST Request" or "GET Request" to test your Edge Function
              </div>
            )}
          </div>
        </div>

        {/* Code Examples */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Code Example</h3>
          <div className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto">
            <pre className="text-sm">
{`// Using supabase.functions.invoke()
const { data, error } = await supabase.functions.invoke('${functionName}', {
  body: ${requestBody || 'null'}
})

if (error) {
  console.error('Function error:', error)
} else {
  console.log('Function response:', data)
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}