// Re-export all bridge classes for easy importing
export { RestBridge } from './rest-bridge'
export { AuthBridge } from './auth-bridge'
export { VFSBridge } from './storage-bridge'
export { FunctionsBridge } from './functions-bridge'

// For backwards compatibility, export the old names
export { RestBridge as EnhancedSupabaseAPIBridge } from './rest-bridge'