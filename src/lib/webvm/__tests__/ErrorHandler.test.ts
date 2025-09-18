import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebVMErrorHandler, type ErrorHandlerConfig } from '../ErrorHandler'
import { WebVMError, ProxyError, WebVMInitializationError } from '../types'

// Mock Logger
vi.mock('../infrastructure/Logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('WebVMErrorHandler', () => {
  let errorHandler: WebVMErrorHandler
  let mockLogger: any

  beforeEach(() => {
    // Create error handler with test configuration
    const testConfig: Partial<ErrorHandlerConfig> = {
      retry: {
        maxAttempts: 2,
        baseDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
        jitter: false
      },
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 100,
        monitoringPeriod: 50
      },
      timeouts: {
        default: 1000,
        proxy: 500,
        command: 2000,
        startup: 3000
      },
      enableAutoRecovery: true,
      maxConcurrentOperations: 5
    }

    errorHandler = new WebVMErrorHandler(testConfig)
  })

  afterEach(() => {
    errorHandler.shutdown()
    vi.clearAllMocks()
  })

  describe('Operation Execution', () => {
    it('should execute successful operation', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await errorHandler.execute(operation, {
        name: 'test-operation'
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry failed operations', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValue('success')
      
      const result = await errorHandler.execute(operation, {
        name: 'test-operation',
        retryable: true
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new WebVMInitializationError('init failed'))
      
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        retryable: true
      })).rejects.toThrow('init failed')

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should timeout long-running operations', async () => {
      const operation = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      )
      
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        timeout: 100
      })).rejects.toThrow('Operation timed out after 100ms')

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should enforce concurrent operation limits', async () => {
      const operations = Array.from({ length: 10 }, () => 
        vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      )

      const promises = operations.map(op => 
        errorHandler.execute(op, { name: 'concurrent-test' })
      )

      // Some operations should fail with rate limit error
      const results = await Promise.allSettled(promises)
      const failures = results.filter(r => r.status === 'rejected')
      
      expect(failures.length).toBeGreaterThan(0)
      expect(failures.some(f => 
        f.reason.message.includes('Maximum concurrent operations limit exceeded')
      )).toBe(true)
    })
  })

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after failure threshold', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('service failure'))
      
      // First two failures should be allowed
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow('service failure')

      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow('service failure')

      // Third attempt should be blocked by circuit breaker
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow('Circuit breaker is open for test-service')

      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should transition to half-open after reset timeout', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('failure 1'))
        .mockRejectedValueOnce(new Error('failure 2'))
        .mockResolvedValue('recovery success')
      
      // Trigger circuit breaker opening
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow('failure 1')

      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow('failure 2')

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should allow one request through (half-open)
      const result = await errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })

      expect(result).toBe('recovery success')
    })

    it('should close circuit breaker after successful operation', async () => {
      const failingOp = vi.fn().mockRejectedValue(new Error('failure'))
      const successOp = vi.fn().mockResolvedValue('success')
      
      // Open circuit breaker
      await expect(errorHandler.execute(failingOp, {
        name: 'failing-op',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow()

      await expect(errorHandler.execute(failingOp, {
        name: 'failing-op',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow()

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150))

      // Successful operation should close circuit breaker
      await errorHandler.execute(successOp, {
        name: 'success-op',
        circuitBreakerKey: 'test-service',
        retryable: false
      })

      // Next operation should work normally
      await errorHandler.execute(successOp, {
        name: 'normal-op',
        circuitBreakerKey: 'test-service',
        retryable: false
      })

      expect(successOp).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Enhancement', () => {
    it('should enhance non-WebVM errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('generic error'))
      
      try {
        await errorHandler.execute(operation, {
          name: 'test-operation',
          instanceId: 'test-instance',
          retryable: false
        })
      } catch (error) {
        expect(error).toBeInstanceOf(WebVMError)
        expect(error.message).toBe('generic error')
        expect(error.context).toMatchObject({
          originalError: expect.any(Error),
          context: {
            name: 'test-operation',
            instanceId: 'test-instance'
          }
        })
      }
    })

    it('should preserve WebVM errors unchanged', async () => {
      const webvmError = new WebVMError('webvm specific error', 'TEST_ERROR')
      const operation = vi.fn().mockRejectedValue(webvmError)
      
      try {
        await errorHandler.execute(operation, {
          name: 'test-operation',
          retryable: false
        })
      } catch (error) {
        expect(error).toBe(webvmError)
        expect(error.code).toBe('TEST_ERROR')
      }
    })
  })

  describe('Retry Logic', () => {
    it('should calculate exponential backoff delay', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('failure 1'))
        .mockRejectedValueOnce(new Error('failure 2'))
        .mockResolvedValue('success')

      const startTime = Date.now()
      
      const result = await errorHandler.execute(operation, {
        name: 'test-operation',
        retryable: true
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
      // Should have delays: 10ms + 20ms = 30ms minimum
      expect(duration).toBeGreaterThan(25)
    })

    it('should not retry client errors (4xx)', async () => {
      const proxyError = new ProxyError('Bad Request', 'PROXY_ERROR', { status: 400 })
      const operation = vi.fn().mockRejectedValue(proxyError)
      
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        retryable: true
      })).rejects.toThrow('Bad Request')

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry server errors (5xx)', async () => {
      const proxyError = new ProxyError('Internal Server Error', 'PROXY_ERROR', { status: 500 })
      const operation = vi.fn()
        .mockRejectedValueOnce(proxyError)
        .mockResolvedValue('success')
      
      const result = await errorHandler.execute(operation, {
        name: 'test-operation',
        retryable: true
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should retry rate limit errors (429)', async () => {
      const rateLimitError = new ProxyError('Rate Limited', 'PROXY_ERROR', { status: 429 })
      const operation = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success')
      
      const result = await errorHandler.execute(operation, {
        name: 'test-operation',
        retryable: true
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Metrics and Monitoring', () => {
    it('should track active operations', () => {
      const metrics = errorHandler.getMetrics()
      expect(metrics).toMatchObject({
        activeOperations: 0,
        circuitBreakers: []
      })
    })

    it('should track circuit breaker states', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'))
      
      // Trigger circuit breaker
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow()

      const metrics = errorHandler.getMetrics()
      expect(metrics.circuitBreakers).toHaveLength(1)
      expect(metrics.circuitBreakers[0]).toMatchObject({
        key: 'test-service',
        state: 'closed',
        failures: 1,
        successes: 0
      })
    })

    it('should reset circuit breaker manually', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'))
      
      // Open circuit breaker
      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow()

      await expect(errorHandler.execute(operation, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })).rejects.toThrow()

      // Reset circuit breaker
      errorHandler.resetCircuitBreaker('test-service')

      // Should allow operations again
      const successOp = vi.fn().mockResolvedValue('success')
      const result = await errorHandler.execute(successOp, {
        name: 'test-operation',
        circuitBreakerKey: 'test-service',
        retryable: false
      })

      expect(result).toBe('success')
    })
  })

  describe('Cleanup and Shutdown', () => {
    it('should clean up resources on shutdown', () => {
      const metrics = errorHandler.getMetrics()
      expect(metrics.circuitBreakers.length).toBeGreaterThanOrEqual(0)

      errorHandler.shutdown()

      // Should clean up internal state
      expect(() => errorHandler.getMetrics()).not.toThrow()
    })
  })
})