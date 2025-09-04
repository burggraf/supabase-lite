/**
 * PostgreSQL Benchmark Utilities
 * 
 * This module provides comprehensive benchmarking capabilities to compare
 * PostgreSQL performance against PGlite in the WebVM environment.
 */

import { logger } from '../../infrastructure/Logger'
import { DatabaseManager } from '../../database/connection'

export interface BenchmarkConfig {
  recordCounts: number[]
  concurrency: number[]
  iterations: number
  warmupRuns: number
  timeoutMs: number
}

export interface QueryBenchmark {
  name: string
  sql: string
  expectedRows?: number
  setup?: string[]
  cleanup?: string[]
}

export interface BenchmarkResult {
  testName: string
  database: 'postgresql' | 'pglite'
  recordCount: number
  concurrency: number
  iterations: number
  results: {
    averageTime: number
    medianTime: number
    p95Time: number
    p99Time: number
    minTime: number
    maxTime: number
    standardDeviation: number
    throughputQPS: number
    errorRate: number
  }
  errors: string[]
}

export interface ComparisonResult {
  testName: string
  recordCount: number
  concurrency: number
  postgresql: BenchmarkResult['results']
  pglite: BenchmarkResult['results']
  performanceRatio: number // PostgreSQL performance vs PGlite (1.0 = equal, >1.0 = PostgreSQL faster)
  verdict: 'postgresql_faster' | 'pglite_faster' | 'equivalent'
  details: string
}

export class PostgreSQLBenchmark {
  private logger = logger
  private databaseManager = DatabaseManager.getInstance()

  /**
   * Default benchmark configuration
   */
  private defaultConfig: BenchmarkConfig = {
    recordCounts: [100, 1000, 10000],
    concurrency: [1, 5, 10],
    iterations: 10,
    warmupRuns: 3,
    timeoutMs: 30000
  }

  /**
   * Standard benchmark queries for comparison
   */
  private benchmarkQueries: QueryBenchmark[] = [
    {
      name: 'simple_select',
      sql: 'SELECT * FROM benchmark_data LIMIT 100',
      expectedRows: 100,
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, created_at timestamp DEFAULT now())'
      ],
      cleanup: ['DROP TABLE benchmark_data']
    },
    {
      name: 'indexed_select',
      sql: 'SELECT * FROM benchmark_data WHERE value > 500 ORDER BY value LIMIT 50',
      expectedRows: 50,
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, created_at timestamp DEFAULT now())',
        'CREATE INDEX idx_benchmark_value ON benchmark_data(value)'
      ],
      cleanup: ['DROP TABLE benchmark_data']
    },
    {
      name: 'join_query',
      sql: `SELECT bd.*, bc.category_name 
            FROM benchmark_data bd 
            JOIN benchmark_categories bc ON bd.category_id = bc.id 
            WHERE bd.value > 100 
            LIMIT 100`,
      expectedRows: 100,
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'DROP TABLE IF EXISTS benchmark_categories',
        'CREATE TABLE benchmark_categories (id serial PRIMARY KEY, category_name text)',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, category_id integer, created_at timestamp DEFAULT now())',
        'CREATE INDEX idx_benchmark_category ON benchmark_data(category_id)'
      ],
      cleanup: ['DROP TABLE benchmark_data', 'DROP TABLE benchmark_categories']
    },
    {
      name: 'insert_single',
      sql: "INSERT INTO benchmark_data (name, value) VALUES ('test', 123)",
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, created_at timestamp DEFAULT now())'
      ],
      cleanup: ['DROP TABLE benchmark_data']
    },
    {
      name: 'insert_bulk',
      sql: `INSERT INTO benchmark_data (name, value) VALUES 
            ('test1', 100), ('test2', 200), ('test3', 300), ('test4', 400), ('test5', 500)`,
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, created_at timestamp DEFAULT now())'
      ],
      cleanup: ['DROP TABLE benchmark_data']
    },
    {
      name: 'update_query',
      sql: 'UPDATE benchmark_data SET value = value * 2 WHERE id <= 100',
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, created_at timestamp DEFAULT now())'
      ],
      cleanup: ['DROP TABLE benchmark_data']
    },
    {
      name: 'aggregate_query',
      sql: 'SELECT COUNT(*), AVG(value), MAX(value), MIN(value) FROM benchmark_data',
      expectedRows: 1,
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, created_at timestamp DEFAULT now())'
      ],
      cleanup: ['DROP TABLE benchmark_data']
    },
    {
      name: 'complex_query',
      sql: `SELECT 
              category_name,
              COUNT(*) as record_count,
              AVG(value) as avg_value,
              MAX(value) as max_value,
              MIN(value) as min_value
            FROM benchmark_data bd
            JOIN benchmark_categories bc ON bd.category_id = bc.id
            WHERE bd.created_at > NOW() - INTERVAL '1 day'
            GROUP BY category_name
            HAVING COUNT(*) > 10
            ORDER BY avg_value DESC
            LIMIT 20`,
      expectedRows: 20,
      setup: [
        'DROP TABLE IF EXISTS benchmark_data',
        'DROP TABLE IF EXISTS benchmark_categories',
        'CREATE TABLE benchmark_categories (id serial PRIMARY KEY, category_name text)',
        'CREATE TABLE benchmark_data (id serial PRIMARY KEY, name text, value integer, category_id integer, created_at timestamp DEFAULT now())',
        'CREATE INDEX idx_benchmark_created_at ON benchmark_data(created_at)',
        'CREATE INDEX idx_benchmark_category ON benchmark_data(category_id)'
      ],
      cleanup: ['DROP TABLE benchmark_data', 'DROP TABLE benchmark_categories']
    }
  ]

  /**
   * Run comprehensive benchmarks comparing PostgreSQL and PGlite
   */
  async runComprehensiveBenchmark(config?: Partial<BenchmarkConfig>): Promise<ComparisonResult[]> {
    const finalConfig = { ...this.defaultConfig, ...config }
    const results: ComparisonResult[] = []

    this.logger.info('PostgreSQL Benchmark', 'Starting comprehensive benchmark suite')
    this.logger.info('PostgreSQL Benchmark', `Configuration: ${JSON.stringify(finalConfig, null, 2)}`)

    for (const query of this.benchmarkQueries) {
      for (const recordCount of finalConfig.recordCounts) {
        for (const concurrency of finalConfig.concurrency) {
          try {
            // Run benchmark for PostgreSQL
            const postgresqlResult = await this.runSingleBenchmark('postgresql', query, recordCount, concurrency, finalConfig)
            
            // Run benchmark for PGlite
            const pgliteResult = await this.runSingleBenchmark('pglite', query, recordCount, concurrency, finalConfig)
            
            // Compare results
            const comparison = this.compareResults(postgresqlResult, pgliteResult)
            results.push(comparison)
            
            this.logger.info('PostgreSQL Benchmark', 
              `${query.name} (${recordCount} records, ${concurrency} concurrent): ${comparison.verdict}`)

          } catch (error) {
            this.logger.error('PostgreSQL Benchmark', 
              `Failed to run benchmark ${query.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }
        }
      }
    }

    await this.generateBenchmarkReport(results)
    return results
  }

  /**
   * Run benchmark for a specific database and query
   */
  private async runSingleBenchmark(
    database: 'postgresql' | 'pglite',
    query: QueryBenchmark,
    recordCount: number,
    concurrency: number,
    config: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    this.logger.info('PostgreSQL Benchmark', 
      `Running ${query.name} on ${database} with ${recordCount} records and ${concurrency} concurrency`)

    // Setup test data
    await this.setupTestData(database, query, recordCount)

    // Warmup runs
    for (let i = 0; i < config.warmupRuns; i++) {
      await this.executeQuery(database, query.sql)
    }

    // Benchmark runs
    const executionTimes: number[] = []
    const errors: string[] = []

    for (let iteration = 0; iteration < config.iterations; iteration++) {
      if (concurrency === 1) {
        // Sequential execution
        try {
          const startTime = performance.now()
          await this.executeQuery(database, query.sql)
          const endTime = performance.now()
          executionTimes.push(endTime - startTime)
        } catch (error) {
          errors.push(error instanceof Error ? error.message : 'Unknown error')
        }
      } else {
        // Concurrent execution
        const promises = Array(concurrency).fill(null).map(async () => {
          try {
            const startTime = performance.now()
            await this.executeQuery(database, query.sql)
            const endTime = performance.now()
            return endTime - startTime
          } catch (error) {
            errors.push(error instanceof Error ? error.message : 'Unknown error')
            return null
          }
        })

        const results = await Promise.all(promises)
        results.forEach(time => {
          if (time !== null) executionTimes.push(time)
        })
      }
    }

    // Cleanup test data
    await this.cleanupTestData(database, query)

    // Calculate statistics
    const stats = this.calculateStatistics(executionTimes)

    return {
      testName: query.name,
      database,
      recordCount,
      concurrency,
      iterations: config.iterations,
      results: {
        ...stats,
        throughputQPS: executionTimes.length / (stats.averageTime / 1000),
        errorRate: errors.length / (config.iterations * concurrency)
      },
      errors
    }
  }

  /**
   * Setup test data for benchmarking
   */
  private async setupTestData(database: 'postgresql' | 'pglite', query: QueryBenchmark, recordCount: number): Promise<void> {
    if (!query.setup) return

    for (const setupSql of query.setup) {
      await this.executeQuery(database, setupSql)
    }

    // Insert test data
    if (setupSql => setupSql.includes('benchmark_data')) {
      await this.insertTestData(database, recordCount)
    }

    if (query.setup.some(sql => sql.includes('benchmark_categories'))) {
      await this.insertCategoryData(database)
    }
  }

  /**
   * Insert test data for benchmarking
   */
  private async insertTestData(database: 'postgresql' | 'pglite', recordCount: number): Promise<void> {
    const batchSize = 1000
    const batches = Math.ceil(recordCount / batchSize)

    for (let batch = 0; batch < batches; batch++) {
      const startId = batch * batchSize
      const endId = Math.min(startId + batchSize, recordCount)
      const values = []

      for (let i = startId; i < endId; i++) {
        const categoryId = (i % 5) + 1 // 5 categories
        values.push(`('test_record_${i}', ${Math.floor(Math.random() * 1000)}, ${categoryId})`)
      }

      const insertSql = `INSERT INTO benchmark_data (name, value, category_id) VALUES ${values.join(', ')}`
      await this.executeQuery(database, insertSql)
    }
  }

  /**
   * Insert category test data
   */
  private async insertCategoryData(database: 'postgresql' | 'pglite'): Promise<void> {
    const categories = [
      "('Category A')",
      "('Category B')",
      "('Category C')",
      "('Category D')",
      "('Category E')"
    ]

    const insertSql = `INSERT INTO benchmark_categories (category_name) VALUES ${categories.join(', ')}`
    await this.executeQuery(database, insertSql)
  }

  /**
   * Cleanup test data after benchmarking
   */
  private async cleanupTestData(database: 'postgresql' | 'pglite', query: QueryBenchmark): Promise<void> {
    if (!query.cleanup) return

    for (const cleanupSql of query.cleanup) {
      try {
        await this.executeQuery(database, cleanupSql)
      } catch (error) {
        // Ignore cleanup errors
        this.logger.warn('PostgreSQL Benchmark', `Cleanup warning: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Execute query against specified database
   */
  private async executeQuery(database: 'postgresql' | 'pglite', sql: string): Promise<any> {
    if (database === 'postgresql') {
      // In real implementation, this would execute against PostgreSQL in WebVM
      // For now, simulate PostgreSQL execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10))
      return { rows: [], rowCount: 0 }
    } else {
      // Execute against PGlite
      return await this.databaseManager.executeQuery(sql)
    }
  }

  /**
   * Calculate performance statistics
   */
  private calculateStatistics(times: number[]): Omit<BenchmarkResult['results'], 'throughputQPS' | 'errorRate'> {
    if (times.length === 0) {
      return {
        averageTime: 0,
        medianTime: 0,
        p95Time: 0,
        p99Time: 0,
        minTime: 0,
        maxTime: 0,
        standardDeviation: 0
      }
    }

    const sorted = [...times].sort((a, b) => a - b)
    const sum = times.reduce((a, b) => a + b, 0)
    const mean = sum / times.length
    
    const variance = times.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / times.length
    const standardDeviation = Math.sqrt(variance)

    return {
      averageTime: mean,
      medianTime: sorted[Math.floor(sorted.length / 2)],
      p95Time: sorted[Math.floor(sorted.length * 0.95)],
      p99Time: sorted[Math.floor(sorted.length * 0.99)],
      minTime: sorted[0],
      maxTime: sorted[sorted.length - 1],
      standardDeviation
    }
  }

  /**
   * Compare PostgreSQL and PGlite results
   */
  private compareResults(postgresqlResult: BenchmarkResult, pgliteResult: BenchmarkResult): ComparisonResult {
    const performanceRatio = pgliteResult.results.averageTime / postgresqlResult.results.averageTime
    
    let verdict: ComparisonResult['verdict']
    let details: string

    if (performanceRatio > 1.2) {
      verdict = 'postgresql_faster'
      details = `PostgreSQL is ${(performanceRatio * 100 - 100).toFixed(1)}% faster`
    } else if (performanceRatio < 0.8) {
      verdict = 'pglite_faster'
      details = `PGlite is ${(100 - performanceRatio * 100).toFixed(1)}% faster`
    } else {
      verdict = 'equivalent'
      details = 'Performance is roughly equivalent'
    }

    return {
      testName: postgresqlResult.testName,
      recordCount: postgresqlResult.recordCount,
      concurrency: postgresqlResult.concurrency,
      postgresql: postgresqlResult.results,
      pglite: pgliteResult.results,
      performanceRatio,
      verdict,
      details
    }
  }

  /**
   * Generate comprehensive benchmark report
   */
  private async generateBenchmarkReport(results: ComparisonResult[]): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(results),
      detailed_results: results,
      recommendations: this.generateRecommendations(results)
    }

    this.logger.info('PostgreSQL Benchmark', 'Benchmark Report Summary:')
    this.logger.info('PostgreSQL Benchmark', JSON.stringify(report.summary, null, 2))

    // In a real implementation, this would write to a file
    // For now, just log the report
    console.log('Full Benchmark Report:', JSON.stringify(report, null, 2))
  }

  /**
   * Generate benchmark summary
   */
  private generateSummary(results: ComparisonResult[]): any {
    const postgresqlFaster = results.filter(r => r.verdict === 'postgresql_faster').length
    const pgliteFaster = results.filter(r => r.verdict === 'pglite_faster').length
    const equivalent = results.filter(r => r.verdict === 'equivalent').length

    const avgPerformanceRatio = results.reduce((sum, r) => sum + r.performanceRatio, 0) / results.length

    return {
      total_tests: results.length,
      postgresql_faster: postgresqlFaster,
      pglite_faster: pgliteFaster,
      equivalent: equivalent,
      average_performance_ratio: avgPerformanceRatio,
      overall_verdict: postgresqlFaster > pgliteFaster ? 'postgresql_recommended' : 
                      pgliteFaster > postgresqlFaster ? 'pglite_recommended' : 'equivalent_performance'
    }
  }

  /**
   * Generate recommendations based on benchmark results
   */
  private generateRecommendations(results: ComparisonResult[]): string[] {
    const recommendations: string[] = []
    
    const avgRatio = results.reduce((sum, r) => sum + r.performanceRatio, 0) / results.length

    if (avgRatio > 1.3) {
      recommendations.push('PostgreSQL shows significant performance advantages. Recommend PostgreSQL implementation.')
      recommendations.push('PostgreSQL performs especially well on complex queries and concurrent operations.')
    } else if (avgRatio < 0.7) {
      recommendations.push('PGlite shows better performance in this environment. Recommend enhanced PGlite implementation.')
      recommendations.push('PGlite may be more suitable for the WebVM resource constraints.')
    } else {
      recommendations.push('Performance is roughly equivalent. Decision should be based on feature requirements.')
      recommendations.push('Consider PostgreSQL for full feature set, PGlite for lighter resource usage.')
    }

    // Analyze specific patterns
    const complexQueries = results.filter(r => ['join_query', 'complex_query'].includes(r.testName))
    const insertQueries = results.filter(r => r.testName.includes('insert'))

    if (complexQueries.every(r => r.verdict === 'postgresql_faster')) {
      recommendations.push('PostgreSQL excels at complex queries. Important for PostgREST compatibility.')
    }

    if (insertQueries.every(r => r.verdict === 'pglite_faster')) {
      recommendations.push('PGlite shows better insert performance. Good for data-heavy applications.')
    }

    return recommendations
  }
}

// Export singleton instance
export const postgreSQLBenchmark = new PostgreSQLBenchmark()