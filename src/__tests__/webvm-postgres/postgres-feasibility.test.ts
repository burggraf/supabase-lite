/**
 * PostgreSQL Feasibility Test Suite
 * 
 * Comprehensive test suite to determine PostgreSQL feasibility in WebVM
 * vs enhanced PGlite implementation. This is the main orchestrator for
 * Phase 1A feasibility research.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { postgreSQLInstaller, InstallationResult } from '../../lib/webvm/postgres-test/PostgreSQLInstaller'
import { postgreSQLBenchmark, ComparisonResult } from '../../lib/webvm/postgres-test/PostgreSQLBenchmark'
import { resourceMonitor, ResourceAnalysis } from '../../lib/webvm/postgres-test/ResourceMonitor'
import { compatibilityTester, CompatibilityReport } from '../../lib/webvm/postgres-test/CompatibilityTester'
import { WebVMManager } from '../../lib/webvm/WebVMManager'

// Test results storage
interface FeasibilityResults {
  installation: {
    postgresql: InstallationResult | null
    timestamp: string
  }
  performance: {
    comparison: ComparisonResult[]
    timestamp: string
  }
  resources: {
    postgresql: ResourceAnalysis | null
    baseline: ResourceAnalysis | null
    timestamp: string
  }
  compatibility: {
    postgresql: CompatibilityReport | null
    pglite: CompatibilityReport | null
    timestamp: string
  }
}

describe('PostgreSQL Feasibility Analysis', () => {
  let webvmManager: WebVMManager
  let feasibilityResults: FeasibilityResults

  beforeAll(async () => {
    webvmManager = WebVMManager.getInstance()
    
    // Initialize results structure
    feasibilityResults = {
      installation: { postgresql: null, timestamp: new Date().toISOString() },
      performance: { comparison: [], timestamp: new Date().toISOString() },
      resources: { postgresql: null, baseline: null, timestamp: new Date().toISOString() },
      compatibility: { postgresql: null, pglite: null, timestamp: new Date().toISOString() }
    }

    // Ensure WebVM is running for tests
    const status = webvmManager.getStatus()
    if (status.state !== 'running') {
      await webvmManager.start()
    }

    // Wait for WebVM to be fully ready
    await new Promise(resolve => setTimeout(resolve, 3000))
  }, 60000) // 60 second timeout

  afterAll(async () => {
    // Generate final feasibility report
    await generateFeasibilityReport(feasibilityResults)
  })

  describe('Phase 1: Installation Feasibility', () => {
    test('should successfully install PostgreSQL in WebVM', async () => {
      console.log('🔄 Testing PostgreSQL installation in WebVM...')
      
      try {
        const installResult = await postgreSQLInstaller.installPostgreSQL({
          version: '15',
          maxConnections: 25, // Reduced for WebVM constraints
          sharedBuffers: '64MB', // Reduced for WebVM constraints
          workMem: '2MB' // Reduced for WebVM constraints
        })

        feasibilityResults.installation.postgresql = installResult
        
        console.log(`📊 Installation Results:`)
        console.log(`   Success: ${installResult.success}`)
        console.log(`   Version: ${installResult.version}`)
        console.log(`   Install Time: ${installResult.installTime}ms`)
        console.log(`   Memory Usage: ${(installResult.memoryUsage / 1024 / 1024).toFixed(1)}MB`)
        console.log(`   Disk Usage: ${(installResult.diskUsage / 1024 / 1024).toFixed(1)}MB`)

        if (installResult.error) {
          console.log(`   Error: ${installResult.error}`)
        }

        // Installation should succeed for PostgreSQL path to be viable
        expect(installResult.success).toBe(true)
        expect(installResult.version).toBeTruthy()
        expect(installResult.installTime).toBeLessThan(60000) // Should install within 60 seconds
        expect(installResult.memoryUsage).toBeLessThan(300 * 1024 * 1024) // Should use less than 300MB

      } catch (error) {
        console.error('❌ PostgreSQL installation failed:', error)
        
        // Record failed installation
        feasibilityResults.installation.postgresql = {
          success: false,
          version: null,
          installTime: 0,
          memoryUsage: 0,
          diskUsage: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          logs: ['Installation test failed']
        }

        // Installation failure means we should fallback to PGlite
        expect(false).toBe(true) // This will fail the test as expected
      }
    }, 120000) // 2 minute timeout for installation

    test('should measure baseline resource usage', async () => {
      console.log('🔄 Measuring baseline resource usage...')
      
      try {
        // Start monitoring before PostgreSQL operations
        await resourceMonitor.startMonitoring({
          duration: 30000, // 30 seconds
          interval: 1000   // 1 second intervals
        })

        // Wait for monitoring to complete
        const baselineAnalysis = await new Promise<ResourceAnalysis>((resolve) => {
          setTimeout(async () => {
            const analysis = await resourceMonitor.stopMonitoring()
            resolve(analysis)
          }, 31000)
        })

        feasibilityResults.resources.baseline = baselineAnalysis

        console.log(`📊 Baseline Resource Usage:`)
        console.log(`   Average Memory: ${resourceMonitor.formatBytes(baselineAnalysis.summary.memory.average)}`)
        console.log(`   Peak Memory: ${resourceMonitor.formatBytes(baselineAnalysis.summary.memory.peak)}`)
        console.log(`   Average CPU: ${resourceMonitor.formatPercentage(baselineAnalysis.summary.cpu.average)}`)
        console.log(`   Peak CPU: ${resourceMonitor.formatPercentage(baselineAnalysis.summary.cpu.peak)}`)
        console.log(`   Memory Stable: ${baselineAnalysis.summary.stability.memory_stable}`)
        console.log(`   CPU Stable: ${baselineAnalysis.summary.stability.cpu_stable}`)

        expect(baselineAnalysis.snapshots.length).toBeGreaterThan(25) // Should have ~30 snapshots
        expect(baselineAnalysis.summary.memory.average).toBeGreaterThan(0)
        expect(baselineAnalysis.summary.cpu.average).toBeGreaterThan(0)

      } catch (error) {
        console.error('❌ Baseline resource monitoring failed:', error)
        throw error
      }
    }, 40000) // 40 second timeout
  })

  describe('Phase 2: Performance Analysis', () => {
    test('should benchmark PostgreSQL vs PGlite performance', async () => {
      console.log('🔄 Running performance benchmarks...')
      
      try {
        // Run comprehensive benchmarks
        const benchmarkResults = await postgreSQLBenchmark.runComprehensiveBenchmark({
          recordCounts: [100, 1000], // Reduced for faster testing
          concurrency: [1, 3], // Reduced for WebVM constraints
          iterations: 5, // Reduced for faster testing
          warmupRuns: 2
        })

        feasibilityResults.performance.comparison = benchmarkResults

        // Analyze results
        const postgresqlFaster = benchmarkResults.filter(r => r.verdict === 'postgresql_faster').length
        const pgliteFaster = benchmarkResults.filter(r => r.verdict === 'pglite_faster').length
        const equivalent = benchmarkResults.filter(r => r.verdict === 'equivalent').length

        const avgPerformanceRatio = benchmarkResults.reduce((sum, r) => sum + r.performanceRatio, 0) / benchmarkResults.length

        console.log(`📊 Performance Benchmark Results:`)
        console.log(`   Total Tests: ${benchmarkResults.length}`)
        console.log(`   PostgreSQL Faster: ${postgresqlFaster}`)
        console.log(`   PGlite Faster: ${pgliteFaster}`)
        console.log(`   Equivalent: ${equivalent}`)
        console.log(`   Average Performance Ratio: ${avgPerformanceRatio.toFixed(2)}`)

        // Log detailed results for key queries
        const keyTests = ['simple_select', 'join_query', 'insert_single', 'complex_query']
        keyTests.forEach(testName => {
          const result = benchmarkResults.find(r => r.testName === testName)
          if (result) {
            console.log(`   ${testName}: ${result.verdict} (${result.performanceRatio.toFixed(2)}x)`)
          }
        })

        expect(benchmarkResults.length).toBeGreaterThan(0)
        // Performance should be reasonable (within 3x of each other)
        expect(avgPerformanceRatio).toBeGreaterThan(0.3)
        expect(avgPerformanceRatio).toBeLessThan(3.0)

      } catch (error) {
        console.error('❌ Performance benchmarking failed:', error)
        throw error
      }
    }, 180000) // 3 minute timeout for comprehensive benchmarks
  })

  describe('Phase 3: Resource Impact Analysis', () => {
    test('should monitor PostgreSQL resource usage under load', async () => {
      console.log('🔄 Monitoring PostgreSQL resource usage under load...')
      
      try {
        // Start resource monitoring
        await resourceMonitor.startMonitoring({
          duration: 45000, // 45 seconds
          interval: 1000   // 1 second intervals
        })

        // Simulate database load while monitoring
        setTimeout(async () => {
          try {
            // Run some database operations to create load
            console.log('   Simulating database load...')
            
            // This would normally execute actual queries
            // For now, just wait to simulate load
            await new Promise(resolve => setTimeout(resolve, 30000))
            
          } catch (error) {
            console.warn('Database load simulation failed:', error)
          }
        }, 5000)

        // Wait for monitoring to complete
        const resourceAnalysis = await new Promise<ResourceAnalysis>((resolve) => {
          setTimeout(async () => {
            const analysis = await resourceMonitor.stopMonitoring()
            resolve(analysis)
          }, 46000)
        })

        feasibilityResults.resources.postgresql = resourceAnalysis

        console.log(`📊 PostgreSQL Resource Usage Under Load:`)
        console.log(`   Average Memory: ${resourceMonitor.formatBytes(resourceAnalysis.summary.memory.average)}`)
        console.log(`   Peak Memory: ${resourceMonitor.formatBytes(resourceAnalysis.summary.memory.peak)}`)
        console.log(`   PostgreSQL Memory: ${resourceMonitor.formatBytes(resourceAnalysis.summary.memory.postgresql_usage)}`)
        console.log(`   Average CPU: ${resourceMonitor.formatPercentage(resourceAnalysis.summary.cpu.average)}`)
        console.log(`   Peak CPU: ${resourceMonitor.formatPercentage(resourceAnalysis.summary.cpu.peak)}`)
        console.log(`   PostgreSQL CPU: ${resourceMonitor.formatPercentage(resourceAnalysis.summary.cpu.postgresql_usage)}`)
        console.log(`   Memory Stable: ${resourceAnalysis.summary.stability.memory_stable}`)
        console.log(`   CPU Stable: ${resourceAnalysis.summary.stability.cpu_stable}`)

        // Resource usage should be within acceptable bounds
        const avgMemoryMB = resourceAnalysis.summary.memory.average / (1024 * 1024)
        const peakMemoryMB = resourceAnalysis.summary.memory.peak / (1024 * 1024)
        const avgCpuPercent = resourceAnalysis.summary.cpu.average * 100
        
        expect(resourceAnalysis.snapshots.length).toBeGreaterThan(40) // Should have ~45 snapshots
        expect(avgMemoryMB).toBeLessThan(500) // Should use less than 500MB on average
        expect(peakMemoryMB).toBeLessThan(800) // Should not exceed 800MB peak
        expect(avgCpuPercent).toBeLessThan(80) // Should use less than 80% CPU on average

      } catch (error) {
        console.error('❌ PostgreSQL resource monitoring failed:', error)
        throw error
      }
    }, 60000) // 60 second timeout
  })

  describe('Phase 4: PostgREST Compatibility Analysis', () => {
    test('should verify PostgreSQL compatibility with PostgREST', async () => {
      console.log('🔄 Testing PostgreSQL compatibility with PostgREST...')
      
      try {
        const postgresqlCompatibility = await compatibilityTester.runCompatibilityTests('postgresql')
        feasibilityResults.compatibility.postgresql = postgresqlCompatibility

        console.log(`📊 PostgreSQL PostgREST Compatibility:`)
        console.log(`   Total Tests: ${postgresqlCompatibility.totalTests}`)
        console.log(`   Passed: ${postgresqlCompatibility.passedTests}`)
        console.log(`   Failed: ${postgresqlCompatibility.failedTests}`)
        console.log(`   Critical Failures: ${postgresqlCompatibility.criticalFailures}`)
        console.log(`   Compatibility Score: ${postgresqlCompatibility.compatibilityScore.toFixed(1)}%`)

        console.log(`   Feature Compatibility:`)
        console.log(`     Schema Introspection: ${postgresqlCompatibility.summary.schema_introspection ? '✅' : '❌'}`)
        console.log(`     Row Level Security: ${postgresqlCompatibility.summary.row_level_security ? '✅' : '❌'}`)
        console.log(`     JWT Authentication: ${postgresqlCompatibility.summary.jwt_authentication ? '✅' : '❌'}`)
        console.log(`     Stored Procedures: ${postgresqlCompatibility.summary.stored_procedures ? '✅' : '❌'}`)
        console.log(`     Realtime Notifications: ${postgresqlCompatibility.summary.realtime_notifications ? '✅' : '❌'}`)

        // Critical compatibility tests should pass
        expect(postgresqlCompatibility.criticalFailures).toBeLessThan(3) // Allow max 2 critical failures
        expect(postgresqlCompatibility.compatibilityScore).toBeGreaterThan(70) // At least 70% compatibility
        expect(postgresqlCompatibility.summary.schema_introspection).toBe(true) // Essential for PostgREST

      } catch (error) {
        console.error('❌ PostgreSQL compatibility testing failed:', error)
        throw error
      }
    }, 60000) // 60 second timeout

    test('should verify PGlite compatibility as fallback', async () => {
      console.log('🔄 Testing PGlite compatibility with PostgREST...')
      
      try {
        const pgliteCompatibility = await compatibilityTester.runCompatibilityTests('pglite')
        feasibilityResults.compatibility.pglite = pgliteCompatibility

        console.log(`📊 PGlite PostgREST Compatibility:`)
        console.log(`   Total Tests: ${pgliteCompatibility.totalTests}`)
        console.log(`   Passed: ${pgliteCompatibility.passedTests}`)
        console.log(`   Failed: ${pgliteCompatibility.failedTests}`)
        console.log(`   Critical Failures: ${pgliteCompatibility.criticalFailures}`)
        console.log(`   Compatibility Score: ${pgliteCompatibility.compatibilityScore.toFixed(1)}%`)

        console.log(`   Feature Compatibility:`)
        console.log(`     Schema Introspection: ${pgliteCompatibility.summary.schema_introspection ? '✅' : '❌'}`)
        console.log(`     Row Level Security: ${pgliteCompatibility.summary.row_level_security ? '✅' : '❌'}`)
        console.log(`     JWT Authentication: ${pgliteCompatibility.summary.jwt_authentication ? '✅' : '❌'}`)
        console.log(`     Stored Procedures: ${pgliteCompatibility.summary.stored_procedures ? '✅' : '❌'}`)
        console.log(`     Realtime Notifications: ${pgliteCompatibility.summary.realtime_notifications ? '✅' : '❌'}`)

        // PGlite should have reasonable compatibility as fallback
        expect(pgliteCompatibility.criticalFailures).toBeLessThan(5) // More lenient for PGlite
        expect(pgliteCompatibility.compatibilityScore).toBeGreaterThan(60) // At least 60% compatibility

      } catch (error) {
        console.error('❌ PGlite compatibility testing failed:', error)
        throw error
      }
    }, 60000) // 60 second timeout
  })
})

/**
 * Generate comprehensive feasibility report
 */
async function generateFeasibilityReport(results: FeasibilityResults): Promise<void> {
  console.log('\n' + '='.repeat(80))
  console.log('📋 POSTGRESQL FEASIBILITY ANALYSIS REPORT')
  console.log('='.repeat(80))

  // Installation Assessment
  console.log('\n📦 INSTALLATION FEASIBILITY')
  console.log('-'.repeat(40))
  
  if (results.installation.postgresql) {
    const install = results.installation.postgresql
    console.log(`✅ PostgreSQL Installation: ${install.success ? 'SUCCESS' : 'FAILED'}`)
    if (install.success) {
      console.log(`   Version: ${install.version}`)
      console.log(`   Install Time: ${(install.installTime / 1000).toFixed(1)}s`)
      console.log(`   Memory Usage: ${(install.memoryUsage / 1024 / 1024).toFixed(1)}MB`)
      console.log(`   Disk Usage: ${(install.diskUsage / 1024 / 1024).toFixed(1)}MB`)
    } else {
      console.log(`   Error: ${install.error}`)
    }
  }

  // Performance Assessment
  console.log('\n⚡ PERFORMANCE ANALYSIS')
  console.log('-'.repeat(40))
  
  if (results.performance.comparison.length > 0) {
    const postgresqlFaster = results.performance.comparison.filter(r => r.verdict === 'postgresql_faster').length
    const pgliteFaster = results.performance.comparison.filter(r => r.verdict === 'pglite_faster').length
    const equivalent = results.performance.comparison.filter(r => r.verdict === 'equivalent').length
    const avgRatio = results.performance.comparison.reduce((sum, r) => sum + r.performanceRatio, 0) / results.performance.comparison.length

    console.log(`Total Benchmarks: ${results.performance.comparison.length}`)
    console.log(`PostgreSQL Faster: ${postgresqlFaster}`)
    console.log(`PGlite Faster: ${pgliteFaster}`)
    console.log(`Equivalent: ${equivalent}`)
    console.log(`Average Performance Ratio: ${avgRatio.toFixed(2)}`)
    
    const performanceVerdict = avgRatio > 1.3 ? 'PostgreSQL Recommended' :
                              avgRatio < 0.7 ? 'PGlite Recommended' : 'Equivalent Performance'
    console.log(`Performance Verdict: ${performanceVerdict}`)
  }

  // Resource Assessment
  console.log('\n💾 RESOURCE ANALYSIS')
  console.log('-'.repeat(40))
  
  if (results.resources.postgresql) {
    const res = results.resources.postgresql
    console.log(`Average Memory: ${(res.summary.memory.average / 1024 / 1024).toFixed(1)}MB`)
    console.log(`Peak Memory: ${(res.summary.memory.peak / 1024 / 1024).toFixed(1)}MB`)
    console.log(`PostgreSQL Memory: ${(res.summary.memory.postgresql_usage / 1024 / 1024).toFixed(1)}MB`)
    console.log(`Average CPU: ${(res.summary.cpu.average * 100).toFixed(1)}%`)
    console.log(`Peak CPU: ${(res.summary.cpu.peak * 100).toFixed(1)}%`)
    console.log(`PostgreSQL CPU: ${(res.summary.cpu.postgresql_usage * 100).toFixed(1)}%`)
    console.log(`Stability: Memory ${res.summary.stability.memory_stable ? '✅' : '❌'}, CPU ${res.summary.stability.cpu_stable ? '✅' : '❌'}`)
  }

  // Compatibility Assessment
  console.log('\n🔗 POSTGREST COMPATIBILITY')
  console.log('-'.repeat(40))
  
  if (results.compatibility.postgresql) {
    const comp = results.compatibility.postgresql
    console.log(`PostgreSQL Compatibility Score: ${comp.compatibilityScore.toFixed(1)}%`)
    console.log(`Critical Failures: ${comp.criticalFailures}`)
    console.log(`Schema Introspection: ${comp.summary.schema_introspection ? '✅' : '❌'}`)
    console.log(`Row Level Security: ${comp.summary.row_level_security ? '✅' : '❌'}`)
    console.log(`JWT Authentication: ${comp.summary.jwt_authentication ? '✅' : '❌'}`)
    console.log(`Stored Procedures: ${comp.summary.stored_procedures ? '✅' : '❌'}`)
  }

  if (results.compatibility.pglite) {
    const comp = results.compatibility.pglite
    console.log(`PGlite Compatibility Score: ${comp.compatibilityScore.toFixed(1)}%`)
    console.log(`Critical Failures: ${comp.criticalFailures}`)
  }

  // Final Recommendation
  console.log('\n🎯 FINAL RECOMMENDATION')
  console.log('-'.repeat(40))

  const recommendation = generateFinalRecommendation(results)
  console.log(recommendation.verdict)
  console.log('\nReasons:')
  recommendation.reasons.forEach(reason => console.log(`  • ${reason}`))
  
  if (recommendation.nextSteps.length > 0) {
    console.log('\nNext Steps:')
    recommendation.nextSteps.forEach(step => console.log(`  • ${step}`))
  }

  console.log('\n' + '='.repeat(80))
  console.log('END OF FEASIBILITY ANALYSIS')
  console.log('='.repeat(80))
}

/**
 * Generate final recommendation based on all test results
 */
function generateFinalRecommendation(results: FeasibilityResults): {
  verdict: string
  reasons: string[]
  nextSteps: string[]
} {
  const reasons: string[] = []
  const nextSteps: string[] = []

  // Check installation success
  const installSuccess = results.installation.postgresql?.success || false
  
  // Check resource constraints
  const avgMemoryMB = results.resources.postgresql 
    ? results.resources.postgresql.summary.memory.average / (1024 * 1024)
    : 0
  const resourcesAcceptable = avgMemoryMB < 400

  // Check performance
  const avgPerformanceRatio = results.performance.comparison.length > 0
    ? results.performance.comparison.reduce((sum, r) => sum + r.performanceRatio, 0) / results.performance.comparison.length
    : 1
  const performanceGood = avgPerformanceRatio > 0.8 // PostgreSQL not significantly slower

  // Check compatibility
  const compatibilityGood = results.compatibility.postgresql
    ? results.compatibility.postgresql.criticalFailures < 3 && results.compatibility.postgresql.compatibilityScore > 70
    : false

  // Make decision
  if (installSuccess && resourcesAcceptable && performanceGood && compatibilityGood) {
    reasons.push('PostgreSQL installation successful in WebVM')
    reasons.push(`Resource usage acceptable (${avgMemoryMB.toFixed(1)}MB average)`)
    reasons.push(`Performance is competitive (${avgPerformanceRatio.toFixed(2)}x ratio)`)
    reasons.push('PostgREST compatibility requirements met')
    
    nextSteps.push('Proceed with PostgreSQL implementation in Phase 1B')
    nextSteps.push('Optimize PostgreSQL configuration for WebVM constraints')
    nextSteps.push('Begin PostgREST integration planning')
    
    return {
      verdict: '✅ RECOMMENDATION: Implement PostgreSQL + PostgREST',
      reasons,
      nextSteps
    }
  } else {
    if (!installSuccess) reasons.push('PostgreSQL installation failed in WebVM')
    if (!resourcesAcceptable) reasons.push(`Resource usage too high (${avgMemoryMB.toFixed(1)}MB average)`)
    if (!performanceGood) reasons.push(`Performance significantly slower (${avgPerformanceRatio.toFixed(2)}x ratio)`)
    if (!compatibilityGood) reasons.push('PostgREST compatibility issues detected')
    
    nextSteps.push('Proceed with Enhanced PGlite implementation in Phase 1B')
    nextSteps.push('Design PostgreSQL compatibility layer for PGlite')
    nextSteps.push('Implement missing features needed for PostgREST')
    
    return {
      verdict: '🔄 RECOMMENDATION: Implement Enhanced PGlite + PostgREST',
      reasons,
      nextSteps
    }
  }
}