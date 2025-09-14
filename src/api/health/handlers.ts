import { http } from 'msw'
import { createSimpleHandler } from '../kernel'
import type { ApiRequest, ApiContext, ApiResponse } from '../types'

// Health check executor
async function healthExecutor(
  request: ApiRequest,
  context: ApiContext
): Promise<ApiResponse> {
  console.log('🔧 Health handler called')

  return {
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Supabase Lite API is running',
      requestId: context.requestId
    },
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  }
}

// Health check handlers using the new API kernel
export const healthHandlers = [
  http.get('/health', createSimpleHandler(healthExecutor)),
]