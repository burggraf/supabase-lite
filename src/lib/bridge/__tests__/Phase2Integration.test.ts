/**
 * Phase 2 Integration Test Suite
 * 
 * Comprehensive end-to-end testing for PostgREST integration with WebVM
 * Tests the complete hybrid architecture from browser to WebVM
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { WebVMPostgRESTDeployer } from '../WebVMPostgRESTDeployer'
import { PostgRESTConfigManager } from '../PostgRESTConfigManager'
import { JWTAuthIntegrator } from '../JWTAuthIntegrator'
import { BridgeActivator } from '../BridgeActivator'
import { PostgRESTEndpointAdapter } from '../PostgRESTEndpointAdapter'
import { APICallUpdater } from '../APICallUpdater'
import { PGliteBridge } from '../PGliteBridge'

// Mock WebVM interface for testing
const mockWebVMInterface = {
	executeCommand: vi.fn(),
	isAvailable: vi.fn().mockResolvedValue(true),
	getStatus: vi.fn().mockResolvedValue({ running: true })
}

// Mock database manager
const mockDatabaseManager = {
	query: vi.fn(),
	executeQuery: vi.fn(),
	isConnected: vi.fn().mockReturnValue(true)
}

describe('Phase 2 Integration Test Suite', () => {
	let deployer: WebVMPostgRESTDeployer
	let configManager: PostgRESTConfigManager
	let authIntegrator: JWTAuthIntegrator
	let bridgeActivator: BridgeActivator
	let endpointAdapter: PostgRESTEndpointAdapter
	let apiUpdater: APICallUpdater
	let pgliteBridge: PGliteBridge

	beforeAll(async () => {
		// Initialize all components
		deployer = WebVMPostgRESTDeployer.getInstance()
		configManager = PostgRESTConfigManager.getInstance()
		authIntegrator = JWTAuthIntegrator.getInstance()
		bridgeActivator = BridgeActivator.getInstance()
		endpointAdapter = PostgRESTEndpointAdapter.getInstance()
		apiUpdater = APICallUpdater.getInstance()
		pgliteBridge = PGliteBridge.getInstance()

		// Mock successful command executions
		mockWebVMInterface.executeCommand.mockImplementation((command: string) => {
			if (command.includes('wget')) {
				return Promise.resolve({ exitCode: 0, stdout: 'Downloaded', stderr: '' })
			}
			if (command.includes('systemctl start')) {
				return Promise.resolve({ exitCode: 0, stdout: 'Started', stderr: '' })
			}
			if (command.includes('systemctl is-active')) {
				return Promise.resolve({ exitCode: 0, stdout: 'active', stderr: '' })
			}
			if (command.includes('postgrest --version')) {
				return Promise.resolve({ exitCode: 0, stdout: 'postgrest 12.2.0', stderr: '' })
			}
			return Promise.resolve({ exitCode: 0, stdout: 'OK', stderr: '' })
		})

		// Mock successful HTTP responses
		global.fetch = vi.fn().mockImplementation((url: string) => {
			if (url.includes('postgrest')) {
				return Promise.resolve({
					ok: true,
					status: 200,
					statusText: 'OK',
					json: () => Promise.resolve([]),
					text: () => Promise.resolve('[]'),
					headers: new Headers()
				})
			}
			return Promise.resolve({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ success: true })
			})
		})
	})

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterAll(() => {
		vi.restoreAllMocks()
	})

	describe('Component Initialization', () => {
		it('should initialize WebVM PostgREST deployer successfully', async () => {
			await expect(deployer.initialize(mockWebVMInterface)).resolves.not.toThrow()
			expect(mockWebVMInterface.executeCommand).toHaveBeenCalled()
		})

		it('should create PostgREST bridge configuration', async () => {
			const config = await configManager.createBridgeConfiguration({
				bridgeEndpoint: 'http://localhost:8081/pglite-bridge',
				jwtSecret: 'test-secret-key-that-is-long-enough-for-testing',
				port: 3000,
				schemas: ['public', 'auth', 'storage']
			})

			expect(config).toBeDefined()
			expect(config.dbUri).toBe('http://localhost:8081/pglite-bridge')
			expect(config.serverPort).toBe(3000)
			expect(config.dbSchemas).toEqual(['public', 'auth', 'storage'])
		})

		it('should initialize JWT authentication integrator', async () => {
			await expect(authIntegrator.initialize({
				jwtSecret: 'test-secret-key-that-is-long-enough-for-testing',
				tokenExpiration: 3600,
				refreshThreshold: 300,
				roleClaimKey: 'role',
				userClaimKey: 'user_id',
				enableAutoRefresh: true
			})).resolves.not.toThrow()
		})

		it('should initialize bridge activator', async () => {
			await expect(bridgeActivator.initialize(mockWebVMInterface)).resolves.not.toThrow()
		})

		it('should initialize endpoint adapter', async () => {
			await expect(endpointAdapter.initialize({
				baseUrl: 'http://localhost:3000',
				timeout: 10000,
				retryAttempts: 3,
				retryDelay: 1000,
				enableLogging: true,
				enableMetrics: true
			})).resolves.not.toThrow()
		})

		it('should initialize API call updater', async () => {
			await expect(apiUpdater.initialize({
				enableLogging: true,
				preserveOriginalBehavior: true,
				fallbackToMSW: true,
				updateBatchSize: 10
			})).resolves.not.toThrow()
		})
	})

	describe('PostgREST Deployment', () => {
		it('should deploy PostgREST service in WebVM', async () => {
			const config = {
				postgrestVersion: '12.2.0',
				dbUri: 'http://localhost:8081/pglite-bridge',
				dbSchema: 'public',
				dbAnonRole: 'anonymous',
				jwtSecret: 'test-secret-key-that-is-long-enough-for-testing',
				port: 3000
			}

			await expect(deployer.deployPostgREST(config)).resolves.not.toThrow()
			
			// Verify deployment commands were executed
			expect(mockWebVMInterface.executeCommand).toHaveBeenCalledWith(
				expect.stringContaining('wget')
			)
			expect(mockWebVMInterface.executeCommand).toHaveBeenCalledWith(
				expect.stringContaining('tar -xf')
			)
		})

		it('should start PostgREST service successfully', async () => {
			await expect(deployer.startPostgREST()).resolves.not.toThrow()
			
			const status = deployer.getStatus()
			expect(status.isRunning).toBe(true)
			expect(status.isDeployed).toBe(true)
		})

		it('should perform health check on PostgREST service', async () => {
			const isHealthy = await deployer.performHealthCheck()
			expect(isHealthy).toBe(true)
		})
	})

	describe('Configuration Management', () => {
		it('should generate valid PostgREST configuration file', () => {
			const configContent = configManager.generateConfigFile()
			
			expect(configContent).toContain('db-uri =')
			expect(configContent).toContain('db-schema =')
			expect(configContent).toContain('jwt-secret =')
			expect(configContent).toContain('server-port =')
		})

		it('should generate environment variables', () => {
			const envVars = configManager.generateEnvironmentVariables()
			
			expect(envVars).toHaveProperty('PGRST_DB_URI')
			expect(envVars).toHaveProperty('PGRST_JWT_SECRET')
			expect(envVars).toHaveProperty('PGRST_SERVER_PORT')
		})

		it('should validate configuration correctly', () => {
			const validation = configManager.validateConfiguration()
			
			expect(validation.isValid).toBe(true)
			expect(validation.errors).toHaveLength(0)
		})

		it('should configure schema introspection', async () => {
			const schemaConfig = await configManager.configureSchemaIntrospection()
			
			expect(schemaConfig.schemas).toEqual(['public', 'auth', 'storage'])
			expect(schemaConfig.functions).toHaveLength(6)
			expect(schemaConfig.functions.some(f => f.name === 'jwt')).toBe(true)
		})
	})

	describe('JWT Authentication Integration', () => {
		it('should generate PostgREST-compatible JWT token', async () => {
			// Mock auth service to return a user
			vi.spyOn(authIntegrator as any, 'getCurrentUser').mockResolvedValue({
				userId: 'test-user-id',
				role: 'authenticated',
				email: 'test@example.com',
				permissions: ['read:public', 'write:own']
			})

			const token = await authIntegrator.generatePostgRESTToken()
			
			expect(token).toBeDefined()
			expect(typeof token).toBe('string')
			expect(token.split('.')).toHaveLength(3) // JWT format
		})

		it('should validate JWT token and extract auth context', async () => {
			// Generate a token first
			vi.spyOn(authIntegrator as any, 'getCurrentUser').mockResolvedValue({
				userId: 'test-user-id',
				role: 'authenticated',
				email: 'test@example.com',
				permissions: ['read:public', 'write:own']
			})

			const token = await authIntegrator.generatePostgRESTToken()
			const authContext = await authIntegrator.validatePostgRESTToken(token)
			
			expect(authContext.userId).toBe('test-user-id')
			expect(authContext.role).toBe('authenticated')
			expect(authContext.isAnonymous).toBe(false)
		})

		it('should create anonymous context when no auth token', async () => {
			const anonymousContext = await authIntegrator.createAnonymousContext()
			
			expect(anonymousContext.role).toBe('anonymous')
			expect(anonymousContext.isAnonymous).toBe(true)
			expect(anonymousContext.permissions).toContain('read:public')
		})

		it('should extract auth context from request headers', async () => {
			const headers = new Headers()
			headers.set('Authorization', 'Bearer invalid-token')
			
			const authContext = await authIntegrator.extractAuthContextFromRequest(headers)
			
			// Should fall back to anonymous if token is invalid
			expect(authContext.isAnonymous).toBe(true)
		})
	})

	describe('Bridge Activation', () => {
		it('should activate hybrid architecture bridge', async () => {
			const config = {
				webvmEndpoint: 'http://localhost:8080',
				postgrestPort: 3000,
				bridgePort: 8081,
				jwtSecret: 'test-secret-key-that-is-long-enough-for-testing',
				enableHealthChecks: true,
				corsOrigins: ['http://localhost:5173']
			}

			// Mock PGlite bridge initialization
			vi.spyOn(pgliteBridge, 'initialize').mockResolvedValue()
			vi.spyOn(pgliteBridge, 'startHTTPServer').mockResolvedValue()

			await expect(bridgeActivator.activate(config)).resolves.not.toThrow()
			
			const status = bridgeActivator.getStatus()
			expect(status.isActive).toBe(true)
			expect(status.bridgeEndpoint).toBe('http://localhost:8081')
		})

		it('should perform comprehensive health check', async () => {
			const healthStatus = await bridgeActivator.performHealthCheck()
			
			expect(healthStatus).toHaveProperty('overall')
			expect(healthStatus).toHaveProperty('components')
			expect(healthStatus.components).toHaveProperty('bridge')
			expect(healthStatus.components).toHaveProperty('postgrest')
			expect(healthStatus.components).toHaveProperty('connectivity')
		})
	})

	describe('Endpoint Adapter', () => {
		it('should make GET request to PostgREST', async () => {
			const response = await endpointAdapter.get('users')
			
			expect(response).toHaveProperty('data')
			expect(response).toHaveProperty('status')
			expect(response.status).toBe(200)
		})

		it('should make POST request to PostgREST', async () => {
			const testData = { name: 'Test User', email: 'test@example.com' }
			const response = await endpointAdapter.post('users', testData)
			
			expect(response).toHaveProperty('data')
			expect(response.status).toBe(200)
		})

		it('should execute RPC function call', async () => {
			const response = await endpointAdapter.rpc('get_user_count')
			
			expect(response).toHaveProperty('data')
			expect(response.status).toBe(200)
		})

		it('should track request metrics', async () => {
			await endpointAdapter.get('users')
			await endpointAdapter.post('posts', { title: 'Test' })
			
			const metrics = endpointAdapter.getMetrics()
			
			expect(metrics.requests.total).toBeGreaterThan(0)
			expect(metrics.requests.successful).toBeGreaterThan(0)
			expect(metrics.requests.byMethod).toHaveProperty('GET')
			expect(metrics.requests.byMethod).toHaveProperty('POST')
		})
	})

	describe('API Call Updates', () => {
		it('should activate API call interception', async () => {
			await expect(apiUpdater.activate()).resolves.not.toThrow()
			expect(apiUpdater.isAdapterActive()).toBe(true)
		})

		it('should update Supabase REST API calls', async () => {
			const originalUrl = '/rest/v1/users?select=*'
			const result = await apiUpdater.updateAPICall(originalUrl, { method: 'GET' })
			
			expect(result.updated).toBe(true)
			expect(result.url).toContain('localhost:3000')
		})

		it('should handle RPC function calls', async () => {
			const originalUrl = '/rest/v1/rpc/get_user_count'
			const result = await apiUpdater.updateAPICall(originalUrl, { 
				method: 'POST',
				body: JSON.stringify({})
			})
			
			expect(result.updated).toBe(true)
			expect(result.url).toContain('rpc/get_user_count')
		})

		it('should track API update statistics', async () => {
			await apiUpdater.updateAPICall('/rest/v1/users', { method: 'GET' })
			await apiUpdater.updateAPICall('/rest/v1/posts', { method: 'GET' })
			
			const status = apiUpdater.getStatus()
			
			expect(status.totalCalls).toBeGreaterThan(0)
			expect(status.updatedCalls).toBeGreaterThan(0)
		})
	})

	describe('End-to-End Integration', () => {
		it('should handle complete request flow from browser to WebVM', async () => {
			// Simulate a complete request flow:
			// 1. API call intercepted by updater
			// 2. Routed through endpoint adapter  
			// 3. Authenticated via JWT integrator
			// 4. Processed by PostgREST in WebVM
			// 5. Response returned through bridge

			const originalUrl = '/rest/v1/users?select=id,email&limit=10'
			
			// Update API call
			const updatedCall = await apiUpdater.updateAPICall(originalUrl, { method: 'GET' })
			expect(updatedCall.updated).toBe(true)
			
			// Make request through adapter
			const response = await endpointAdapter.get('users', { select: 'id,email', limit: 10 })
			expect(response.status).toBe(200)
			
			// Verify auth integration
			const authStatus = authIntegrator.getStatus()
			expect(authStatus).toBeDefined()
		})

		it('should maintain performance within acceptable limits', async () => {
			const startTime = performance.now()
			
			// Make multiple requests to test performance
			const requests = Array.from({ length: 10 }, (_, i) => 
				endpointAdapter.get('users', { limit: 1, offset: i })
			)
			
			await Promise.all(requests)
			
			const endTime = performance.now()
			const totalTime = endTime - startTime
			
			// Should complete within reasonable time (adjust threshold as needed)
			expect(totalTime).toBeLessThan(5000) // 5 seconds
			
			const metrics = endpointAdapter.getMetrics()
			expect(metrics.performance.averageLatency).toBeLessThan(500) // 500ms average
		})

		it('should handle error scenarios gracefully', async () => {
			// Mock a network error
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
			
			await expect(endpointAdapter.get('users')).rejects.toThrow('Network error')
			
			const metrics = endpointAdapter.getMetrics()
			expect(metrics.errors.networkErrors).toBeGreaterThan(0)
		})

		it('should support fallback to MSW when PostgREST is unavailable', async () => {
			// Simulate PostgREST being down
			global.fetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes('localhost:3000')) {
					return Promise.reject(new Error('Connection refused'))
				}
				// MSW fallback response
				return Promise.resolve({
					ok: true,
					status: 200,
					json: () => Promise.resolve({ data: 'fallback' })
				})
			})
			
			// Should not throw error due to fallback
			const originalUrl = '/rest/v1/users'
			const result = await apiUpdater.updateAPICall(originalUrl, { method: 'GET' })
			
			// Should either update or fallback gracefully
			expect(result).toBeDefined()
		})
	})

	describe('Cleanup and Teardown', () => {
		it('should deactivate bridge components gracefully', async () => {
			await expect(bridgeActivator.deactivate()).resolves.not.toThrow()
			await expect(endpointAdapter.deactivate()).resolves.not.toThrow()
			await expect(apiUpdater.deactivate()).resolves.not.toThrow()
			
			const bridgeStatus = bridgeActivator.getStatus()
			expect(bridgeStatus.isActive).toBe(false)
		})

		it('should stop PostgREST service cleanly', async () => {
			await expect(deployer.stopPostgREST()).resolves.not.toThrow()
			
			const status = deployer.getStatus()
			expect(status.isRunning).toBe(false)
		})

		it('should clear authentication state on sign out', async () => {
			await expect(authIntegrator.signOut()).resolves.not.toThrow()
			
			const status = authIntegrator.getStatus()
			expect(status.isAuthenticated).toBe(false)
		})
	})
})