/**
 * Supabase Edge Functions Client for Supabase Lite
 * 
 * This module provides a client that mimics the @supabase/supabase-js functions interface
 * and works seamlessly with the local Supabase Lite environment.
 */

export interface FunctionInvokeOptions {
  headers?: Record<string, string>
  body?: unknown
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  region?: string
}

export interface FunctionResponse<T = any> {
  data: T | null
  error: Error | null
}

export class FunctionsHttpError extends Error {
  context: Response
  
  constructor(message: string, context: Response) {
    super(message)
    this.name = 'FunctionsHttpError'
    this.context = context
  }
}

export class FunctionsRelayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FunctionsRelayError'
  }
}

export class FunctionsFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FunctionsFetchError'
  }
}

export class FunctionsClient {
  private supabaseUrl: string
  private supabaseKey: string
  private defaultHeaders: Record<string, string>

  constructor(supabaseUrl: string, supabaseKey: string, headers: Record<string, string> = {}) {
    this.supabaseUrl = supabaseUrl.replace(/\/$/, '') // Remove trailing slash
    this.supabaseKey = supabaseKey
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      ...headers
    }
  }

  /**
   * Invoke an Edge Function
   */
  async invoke<T = any>(
    functionName: string,
    options: FunctionInvokeOptions = {}
  ): Promise<FunctionResponse<T>> {
    try {
      const {
        headers: customHeaders = {},
        body,
        method = 'POST',
        region
      } = options

      // Build function URL
      const functionUrl = `${this.supabaseUrl}/functions/${functionName}`

      // Combine headers
      const headers = {
        ...this.defaultHeaders,
        ...customHeaders
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers
      }

      // Add body for non-GET requests
      if (method !== 'GET' && body !== undefined) {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
      }

      // Make the request
      const response = await fetch(functionUrl, requestOptions)

      // Handle response
      let data: T | null = null
      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        data = text as unknown as T
      }

      // Check for HTTP errors
      if (!response.ok) {
        return {
          data: null,
          error: new FunctionsHttpError(
            `Edge Function returned ${response.status}: ${response.statusText}`,
            response
          )
        }
      }

      return {
        data,
        error: null
      }

    } catch (error) {
      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          data: null,
          error: new FunctionsFetchError(`Network error: ${error.message}`)
        }
      }

      // Handle other errors as relay errors
      return {
        data: null,
        error: new FunctionsRelayError(`Function invocation failed: ${(error as Error).message}`)
      }
    }
  }
}

/**
 * Create a functions client that works with Supabase Lite
 */
export function createFunctionsClient(options: {
  supabaseUrl: string
  supabaseKey: string
  headers?: Record<string, string>
}): FunctionsClient {
  return new FunctionsClient(options.supabaseUrl, options.supabaseKey, options.headers)
}