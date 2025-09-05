import { HttpResponse } from 'msw'
import { RestBridge } from '../../bridges/rest-bridge'
import { createPostRoutes } from '../shared/route-factory'
import { handleError } from '../shared/error-handling'
import { addCorsHeaders } from '../shared/cors'

const restBridge = new RestBridge()

/**
 * Handler for POST /rest/v1/rpc/:functionName
 * Handles stored procedure/function calls
 */
const createRpcHandler = async ({ params, request }: any) => {
  try {
    const body = await request.json().catch(() => ({}))
    const response = await restBridge.handleRpc(
      params.functionName as string,
      body
    )
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: addCorsHeaders({
        ...response.headers,
        'Access-Control-Allow-Methods': 'POST'
      })
    })
  } catch (error: any) {
    console.error(`❌ MSW: RPC error for ${params.functionName}:`, error)
    return handleError(error, `RPC ${params.functionName}`, 'PGRST100')
  }
}

/**
 * Export RPC handlers for stored procedure calls
 */
export const rpcHandlers = [
  ...createPostRoutes('/rest/v1/rpc/:functionName', createRpcHandler)
]