/**
 * Decision Matrix for PostgreSQL vs Enhanced PGlite
 * 
 * This module provides a comprehensive decision framework to determine
 * whether to proceed with PostgreSQL or Enhanced PGlite implementation
 * based on feasibility test results.
 */

import { logger } from '../../infrastructure/Logger'
import { InstallationResult } from './PostgreSQLInstaller'
import { ComparisonResult } from './PostgreSQLBenchmark'
import { ResourceAnalysis } from './ResourceMonitor'
import { CompatibilityReport } from './CompatibilityTester'

export interface DecisionCriteria {
  installation: {
    weight: number
    requirements: {
      success: boolean
      maxInstallTime: number  // milliseconds
      maxMemoryUsage: number  // bytes
      maxDiskUsage: number    // bytes
    }
  }
  performance: {
    weight: number
    requirements: {
      minPerformanceRatio: number    // PostgreSQL vs PGlite ratio
      maxSlowdownAcceptable: number  // How much slower is acceptable
      keyQueries: string[]           // Critical queries that must perform well
    }
  }
  resources: {
    weight: number
    requirements: {
      maxAverageMemory: number  // bytes
      maxPeakMemory: number     // bytes
      maxAverageCpu: number     // percentage (0-1)
      maxPeakCpu: number        // percentage (0-1)
      requireStability: boolean
    }
  }
  compatibility: {
    weight: number
    requirements: {
      minCompatibilityScore: number     // percentage (0-100)
      maxCriticalFailures: number
      requiredFeatures: string[]        // Must-have features
    }
  }
}

export interface DecisionInput {
  installation: InstallationResult
  performance: ComparisonResult[]
  resources: ResourceAnalysis
  compatibility: CompatibilityReport
}

export interface DecisionResult {
  recommendation: 'PostgreSQL' | 'Enhanced PGlite'
  confidence: number // 0-1 scale
  overallScore: {
    postgresql: number
    pglite: number
  }
  criteriaScores: {
    installation: { postgresql: number; pglite: number; weight: number }
    performance: { postgresql: number; pglite: number; weight: number }
    resources: { postgresql: number; pglite: number; weight: number }
    compatibility: { postgresql: number; pglite: number; weight: number }
  }
  reasons: {
    forPostgreSQL: string[]
    forPGlite: string[]
    concerns: string[]
  }
  nextSteps: string[]
  riskAssessment: {
    postgresql: { risks: string[]; mitigations: string[] }
    pglite: { risks: string[]; mitigations: string[] }
  }
}

export class DecisionMatrix {
  private logger = logger

  /**
   * Default decision criteria optimized for WebVM environment
   */
  private defaultCriteria: DecisionCriteria = {
    installation: {
      weight: 0.2,
      requirements: {
        success: true,
        maxInstallTime: 120000,      // 2 minutes
        maxMemoryUsage: 300 * 1024 * 1024,  // 300MB
        maxDiskUsage: 800 * 1024 * 1024     // 800MB
      }
    },
    performance: {
      weight: 0.3,
      requirements: {
        minPerformanceRatio: 0.7,    // PostgreSQL should be at least 70% of PGlite speed
        maxSlowdownAcceptable: 2.0,  // Max 2x slower than PGlite
        keyQueries: ['simple_select', 'join_query', 'insert_single', 'complex_query']
      }
    },
    resources: {
      weight: 0.3,
      requirements: {
        maxAverageMemory: 400 * 1024 * 1024,  // 400MB
        maxPeakMemory: 600 * 1024 * 1024,     // 600MB
        maxAverageCpu: 0.6,                   // 60%
        maxPeakCpu: 0.8,                      // 80%
        requireStability: true
      }
    },
    compatibility: {
      weight: 0.2,
      requirements: {
        minCompatibilityScore: 80,
        maxCriticalFailures: 2,
        requiredFeatures: [
          'schema_introspection',
          'row_level_security', 
          'jwt_authentication',
          'stored_procedures'
        ]
      }
    }
  }

  /**
   * Make decision based on feasibility test results
   */
  makeDecision(input: DecisionInput, criteria?: Partial<DecisionCriteria>): DecisionResult {
    const finalCriteria = this.mergeCriteria(criteria)
    
    this.logger.info('Decision Matrix', 'Starting decision analysis...')
    
    // Score each criterion
    const installationScore = this.scoreInstallation(input.installation, finalCriteria.installation)
    const performanceScore = this.scorePerformance(input.performance, finalCriteria.performance)
    const resourcesScore = this.scoreResources(input.resources, finalCriteria.resources)
    const compatibilityScore = this.scoreCompatibility(input.compatibility, finalCriteria.compatibility)

    // Calculate weighted overall scores
    const postgresqlScore = 
      (installationScore.postgresql * finalCriteria.installation.weight) +
      (performanceScore.postgresql * finalCriteria.performance.weight) +
      (resourcesScore.postgresql * finalCriteria.resources.weight) +
      (compatibilityScore.postgresql * finalCriteria.compatibility.weight)

    const pgliteScore = 
      (installationScore.pglite * finalCriteria.installation.weight) +
      (performanceScore.pglite * finalCriteria.performance.weight) +
      (resourcesScore.pglite * finalCriteria.resources.weight) +
      (compatibilityScore.pglite * finalCriteria.compatibility.weight)

    // Determine recommendation and confidence
    const recommendation = postgresqlScore > pgliteScore ? 'PostgreSQL' : 'Enhanced PGlite'
    const scoreDifference = Math.abs(postgresqlScore - pgliteScore)
    const confidence = Math.min(1.0, scoreDifference + 0.1) // Minimum 10% confidence

    // Generate reasons and next steps
    const reasons = this.generateReasons(input, finalCriteria, {
      installation: installationScore,
      performance: performanceScore,
      resources: resourcesScore,
      compatibility: compatibilityScore
    })

    const nextSteps = this.generateNextSteps(recommendation, input)
    const riskAssessment = this.generateRiskAssessment(input, recommendation)

    const result: DecisionResult = {
      recommendation,
      confidence,
      overallScore: {
        postgresql: postgresqlScore,
        pglite: pgliteScore
      },
      criteriaScores: {
        installation: { ...installationScore, weight: finalCriteria.installation.weight },
        performance: { ...performanceScore, weight: finalCriteria.performance.weight },
        resources: { ...resourcesScore, weight: finalCriteria.resources.weight },
        compatibility: { ...compatibilityScore, weight: finalCriteria.compatibility.weight }
      },
      reasons,
      nextSteps,
      riskAssessment
    }

    this.logger.info('Decision Matrix', `Decision: ${recommendation} (${(confidence * 100).toFixed(1)}% confidence)`)
    
    return result
  }

  /**
   * Score installation feasibility
   */
  private scoreInstallation(
    installation: InstallationResult,
    criteria: DecisionCriteria['installation']
  ): { postgresql: number; pglite: number } {
    let postgresqlScore = 0
    let pgliteScore = 0.8 // PGlite gets base score as it's always "installable"

    if (installation.success) {
      postgresqlScore += 0.4 // Base success score

      // Install time scoring
      if (installation.installTime <= criteria.requirements.maxInstallTime) {
        postgresqlScore += 0.2
      } else {
        postgresqlScore -= 0.1
      }

      // Memory usage scoring
      if (installation.memoryUsage <= criteria.requirements.maxMemoryUsage) {
        postgresqlScore += 0.2
      } else {
        postgresqlScore -= 0.1
      }

      // Disk usage scoring
      if (installation.diskUsage <= criteria.requirements.maxDiskUsage) {
        postgresqlScore += 0.2
      } else {
        postgresqlScore -= 0.1
      }
    } else {
      // Installation failure is a major penalty
      postgresqlScore = 0
      pgliteScore = 1.0 // PGlite becomes clear winner
    }

    return {
      postgresql: Math.max(0, Math.min(1, postgresqlScore)),
      pglite: Math.max(0, Math.min(1, pgliteScore))
    }
  }

  /**
   * Score performance comparison
   */
  private scorePerformance(
    performance: ComparisonResult[],
    criteria: DecisionCriteria['performance']
  ): { postgresql: number; pglite: number } {
    if (performance.length === 0) {
      return { postgresql: 0.5, pglite: 0.5 } // Neutral if no data
    }

    let postgresqlScore = 0
    let pgliteScore = 0
    let totalWeight = 0

    performance.forEach(result => {
      const weight = criteria.requirements.keyQueries.includes(result.testName) ? 2.0 : 1.0
      totalWeight += weight

      if (result.verdict === 'postgresql_faster') {
        postgresqlScore += weight
      } else if (result.verdict === 'pglite_faster') {
        pgliteScore += weight
      } else {
        // Equivalent performance
        postgresqlScore += weight * 0.5
        pgliteScore += weight * 0.5
      }
    })

    // Normalize scores
    postgresqlScore /= totalWeight
    pgliteScore /= totalWeight

    // Apply performance ratio penalty if PostgreSQL is too slow
    const avgRatio = performance.reduce((sum, r) => sum + r.performanceRatio, 0) / performance.length
    if (avgRatio < criteria.requirements.minPerformanceRatio) {
      postgresqlScore *= 0.5 // Significant penalty for being too slow
    }

    return {
      postgresql: Math.max(0, Math.min(1, postgresqlScore)),
      pglite: Math.max(0, Math.min(1, pgliteScore))
    }
  }

  /**
   * Score resource usage
   */
  private scoreResources(
    resources: ResourceAnalysis,
    criteria: DecisionCriteria['resources']
  ): { postgresql: number; pglite: number } {
    let postgresqlScore = 1.0 // Start with full score
    let pgliteScore = 0.9 // PGlite gets slightly lower base score due to browser overhead

    // Memory usage scoring
    if (resources.summary.memory.average > criteria.requirements.maxAverageMemory) {
      postgresqlScore -= 0.3
    }
    if (resources.summary.memory.peak > criteria.requirements.maxPeakMemory) {
      postgresqlScore -= 0.2
    }

    // CPU usage scoring
    if (resources.summary.cpu.average > criteria.requirements.maxAverageCpu) {
      postgresqlScore -= 0.3
    }
    if (resources.summary.cpu.peak > criteria.requirements.maxPeakCpu) {
      postgresqlScore -= 0.2
    }

    // Stability scoring
    if (criteria.requirements.requireStability) {
      if (!resources.summary.stability.memory_stable) {
        postgresqlScore -= 0.2
      }
      if (!resources.summary.stability.cpu_stable) {
        postgresqlScore -= 0.2
      }
    }

    return {
      postgresql: Math.max(0, Math.min(1, postgresqlScore)),
      pglite: Math.max(0, Math.min(1, pgliteScore))
    }
  }

  /**
   * Score PostgREST compatibility
   */
  private scoreCompatibility(
    compatibility: CompatibilityReport,
    criteria: DecisionCriteria['compatibility']
  ): { postgresql: number; pglite: number } {
    let postgresqlScore = 0
    let pgliteScore = 0.7 // PGlite starts lower due to expected limitations

    // Base compatibility score
    if (compatibility.compatibilityScore >= criteria.requirements.minCompatibilityScore) {
      postgresqlScore += 0.4
    } else {
      postgresqlScore += (compatibility.compatibilityScore / 100) * 0.4
    }

    // Critical failures penalty
    if (compatibility.criticalFailures <= criteria.requirements.maxCriticalFailures) {
      postgresqlScore += 0.2
    } else {
      postgresqlScore -= (compatibility.criticalFailures - criteria.requirements.maxCriticalFailures) * 0.1
    }

    // Required features scoring
    let requiredFeaturesScore = 0
    criteria.requirements.requiredFeatures.forEach(feature => {
      if ((compatibility.summary as any)[feature]) {
        requiredFeaturesScore += 0.1
      }
    })
    postgresqlScore += Math.min(0.4, requiredFeaturesScore)

    // PGlite compatibility assumed to be lower but still functional
    pgliteScore += Math.min(postgresqlScore * 0.8, 0.8)

    return {
      postgresql: Math.max(0, Math.min(1, postgresqlScore)),
      pglite: Math.max(0, Math.min(1, pgliteScore))
    }
  }

  /**
   * Generate detailed reasons for recommendation
   */
  private generateReasons(
    input: DecisionInput,
    criteria: DecisionCriteria,
    scores: any
  ): DecisionResult['reasons'] {
    const forPostgreSQL: string[] = []
    const forPGlite: string[] = []
    const concerns: string[] = []

    // Installation reasons
    if (input.installation.success) {
      forPostgreSQL.push('PostgreSQL installation successful in WebVM')
      if (input.installation.installTime < 60000) {
        forPostgreSQL.push('Fast installation time')
      }
    } else {
      forPGlite.push('PostgreSQL installation failed - PGlite more reliable')
      concerns.push(`PostgreSQL installation error: ${input.installation.error}`)
    }

    // Performance reasons
    const postgresqlFaster = input.performance.filter(r => r.verdict === 'postgresql_faster').length
    const pgliteFaster = input.performance.filter(r => r.verdict === 'pglite_faster').length
    
    if (postgresqlFaster > pgliteFaster) {
      forPostgreSQL.push(`PostgreSQL faster in ${postgresqlFaster}/${input.performance.length} benchmarks`)
    } else if (pgliteFaster > postgresqlFaster) {
      forPGlite.push(`PGlite faster in ${pgliteFaster}/${input.performance.length} benchmarks`)
    }

    const avgRatio = input.performance.reduce((sum, r) => sum + r.performanceRatio, 0) / input.performance.length
    if (avgRatio > 1.2) {
      forPostgreSQL.push(`PostgreSQL ${((avgRatio - 1) * 100).toFixed(0)}% faster on average`)
    } else if (avgRatio < 0.8) {
      forPGlite.push(`PGlite ${((1 - avgRatio) * 100).toFixed(0)}% faster on average`)
    }

    // Resource reasons
    const avgMemoryMB = input.resources.summary.memory.average / (1024 * 1024)
    const avgCpuPercent = input.resources.summary.cpu.average * 100

    if (avgMemoryMB < 300) {
      forPostgreSQL.push(`Acceptable memory usage (${avgMemoryMB.toFixed(1)}MB average)`)
    } else if (avgMemoryMB > 400) {
      concerns.push(`High memory usage (${avgMemoryMB.toFixed(1)}MB average)`)
      forPGlite.push('Lower resource requirements than PostgreSQL')
    }

    if (avgCpuPercent < 50) {
      forPostgreSQL.push(`Low CPU usage (${avgCpuPercent.toFixed(1)}% average)`)
    } else if (avgCpuPercent > 70) {
      concerns.push(`High CPU usage (${avgCpuPercent.toFixed(1)}% average)`)
      forPGlite.push('More CPU efficient for WebVM environment')
    }

    if (input.resources.summary.stability.memory_stable && input.resources.summary.stability.cpu_stable) {
      forPostgreSQL.push('Stable resource usage patterns')
    } else {
      concerns.push('Unstable resource usage detected')
    }

    // Compatibility reasons
    if (input.compatibility.compatibilityScore > 85) {
      forPostgreSQL.push(`High PostgREST compatibility (${input.compatibility.compatibilityScore.toFixed(1)}%)`)
    } else if (input.compatibility.compatibilityScore < 70) {
      concerns.push(`Low PostgREST compatibility (${input.compatibility.compatibilityScore.toFixed(1)}%)`)
      forPGlite.push('Can be enhanced for better PostgREST compatibility')
    }

    if (input.compatibility.criticalFailures > 2) {
      concerns.push(`${input.compatibility.criticalFailures} critical compatibility failures`)
      forPGlite.push('Fewer critical compatibility requirements')
    }

    // Feature-specific reasons
    if (input.compatibility.summary.schema_introspection) {
      forPostgreSQL.push('Schema introspection works correctly')
    } else {
      concerns.push('Schema introspection issues detected')
    }

    if (input.compatibility.summary.row_level_security) {
      forPostgreSQL.push('Row Level Security fully supported')
    } else {
      concerns.push('RLS support limitations')
    }

    return { forPostgreSQL, forPGlite, concerns }
  }

  /**
   * Generate next steps based on recommendation
   */
  private generateNextSteps(recommendation: 'PostgreSQL' | 'Enhanced PGlite', input: DecisionInput): string[] {
    const nextSteps: string[] = []

    if (recommendation === 'PostgreSQL') {
      nextSteps.push('Proceed with Phase 1B: PostgreSQL implementation')
      nextSteps.push('Optimize PostgreSQL configuration for WebVM constraints')
      nextSteps.push('Implement PostgreSQL service management in WebVMManager')
      nextSteps.push('Create PostgreSQL-specific connection pooling')
      nextSteps.push('Begin PostgREST installation and configuration')
      nextSteps.push('Test PostgreSQL + PostgREST integration')
      
      if (input.resources.summary.memory.average > 300 * 1024 * 1024) {
        nextSteps.push('Implement memory usage optimizations')
      }
      
      if (input.compatibility.criticalFailures > 0) {
        nextSteps.push('Address critical PostgREST compatibility issues')
      }
    } else {
      nextSteps.push('Proceed with Phase 1B: Enhanced PGlite implementation')
      nextSteps.push('Design PostgreSQL compatibility layer for PGlite')
      nextSteps.push('Implement missing PostgreSQL features in PGlite')
      nextSteps.push('Create PostgREST adapter for PGlite')
      nextSteps.push('Enhance PGlite performance for key operations')
      nextSteps.push('Implement advanced query optimization')
      nextSteps.push('Add PostgreSQL extension simulation layer')
      
      if (input.performance.some(r => r.verdict === 'pglite_faster')) {
        nextSteps.push('Leverage PGlite performance advantages')
      }
    }

    nextSteps.push('Create comprehensive test suite for chosen implementation')
    nextSteps.push('Document implementation decisions and trade-offs')
    nextSteps.push('Prepare for Phase 2: PostgREST integration')

    return nextSteps
  }

  /**
   * Generate risk assessment for both options
   */
  private generateRiskAssessment(
    input: DecisionInput,
    recommendation: 'PostgreSQL' | 'Enhanced PGlite'
  ): DecisionResult['riskAssessment'] {
    const postgresqlRisks: string[] = []
    const postgresqlMitigations: string[] = []
    const pgliteRisks: string[] = []
    const pgliteMitigations: string[] = []

    // PostgreSQL risks
    if (!input.installation.success) {
      postgresqlRisks.push('Installation failure in WebVM environment')
      postgresqlMitigations.push('Implement robust installation retry mechanisms')
    }

    if (input.resources.summary.memory.average > 350 * 1024 * 1024) {
      postgresqlRisks.push('High memory usage may impact browser performance')
      postgresqlMitigations.push('Implement memory monitoring and limits')
    }

    if (input.resources.summary.cpu.average > 0.6) {
      postgresqlRisks.push('High CPU usage may cause UI lag')
      postgresqlMitigations.push('Implement CPU throttling and background processing')
    }

    if (!input.resources.summary.stability.memory_stable) {
      postgresqlRisks.push('Unstable memory usage patterns')
      postgresqlMitigations.push('Implement memory leak detection and prevention')
    }

    if (input.compatibility.criticalFailures > 2) {
      postgresqlRisks.push('PostgREST compatibility issues')
      postgresqlMitigations.push('Implement compatibility shims and workarounds')
    }

    // PGlite risks
    pgliteRisks.push('Feature limitations compared to full PostgreSQL')
    pgliteMitigations.push('Implement comprehensive PostgreSQL compatibility layer')

    pgliteRisks.push('May require significant development effort for PostgREST compatibility')
    pgliteMitigations.push('Create staged implementation with iterative testing')

    if (input.performance.some(r => r.verdict === 'postgresql_faster')) {
      pgliteRisks.push('Performance gaps for complex operations')
      pgliteMitigations.push('Implement query optimization and caching strategies')
    }

    pgliteRisks.push('Long-term maintenance of compatibility layer')
    pgliteMitigations.push('Design modular architecture for easy updates')

    return {
      postgresql: { risks: postgresqlRisks, mitigations: postgresqlMitigations },
      pglite: { risks: pgliteRisks, mitigations: pgliteMitigations }
    }
  }

  /**
   * Merge user criteria with defaults
   */
  private mergeCriteria(userCriteria?: Partial<DecisionCriteria>): DecisionCriteria {
    if (!userCriteria) {
      return { ...this.defaultCriteria }
    }

    return {
      installation: { ...this.defaultCriteria.installation, ...userCriteria.installation },
      performance: { ...this.defaultCriteria.performance, ...userCriteria.performance },
      resources: { ...this.defaultCriteria.resources, ...userCriteria.resources },
      compatibility: { ...this.defaultCriteria.compatibility, ...userCriteria.compatibility }
    }
  }

  /**
   * Export decision result to JSON
   */
  exportDecision(result: DecisionResult): string {
    return JSON.stringify({
      ...result,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }, null, 2)
  }

  /**
   * Generate decision summary report
   */
  generateSummaryReport(result: DecisionResult): string {
    const lines: string[] = []
    
    lines.push('# PostgreSQL vs Enhanced PGlite Decision Report')
    lines.push('')
    lines.push(`**Recommendation:** ${result.recommendation}`)
    lines.push(`**Confidence:** ${(result.confidence * 100).toFixed(1)}%`)
    lines.push('')
    
    lines.push('## Overall Scores')
    lines.push(`- PostgreSQL: ${result.overallScore.postgresql.toFixed(2)}`)
    lines.push(`- Enhanced PGlite: ${result.overallScore.pglite.toFixed(2)}`)
    lines.push('')
    
    lines.push('## Criteria Breakdown')
    Object.entries(result.criteriaScores).forEach(([criterion, scores]) => {
      lines.push(`### ${criterion.charAt(0).toUpperCase() + criterion.slice(1)} (Weight: ${(scores.weight * 100).toFixed(0)}%)`)
      lines.push(`- PostgreSQL: ${scores.postgresql.toFixed(2)}`)
      lines.push(`- PGlite: ${scores.pglite.toFixed(2)}`)
      lines.push('')
    })
    
    lines.push('## Reasons for PostgreSQL')
    result.reasons.forPostgreSQL.forEach(reason => lines.push(`- ${reason}`))
    lines.push('')
    
    lines.push('## Reasons for Enhanced PGlite')
    result.reasons.forPGlite.forEach(reason => lines.push(`- ${reason}`))
    lines.push('')
    
    if (result.reasons.concerns.length > 0) {
      lines.push('## Concerns')
      result.reasons.concerns.forEach(concern => lines.push(`- ${concern}`))
      lines.push('')
    }
    
    lines.push('## Next Steps')
    result.nextSteps.forEach(step => lines.push(`- ${step}`))
    lines.push('')
    
    lines.push('## Risk Assessment')
    lines.push(`### ${result.recommendation} Risks`)
    const risks = result.recommendation === 'PostgreSQL' 
      ? result.riskAssessment.postgresql.risks
      : result.riskAssessment.pglite.risks
    risks.forEach(risk => lines.push(`- ${risk}`))
    
    lines.push('')
    lines.push('### Mitigations')
    const mitigations = result.recommendation === 'PostgreSQL'
      ? result.riskAssessment.postgresql.mitigations
      : result.riskAssessment.pglite.mitigations
    mitigations.forEach(mitigation => lines.push(`- ${mitigation}`))
    
    return lines.join('\n')
  }
}

// Export singleton instance
export const decisionMatrix = new DecisionMatrix()