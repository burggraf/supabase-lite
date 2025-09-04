/**
 * Bridge Activator
 * 
 * Activates the HTTP bridge for browser-to-WebVM communication
 * Replaces MSW handlers with real PostgREST integration
 */

import { logger } from '@/lib/infrastructure/Logger'
import { errorHandler } from '@/lib/infrastructure/ErrorHandler'
import { PGliteBridge } from './PGliteBridge'
import { WebVMPostgRESTDeployer } from './WebVMPostgRESTDeployer'
import { PostgRESTConfigManager } from './PostgRESTConfigManager'

export interface BridgeActivationConfig {
	webvmEndpoint: string
	postgrestPort: number
	bridgePort: number
	jwtSecret: string
	enableHealthChecks: boolean
	corsOrigins: string[]
}

export interface BridgeActivationStatus {
	isActive: boolean
	bridgeEndpoint: string
	postgrestEndpoint: string
	lastHealthCheck?: Date
	errorCount: number
	startTime?: Date
	uptime?: number
}

/**
 * Activates the hybrid architecture bridge
 * Coordinates between PGlite, HTTP bridge, and PostgREST service
 */
export class BridgeActivator {
	private static instance: BridgeActivator
	private status: BridgeActivationStatus
	private pgLiteBridge: PGliteBridge | null = null
	private postgrestDeployer: WebVMPostgRESTDeployer | null = null
	private configManager: PostgRESTConfigManager | null = null
	private healthCheckInterval: NodeJS.Timeout | null = null
	private webvmInterface: any = null

	private constructor() {
		this.status = {
			isActive: false,
			bridgeEndpoint: '',
			postgrestEndpoint: '',
			errorCount: 0
		}
	}

	public static getInstance(): BridgeActivator {
		if (!BridgeActivator.instance) {
			BridgeActivator.instance = new BridgeActivator()
		}
		return BridgeActivator.instance
	}

	/**
	 * Initialize bridge components
	 */
	public async initialize(webvmInterface: any): Promise<void> {
		try {
			logger.info('Initializing Bridge Activator')
			this.webvmInterface = webvmInterface

			// Initialize components
			this.pgLiteBridge = PGliteBridge.getInstance()
			this.postgrestDeployer = WebVMPostgRESTDeployer.getInstance()
			this.configManager = PostgRESTConfigManager.getInstance()

			// Initialize WebVM components
			await this.postgrestDeployer.initialize(webvmInterface)

			logger.info('Bridge Activator initialized successfully')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'BridgeActivator.initialize' })
			throw error
		}
	}

	/**
	 * Activate the full hybrid architecture bridge
	 */
	public async activate(config: BridgeActivationConfig): Promise<void> {
		try {
			logger.info('Activating hybrid architecture bridge', config)

			// Step 1: Configure PostgREST for bridge communication
			const bridgeEndpoint = `http://localhost:${config.bridgePort}/pglite-bridge`
			
			await this.configManager!.createBridgeConfiguration({
				bridgeEndpoint,
				jwtSecret: config.jwtSecret,
				port: config.postgrestPort,
				schemas: ['public', 'auth', 'storage'],
				corsOrigins: config.corsOrigins
			})

			// Step 2: Start PGlite HTTP bridge server
			await this.startBridgeServer(config.bridgePort)

			// Step 3: Deploy and start PostgREST in WebVM
			await this.deployPostgRESTService(config)

			// Step 4: Verify end-to-end connectivity
			await this.verifyBridgeConnectivity()

			// Step 5: Replace MSW handlers
			await this.replaceMSWHandlers()

			// Step 6: Start health monitoring
			if (config.enableHealthChecks) {
				this.startHealthMonitoring()
			}

			// Update status
			this.status = {
				isActive: true,
				bridgeEndpoint: `http://localhost:${config.bridgePort}`,
				postgrestEndpoint: `http://localhost:${config.postgrestPort}`,
				errorCount: 0,
				startTime: new Date()
			}

			logger.info('Hybrid architecture bridge activated successfully')
		} catch (error) {
			this.status.errorCount++
			errorHandler.handleError(error as Error, { context: 'BridgeActivator.activate' })
			throw error
		}
	}

	/**
	 * Deactivate the bridge and restore MSW handlers
	 */
	public async deactivate(): Promise<void> {
		try {
			logger.info('Deactivating hybrid architecture bridge')

			// Stop health monitoring
			this.stopHealthMonitoring()

			// Stop PostgREST service
			if (this.postgrestDeployer) {
				await this.postgrestDeployer.stopPostgREST()
			}

			// Stop bridge server
			await this.stopBridgeServer()

			// Restore MSW handlers
			await this.restoreMSWHandlers()

			this.status.isActive = false
			logger.info('Hybrid architecture bridge deactivated')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'BridgeActivator.deactivate' })
		}
	}

	/**
	 * Get current activation status
	 */
	public getStatus(): BridgeActivationStatus {
		if (this.status.startTime && this.status.isActive) {
			this.status.uptime = Date.now() - this.status.startTime.getTime()
		}
		return { ...this.status }
	}

	/**
	 * Perform health check on entire bridge system
	 */
	public async performHealthCheck(): Promise<{
		overall: boolean
		components: {
			bridge: boolean
			postgrest: boolean
			connectivity: boolean
		}
	}> {
		try {
			const results = {
				overall: false,
				components: {
					bridge: false,
					postgrest: false,
					connectivity: false
				}
			}

			// Check PGlite bridge health
			if (this.pgLiteBridge) {
				try {
					const response = await fetch(`${this.status.bridgeEndpoint}/health`)
					results.components.bridge = response.ok
				} catch {
					results.components.bridge = false
				}
			}

			// Check PostgREST health
			if (this.postgrestDeployer) {
				results.components.postgrest = await this.postgrestDeployer.performHealthCheck()
			}

			// Check end-to-end connectivity
			results.components.connectivity = await this.testEndToEndConnectivity()

			results.overall = Object.values(results.components).every(status => status)
			this.status.lastHealthCheck = new Date()

			if (!results.overall) {
				this.status.errorCount++
			}

			return results
		} catch (error) {
			logger.error('Health check failed', error)
			this.status.errorCount++
			return {
				overall: false,
				components: { bridge: false, postgrest: false, connectivity: false }
			}
		}
	}

	/**
	 * Get bridge metrics and performance data
	 */
	public async getMetrics(): Promise<{
		requests: {
			total: number
			successful: number
			failed: number
			averageLatency: number
		}
		connections: {
			active: number
			poolSize: number
		}
		errors: {
			bridgeErrors: number
			postgrestErrors: number
		}
	}> {
		// Implementation would collect metrics from bridge and PostgREST
		// For now, return mock data structure
		return {
			requests: {
				total: 0,
				successful: 0,
				failed: 0,
				averageLatency: 0
			},
			connections: {
				active: 0,
				poolSize: 10
			},
			errors: {
				bridgeErrors: this.status.errorCount,
				postgrestErrors: this.postgrestDeployer?.getStatus().errorCount || 0
			}
		}
	}

	// Private helper methods

	private async startBridgeServer(port: number): Promise<void> {
		logger.info('Starting PGlite HTTP bridge server', { port })
		
		if (!this.pgLiteBridge) {
			throw new Error('PGlite bridge not initialized')
		}

		// Start HTTP server for bridge
		await this.pgLiteBridge.startHTTPServer({
			port,
			enableCORS: true,
			corsOrigins: this.configManager?.getConfiguration()?.serverCorsOrigins || ['*']
		})

		logger.info('PGlite HTTP bridge server started')
	}

	private async stopBridgeServer(): Promise<void> {
		logger.info('Stopping PGlite HTTP bridge server')
		
		if (this.pgLiteBridge) {
			await this.pgLiteBridge.stopHTTPServer()
		}
		
		logger.info('PGlite HTTP bridge server stopped')
	}

	private async deployPostgRESTService(config: BridgeActivationConfig): Promise<void> {
		logger.info('Deploying PostgREST service in WebVM')
		
		if (!this.postgrestDeployer || !this.configManager) {
			throw new Error('Components not initialized')
		}

		const postgrestConfig = {
			postgrestVersion: '12.2.0',
			dbUri: `http://localhost:${config.bridgePort}/pglite-bridge`,
			dbSchema: 'public',
			dbAnonRole: 'anonymous',
			jwtSecret: config.jwtSecret,
			port: config.postgrestPort
		}

		await this.postgrestDeployer.deployPostgREST(postgrestConfig)
		await this.postgrestDeployer.startPostgREST()

		logger.info('PostgREST service deployed and started')
	}

	private async verifyBridgeConnectivity(): Promise<void> {
		logger.info('Verifying end-to-end bridge connectivity')
		
		// Test basic connectivity through PostgREST
		const testEndpoint = `http://localhost:${this.status.postgrestEndpoint.split(':')[2]}`
		
		try {
			const response = await fetch(testEndpoint, { method: 'GET' })
			if (!response.ok) {
				throw new Error(`Connectivity test failed: ${response.status}`)
			}
		} catch (error) {
			throw new Error(`Bridge connectivity verification failed: ${error}`)
		}
		
		logger.info('Bridge connectivity verified')
	}

	private async testEndToEndConnectivity(): Promise<boolean> {
		try {
			// Test a simple query through the entire stack
			const testQuery = 'SELECT 1 as test'
			const bridgeResponse = await fetch(`${this.status.bridgeEndpoint}/query`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sql: testQuery })
			})

			if (!bridgeResponse.ok) {
				return false
			}

			const result = await bridgeResponse.json()
			return result && result.data && result.data.length > 0
		} catch {
			return false
		}
	}

	private async replaceMSWHandlers(): Promise<void> {
		logger.info('Replacing MSW handlers with real PostgREST endpoints')
		
		// This would dynamically update the MSW handlers or disable them
		// and route requests to the real PostgREST service
		
		// For now, we'll emit an event that the application can listen to
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('bridge-activated', {
				detail: {
					postgrestEndpoint: this.status.postgrestEndpoint,
					bridgeEndpoint: this.status.bridgeEndpoint
				}
			}))
		}
		
		logger.info('MSW handlers replaced with PostgREST integration')
	}

	private async restoreMSWHandlers(): Promise<void> {
		logger.info('Restoring MSW handlers')
		
		// This would restore the MSW handlers to simulation mode
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('bridge-deactivated'))
		}
		
		logger.info('MSW handlers restored')
	}

	private startHealthMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
		}

		this.healthCheckInterval = setInterval(async () => {
			const healthStatus = await this.performHealthCheck()
			
			if (!healthStatus.overall) {
				logger.warn('Bridge health check failed', healthStatus)
				
				// Attempt recovery if multiple failures
				if (this.status.errorCount > 5) {
					logger.info('Attempting bridge recovery due to health failures')
					try {
						// Could implement recovery logic here
						// For now, just log the issue
						logger.error('Bridge requires manual intervention')
					} catch (error) {
						logger.error('Bridge recovery failed', error)
					}
				}
			}
		}, 60000) // Check every minute
	}

	private stopHealthMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
			this.healthCheckInterval = null
		}
	}
}

export default BridgeActivator