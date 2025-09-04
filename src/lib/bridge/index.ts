/**
 * Hybrid Architecture Bridge Components
 * 
 * Exports all components for the Enhanced PGlite + WebVM hybrid architecture
 * implementation that enables browser-native PGlite with WebVM-hosted PostgREST
 * and Envoy services.
 */

export { PGliteBridge, pgliteBridge } from './PGliteBridge'
export { WebVMServiceManager, webvmServiceManager } from './WebVMServiceManager'
export { HybridArchitectureOptimizer, hybridOptimizer } from './HybridArchitectureOptimizer'
export { IntegrationTester, integrationTester } from './IntegrationTester'

// Types and interfaces
export type {
  BridgeRequest,
  BridgeResponse,
  SchemaMetadata,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  FunctionInfo,
  ParameterInfo,
  ViewInfo,
  PostgRESTQuery
} from './PGliteBridge'

export type {
  PostgRESTConfig,
  EnvoyConfig,
  EnvoyCluster,
  EnvoyRoute,
  ServiceStatus,
  ServiceHealth,
  BridgeEndpointConfig
} from './WebVMServiceManager'

export type {
  PerformanceMetrics,
  OptimizerConfig
} from './HybridArchitectureOptimizer'

export type {
  TestResult,
  TestSuite,
  PerformanceTestResult,
  CrossContextTest,
  APICompatibilityTest
} from './IntegrationTester'