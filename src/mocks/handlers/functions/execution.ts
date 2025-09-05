import { HttpResponse } from 'msw'
import { VFSManager } from '../../../lib/vfs/VFSManager'
import { createGetRoutes, createPostRoutes, createAllRoutes } from '../shared/route-factory'
import { handleError, createFunctionsError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'
import { logger } from '../../../lib/infrastructure/Logger'
const vfsManager = VFSManager.getInstance()

/**
 * Helper function for Edge Function simulation
 */
async function simulateEdgeFunctionExecution(
  functionName: string,
  code: string,
  requestBody: unknown
): Promise<{
  response: any
  status: number
  executionTime: string
}> {
  const startTime = performance.now()
  
  try {
    let response: any = { message: 'Function executed successfully' }
    let status = 200
    
    // Special handling for specific function types
    if (functionName === 'network-health-check' || code.includes('network health check') || code.includes('testEndpoint')) {
      // Mock network health check results
      const mockResults = [
        {
          endpoint: 'https://httpbin.org/get',
          status: 'success',
          responseTime: Math.floor(Math.random() * 100) + 50
        },
        {
          endpoint: 'https://jsonplaceholder.typicode.com/posts/1',
          status: 'success',
          responseTime: Math.floor(Math.random() * 200) + 100
        }
      ]
      
      response = {
        message: 'Network health check completed',
        timestamp: new Date().toISOString(),
        results: mockResults,
        summary: {
          totalEndpoints: mockResults.length,
          successfulEndpoints: mockResults.filter(r => r.status === 'success').length,
          averageResponseTime: mockResults.reduce((sum, r) => sum + r.responseTime, 0) / mockResults.length
        }
      }
    }
    else if (functionName === 'external-api-test' || code.includes('external API connectivity') || code.includes('jsonplaceholder.typicode.com')) {
      // Mock external API test results
      response = {
        test: {
          endpoint: 'https://jsonplaceholder.typicode.com/posts/1',
          method: 'GET',
          status: 'success',
          responseTime: Math.floor(Math.random() * 150) + 75,
          data: {
            userId: 1,
            id: 1,
            title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
            body: 'quia et suscipit suscipit recusandae consequuntur expedita et cum reprehenderit molestiae ut ut quas totam'
          }
        },
        message: 'External API connectivity test completed successfully',
        timestamp: new Date().toISOString()
      }
    }
    else if (functionName === 'api-playground' || code.includes('API Playground') || code.includes('Interactive function for testing various external APIs')) {
      // Mock API playground results
      response = {
        playground: {
          availableAPIs: [
            'JSONPlaceholder - Fake JSON data',
            'HTTPBin - HTTP testing service',
            'ReqRes - REST API testing'
          ],
          message: 'API Playground is ready for testing',
          exampleEndpoints: [
            'GET /posts - List all posts',
            'GET /users - List all users',
            'POST /posts - Create a new post'
          ]
        },
        timestamp: new Date().toISOString()
      }
    }
    else {
      // Generic function execution - try to extract return value from code
      let responseCode = code
      if (code.includes('return ')) {
        // Simple variable substitution for common patterns
        responseCode = responseCode.replace(/new Date\(\)\.toISOString\(\)/g, `"${new Date().toISOString()}"`)
        responseCode = responseCode.replace(/req\.method/g, '"POST"')
        responseCode = responseCode.replace(/req\.url/g, `"${functionName}"`)
        
        // Handle variable substitution - if responseCode is just a variable name, find its definition
        if (responseCode.trim().match(/^\w+$/)) {
          const varName = responseCode.trim()
          const varDefinition = code.match(new RegExp(`const\\s+${varName}\\s*=\\s*([^;\\n]+)`, 'i'))
          if (varDefinition) {
            responseCode = varDefinition[1]
          }
        }
      }
      
      // Try to extract a meaningful response from the function code
      if (code.includes('Hello') || code.includes('name')) {
        const name = typeof requestBody === 'object' && requestBody && 'name' in requestBody 
          ? (requestBody as any).name 
          : 'World'
        response = { message: `Hello ${name}!` }
      } else if (code.includes('Response.json')) {
        // Extract JSON response pattern
        const jsonMatch = code.match(/Response\.json\(([^)]+)\)/)
        if (jsonMatch) {
          try {
            response = JSON.parse(jsonMatch[1].replace(/'/g, '"'))
          } catch {
            response = { message: 'Function executed', data: requestBody }
          }
        } else {
          response = { message: 'Function executed', data: requestBody }
        }
      } else {
        response = { 
          message: 'Function executed successfully',
          function: functionName,
          timestamp: new Date().toISOString(),
          input: requestBody
        }
      }
    }
    
    const endTime = performance.now()
    const executionTime = `${(endTime - startTime).toFixed(2)}ms`
    
    return { response, status, executionTime }
  } catch (error: any) {
    const endTime = performance.now()
    const executionTime = `${(endTime - startTime).toFixed(2)}ms`
    
    return {
      response: { 
        error: 'Function execution failed', 
        message: error.message,
        function: functionName
      },
      status: 500,
      executionTime
    }
  }
}

/**
 * Handler for /functions/v1/:functionName
 * Direct edge function execution (legacy/simple format)
 */
const createFunctionExecutionHandler = async ({ params, request }: any) => {
  const functionName = params.functionName as string
  console.log('✅ DIRECT EDGE FUNCTION HANDLER CALLED:', functionName, request.method)
  
  return HttpResponse.json({ 
    message: 'Edge function working via direct handler', 
    function: functionName,
    method: request.method
  }, { 
    status: 200,
    headers: addCorsHeaders({
      'Content-Type': 'application/json'
    })
  })
}

/**
 * Handler for /functions/:functionName
 * Supabase.js compatible edge function execution
 */
const createSupabaseCompatibleFunctionHandler = async ({ params, request, projectInfo }: any) => {
  try {
    const functionName = params.functionName as string
    
    // Extract headers for authentication (Supabase.js compatibility)
    const apikey = request.headers.get('apikey')
    const authorization = request.headers.get('authorization')
    
    logger.info('Edge function invoked via Supabase.js', { 
      functionName,
      hasApikey: !!apikey,
      hasAuth: !!authorization,
      method: request.method,
      projectId: projectInfo?.projectId
    })
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsManager.initialize(projectInfo.projectId)
    }
    
    // Try multiple possible paths for the function file
    const possiblePaths = [
      `edge-functions/${functionName}.ts`,
      `edge-functions/${functionName}/index.ts`,
      `edge-functions/${functionName}.js`,
    ]
    
    let functionFile = null
    for (const path of possiblePaths) {
      try {
        functionFile = await vfsManager.readFile(path)
        if (functionFile) {
          console.log(`📁 Found function at: ${path}`)
          break
        }
      } catch (error) {
        // Continue to next path
        continue
      }
    }
    
    if (!functionFile) {
      return HttpResponse.json(
        { error: 'Function not found', message: `Function '${functionName}' not found. Tried paths: ${possiblePaths.join(', ')}` },
        { 
          status: 404,
          headers: addCorsHeaders({
            'Content-Type': 'application/json'
          })
        }
      )
    }

    // Parse request body
    let requestBody: any = {}
    try {
      if (request.method !== 'GET') {
        const contentType = request.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          requestBody = await request.json()
        } else {
          requestBody = await request.text()
        }
      }
    } catch (error) {
      console.log('Could not parse request body, using empty object')
    }

    // Simulate function execution
    const executionResult = await simulateEdgeFunctionExecution(
      functionName,
      functionFile.content || '',
      requestBody
    )

    logger.info('Edge function executed', { 
      functionName,
      status: executionResult.status,
      duration: executionResult.executionTime,
      projectId: projectInfo?.projectId
    })

    return HttpResponse.json(executionResult.response as any, { 
      status: executionResult.status,
      headers: addCorsHeaders({
        'Content-Type': 'application/json',
        'X-Function-Name': functionName,
        'X-Execution-Time': executionResult.executionTime,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type'
      })
    })
  } catch (error: any) {
    console.error(`❌ MSW: Edge function execution error for ${params.functionName}:`, error)
    return createFunctionsError('function_error', error.message || 'Function execution failed', 500)
  }
}

/**
 * Export edge function execution handlers
 */
export const functionExecutionHandlers = [
  // Direct function execution (legacy format)
  ...createAllRoutes('/functions/v1/:functionName', createFunctionExecutionHandler),
  
  // Supabase.js compatible handlers
  ...createAllRoutes('/functions/:functionName', createSupabaseCompatibleFunctionHandler),
]