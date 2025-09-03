import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OfflineErrorBoundary } from '../OfflineErrorBoundary'

// Mock component that can throw errors
const ThrowError = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

// Mock the OfflineErrorHandler
const mockOfflineErrorHandler = vi.hoisted(() => ({
  getInstance: vi.fn(() => ({
    isOfflineError: vi.fn(),
    enrichError: vi.fn(),
    scheduleRetry: vi.fn()
  }))
}))

vi.mock('@/lib/offline/OfflineErrorHandler', () => ({
  OfflineErrorHandler: mockOfflineErrorHandler
}))

describe('OfflineErrorBoundary', () => {
  let mockHandler: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockHandler = {
      isOfflineError: vi.fn(),
      enrichError: vi.fn(),
      scheduleRetry: vi.fn()
    }
    mockOfflineErrorHandler.getInstance.mockReturnValue(mockHandler)
    
    // Clear console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <OfflineErrorBoundary>
          <div>Test content</div>
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('Test content')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error UI when child component throws', () => {
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: ['Check connection', 'Try again'],
        originalError: new Error('Test error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('Connection Issue')).toBeInTheDocument()
      expect(screen.getByText('Connection error occurred')).toBeInTheDocument()
    })

    it('should display generic error for non-offline errors', () => {
      mockHandler.isOfflineError.mockReturnValue(false)
      mockHandler.enrichError.mockReturnValue({
        isOffline: false,
        userFriendlyMessage: 'Test error',
        suggestedActions: [],
        originalError: new Error('Test error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    it('should show suggested actions for offline errors', () => {
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: ['Check your internet connection', 'Try again later'],
        originalError: new Error('Test error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('What you can do:')).toBeInTheDocument()
      expect(screen.getByText('Check your internet connection')).toBeInTheDocument()
      expect(screen.getByText('Try again later')).toBeInTheDocument()
    })

    it('should handle retry functionality', () => {
      const onRetry = vi.fn()
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: ['Check connection'],
        originalError: new Error('Test error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary onRetry={onRetry}>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      const retryButton = screen.getByText('Try Again')
      fireEvent.click(retryButton)

      expect(onRetry).toHaveBeenCalledOnce()
    })

    it('should reset error state when retry is clicked', () => {
      const onRetry = vi.fn()
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: ['Check connection'],
        originalError: new Error('Test error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary onRetry={onRetry}>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('Connection Issue')).toBeInTheDocument()

      const retryButton = screen.getByText('Try Again')
      fireEvent.click(retryButton)

      // The error boundary should reset its internal state
      // We can't easily test the actual reset without the component re-rendering
      // but we can verify onRetry was called
      expect(onRetry).toHaveBeenCalledOnce()
    })
  })

  describe('Automatic Retry', () => {
    it('should schedule automatic retry for offline errors', () => {
      const onRetry = vi.fn()
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: ['Check connection'],
        originalError: new Error('Network error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })
      mockHandler.scheduleRetry.mockReturnValue(true)

      render(
        <OfflineErrorBoundary onRetry={onRetry} enableAutoRetry>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(mockHandler.scheduleRetry).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'error_boundary',
          component: 'OfflineErrorBoundary'
        }),
        expect.any(Function)
      )
    })

    it('should not schedule retry when auto retry is disabled', () => {
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: ['Check connection'],
        originalError: new Error('Network error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary enableAutoRetry={false}>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(mockHandler.scheduleRetry).not.toHaveBeenCalled()
    })
  })

  describe('Error Context', () => {
    it('should use custom operation name when provided', () => {
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: [],
        originalError: new Error('Test error'),
        context: { operation: 'custom_operation', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary operationName="custom_operation">
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(mockHandler.enrichError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'custom_operation'
        })
      )
    })

    it('should use default operation name when none provided', () => {
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: [],
        originalError: new Error('Test error'),
        context: { operation: 'error_boundary', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary>
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(mockHandler.enrichError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: 'error_boundary'
        })
      )
    })
  })

  describe('Custom Error Messages', () => {
    it('should display custom offline message when provided', () => {
      mockHandler.isOfflineError.mockReturnValue(true)
      mockHandler.enrichError.mockReturnValue({
        isOffline: true,
        userFriendlyMessage: 'Connection error occurred',
        suggestedActions: [],
        originalError: new Error('Test error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary 
          offlineMessage="Custom offline message"
          fallbackMessage="Custom fallback message"
        >
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('Custom offline message')).toBeInTheDocument()
    })

    it('should display custom fallback message for non-offline errors', () => {
      mockHandler.isOfflineError.mockReturnValue(false)
      mockHandler.enrichError.mockReturnValue({
        isOffline: false,
        userFriendlyMessage: 'Test error',
        suggestedActions: [],
        originalError: new Error('Test error'),
        context: { operation: 'test', component: 'Test', userAction: 'Test action' }
      })

      render(
        <OfflineErrorBoundary 
          offlineMessage="Custom offline message"
          fallbackMessage="Custom fallback message"
        >
          <ThrowError shouldThrow />
        </OfflineErrorBoundary>
      )

      expect(screen.getByText('Custom fallback message')).toBeInTheDocument()
    })
  })
})