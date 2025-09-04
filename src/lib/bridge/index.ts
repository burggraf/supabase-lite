/**
 * Hybrid Architecture Bridge Components
 * 
 * Exports all components for the Enhanced PGlite + WebVM hybrid architecture
 * implementation that enables browser-native PGlite with WebVM-hosted PostgREST
 * and Envoy services.
 * 
 * Phase 1B: Core Bridge Components (Complete)
 * Phase 2: PostgREST Integration Components (Complete)
 */

// Phase 1B: Core Bridge Components
export { PGliteBridge, pgliteBridge } from './PGliteBridge'
export { WebVMServiceManager, webvmServiceManager } from './WebVMServiceManager'
export { HybridArchitectureOptimizer, hybridOptimizer } from './HybridArchitectureOptimizer'
export { IntegrationTester, integrationTester } from './IntegrationTester'

// Phase 2: PostgREST Integration Components
export { WebVMPostgRESTDeployer } from './WebVMPostgRESTDeployer'
export { PostgRESTConfigManager } from './PostgRESTConfigManager'
export { JWTAuthIntegrator } from './JWTAuthIntegrator'
export { BridgeActivator } from './BridgeActivator'
export { PostgRESTEndpointAdapter } from './PostgRESTEndpointAdapter'
export { APICallUpdater } from './APICallUpdater'

// Phase 2: Integration Orchestrator
export { Phase2IntegrationOrchestrator } from './Phase2IntegrationOrchestrator'

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

// Phase 2 Component Types
export type {
  PostgRESTDeploymentConfig,
  WebVMPostgRESTStatus
} from './WebVMPostgRESTDeployer'

export type {
  PostgRESTBridgeConfig,
  SchemaIntrospectionConfig
} from './PostgRESTConfigManager'

export type {
  JWTAuthConfig,
  AuthContext,
  JWTAuthStatus
} from './JWTAuthIntegrator'

export type {
  BridgeActivationConfig,
  BridgeActivationStatus
} from './BridgeActivator'

export type {
  PostgRESTEndpointConfig,
  PostgRESTRequest,
  PostgRESTResponse,
  EndpointMetrics
} from './PostgRESTEndpointAdapter'

export type {
  APICallMapping,
  APICallUpdateConfig,
  APIUpdateStatus
} from './APICallUpdater'

export type {
  Phase2Config,
  Phase2Status,
  Phase2Event
} from './Phase2IntegrationOrchestrator'