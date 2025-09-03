import type { ErrorHandler, InfrastructureError } from '@/types/infrastructure';
import { logger } from './Logger';

// Error code constants
export const ERROR_CODES = {
  // Database errors
  DATABASE_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DB_QUERY_FAILED',
  DATABASE_TRANSACTION_FAILED: 'DB_TRANSACTION_FAILED',
  DATABASE_TIMEOUT: 'DB_TIMEOUT',
  DATABASE_CONSTRAINT_VIOLATION: 'DB_CONSTRAINT_VIOLATION',
  
  // API errors
  API_REQUEST_FAILED: 'API_REQUEST_FAILED',
  API_VALIDATION_FAILED: 'API_VALIDATION_FAILED',
  API_TIMEOUT: 'API_TIMEOUT',
  API_UNAUTHORIZED: 'API_UNAUTHORIZED',
  API_FORBIDDEN: 'API_FORBIDDEN',
  API_NOT_FOUND: 'API_NOT_FOUND',
  API_RATE_LIMITED: 'API_RATE_LIMITED',
  
  // Configuration errors
  CONFIG_MISSING: 'CONFIG_MISSING',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',
  
  // Migration errors
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  MIGRATION_ROLLBACK_FAILED: 'MIGRATION_ROLLBACK_FAILED',
  MIGRATION_NOT_FOUND: 'MIGRATION_NOT_FOUND',
  
  // Type generation errors
  TYPE_GENERATION_FAILED: 'TYPE_GENERATION_FAILED',
  SCHEMA_READ_FAILED: 'SCHEMA_READ_FAILED',
  
  // General errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export class InfrastructureErrorHandler implements ErrorHandler {
  private errorMappings = new Map<string, Partial<InfrastructureError>>();
  
  constructor() {
    this.initializeErrorMappings();
  }

  handleError(error: unknown, context?: Record<string, any>): InfrastructureError {
    const infraError = this.convertToInfrastructureError(error, context);
    
    // Log the error
    logger.error('Infrastructure error occurred', error as Error, {
      code: infraError.code,
      context: infraError.context,
    });

    return infraError;
  }

  formatError(error: InfrastructureError): string {
    let message = `[${error.code}] ${error.message}`;
    
    if (error.details) {
      message += `\nDetails: ${error.details}`;
    }
    
    if (error.hint) {
      message += `\nHint: ${error.hint}`;
    }

    return message;
  }

  isRecoverable(error: InfrastructureError): boolean {
    const recoverableCodes = [
      ERROR_CODES.DATABASE_TIMEOUT,
      ERROR_CODES.API_TIMEOUT,
      ERROR_CODES.API_RATE_LIMITED,
      ERROR_CODES.API_REQUEST_FAILED,
    ];

    return recoverableCodes.includes(error.code as any);
  }

  // Create specific error types
  createDatabaseError(message: string, originalError?: Error, details?: string): InfrastructureError {
    return this.createError(ERROR_CODES.DATABASE_QUERY_FAILED, message, originalError, details);
  }

  createAPIError(message: string, originalError?: Error, details?: string): InfrastructureError {
    return this.createError(ERROR_CODES.API_REQUEST_FAILED, message, originalError, details);
  }

  createValidationError(message: string, details?: string): InfrastructureError {
    return this.createError(ERROR_CODES.VALIDATION_ERROR, message, undefined, details);
  }

  createConfigError(message: string, details?: string): InfrastructureError {
    return this.createError(ERROR_CODES.CONFIG_INVALID, message, undefined, details);
  }

  createMigrationError(message: string, originalError?: Error, details?: string): InfrastructureError {
    return this.createError(ERROR_CODES.MIGRATION_FAILED, message, originalError, details);
  }

  private createError(
    code: string,
    message: string,
    originalError?: Error,
    details?: string,
    context?: Record<string, any>
  ): InfrastructureError {
    const errorMapping = this.errorMappings.get(code);
    
    return {
      code,
      message,
      details: details || errorMapping?.details,
      hint: errorMapping?.hint,
      originalError,
      context,
    };
  }

  private convertToInfrastructureError(error: unknown, context?: Record<string, any>): InfrastructureError {
    // Handle InfrastructureError (already processed) first
    if (this.isInfrastructureError(error)) {
      const infraError = error as InfrastructureError;
      return { 
        ...infraError, 
        context: { ...(infraError.context || {}), ...context } 
      };
    }

    // Handle PostgreSQL errors  
    if (this.isPGError(error)) {
      return this.mapPGError(error, context);
    }

    // Handle HTTP errors
    if (this.isHTTPError(error)) {
      return this.mapHTTPError(error, context);
    }

    // Handle standard Error objects (catch-all for Error instances)
    if ((error as any) instanceof Error) {
      return this.mapStandardError(error as Error, context);
    }

    // Handle string errors
    if (typeof error === 'string') {
      return {
        code: ERROR_CODES.UNKNOWN_ERROR,
        message: error,
        context,
      };
    }

    // Handle unknown errors
    return {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: 'An unknown error occurred',
      details: String(error),
      context,
    };
  }

  private isInfrastructureError(error: unknown): error is InfrastructureError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      !(error instanceof Error) // Exclude standard Error objects
    );
  }

  private isPGError(error: unknown): error is any {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as any).code === 'string' &&
      // PostgreSQL error codes are 5 characters (like '23505', '42P01')
      /^[0-9A-Z]{5}$/.test((error as any).code) &&
      // Must have message and not be an InfrastructureError (which would have different code format)
      'message' in error &&
      typeof (error as any).message === 'string'
    );
  }

  private isHTTPError(error: unknown): error is any {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof (error as any).status === 'number'
    );
  }

  private mapStandardError(error: Error, context?: Record<string, any>): InfrastructureError {
    // Map common error names to specific codes
    const errorName = error.name.toLowerCase();
    
    if (errorName.includes('timeout')) {
      return this.createError(ERROR_CODES.DATABASE_TIMEOUT, error.message, error, undefined, context);
    }
    
    if (errorName.includes('validation')) {
      return this.createError(ERROR_CODES.VALIDATION_ERROR, error.message, error, undefined, context);
    }
    
    if (errorName.includes('permission') || errorName.includes('access')) {
      return this.createError(ERROR_CODES.PERMISSION_DENIED, error.message, error, undefined, context);
    }

    return this.createError(ERROR_CODES.UNKNOWN_ERROR, error.message, error, undefined, context);
  }

  private mapPGError(error: any, context?: Record<string, any>): InfrastructureError {
    const pgCode = error.code;
    let infraCode: string = ERROR_CODES.DATABASE_QUERY_FAILED;
    let hint: string | undefined;

    // Map PostgreSQL error codes to infrastructure codes
    switch (pgCode) {
      case '23505': // unique_violation
        infraCode = ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION;
        hint = 'Check for duplicate values in unique columns';
        break;
      case '23503': // foreign_key_violation
        infraCode = ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION;
        hint = 'Referenced record may not exist or cannot be deleted due to references';
        break;
      case '23502': // not_null_violation
        infraCode = ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION;
        hint = 'Required field cannot be null';
        break;
      case '42P01': // undefined_table
        infraCode = ERROR_CODES.DATABASE_QUERY_FAILED;
        hint = 'Table does not exist - check table name and schema';
        break;
      case '42703': // undefined_column
        infraCode = ERROR_CODES.DATABASE_QUERY_FAILED;
        hint = 'Column does not exist - check column name and table schema';
        break;
    }

    return {
      code: infraCode,
      message: error.message || 'Database operation failed',
      details: error.detail || error.hint,
      hint,
      originalError: error,
      context,
    };
  }

  private mapHTTPError(error: any, context?: Record<string, any>): InfrastructureError {
    const status = error.status;
    let code: string;
    let message: string;
    let hint: string | undefined;

    switch (status) {
      case 400:
        code = ERROR_CODES.API_VALIDATION_FAILED;
        message = 'Invalid request parameters';
        hint = 'Check request format and parameters';
        break;
      case 401:
        code = ERROR_CODES.API_UNAUTHORIZED;
        message = 'Authentication required';
        hint = 'Provide valid authentication credentials';
        break;
      case 403:
        code = ERROR_CODES.API_FORBIDDEN;
        message = 'Access forbidden';
        hint = 'Check user permissions for this resource';
        break;
      case 404:
        code = ERROR_CODES.API_NOT_FOUND;
        message = 'Resource not found';
        hint = 'Check if the resource exists and the URL is correct';
        break;
      case 429:
        code = ERROR_CODES.API_RATE_LIMITED;
        message = 'Too many requests';
        hint = 'Wait before making additional requests';
        break;
      case 408:
        code = ERROR_CODES.API_TIMEOUT;
        message = 'Request timeout';
        hint = 'Try again or increase timeout duration';
        break;
      default:
        code = ERROR_CODES.API_REQUEST_FAILED;
        message = error.message || `HTTP ${status} error`;
        break;
    }

    return {
      code,
      message,
      details: error.statusText,
      hint,
      originalError: error,
      context,
    };
  }

  private initializeErrorMappings(): void {
    // Database error mappings
    this.errorMappings.set(ERROR_CODES.DATABASE_CONNECTION_FAILED, {
      hint: 'Check database configuration and ensure the database is running',
    });

    this.errorMappings.set(ERROR_CODES.DATABASE_TIMEOUT, {
      hint: 'Optimize query performance or increase timeout setting',
    });

    // API error mappings
    this.errorMappings.set(ERROR_CODES.API_RATE_LIMITED, {
      hint: 'Implement exponential backoff or reduce request frequency',
    });

    // Configuration error mappings
    this.errorMappings.set(ERROR_CODES.CONFIG_MISSING, {
      hint: 'Ensure all required configuration values are provided',
    });

    // Migration error mappings
    this.errorMappings.set(ERROR_CODES.MIGRATION_FAILED, {
      hint: 'Check migration syntax and ensure database compatibility',
    });
  }
}

// Singleton instance
export const errorHandler = new InfrastructureErrorHandler();

// Convenience functions
export const createDatabaseError = (message: string, originalError?: Error, details?: string) =>
  errorHandler.createDatabaseError(message, originalError, details);

export const createAPIError = (message: string, originalError?: Error, details?: string) =>
  errorHandler.createAPIError(message, originalError, details);

export const createValidationError = (message: string, details?: string) =>
  errorHandler.createValidationError(message, details);

export const createMigrationError = (message: string, originalError?: Error, details?: string) =>
  errorHandler.createMigrationError(message, originalError, details);

export const handleError = (error: unknown, context?: Record<string, any>) =>
  errorHandler.handleError(error, context);