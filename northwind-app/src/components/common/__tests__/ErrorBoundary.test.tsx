import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, withErrorBoundary, ErrorDisplay } from '../ErrorBoundary'

// Test component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Mock console.error to avoid noise in tests
const originalError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalError
})

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('should render error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/We encountered an unexpected error/)).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Go Home')).toBeInTheDocument()
  })

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()
    expect(screen.getByText(/Test error message/)).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should not show error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('should call custom error handler when provided', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('should use custom fallback when provided', () => {
    const fallback = (error: Error) => (
      <div>Custom error: {error.message}</div>
    )

    render(
      <ErrorBoundary fallback={fallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error: Test error message')).toBeInTheDocument()
  })

  it('should reset error state when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Try Again'))

    // Re-render with no error
    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should navigate to home when Go Home is clicked', () => {
    // Mock window.location
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByText('Go Home'))

    expect(window.location.href).toBe('/')

    // Restore original location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: false,
    })
  })
})

describe('withErrorBoundary', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = ({ shouldThrow }: { shouldThrow: boolean }) => (
      <ThrowError shouldThrow={shouldThrow} />
    )

    const WrappedComponent = withErrorBoundary(TestComponent)

    render(<WrappedComponent shouldThrow={false} />)
    expect(screen.getByText('No error')).toBeInTheDocument()

    render(<WrappedComponent shouldThrow={true} />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should pass through custom fallback and error handler', () => {
    const onError = vi.fn()
    const fallback = () => <div>HOC Custom fallback</div>

    const TestComponent = () => <ThrowError shouldThrow={true} />
    const WrappedComponent = withErrorBoundary(TestComponent, fallback, onError)

    render(<WrappedComponent />)

    expect(screen.getByText('HOC Custom fallback')).toBeInTheDocument()
    expect(onError).toHaveBeenCalled()
  })
})

describe('ErrorDisplay', () => {
  it('should display error message string', () => {
    render(<ErrorDisplay error="Something went wrong" />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should display error object message', () => {
    const error = new Error('Network connection failed')
    render(<ErrorDisplay error={error} />)

    expect(screen.getByText('Network connection failed')).toBeInTheDocument()
  })

  it('should show retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorDisplay error="Test error" onRetry={onRetry} />)

    const retryButton = screen.getByText('Retry')
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('should not show retry button when onRetry not provided', () => {
    render(<ErrorDisplay error="Test error" />)

    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <ErrorDisplay error="Test error" className="custom-error" />
    )

    const errorDiv = container.firstChild as HTMLElement
    expect(errorDiv).toHaveClass('custom-error')
  })

  it('should have proper error styling and icons', () => {
    render(<ErrorDisplay error="Test error" />)

    // Should have red color scheme
    const container = screen.getByText('Test error').closest('div')
    expect(container).toHaveClass('bg-red-50', 'border-red-200')

    // Should have alert icon
    expect(container?.querySelector('svg')).toBeInTheDocument()
  })
})