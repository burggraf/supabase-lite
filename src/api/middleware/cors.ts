/**
 * CORS middleware for cross-origin request handling
 */

import type { MiddlewareFunction, ApiRequest, ApiContext, ApiResponse } from '../types'
import { getApiConfig } from '../config'

export const corsMiddleware: MiddlewareFunction = async (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
): Promise<ApiResponse> => {
  const config = getApiConfig()

  try {
    const response = await next()

    // Add CORS headers to the response
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*', // In a real app, this should be more restrictive
      'Access-Control-Allow-Methods': config.cors.allowedMethods.join(', '),
      'Access-Control-Allow-Headers': config.cors.allowedHeaders.join(', '),
      'Access-Control-Allow-Credentials': config.cors.credentials.toString(),
      'Access-Control-Max-Age': '86400' // 24 hours
    }

    return {
      ...response,
      headers: {
        ...response.headers,
        ...corsHeaders
      }
    }
  } catch (error) {
    // Even on error, we need CORS headers for cross-origin requests
    throw error
  }
}