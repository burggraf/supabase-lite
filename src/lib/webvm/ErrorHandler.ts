import { logger as Logger } from '../infrastructure/Logger'
import { 
  WebVMError, 
  RuntimeNotFoundError, 
  RuntimeFailureError, 
  ProxyError,
  WebVMInitializationError 
} from './types'

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  jitter: boolean
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  resetTimeout: number
  monitoringPeriod: number
}

export interface TimeoutConfig {
  default: number
  proxy: number
  command: number
  startup: number
}

export interface ErrorHandlerConfig {
  retry: RetryConfig
  circuitBreaker: CircuitBreakerConfig
  timeouts: TimeoutConfig
  enableAutoRecovery: boolean
  maxConcurrentOperations: number
}

export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerStats {
  failures: number
  successes: number
  lastFailureTime: number
  state: CircuitBreakerState
  nextRetryTime: number
}

interface OperationMetrics {
  startTime: number
  operation: string
  instanceId?: string
}

/**
 * Comprehensive error handling and fallback logic for WebVM operations
 * Provides circuit breaker, retry logic, timeout control, and graceful degradation
 */
export class WebVMErrorHandler {
  private config: ErrorHandlerConfig
  private circuitBreakers = new Map<string, CircuitBreakerStats>()
  private activeOperations = new Map<string, OperationMetrics>()
  private healthChecks = new Map<string, number>()

  private static readonly DEFAULT_CONFIG: ErrorHandlerConfig = {
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000 // 1 minute
    },
    timeouts: {
      default: 30000, // 30 seconds
      proxy: 15000,   // 15 seconds for HTTP proxy
      command: 60000, // 1 minute for commands
      startup: 120000 // 2 minutes for startup
    },
    enableAutoRecovery: true,
    maxConcurrentOperations: 20
  }

  constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = { ...WebVMErrorHandler.DEFAULT_CONFIG, ...config }
    Logger.info('WebVM Error Handler initialized', { config: this.config })
    
    // Start background health monitoring
    this.startHealthMonitoring()
  }

  /**
   * Execute operation with comprehensive error handling
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: {
      name: string
      instanceId?: string
      timeout?: number
      retryable?: boolean
      circuitBreakerKey?: string
    }
  ): Promise<T> {
    const { name, instanceId, timeout, retryable = true, circuitBreakerKey } = context
    const operationId = this.generateOperationId()
    const timeoutMs = timeout || this.config.timeouts.default

    try {
      // Check concurrent operations limit
      this.checkConcurrentOperationsLimit()

      // Start operation tracking
      this.startOperation(operationId, name, instanceId)

      // Check circuit breaker
      const breakerKey = circuitBreakerKey || instanceId || 'global'
      this.checkCircuitBreaker(breakerKey)

      // Execute with timeout and retry logic
      const result = retryable 
        ? await this.executeWithRetry(operation, timeoutMs, breakerKey)
        : await this.executeWithTimeout(operation, timeoutMs)

      // Record success
      this.recordSuccess(breakerKey)
      
      return result
    } catch (error) {
      // Record failure
      const breakerKey = circuitBreakerKey || instanceId || 'global'
      this.recordFailure(breakerKey, error)
      
      throw this.enhanceError(error, context)
    } finally {
      // Clean up operation tracking
      this.endOperation(operationId)
    }
  }

  /**
   * Execute operation with timeout protection
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>, 
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new WebVMError(`Operation timed out after ${timeoutMs}ms`, 'TIMEOUT'))
      }, timeoutMs)

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer))
    })
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    circuitBreakerKey: string
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 1; attempt <= this.config.retry.maxAttempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(operation, timeoutMs)
        
        if (attempt > 1) {
          Logger.info('Operation succeeded after retry', { 
            attempt, 
            circuitBreakerKey 
          })
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        
        // Don't retry non-retryable errors
        if (this.isNonRetryableError(error)) {
          Logger.debug('Non-retryable error, not retrying', { error: error.message })
          throw error
        }

        // Don't retry on last attempt
        if (attempt === this.config.retry.maxAttempts) {
          Logger.error('All retry attempts exhausted', { 
            attempts: attempt, 
            error: error.message 
          })
          break
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt)
        
        Logger.warn('Operation failed, retrying', { 
          attempt, 
          maxAttempts: this.config.retry.maxAttempts,
          delay,
          error: error.message 
        })

        await this.sleep(delay)
      }
    }

    throw lastError
  }

  /**
   * Check if circuit breaker allows operation
   */
  private checkCircuitBreaker(key: string): void {
    const breaker = this.getCircuitBreaker(key)
    
    switch (breaker.state) {
      case 'open':
        if (Date.now() < breaker.nextRetryTime) {
          throw new WebVMError(
            `Circuit breaker is open for ${key}`,
            'CIRCUIT_BREAKER_OPEN',
            { nextRetryTime: breaker.nextRetryTime }
          )
        }
        // Transition to half-open
        breaker.state = 'half-open'
        Logger.info('Circuit breaker transitioning to half-open', { key })
        break
        
      case 'half-open':
        // Allow limited requests through
        break
        
      case 'closed':
        // Normal operation
        break
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(key: string): void {
    const breaker = this.getCircuitBreaker(key)
    breaker.successes++
    
    if (breaker.state === 'half-open') {
      // Reset circuit breaker after successful operation
      breaker.state = 'closed'
      breaker.failures = 0
      Logger.info('Circuit breaker closed after successful operation', { key })
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(key: string, error: any): void {
    const breaker = this.getCircuitBreaker(key)
    breaker.failures++
    breaker.lastFailureTime = Date.now()
    
    // Open circuit breaker if failure threshold exceeded
    if (breaker.failures >= this.config.circuitBreaker.failureThreshold && 
        breaker.state === 'closed') {
      breaker.state = 'open'
      breaker.nextRetryTime = Date.now() + this.config.circuitBreaker.resetTimeout
      
      Logger.warn('Circuit breaker opened due to failures', { 
        key, 
        failures: breaker.failures,
        threshold: this.config.circuitBreaker.failureThreshold,
        nextRetryTime: breaker.nextRetryTime
      })
    }
  }

  /**
   * Get or create circuit breaker for key
   */
  private getCircuitBreaker(key: string): CircuitBreakerStats {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        failures: 0,
        successes: 0,
        lastFailureTime: 0,
        state: 'closed',
        nextRetryTime: 0
      })
    }
    return this.circuitBreakers.get(key)!
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.config.retry.baseDelay * Math.pow(this.config.retry.backoffMultiplier, attempt - 1),
      this.config.retry.maxDelay
    )

    if (!this.config.retry.jitter) {
      return exponentialDelay
    }

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 // Up to 30% jitter
    return Math.floor(exponentialDelay * (1 + jitter))
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    if (error instanceof WebVMInitializationError) return true
    if (error instanceof RuntimeNotFoundError) return true
    
    // HTTP errors that shouldn't be retried
    if (error instanceof ProxyError) {
      const status = error.context?.status
      if (status && (status >= 400 && status < 500 && status !== 429)) {
        return true // Client errors (except rate limiting)
      }
    }

    return false
  }

  /**
   * Enhance error with additional context
   */
  private enhanceError(error: any, context: any): Error {
    if (error instanceof WebVMError) {
      return error
    }

    const enhanced = new WebVMError(
      error.message || 'Unknown WebVM error',
      'OPERATION_FAILED',
      { 
        originalError: error,
        context,
        timestamp: new Date().toISOString()
      }
    )

    enhanced.stack = error.stack
    return enhanced
  }

  /**
   * Check concurrent operations limit
   */
  private checkConcurrentOperationsLimit(): void {
    if (this.activeOperations.size >= this.config.maxConcurrentOperations) {
      throw new WebVMError(
        `Maximum concurrent operations limit exceeded (${this.config.maxConcurrentOperations})`,
        'RATE_LIMITED'
      )
    }
  }

  /**
   * Start operation tracking
   */
  private startOperation(operationId: string, operation: string, instanceId?: string): void {
    this.activeOperations.set(operationId, {
      startTime: Date.now(),
      operation,
      instanceId
    })
  }

  /**
   * End operation tracking
   */
  private endOperation(operationId: string): void {
    const metrics = this.activeOperations.get(operationId)
    if (metrics) {
      const duration = Date.now() - metrics.startTime
      Logger.debug('Operation completed', {
        operation: metrics.operation,
        instanceId: metrics.instanceId,
        duration
      })
      this.activeOperations.delete(operationId)
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Start background health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthChecks()
      this.cleanupStaleOperations()
      this.resetCircuitBreakerStats()
    }, this.config.circuitBreaker.monitoringPeriod)
  }

  /**
   * Perform health checks and attempt recovery
   */
  private performHealthChecks(): void {
    if (!this.config.enableAutoRecovery) return

    // Check for stale operations
    const now = Date.now()
    const staleOperations = Array.from(this.activeOperations.entries())
      .filter(([_, metrics]) => now - metrics.startTime > this.config.timeouts.default * 2)

    if (staleOperations.length > 0) {
      Logger.warn('Detected stale operations', { 
        count: staleOperations.length,
        operations: staleOperations.map(([id, metrics]) => ({
          id, 
          operation: metrics.operation,
          age: now - metrics.startTime
        }))
      })
    }
  }

  /**
   * Clean up stale operations
   */
  private cleanupStaleOperations(): void {
    const now = Date.now()
    const maxAge = this.config.timeouts.default * 3 // 3x timeout

    for (const [operationId, metrics] of this.activeOperations.entries()) {
      if (now - metrics.startTime > maxAge) {
        Logger.warn('Cleaning up stale operation', {
          operationId,
          operation: metrics.operation,
          age: now - metrics.startTime
        })
        this.activeOperations.delete(operationId)
      }
    }
  }

  /**
   * Reset circuit breaker statistics periodically
   */
  private resetCircuitBreakerStats(): void {
    const now = Date.now()
    const resetPeriod = this.config.circuitBreaker.monitoringPeriod * 2

    for (const [key, breaker] of this.circuitBreakers.entries()) {
      // Reset stats for closed circuit breakers after monitoring period
      if (breaker.state === 'closed' && 
          now - breaker.lastFailureTime > resetPeriod) {
        breaker.failures = 0
        breaker.successes = 0
      }
    }
  }

  /**
   * Get current system metrics
   */
  getMetrics(): {
    activeOperations: number
    circuitBreakers: Array<{
      key: string
      state: CircuitBreakerState
      failures: number
      successes: number
    }>
  } {
    return {
      activeOperations: this.activeOperations.size,
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([key, breaker]) => ({
        key,
        state: breaker.state,
        failures: breaker.failures,
        successes: breaker.successes
      }))
    }
  }

  /**
   * Reset circuit breaker for specific key
   */
  resetCircuitBreaker(key: string): void {
    const breaker = this.circuitBreakers.get(key)
    if (breaker) {
      breaker.state = 'closed'
      breaker.failures = 0
      breaker.successes = 0
      breaker.nextRetryTime = 0
      Logger.info('Circuit breaker manually reset', { key })
    }
  }

  /**
   * Clean up resources
   */
  shutdown(): void {
    this.circuitBreakers.clear()
    this.activeOperations.clear()
    this.healthChecks.clear()
    Logger.info('WebVM Error Handler shutdown completed')
  }
}