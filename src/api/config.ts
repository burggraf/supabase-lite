/**
 * Centralized API configuration
 */

export interface ApiConfig {
  cors: {
    allowedOrigins: string[]
    allowedMethods: string[]
    allowedHeaders: string[]
    credentials: boolean
  }
  debugging: {
    enableInstrumentation: boolean
    enableVerboseLogging: boolean
    enablePerformanceTracking: boolean
    enableRequestTracing: boolean
    enableSQLLogging: boolean
    logLevel: 'error' | 'warn' | 'info' | 'debug'
  }
  query: {
    defaultLimit: number
    maxLimit: number
    maxOffset: number
    enableCounting: boolean
    defaultTimeout: number
  }
  auth: {
    jwtSecret: string
    tokenExpiration: number
    refreshTokenExpiration: number
    maxAuthAttempts: number
    lockoutDurationMs: number
  }
  request: {
    maxRequestSize: number
    requestTimeoutMs: number
    enableDetailedErrors: boolean
  }
  database: {
    defaultSchema: string
    queryTimeoutMs: number
    enableQueryCaching: boolean
  }
  storage: {
    maxFileSize: number
    allowedMimeTypes: string[]
    signedUrlExpirySeconds: number
  }
}

export const defaultApiConfig: ApiConfig = {
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'apikey',
      'Prefer',
      'Range',
      'X-Client-Info',
      'Accept',
      'Accept-Encoding',
      'Accept-Language'
    ],
    credentials: true
  },
  debugging: {
    enableInstrumentation: true,
    enableVerboseLogging: false,
    enablePerformanceTracking: true,
    enableRequestTracing: true,
    enableSQLLogging: true,
    logLevel: 'debug'
  },
  query: {
    defaultLimit: 1000,
    maxLimit: 10000,
    maxOffset: 100000,
    enableCounting: true,
    defaultTimeout: 30000
  },
  auth: {
    jwtSecret: 'your-super-secret-jwt-token-with-at-least-32-characters-long',
    tokenExpiration: 3600, // 1 hour in seconds
    refreshTokenExpiration: 2592000, // 30 days
    maxAuthAttempts: 5,
    lockoutDurationMs: 900000 // 15 minutes
  },
  request: {
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    requestTimeoutMs: 30000,
    enableDetailedErrors: true // Enable in development
  },
  database: {
    defaultSchema: 'public',
    queryTimeoutMs: 30000,
    enableQueryCaching: true
  },
  storage: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: ['*'], // All types allowed in development
    signedUrlExpirySeconds: 3600 // 1 hour
  }
}

let currentConfig: ApiConfig = { ...defaultApiConfig }

export function getApiConfig(): ApiConfig {
  return currentConfig
}

export function updateApiConfig(updates: Partial<ApiConfig>): void {
  currentConfig = {
    ...currentConfig,
    ...updates,
    cors: { ...currentConfig.cors, ...updates.cors },
    debugging: { ...currentConfig.debugging, ...updates.debugging },
    query: { ...currentConfig.query, ...updates.query },
    auth: { ...currentConfig.auth, ...updates.auth },
    request: { ...currentConfig.request, ...updates.request },
    database: { ...currentConfig.database, ...updates.database },
    storage: { ...currentConfig.storage, ...updates.storage }
  }
}

/**
 * Reset configuration to defaults
 */
export function resetApiConfig(): void {
  currentConfig = { ...defaultApiConfig }
}

/**
 * Load configuration from environment variables
 * Useful for production deployments
 */
export function loadConfigFromEnvironment(): void {
  if (typeof process === 'undefined' || !process.env) return

  const env = process.env
  const envUpdates: Partial<ApiConfig> = {}

  // JWT Configuration
  if (env.JWT_SECRET) {
    envUpdates.auth = { ...currentConfig.auth, jwtSecret: env.JWT_SECRET }
  }

  // Query Limits
  if (env.DEFAULT_QUERY_LIMIT) {
    envUpdates.query = { ...currentConfig.query, defaultLimit: parseInt(env.DEFAULT_QUERY_LIMIT) }
  }

  // Debug Level
  if (env.LOG_LEVEL && ['error', 'warn', 'info', 'debug'].includes(env.LOG_LEVEL)) {
    envUpdates.debugging = { ...currentConfig.debugging, logLevel: env.LOG_LEVEL as any }
  }

  if (Object.keys(envUpdates).length > 0) {
    updateApiConfig(envUpdates)
  }
}

/**
 * Validate configuration values
 */
export function validateApiConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const config = getApiConfig()

  // Validate JWT secret
  if (config.auth.jwtSecret.length < 32) {
    errors.push('JWT secret must be at least 32 characters long')
  }

  // Validate query limits
  if (config.query.defaultLimit > config.query.maxLimit) {
    errors.push('Default query limit cannot exceed max limit')
  }

  // Validate timeouts
  if (config.request.requestTimeoutMs < 1000) {
    errors.push('Request timeout must be at least 1 second')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Auto-load from environment on module initialization
loadConfigFromEnvironment()