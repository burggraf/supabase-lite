import { HttpResponse } from 'msw'
import { addCorsHeaders } from './cors'

/**
 * PostgREST compatible error response format
 */
export interface PostgRESTError {
  code: string
  message: string
  details?: string | null
  hint?: string | null
}

/**
 * Auth API compatible error response format
 */
export interface AuthError {
  error: string
  error_description: string
  message?: string
}

/**
 * Storage API compatible error response format  
 */
export interface StorageError {
  error: string
  message: string
  statusCode: string
}

/**
 * Functions API compatible error response format
 */
export interface FunctionsError {
  error: string
  message: string
}

/**
 * Standard HTTP error codes and their PostgREST equivalents
 */
export const ERROR_CODES = {
  // PostgREST standard codes
  PGRST100: { status: 500, message: 'Server Error' },
  PGRST101: { status: 500, message: 'Database Connection Error' },
  PGRST102: { status: 400, message: 'Invalid Request' },
  PGRST103: { status: 404, message: 'Not Found' },
  PGRST104: { status: 400, message: 'Invalid Range' },
  PGRST105: { status: 400, message: 'Invalid Content-Type' },
  PGRST106: { status: 406, message: 'Not Acceptable' },
  PGRST107: { status: 400, message: 'Invalid Body' },
  PGRST108: { status: 409, message: 'Conflict' },
  PGRST109: { status: 400, message: 'Invalid Query' },
  PGRST110: { status: 422, message: 'Unprocessable Entity' },
  PGRST111: { status: 401, message: 'JWT Error' },
  PGRST112: { status: 403, message: 'Insufficient Privileges' },
  PGRST113: { status: 400, message: 'Invalid Limit' },
  PGRST114: { status: 400, message: 'Invalid Offset' },
} as const

/**
 * Creates a PostgREST compatible error response
 */
export function createPostgRESTError(
  code: keyof typeof ERROR_CODES = 'PGRST100',
  message?: string,
  details?: string | null,
  hint?: string | null
): Response {
  const errorInfo = ERROR_CODES[code]
  const error: PostgRESTError = {
    code,
    message: message || errorInfo.message,
    details: details || null,
    hint: hint || null
  }

  return HttpResponse.json(error, {
    status: errorInfo.status,
    headers: addCorsHeaders({
      'Content-Type': 'application/json'
    })
  })
}

/**
 * Creates an Auth API compatible error response
 */
export function createAuthError(
  error: string,
  error_description: string,
  status: number = 400
): Response {
  const authError: AuthError = {
    error,
    error_description,
    message: error_description
  }

  return HttpResponse.json(authError, {
    status,
    headers: addCorsHeaders({
      'Content-Type': 'application/json'
    })
  })
}

/**
 * Creates a Storage API compatible error response
 */
export function createStorageError(
  error: string,
  message: string,
  statusCode: number = 400
): Response {
  const storageError: StorageError = {
    error,
    message,
    statusCode: statusCode.toString()
  }

  return HttpResponse.json(storageError, {
    status: statusCode,
    headers: addCorsHeaders({
      'Content-Type': 'application/json'
    })
  })
}

/**
 * Creates a Functions API compatible error response
 */
export function createFunctionsError(
  error: string,
  message: string,
  status: number = 500
): Response {
  const functionsError: FunctionsError = {
    error,
    message
  }

  return HttpResponse.json(functionsError, {
    status,
    headers: addCorsHeaders({
      'Content-Type': 'application/json'
    })
  })
}

/**
 * Creates a generic error response with proper CORS headers
 */
export function createGenericError(
  message: string,
  status: number = 500,
  additionalHeaders?: Record<string, string>
): Response {
  return HttpResponse.json(
    { error: 'Internal Server Error', message },
    {
      status,
      headers: addCorsHeaders({
        'Content-Type': 'application/json',
        ...additionalHeaders
      })
    }
  )
}

/**
 * Helper to handle caught errors and convert them to proper responses
 */
export function handleError(
  error: any,
  context: string,
  defaultErrorCode: keyof typeof ERROR_CODES = 'PGRST100'
): Response {
  console.error(`❌ MSW: ${context} error:`, error)
  
  // If it's already a response, return it
  if (error instanceof Response) {
    return error
  }

  // If it has error properties, use them
  if (error?.code && ERROR_CODES[error.code as keyof typeof ERROR_CODES]) {
    return createPostgRESTError(error.code, error.message, error.details, error.hint)
  }

  // Otherwise, create a generic error
  return createPostgRESTError(
    defaultErrorCode,
    error?.message || `${context} failed`,
    null,
    null
  )
}