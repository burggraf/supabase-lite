// WebVM abstraction layer exports

export { WebVMManager } from './WebVMManager'
export { MockWebVMProvider } from './MockWebVMProvider'
export { CheerpXProvider } from './CheerpXProvider'
export { RuntimeEnvironment } from './RuntimeEnvironment'
export { ProcessManager } from './ProcessManager'
export { WebVMErrorHandler } from './ErrorHandler'

export type {
  IWebVMProvider,
  RuntimeInstance,
  RuntimeMetadata,
  CommandResult,
  ProcessInfo,
  WebVMStats,
  ExecuteOptions,
  FileInfo,
  WebVMConfig,
  ProviderConfig,
  MockProviderConfig
} from './types'

export type {
  RetryConfig,
  CircuitBreakerConfig,
  TimeoutConfig,
  ErrorHandlerConfig,
  CircuitBreakerState
} from './ErrorHandler'

export {
  WebVMError,
  RuntimeNotFoundError,
  RuntimeFailureError,
  WebVMInitializationError,
  ProxyError
} from './types'