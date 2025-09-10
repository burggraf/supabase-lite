import type { ParsedQuery, FormattedResponse } from '../../postgrest'
import type { SessionContext } from '../../database/connection'

export interface APIRequest {
  table: string
  method: 'GET' | 'HEAD' | 'POST' | 'PATCH' | 'DELETE' | 'RPC'
  body?: any
  headers: Record<string, string>
  url: URL
}

export interface OperationContext {
  table: string
  query: ParsedQuery
  sessionContext: SessionContext
  headers: Record<string, string>
}

export interface OperationHandler {
  canHandle(request: APIRequest): boolean
  handle(context: OperationContext, body?: any): Promise<FormattedResponse>
}

export interface RequestProcessor {
  process(request: APIRequest): Promise<FormattedResponse>
}

export interface ResponseComposer {
  compose(data: any, metadata: ResponseMetadata): FormattedResponse
}

export interface ResponseMetadata {
  table: string
  operation: string
  query?: ParsedQuery
  statusCode?: number
  headers?: Record<string, string>
}

export interface RequestValidator {
  validate(request: APIRequest): ValidationResult
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ServiceDependencies {
  dbManager: any
  sqlBuilder: any
  rlsFilteringService: any
  errorMapper: any
}