/**
 * Shared API types for the unified kernel system
 */

export interface ApiRequest {
  url: URL
  method: string
  headers: Record<string, string>
  body?: any
  params?: Record<string, string>
}

export interface ApiResponse {
  data: any
  status: number
  headers: Record<string, string>
}

export interface ApiContext {
  requestId: string
  projectId?: string
  projectName?: string
  sessionContext?: SessionContext
  startTime: number
  reportStage?: (stage: string, data?: any) => void
}

export interface SessionContext {
  userId?: string
  role?: string
  claims?: Record<string, any>
  jwt?: string
}

export interface ParsedQuery {
  table?: string
  select?: string[]
  filters?: QueryFilter[]
  order?: QueryOrder[]
  limit?: number
  offset?: number
  count?: boolean
  preferReturn?: 'representation' | 'minimal'
  preferResolution?: 'merge-duplicates' | 'ignore-duplicates'
  returnSingle?: boolean
  onConflict?: string
  schema?: string
  embed?: Record<string, any>
  method?: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE' | 'RPC'
}

export interface QueryFilter {
  column: string
  operator: string
  value: any
  negated?: boolean
}

export interface QueryOrder {
  column: string
  ascending: boolean
}

export type MiddlewareFunction = (
  request: ApiRequest,
  context: ApiContext,
  next: () => Promise<ApiResponse>
) => Promise<ApiResponse>

export type ExecutorFunction = (
  request: ApiRequest,
  context: ApiContext
) => Promise<ApiResponse>

export interface ApiError extends Error {
  statusCode: number
  errorCode?: string
  details?: any
}