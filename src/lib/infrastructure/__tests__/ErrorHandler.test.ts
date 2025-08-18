import { describe, it, expect, beforeEach } from 'vitest';
import { InfrastructureErrorHandler, ERROR_CODES, errorHandler } from '../ErrorHandler';
import type { InfrastructureError } from '@/types/infrastructure';

describe('InfrastructureErrorHandler', () => {
  let testErrorHandler: InfrastructureErrorHandler;

  beforeEach(() => {
    testErrorHandler = new InfrastructureErrorHandler();
  });

  describe('handleError', () => {
    it('should handle standard Error objects', () => {
      const error = new Error('Test error message');
      const result = testErrorHandler.handleError(error, { context: 'test' });

      expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(result.message).toBe('Test error message');
      expect(result.originalError).toBe(error);
      expect(result.context).toEqual({ context: 'test' });
    });

    it('should handle InfrastructureError objects', () => {
      const infraError: InfrastructureError = {
        code: ERROR_CODES.DATABASE_QUERY_FAILED,
        message: 'Query failed',
        details: 'Syntax error',
      };

      const result = testErrorHandler.handleError(infraError, { extra: 'data' });

      expect(result.code).toBe(ERROR_CODES.DATABASE_QUERY_FAILED);
      expect(result.message).toBe('Query failed');
      expect(result.details).toBe('Syntax error');
      expect(result.context).toEqual({ extra: 'data' });
    });

    it('should handle string errors', () => {
      const result = testErrorHandler.handleError('Simple error message');

      expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(result.message).toBe('Simple error message');
    });

    it('should handle unknown error types', () => {
      const result = testErrorHandler.handleError({ weird: 'object' });

      expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(result.message).toBe('An unknown error occurred');
      expect(result.details).toBe('[object Object]');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Operation timed out after 5000ms');
      timeoutError.name = 'TimeoutError';

      const result = testErrorHandler.handleError(timeoutError);

      expect(result.code).toBe(ERROR_CODES.DATABASE_TIMEOUT);
      expect(result.message).toBe('Operation timed out after 5000ms');
    });

    it('should handle validation errors', () => {
      const validationError = new Error('Invalid input format');
      validationError.name = 'ValidationError';

      const result = testErrorHandler.handleError(validationError);

      expect(result.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(result.message).toBe('Invalid input format');
    });
  });

  describe('formatError', () => {
    it('should format basic error', () => {
      const error: InfrastructureError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
      };

      const formatted = testErrorHandler.formatError(error);
      expect(formatted).toBe('[TEST_ERROR] Test error message');
    });

    it('should format error with details', () => {
      const error: InfrastructureError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: 'Additional error details',
      };

      const formatted = testErrorHandler.formatError(error);
      expect(formatted).toBe('[TEST_ERROR] Test error message\nDetails: Additional error details');
    });

    it('should format error with hint', () => {
      const error: InfrastructureError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        hint: 'Try this solution',
      };

      const formatted = testErrorHandler.formatError(error);
      expect(formatted).toBe('[TEST_ERROR] Test error message\nHint: Try this solution');
    });

    it('should format error with details and hint', () => {
      const error: InfrastructureError = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: 'Additional details',
        hint: 'Try this solution',
      };

      const formatted = testErrorHandler.formatError(error);
      expect(formatted).toBe('[TEST_ERROR] Test error message\nDetails: Additional details\nHint: Try this solution');
    });
  });

  describe('isRecoverable', () => {
    it('should identify recoverable errors', () => {
      const timeoutError: InfrastructureError = {
        code: ERROR_CODES.DATABASE_TIMEOUT,
        message: 'Timeout error',
      };

      expect(testErrorHandler.isRecoverable(timeoutError)).toBe(true);
    });

    it('should identify non-recoverable errors', () => {
      const syntaxError: InfrastructureError = {
        code: ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION,
        message: 'Constraint violation',
      };

      expect(testErrorHandler.isRecoverable(syntaxError)).toBe(false);
    });
  });

  describe('Specific error creators', () => {
    it('should create database errors', () => {
      const originalError = new Error('Connection failed');
      const error = testErrorHandler.createDatabaseError('Database operation failed', originalError, 'Connection details');

      expect(error.code).toBe(ERROR_CODES.DATABASE_QUERY_FAILED);
      expect(error.message).toBe('Database operation failed');
      expect(error.originalError).toBe(originalError);
      expect(error.details).toBe('Connection details');
    });

    it('should create API errors', () => {
      const error = testErrorHandler.createAPIError('API request failed', undefined, 'Network details');

      expect(error.code).toBe(ERROR_CODES.API_REQUEST_FAILED);
      expect(error.message).toBe('API request failed');
      expect(error.details).toBe('Network details');
    });

    it('should create validation errors', () => {
      const error = testErrorHandler.createValidationError('Invalid input', 'Field must be a string');

      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toBe('Field must be a string');
    });

    it('should create config errors', () => {
      const error = testErrorHandler.createConfigError('Config load failed', 'File not found');

      expect(error.code).toBe(ERROR_CODES.CONFIG_INVALID);
      expect(error.message).toBe('Config load failed');
      expect(error.details).toBe('File not found');
    });

    it('should create migration errors', () => {
      const originalError = new Error('SQL syntax error');
      const error = testErrorHandler.createMigrationError('Migration failed', originalError, 'Query details');

      expect(error.code).toBe(ERROR_CODES.MIGRATION_FAILED);
      expect(error.message).toBe('Migration failed');
      expect(error.originalError).toBe(originalError);
      expect(error.details).toBe('Query details');
    });
  });

  describe('PostgreSQL error mapping', () => {
    it('should map unique constraint violation', () => {
      const pgError = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        detail: 'Key (email)=(test@example.com) already exists.',
      };

      const result = testErrorHandler.handleError(pgError);

      expect(result.code).toBe(ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION);
      expect(result.message).toBe('duplicate key value violates unique constraint');
      expect(result.details).toBe('Key (email)=(test@example.com) already exists.');
      expect(result.hint).toBe('Check for duplicate values in unique columns');
    });

    it('should map foreign key violation', () => {
      const pgError = {
        code: '23503',
        message: 'insert or update on table violates foreign key constraint',
        detail: 'Key (user_id)=(999) is not present in table "users".',
      };

      const result = testErrorHandler.handleError(pgError);

      expect(result.code).toBe(ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION);
      expect(result.hint).toBe('Referenced record may not exist or cannot be deleted due to references');
    });

    it('should map undefined table error', () => {
      const pgError = {
        code: '42P01',
        message: 'relation "unknown_table" does not exist',
      };

      const result = testErrorHandler.handleError(pgError);

      expect(result.code).toBe(ERROR_CODES.DATABASE_QUERY_FAILED);
      expect(result.hint).toBe('Table does not exist - check table name and schema');
    });
  });

  describe('HTTP error mapping', () => {
    it('should map 400 Bad Request', () => {
      const httpError = {
        status: 400,
        message: 'Bad Request',
        statusText: 'Bad Request',
      };

      const result = testErrorHandler.handleError(httpError);

      expect(result.code).toBe(ERROR_CODES.API_VALIDATION_FAILED);
      expect(result.message).toBe('Invalid request parameters');
      expect(result.hint).toBe('Check request format and parameters');
    });

    it('should map 401 Unauthorized', () => {
      const httpError = {
        status: 401,
        statusText: 'Unauthorized',
      };

      const result = testErrorHandler.handleError(httpError);

      expect(result.code).toBe(ERROR_CODES.API_UNAUTHORIZED);
      expect(result.message).toBe('Authentication required');
    });

    it('should map 404 Not Found', () => {
      const httpError = {
        status: 404,
        statusText: 'Not Found',
      };

      const result = testErrorHandler.handleError(httpError);

      expect(result.code).toBe(ERROR_CODES.API_NOT_FOUND);
      expect(result.message).toBe('Resource not found');
    });

    it('should map 429 Too Many Requests', () => {
      const httpError = {
        status: 429,
        statusText: 'Too Many Requests',
      };

      const result = testErrorHandler.handleError(httpError);

      expect(result.code).toBe(ERROR_CODES.API_RATE_LIMITED);
      expect(result.message).toBe('Too many requests');
      expect(result.hint).toBe('Wait before making additional requests');
    });

    it('should map unknown HTTP status codes', () => {
      const httpError = {
        status: 418,
        message: "I'm a teapot",
        statusText: "I'm a teapot",
      };

      const result = testErrorHandler.handleError(httpError);

      expect(result.code).toBe(ERROR_CODES.API_REQUEST_FAILED);
      expect(result.message).toBe("I'm a teapot");
    });
  });
});

describe('Global error handler instance', () => {
  it('should be available as a singleton', () => {
    const error = new Error('Test error');
    const result = errorHandler.handleError(error);

    expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    expect(result.message).toBe('Test error');
  });
});

describe('Convenience functions', () => {
  it('should provide createDatabaseError function', async () => {
    const { createDatabaseError } = await import('../ErrorHandler');
    const error = createDatabaseError('DB failed', new Error('Connection lost'));

    expect(error.code).toBe(ERROR_CODES.DATABASE_QUERY_FAILED);
    expect(error.message).toBe('DB failed');
  });

  it('should provide createAPIError function', async () => {
    const { createAPIError } = await import('../ErrorHandler');
    const error = createAPIError('API failed');

    expect(error.code).toBe(ERROR_CODES.API_REQUEST_FAILED);
    expect(error.message).toBe('API failed');
  });

  it('should provide createValidationError function', async () => {
    const { createValidationError } = await import('../ErrorHandler');
    const error = createValidationError('Validation failed');

    expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(error.message).toBe('Validation failed');
  });

  it('should provide handleError function', async () => {
    const { handleError } = await import('../ErrorHandler');
    const result = handleError('Test error');

    expect(result.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
    expect(result.message).toBe('Test error');
  });
});