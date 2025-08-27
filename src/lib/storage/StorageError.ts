/**
 * StorageError - Compatible with @supabase/storage-js error handling
 */

export class StorageError extends Error {
  statusCode?: number
  originalError?: Error

  constructor(message: string, statusCode?: number, originalError?: Error) {
    super(message)
    this.name = 'StorageError'
    this.statusCode = statusCode
    this.originalError = originalError

    // Ensure proper error prototype chain
    Object.setPrototypeOf(this, StorageError.prototype)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      stack: this.stack
    }
  }

  static fromResponse(response: Response, message?: string): StorageError {
    const statusCode = response.status
    const errorMessage = message || `Request failed with status ${statusCode}`
    return new StorageError(errorMessage, statusCode)
  }

  static fromError(error: Error, statusCode?: number): StorageError {
    if (error instanceof StorageError) {
      return error
    }
    return new StorageError(error.message, statusCode, error)
  }
}