import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OfflineErrorHandler, type OfflineError, type ErrorContext } from '../OfflineErrorHandler'

// Mock useOnlineStatus hook
const mockUseOnlineStatus = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: mockUseOnlineStatus
}))

describe('OfflineErrorHandler', () => {
  let errorHandler: OfflineErrorHandler

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseOnlineStatus.mockReturnValue({
      isOnline: false,
      isOffline: true
    })
    errorHandler = OfflineErrorHandler.getInstance()
    // Reset singleton for clean tests
    ;(OfflineErrorHandler as any).instance = null
    errorHandler = OfflineErrorHandler.getInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = OfflineErrorHandler.getInstance()
      const instance2 = OfflineErrorHandler.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Error Detection', () => {
    it('should detect network errors when offline', () => {
      const networkError = new Error('Failed to fetch')
      
      const result = errorHandler.isOfflineError(networkError)
      
      expect(result).toBe(true)
    })

    it('should detect timeout errors', () => {
      const timeoutError = new Error('Request timeout')
      
      const result = errorHandler.isOfflineError(timeoutError)
      
      expect(result).toBe(true)
    })

    it('should detect connection refused errors', () => {
      const connectionError = new Error('Connection refused')
      
      const result = errorHandler.isOfflineError(connectionError)
      
      expect(result).toBe(true)
    })

    it('should not detect regular application errors as offline errors', () => {
      const appError = new Error('Invalid user input')
      
      const result = errorHandler.isOfflineError(appError)
      
      expect(result).toBe(false)
    })

    it('should detect offline errors when user is actually online', () => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        isOffline: false
      })

      const networkError = new Error('Failed to fetch')
      
      const result = errorHandler.isOfflineError(networkError)
      
      expect(result).toBe(true) // Error pattern matches offline error
    })
  })

  describe('Error Enrichment', () => {
    it('should enrich network errors with offline context', () => {
      const originalError = new Error('Failed to fetch')
      const context: ErrorContext = {
        operation: 'database_query',
        component: 'SQLEditor',
        userAction: 'Execute query'
      }
      
      const enrichedError = errorHandler.enrichError(originalError, context)
      
      expect(enrichedError.isOffline).toBe(true)
      expect(enrichedError.originalError).toBe(originalError)
      expect(enrichedError.context).toEqual(context)
      expect(enrichedError.userFriendlyMessage).toContain('offline')
      expect(enrichedError.suggestedActions).toHaveLength(3)
    })

    it('should enrich timeout errors with appropriate context', () => {
      const timeoutError = new Error('Request timeout')
      const context: ErrorContext = {
        operation: 'file_upload',
        component: 'Storage',
        userAction: 'Upload file'
      }
      
      const enrichedError = errorHandler.enrichError(timeoutError, context)
      
      expect(enrichedError.isOffline).toBe(true)
      expect(enrichedError.userFriendlyMessage).toContain('connection')
      expect(enrichedError.suggestedActions).toContain('Check your internet connection')
    })

    it('should handle non-offline errors gracefully', () => {
      const appError = new Error('Validation failed')
      const context: ErrorContext = {
        operation: 'form_submission',
        component: 'UserForm',
        userAction: 'Submit form'
      }
      
      const enrichedError = errorHandler.enrichError(appError, context)
      
      expect(enrichedError.isOffline).toBe(false)
      expect(enrichedError.userFriendlyMessage).toBe(appError.message)
      expect(enrichedError.suggestedActions).toHaveLength(0)
    })
  })

  describe('User-Friendly Messages', () => {
    it('should provide helpful messages for database operations', () => {
      const error = new Error('Failed to fetch')
      const context: ErrorContext = {
        operation: 'database_query',
        component: 'SQLEditor',
        userAction: 'Execute query'
      }
      
      const message = errorHandler.generateUserFriendlyMessage(error, context)
      
      expect(message).toContain('database')
      expect(message).toContain('offline')
    })

    it('should provide helpful messages for file operations', () => {
      const error = new Error('Network error')
      const context: ErrorContext = {
        operation: 'file_upload',
        component: 'Storage',
        userAction: 'Upload file'
      }
      
      const message = errorHandler.generateUserFriendlyMessage(error, context)
      
      expect(message).toContain('file')
      expect(message).toContain('connection')
    })

    it('should provide helpful messages for authentication operations', () => {
      const error = new Error('Connection refused')
      const context: ErrorContext = {
        operation: 'user_login',
        component: 'AuthPanel',
        userAction: 'Sign in'
      }
      
      const message = errorHandler.generateUserFriendlyMessage(error, context)
      
      expect(message).toContain('sign in')
      expect(message).toContain('offline')
    })
  })

  describe('Suggested Actions', () => {
    it('should suggest checking internet connection', () => {
      const error = new Error('Failed to fetch')
      const context: ErrorContext = {
        operation: 'api_call',
        component: 'Dashboard',
        userAction: 'Load data'
      }
      
      const actions = errorHandler.generateSuggestedActions(error, context)
      
      expect(actions).toContain('Check your internet connection')
    })

    it('should suggest trying again when connection is restored', () => {
      const error = new Error('Network error')
      const context: ErrorContext = {
        operation: 'database_sync',
        component: 'SyncManager',
        userAction: 'Sync data'
      }
      
      const actions = errorHandler.generateSuggestedActions(error, context)
      
      expect(actions).toContain('Try again when your connection is restored')
    })

    it('should suggest using offline features when available', () => {
      const error = new Error('Request timeout')
      const context: ErrorContext = {
        operation: 'database_query',
        component: 'SQLEditor',
        userAction: 'Query database'
      }
      
      const actions = errorHandler.generateSuggestedActions(error, context)
      
      expect(actions).toContain('Continue working offline - your data is stored locally')
    })

    it('should not suggest actions for non-offline errors', () => {
      const error = new Error('Validation error')
      const context: ErrorContext = {
        operation: 'form_validation',
        component: 'UserForm',
        userAction: 'Submit form'
      }
      
      const actions = errorHandler.generateSuggestedActions(error, context)
      
      expect(actions).toHaveLength(0)
    })
  })

  describe('Automatic Retry Logic', () => {
    it('should schedule retry when connection is restored', async () => {
      const mockRetryFunction = vi.fn()
      const error = new Error('Failed to fetch')
      const context: ErrorContext = {
        operation: 'api_call',
        component: 'Dashboard',
        userAction: 'Load data'
      }
      
      errorHandler.scheduleRetry(error, context, mockRetryFunction)
      
      // Simulate coming back online
      mockUseOnlineStatus.mockReturnValue({
        isOnline: true,
        isOffline: false
      })
      
      // Manually trigger online event
      const onlineEvent = new Event('online')
      window.dispatchEvent(onlineEvent)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(mockRetryFunction).toHaveBeenCalledWith(error, context)
    })

    it('should not schedule retry for non-offline errors', () => {
      const mockRetryFunction = vi.fn()
      const error = new Error('Validation error')
      const context: ErrorContext = {
        operation: 'form_validation',
        component: 'UserForm',
        userAction: 'Submit form'
      }
      
      const result = errorHandler.scheduleRetry(error, context, mockRetryFunction)
      
      expect(result).toBe(false)
      expect(mockRetryFunction).not.toHaveBeenCalled()
    })

    it('should handle multiple retries without duplication', () => {
      const mockRetryFunction = vi.fn()
      const error = new Error('Network error')
      const context: ErrorContext = {
        operation: 'api_call',
        component: 'Dashboard',
        userAction: 'Load data'
      }
      
      // Schedule same retry multiple times
      errorHandler.scheduleRetry(error, context, mockRetryFunction)
      errorHandler.scheduleRetry(error, context, mockRetryFunction)
      errorHandler.scheduleRetry(error, context, mockRetryFunction)
      
      const retryCount = errorHandler.getPendingRetryCount()
      expect(retryCount).toBe(1) // Should deduplicate
    })
  })

  describe('Error Logging and Monitoring', () => {
    it('should track offline error occurrences', () => {
      const error1 = new Error('Failed to fetch')
      const error2 = new Error('Request timeout')
      const context: ErrorContext = {
        operation: 'api_call',
        component: 'Dashboard',
        userAction: 'Load data'
      }
      
      errorHandler.enrichError(error1, context)
      errorHandler.enrichError(error2, context)
      
      const stats = errorHandler.getErrorStats()
      expect(stats.totalOfflineErrors).toBe(2)
      expect(stats.errorsByOperation.api_call).toBe(2)
    })

    it('should provide error frequency statistics', () => {
      const error = new Error('Network error')
      const context1: ErrorContext = { operation: 'database_query', component: 'SQL', userAction: 'Query' }
      const context2: ErrorContext = { operation: 'file_upload', component: 'Storage', userAction: 'Upload' }
      
      errorHandler.enrichError(error, context1)
      errorHandler.enrichError(error, context1)
      errorHandler.enrichError(error, context2)
      
      const stats = errorHandler.getErrorStats()
      expect(stats.errorsByOperation.database_query).toBe(2)
      expect(stats.errorsByOperation.file_upload).toBe(1)
      expect(stats.errorsByComponent.SQL).toBe(2)
      expect(stats.errorsByComponent.Storage).toBe(1)
    })
  })
})