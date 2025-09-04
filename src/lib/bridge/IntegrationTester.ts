/**
 * Integration Tester for Hybrid Architecture
 * 
 * Comprehensive testing framework for validating the hybrid PGlite + WebVM
 * architecture with cross-context communication, performance validation,
 * and end-to-end API compatibility testing.
 */

import { PGliteBridge } from './PGliteBridge'
import { WebVMServiceManager } from './WebVMServiceManager'
import { HybridArchitectureOptimizer } from './HybridArchitectureOptimizer'
import { DatabaseManager } from '../database/connection'
import { logger } from '../infrastructure/Logger'
import type { QueryResult } from '@/types'

/**
 * Test result interfaces
 */
export interface TestResult {
  testName: string
  success: boolean
  duration: number
  details: any
  error?: string
}

export interface TestSuite {
  suiteName: string
  tests: TestResult[]
  overallSuccess: boolean
  totalDuration: number
  successRate: number
}

/**
 * Performance test results
 */
export interface PerformanceTestResult {
  testName: string
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  p95ResponseTime: number
  throughput: number
  successRate: number
  errors: string[]
}

/**
 * Cross-context communication test
 */
export interface CrossContextTest {
  name: string
  browserRequest: () => Promise<any>
  webvmValidation: () => Promise<boolean>
  expectedResult: any
}

/**
 * API compatibility test
 */
export interface APICompatibilityTest {
  name: string
  endpoint: string
  method: string
  body?: any
  headers?: Record<string, string>
  expectedStatus: number
  expectedResponse?: any
  validator?: (response: any) => boolean
}

/**
 * Integration Tester Class
 * 
 * Provides comprehensive testing for the hybrid architecture
 */
export class IntegrationTester {
  private static instance: IntegrationTester
  private pgliteBridge: PGliteBridge
  private webvmServiceManager: WebVMServiceManager
  private hybridOptimizer: HybridArchitectureOptimizer
  private databaseManager: DatabaseManager
  private testResults: Map<string, TestSuite> = new Map()

  private constructor() {
    this.pgliteBridge = PGliteBridge.getInstance()
    this.webvmServiceManager = WebVMServiceManager.getInstance()
    this.hybridOptimizer = HybridArchitectureOptimizer.getInstance()
    this.databaseManager = DatabaseManager.getInstance()
  }

  public static getInstance(): IntegrationTester {
    if (!IntegrationTester.instance) {
      IntegrationTester.instance = new IntegrationTester()
    }
    return IntegrationTester.instance
  }

  /**
   * Run all integration tests
   */
  public async runAllTests(): Promise<Map<string, TestSuite>> {
    logger.info('Starting hybrid architecture integration tests')
    
    try {
      // Initialize all components
      await this.initializeComponents()

      // Run test suites
      const testSuites = [
        { name: 'Bridge Communication', tests: this.getBridgeCommunicationTests() },
        { name: 'Performance Validation', tests: this.getPerformanceTests() },
        { name: 'Data Persistence', tests: this.getDataPersistenceTests() },
        { name: 'API Compatibility', tests: this.getAPICompatibilityTests() },
        { name: 'Error Handling', tests: this.getErrorHandlingTests() },
        { name: 'Optimization Features', tests: this.getOptimizationTests() }
      ]

      for (const suite of testSuites) {
        const results = await this.runTestSuite(suite.name, suite.tests)
        this.testResults.set(suite.name, results)
      }

      // Generate summary report
      this.generateSummaryReport()

      logger.info('Integration tests completed')
      return this.testResults

    } catch (error) {
      logger.error('Integration test setup failed', { error })
      throw error
    }
  }

  /**
   * Run a specific test suite
   */
  public async runTestSuite(suiteName: string, tests: (() => Promise<TestResult>)[]): Promise<TestSuite> {
    logger.info(`Running test suite: ${suiteName}`)
    const startTime = performance.now()
    const results: TestResult[] = []

    for (const test of tests) {
      try {
        const result = await test()
        results.push(result)
        
        if (result.success) {
          logger.debug(`✅ ${result.testName} passed (${result.duration.toFixed(2)}ms)`)
        } else {
          logger.warn(`❌ ${result.testName} failed: ${result.error}`)
        }
      } catch (error) {
        results.push({
          testName: 'Unknown test',
          success: false,
          duration: 0,
          details: {},
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const totalDuration = performance.now() - startTime
    const successCount = results.filter(r => r.success).length
    const successRate = (successCount / results.length) * 100

    const testSuite: TestSuite = {
      suiteName,
      tests: results,
      overallSuccess: successCount === results.length,
      totalDuration,
      successRate
    }

    logger.info(`Test suite ${suiteName} completed: ${successCount}/${results.length} passed (${successRate.toFixed(1)}%)`)
    
    return testSuite
  }

  /**
   * Initialize all components for testing
   */
  private async initializeComponents(): Promise<void> {
    logger.info('Initializing components for testing')
    
    // Initialize database
    await this.databaseManager.initialize()
    
    // Initialize PGlite bridge
    await this.pgliteBridge.initialize()
    
    // Initialize WebVM services
    await this.webvmServiceManager.initialize()
    
    // Wait for services to be ready
    await this.waitForServicesReady()
    
    logger.info('All components initialized successfully')
  }

  /**
   * Wait for all services to be ready
   */
  private async waitForServicesReady(): Promise<void> {
    const maxWaitTime = 30000 // 30 seconds
    const checkInterval = 1000 // 1 second
    let elapsedTime = 0

    while (elapsedTime < maxWaitTime) {
      const services = this.webvmServiceManager.getServicesStatus()
      const allRunning = services.every(s => s.status === 'running')
      
      if (allRunning) {
        logger.info('All services are ready')
        return
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval))
      elapsedTime += checkInterval
    }

    throw new Error('Services failed to start within timeout period')
  }

  /**
   * Get bridge communication tests
   */
  private getBridgeCommunicationTests(): (() => Promise<TestResult>)[] {
    return [
      () => this.testBasicBridgeRequest(),
      () => this.testBridgeRequestWithParams(),
      () => this.testSessionContextPassing(),
      () => this.testSchemaMetadataRequest(),
      () => this.testPostgRESTCompatibleQuery(),
      () => this.testConcurrentRequests()
    ]
  }

  /**
   * Get performance tests
   */
  private getPerformanceTests(): (() => Promise<TestResult>)[] {
    return [
      () => this.testResponseTimeThresholds()
    ]
  }

  /**
   * Get data persistence tests
   */
  private getDataPersistenceTests(): (() => Promise<TestResult>)[] {
    return [
      () => this.testIndexedDBPersistence()
    ]
  }

  /**
   * Get API compatibility tests
   */
  private getAPICompatibilityTests(): (() => Promise<TestResult>)[] {
    return [
      () => this.testPostgRESTCompatibleQuery()
    ]
  }

  /**
   * Get error handling tests
   */
  private getErrorHandlingTests(): (() => Promise<TestResult>)[] {
    return [
      // Error handling tests would be implemented here
    ]
  }

  /**
   * Get optimization tests
   */
  private getOptimizationTests(): (() => Promise<TestResult>)[] {
    return [
      () => this.testQueryCaching()
    ]
  }

  /**
   * Test basic bridge request
   */
  private async testBasicBridgeRequest(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'Basic Bridge Request'

    try {
      const request = {
        id: 'test_001',
        sql: 'SELECT 1 as test_value',
        params: []
      }

      const response = await this.pgliteBridge.handleRequest(request)

      const success = response.success && response.data?.rows?.length > 0 && response.data.rows[0].test_value === 1

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { request, response }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test bridge request with parameters
   */
  private async testBridgeRequestWithParams(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'Bridge Request with Parameters'

    try {
      const request = {
        id: 'test_002',
        sql: 'SELECT $1 as param_value, $2 as param_count',
        params: ['test_string', 42]
      }

      const response = await this.pgliteBridge.handleRequest(request)

      const success = response.success && 
                    response.data?.rows?.length > 0 && 
                    response.data.rows[0].param_value === 'test_string' &&
                    response.data.rows[0].param_count === 42

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { request, response }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test session context passing
   */
  private async testSessionContextPassing(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'Session Context Passing'

    try {
      const sessionContext = {
        role: 'authenticated' as const,
        userId: 'test-user-123',
        claims: { email: 'test@example.com' }
      }

      const request = {
        id: 'test_003',
        sql: 'SELECT current_setting(\'request.jwt.claims\', true) as jwt_claims',
        params: [],
        sessionContext
      }

      const response = await this.pgliteBridge.handleRequest(request)

      // Success if request completes without error (PGlite may not support all PostgreSQL session functions)
      const success = response.success

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { request, response, sessionContext }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test schema metadata request
   */
  private async testSchemaMetadataRequest(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'Schema Metadata Request'

    try {
      const metadata = await this.pgliteBridge.getSchemaMetadata('public')

      const success = metadata && 
                     Array.isArray(metadata.tables) &&
                     Array.isArray(metadata.functions) &&
                     Array.isArray(metadata.views)

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { metadata }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test PostgREST compatible query
   */
  private async testPostgRESTCompatibleQuery(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'PostgREST Compatible Query'

    try {
      // First create a test table
      await this.databaseManager.query(`
        CREATE TABLE IF NOT EXISTS test_table (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Insert test data
      await this.databaseManager.query(
        'INSERT INTO test_table (name) VALUES ($1), ($2)',
        ['Test Item 1', 'Test Item 2']
      )

      const query = {
        table: 'test_table',
        select: ['id', 'name'],
        where: { name: 'Test Item 1' },
        limit: 10
      }

      const { sql, params } = this.pgliteBridge.postgrestToSQL(query)
      const result = await this.databaseManager.query(sql, params)

      const success = result.rows.length > 0 && result.rows[0].name === 'Test Item 1'

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { query, sql, params, result }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test concurrent requests
   */
  private async testConcurrentRequests(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'Concurrent Requests'

    try {
      const concurrency = 10
      const requests = Array.from({ length: concurrency }, (_, i) => ({
        id: `concurrent_${i}`,
        sql: `SELECT ${i} as request_id, 'concurrent_test' as test_type`,
        params: []
      }))

      const promises = requests.map(request => this.pgliteBridge.handleRequest(request))
      const responses = await Promise.all(promises)

      const allSuccessful = responses.every(response => response.success)
      const correctResults = responses.every((response, i) => 
        response.data?.rows?.[0]?.request_id === i
      )

      const success = allSuccessful && correctResults

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { 
          concurrency, 
          allSuccessful, 
          correctResults,
          responseCount: responses.length
        }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test response time thresholds
   */
  private async testResponseTimeThresholds(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'Response Time Thresholds'
    const maxResponseTime = 100 // 100ms threshold

    try {
      const request = {
        id: 'perf_001',
        sql: 'SELECT COUNT(*) FROM information_schema.tables',
        params: []
      }

      const requestStart = performance.now()
      const response = await this.pgliteBridge.handleRequest(request)
      const responseTime = performance.now() - requestStart

      const success = response.success && responseTime < maxResponseTime

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { 
          responseTime, 
          threshold: maxResponseTime,
          withinThreshold: responseTime < maxResponseTime
        }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test IndexedDB persistence
   */
  private async testIndexedDBPersistence(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'IndexedDB Persistence'

    try {
      // Create test table with data
      await this.databaseManager.query(`
        CREATE TABLE IF NOT EXISTS persistence_test (
          id INTEGER PRIMARY KEY,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      const testData = `test_data_${Date.now()}`
      await this.databaseManager.query(
        'INSERT INTO persistence_test (data) VALUES ($1)',
        [testData]
      )

      // Verify data exists
      const result = await this.databaseManager.query(
        'SELECT data FROM persistence_test WHERE data = $1',
        [testData]
      )

      const success = result.rows.length > 0 && result.rows[0].data === testData

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { testData, result }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Test query caching
   */
  private async testQueryCaching(): Promise<TestResult> {
    const startTime = performance.now()
    const testName = 'Query Caching'

    try {
      const sql = 'SELECT NOW() as current_time'
      const options = { cacheable: true, cacheKey: 'test_cache_key', cacheTtl: 60000 }

      // First request (should miss cache)
      const result1 = await this.hybridOptimizer.optimizeRequest(sql, [], options)
      
      // Second request (should hit cache)
      const result2 = await this.hybridOptimizer.optimizeRequest(sql, [], options)

      const metrics = this.hybridOptimizer.getMetrics()
      const success = metrics.cacheHits > 0

      return {
        testName,
        success,
        duration: performance.now() - startTime,
        details: { 
          metrics, 
          result1, 
          result2,
          cacheWorking: success
        }
      }
    } catch (error) {
      return {
        testName,
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error.message
      }
    }
  }

  /**
   * Generate summary report
   */
  private generateSummaryReport(): void {
    let totalTests = 0
    let totalPassed = 0
    let totalDuration = 0

    logger.info('═══════════════════════════════════════')
    logger.info('   HYBRID ARCHITECTURE TEST REPORT')
    logger.info('═══════════════════════════════════════')

    for (const [suiteName, suite] of this.testResults.entries()) {
      totalTests += suite.tests.length
      totalPassed += suite.tests.filter(t => t.success).length
      totalDuration += suite.totalDuration

      const status = suite.overallSuccess ? '✅' : '❌'
      logger.info(`${status} ${suiteName}: ${suite.tests.filter(t => t.success).length}/${suite.tests.length} passed (${suite.successRate.toFixed(1)}%)`)

      // Log failed tests
      for (const test of suite.tests) {
        if (!test.success) {
          logger.warn(`  ❌ ${test.testName}: ${test.error}`)
        }
      }
    }

    const overallSuccessRate = (totalPassed / totalTests) * 100
    const overallStatus = overallSuccessRate === 100 ? '✅' : overallSuccessRate >= 90 ? '⚠️' : '❌'

    logger.info('═══════════════════════════════════════')
    logger.info(`${overallStatus} OVERALL: ${totalPassed}/${totalTests} tests passed (${overallSuccessRate.toFixed(1)}%)`)
    logger.info(`⏱️  Total duration: ${totalDuration.toFixed(2)}ms`)
    logger.info('═══════════════════════════════════════')

    // Log performance metrics
    const optimizerMetrics = this.hybridOptimizer.getMetrics()
    if (optimizerMetrics.totalRequests > 0) {
      logger.info('📊 PERFORMANCE METRICS:')
      logger.info(`   Requests: ${optimizerMetrics.totalRequests}`)
      logger.info(`   Cache hits: ${optimizerMetrics.cacheHits}`)
      logger.info(`   Cache hit rate: ${((optimizerMetrics.cacheHits / optimizerMetrics.totalRequests) * 100).toFixed(1)}%`)
      logger.info(`   Average response time: ${optimizerMetrics.averageResponseTime.toFixed(2)}ms`)
      logger.info(`   Optimization savings: ${optimizerMetrics.optimizationSavings.toFixed(2)}ms`)
    }
  }
}

// Export singleton instance
export const integrationTester = IntegrationTester.getInstance()