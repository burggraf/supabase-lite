/**
 * PostgREST Configuration Manager
 * 
 * Manages PostgREST configuration for PGlite bridge integration
 * Handles JWT authentication, schema configuration, and bridge endpoints
 */

import { logger } from '@/lib/infrastructure/Logger'
import { errorHandler } from '@/lib/infrastructure/ErrorHandler'

export interface PostgRESTBridgeConfig {
	// Database connection (points to HTTP bridge)
	dbUri: string
	dbSchema: string
	dbAnonRole: string
	
	// Authentication
	jwtSecret: string
	jwtSecretIsBase64?: boolean
	roleClaimKey: string
	
	// Server settings
	serverHost: string
	serverPort: number
	serverUnixSocket?: string
	
	// Schema configuration
	dbSchemas: string[]
	dbExtraSearchPath?: string[]
	dbMaxRows?: number
	dbPreRequest?: string
	dbPostRequest?: string
	
	// Connection pool
	dbPoolTimeout?: number
	dbPoolMaxSize?: number
	
	// Logging
	logLevel: 'crit' | 'error' | 'warn' | 'info' | 'debug'
	
	// CORS
	serverCorsOrigins?: string[]
	
	// OpenAPI
	openApiServerProxyUri?: string
}

export interface SchemaIntrospectionConfig {
	schemas: string[]
	excludeTables?: string[]
	includeTables?: string[]
	functions: {
		schema: string
		name: string
		description?: string
	}[]
}

/**
 * Manages PostgREST configuration for hybrid architecture
 * Configures PostgREST to communicate with PGlite via HTTP bridge
 */
export class PostgRESTConfigManager {
	private static instance: PostgRESTConfigManager
	private config: PostgRESTBridgeConfig | null = null
	private schemaConfig: SchemaIntrospectionConfig | null = null

	private constructor() {}

	public static getInstance(): PostgRESTConfigManager {
		if (!PostgRESTConfigManager.instance) {
			PostgRESTConfigManager.instance = new PostgRESTConfigManager()
		}
		return PostgRESTConfigManager.instance
	}

	/**
	 * Create PostgREST configuration for PGlite bridge integration
	 */
	public async createBridgeConfiguration(options: {
		bridgeEndpoint: string
		jwtSecret: string
		port: number
		schemas: string[]
		corsOrigins?: string[]
	}): Promise<PostgRESTBridgeConfig> {
		try {
			logger.info('Creating PostgREST bridge configuration')

			const config: PostgRESTBridgeConfig = {
				// Database connection via HTTP bridge
				dbUri: options.bridgeEndpoint,
				dbSchema: 'public',
				dbAnonRole: 'anonymous',
				
				// Authentication
				jwtSecret: options.jwtSecret,
				jwtSecretIsBase64: false,
				roleClaimKey: 'role',
				
				// Server settings
				serverHost: '0.0.0.0',
				serverPort: options.port,
				
				// Schema configuration
				dbSchemas: options.schemas,
				dbExtraSearchPath: ['public', 'auth', 'storage'],
				dbMaxRows: 1000,
				
				// Connection settings
				dbPoolTimeout: 10,
				dbPoolMaxSize: 10,
				
				// Logging
				logLevel: 'info',
				
				// CORS
				serverCorsOrigins: options.corsOrigins || ['http://localhost:5173']
			}

			this.config = config
			logger.info('PostgREST bridge configuration created', {
				bridgeEndpoint: options.bridgeEndpoint,
				port: options.port,
				schemas: options.schemas
			})

			return config
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'PostgRESTConfigManager.createBridgeConfiguration' })
			throw error
		}
	}

	/**
	 * Configure schema introspection for Supabase compatibility
	 */
	public async configureSchemaIntrospection(): Promise<SchemaIntrospectionConfig> {
		try {
			logger.info('Configuring schema introspection for Supabase compatibility')

			const schemaConfig: SchemaIntrospectionConfig = {
				schemas: ['public', 'auth', 'storage'],
				
				// Exclude internal PostgREST tables
				excludeTables: [
					'spatial_ref_sys',
					'geography_columns',
					'geometry_columns',
					'raster_columns',
					'raster_overviews'
				],
				
				// Include specific Supabase auth functions
				functions: [
					{
						schema: 'auth',
						name: 'jwt',
						description: 'Generate JWT token for user'
					},
					{
						schema: 'auth',
						name: 'role',
						description: 'Get user role from JWT'
					},
					{
						schema: 'auth',
						name: 'uid',
						description: 'Get user ID from JWT'
					},
					{
						schema: 'storage',
						name: 'search',
						description: 'Search storage objects'
					},
					{
						schema: 'storage',
						name: 'foldername',
						description: 'Extract folder name from path'
					},
					{
						schema: 'storage',
						name: 'filename',
						description: 'Extract filename from path'
					}
				]
			}

			this.schemaConfig = schemaConfig
			logger.info('Schema introspection configured', {
				schemas: schemaConfig.schemas,
				functionsCount: schemaConfig.functions.length
			})

			return schemaConfig
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'PostgRESTConfigManager.configureSchemaIntrospection' })
			throw error
		}
	}

	/**
	 * Generate PostgREST configuration file content
	 */
	public generateConfigFile(): string {
		if (!this.config) {
			throw new Error('Configuration not created yet')
		}

		const config = this.config
		const lines: string[] = []

		// Database connection
		lines.push(`# PostgREST Configuration for PGlite Bridge Integration`)
		lines.push(`# Generated: ${new Date().toISOString()}`)
		lines.push('')
		lines.push(`# Database Connection (HTTP Bridge)`)
		lines.push(`db-uri = "${config.dbUri}"`)
		lines.push(`db-schema = "${config.dbSchema}"`)
		lines.push(`db-anon-role = "${config.dbAnonRole}"`)
		
		if (config.dbSchemas.length > 1) {
			lines.push(`db-schemas = "${config.dbSchemas.join(',')}"`)
		}
		
		if (config.dbExtraSearchPath) {
			lines.push(`db-extra-search-path = "${config.dbExtraSearchPath.join(',')}"`)
		}

		// Authentication
		lines.push('')
		lines.push(`# Authentication`)
		lines.push(`jwt-secret = "${config.jwtSecret}"`)
		
		if (config.jwtSecretIsBase64) {
			lines.push(`jwt-secret-is-base64 = true`)
		}
		
		lines.push(`role-claim-key = "${config.roleClaimKey}"`)

		// Server settings
		lines.push('')
		lines.push(`# Server Configuration`)
		lines.push(`server-host = "${config.serverHost}"`)
		lines.push(`server-port = ${config.serverPort}`)
		
		if (config.serverUnixSocket) {
			lines.push(`server-unix-socket = "${config.serverUnixSocket}"`)
		}

		// Performance settings
		lines.push('')
		lines.push(`# Performance Configuration`)
		
		if (config.dbMaxRows) {
			lines.push(`db-max-rows = ${config.dbMaxRows}`)
		}
		
		if (config.dbPoolTimeout) {
			lines.push(`db-pool-timeout = ${config.dbPoolTimeout}`)
		}
		
		if (config.dbPoolMaxSize) {
			lines.push(`db-pool-max-size = ${config.dbPoolMaxSize}`)
		}

		// Pre/Post request hooks
		if (config.dbPreRequest) {
			lines.push('')
			lines.push(`# Request hooks`)
			lines.push(`db-pre-request = "${config.dbPreRequest}"`)
		}
		
		if (config.dbPostRequest) {
			lines.push(`db-post-request = "${config.dbPostRequest}"`)
		}

		// Logging
		lines.push('')
		lines.push(`# Logging`)
		lines.push(`log-level = "${config.logLevel}"`)

		// CORS
		if (config.serverCorsOrigins && config.serverCorsOrigins.length > 0) {
			lines.push('')
			lines.push(`# CORS Configuration`)
			lines.push(`server-cors-origins = "${config.serverCorsOrigins.join(',')}"`)
		}

		// OpenAPI
		if (config.openApiServerProxyUri) {
			lines.push('')
			lines.push(`# OpenAPI Configuration`)
			lines.push(`openapi-server-proxy-uri = "${config.openApiServerProxyUri}"`)
		}

		return lines.join('\n') + '\n'
	}

	/**
	 * Generate environment variables for PostgREST
	 */
	public generateEnvironmentVariables(): Record<string, string> {
		if (!this.config) {
			throw new Error('Configuration not created yet')
		}

		const config = this.config
		const env: Record<string, string> = {}

		// Database connection
		env.PGRST_DB_URI = config.dbUri
		env.PGRST_DB_SCHEMA = config.dbSchema
		env.PGRST_DB_ANON_ROLE = config.dbAnonRole
		
		if (config.dbSchemas.length > 1) {
			env.PGRST_DB_SCHEMAS = config.dbSchemas.join(',')
		}
		
		if (config.dbExtraSearchPath) {
			env.PGRST_DB_EXTRA_SEARCH_PATH = config.dbExtraSearchPath.join(',')
		}

		// Authentication
		env.PGRST_JWT_SECRET = config.jwtSecret
		env.PGRST_ROLE_CLAIM_KEY = config.roleClaimKey
		
		if (config.jwtSecretIsBase64) {
			env.PGRST_JWT_SECRET_IS_BASE64 = 'true'
		}

		// Server settings
		env.PGRST_SERVER_HOST = config.serverHost
		env.PGRST_SERVER_PORT = config.serverPort.toString()
		
		if (config.serverUnixSocket) {
			env.PGRST_SERVER_UNIX_SOCKET = config.serverUnixSocket
		}

		// Performance settings
		if (config.dbMaxRows) {
			env.PGRST_DB_MAX_ROWS = config.dbMaxRows.toString()
		}
		
		if (config.dbPoolTimeout) {
			env.PGRST_DB_POOL_TIMEOUT = config.dbPoolTimeout.toString()
		}
		
		if (config.dbPoolMaxSize) {
			env.PGRST_DB_POOL_MAX_SIZE = config.dbPoolMaxSize.toString()
		}

		// Request hooks
		if (config.dbPreRequest) {
			env.PGRST_DB_PRE_REQUEST = config.dbPreRequest
		}
		
		if (config.dbPostRequest) {
			env.PGRST_DB_POST_REQUEST = config.dbPostRequest
		}

		// Logging
		env.PGRST_LOG_LEVEL = config.logLevel

		// CORS
		if (config.serverCorsOrigins && config.serverCorsOrigins.length > 0) {
			env.PGRST_SERVER_CORS_ORIGINS = config.serverCorsOrigins.join(',')
		}

		// OpenAPI
		if (config.openApiServerProxyUri) {
			env.PGRST_OPENAPI_SERVER_PROXY_URI = config.openApiServerProxyUri
		}

		return env
	}

	/**
	 * Validate configuration for common issues
	 */
	public validateConfiguration(): { isValid: boolean; errors: string[]; warnings: string[] } {
		const errors: string[] = []
		const warnings: string[] = []

		if (!this.config) {
			errors.push('Configuration not created yet')
			return { isValid: false, errors, warnings }
		}

		const config = this.config

		// Required fields
		if (!config.dbUri) {
			errors.push('Database URI is required')
		}
		
		if (!config.jwtSecret) {
			errors.push('JWT secret is required')
		} else if (config.jwtSecret.length < 32) {
			warnings.push('JWT secret should be at least 32 characters long')
		}

		// Port validation
		if (config.serverPort < 1 || config.serverPort > 65535) {
			errors.push('Server port must be between 1 and 65535')
		}

		// Schema validation
		if (!config.dbSchemas || config.dbSchemas.length === 0) {
			warnings.push('No database schemas configured')
		}

		// Connection pool validation
		if (config.dbPoolMaxSize && config.dbPoolMaxSize < 1) {
			warnings.push('Database pool max size should be at least 1')
		}

		// Bridge endpoint validation
		try {
			new URL(config.dbUri)
		} catch {
			errors.push('Database URI must be a valid URL for HTTP bridge')
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings
		}
	}

	/**
	 * Get current configuration
	 */
	public getConfiguration(): PostgRESTBridgeConfig | null {
		return this.config
	}

	/**
	 * Get schema configuration
	 */
	public getSchemaConfiguration(): SchemaIntrospectionConfig | null {
		return this.schemaConfig
	}

	/**
	 * Update JWT secret
	 */
	public updateJWTSecret(newSecret: string): void {
		if (!this.config) {
			throw new Error('Configuration not created yet')
		}

		this.config.jwtSecret = newSecret
		logger.info('JWT secret updated')
	}

	/**
	 * Update CORS origins
	 */
	public updateCORSOrigins(origins: string[]): void {
		if (!this.config) {
			throw new Error('Configuration not created yet')
		}

		this.config.serverCorsOrigins = origins
		logger.info('CORS origins updated', { origins })
	}

	/**
	 * Update database schemas
	 */
	public updateSchemas(schemas: string[]): void {
		if (!this.config) {
			throw new Error('Configuration not created yet')
		}

		this.config.dbSchemas = schemas
		logger.info('Database schemas updated', { schemas })
	}
}

export default PostgRESTConfigManager