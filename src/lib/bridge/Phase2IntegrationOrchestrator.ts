/**
 * Phase 2 Integration Orchestrator
 * 
 * Coordinates all Phase 2 components to provide seamless integration
 * between browser-based PGlite and WebVM-deployed PostgREST services
 */

import { logger } from '@/lib/infrastructure/Logger'
import { errorHandler } from '@/lib/infrastructure/ErrorHandler'
import { WebVMPostgRESTDeployer } from './WebVMPostgRESTDeployer'
import { PostgRESTConfigManager } from './PostgRESTConfigManager'
import { JWTAuthIntegrator } from './JWTAuthIntegrator'
import { BridgeActivator } from './BridgeActivator'
import { PostgRESTEndpointAdapter } from './PostgRESTEndpointAdapter'
import { APICallUpdater } from './APICallUpdater'
import { PGliteBridge } from './PGliteBridge'

export interface Phase2Config {
	// WebVM configuration
	webvmInterface: any
	webvmEndpoint: string
	
	// PostgREST configuration
	postgrestVersion: string
	postgrestPort: number
	
	// Bridge configuration
	bridgePort: number
	bridgeTimeout: number
	
	// Authentication configuration
	jwtSecret: string
	tokenExpiration: number
	
	// Network configuration
	corsOrigins: string[]
	enableRetries: boolean
	retryAttempts: number
	
	// Feature flags
	enableHealthChecks: boolean
	enableMetrics: boolean
	enableLogging: boolean
	fallbackToMSW: boolean
}

export interface Phase2Status {
	// Overall status
	isActive: boolean
	isHealthy: boolean
	startTime?: Date
	uptime?: number
	
	// Component status
	components: {
		deployer: 'inactive' | 'initializing' | 'active' | 'error'
		configManager: 'inactive' | 'active' | 'error'
		authIntegrator: 'inactive' | 'active' | 'error'
		bridgeActivator: 'inactive' | 'activating' | 'active' | 'error'
		endpointAdapter: 'inactive' | 'active' | 'error'
		apiUpdater: 'inactive' | 'active' | 'error'
		pgliteBridge: 'inactive' | 'active' | 'error'
	}
	
	// Performance metrics
	metrics: {
		totalRequests: number
		successfulRequests: number
		failedRequests: number
		averageLatency: number
		errorRate: number
	}
	
	// Error information
	errors: {
		count: number
		lastError?: string
		lastErrorTime?: Date
	}
}

export interface Phase2Event {
	type: 'component-status' | 'health-check' | 'error' | 'metrics-update'
	component?: string
	data: any
	timestamp: Date
}

/**
 * Orchestrates all Phase 2 components for seamless PostgREST integration
 * Manages component lifecycle, health monitoring, and error recovery
 */
export class Phase2IntegrationOrchestrator {
	private static instance: Phase2IntegrationOrchestrator
	private config: Phase2Config | null = null
	private status: Phase2Status
	private eventListeners: Set<(event: Phase2Event) => void> = new Set()
	private healthCheckInterval: NodeJS.Timeout | null = null
	private metricsInterval: NodeJS.Timeout | null = null

	// Component instances
	private deployer: WebVMPostgRESTDeployer | null = null
	private configManager: PostgRESTConfigManager | null = null
	private authIntegrator: JWTAuthIntegrator | null = null
	private bridgeActivator: BridgeActivator | null = null
	private endpointAdapter: PostgRESTEndpointAdapter | null = null
	private apiUpdater: APICallUpdater | null = null
	private pgliteBridge: PGliteBridge | null = null

	private constructor() {
		this.status = {
			isActive: false,
			isHealthy: false,
			components: {
				deployer: 'inactive',
				configManager: 'inactive',
				authIntegrator: 'inactive',
				bridgeActivator: 'inactive',
				endpointAdapter: 'inactive',
				apiUpdater: 'inactive',
				pgliteBridge: 'inactive'
			},
			metrics: {
				totalRequests: 0,
				successfulRequests: 0,
				failedRequests: 0,
				averageLatency: 0,
				errorRate: 0
			},
			errors: {
				count: 0
			}
		}
	}

	public static getInstance(): Phase2IntegrationOrchestrator {
		if (!Phase2IntegrationOrchestrator.instance) {
			Phase2IntegrationOrchestrator.instance = new Phase2IntegrationOrchestrator()
		}
		return Phase2IntegrationOrchestrator.instance
	}

	/**
	 * Initialize and activate the complete Phase 2 integration
	 */
	public async initialize(config: Phase2Config): Promise<void> {
		try {
			logger.info('Initializing Phase 2 Integration Orchestrator')
			this.config = config

			// Phase 1: Initialize all components
			await this.initializeComponents()

			// Phase 2: Configure PostgREST for bridge integration
			await this.configurePostgREST()

			// Phase 3: Set up authentication integration
			await this.setupAuthentication()

			// Phase 4: Deploy PostgREST in WebVM
			await this.deployPostgREST()

			// Phase 5: Activate the bridge
			await this.activateBridge()

			// Phase 6: Switch from MSW to real endpoints
			await this.switchToRealEndpoints()

			// Phase 7: Start monitoring
			await this.startMonitoring()

			this.status.isActive = true
			this.status.startTime = new Date()

			this.emitEvent({
				type: 'component-status',
				data: { status: 'active', message: 'Phase 2 integration activated successfully' },
				timestamp: new Date()
			})

			logger.info('Phase 2 Integration Orchestrator initialized successfully')
		} catch (error) {
			this.handleError('initialize', error as Error)
			throw error
		}
	}

	/**
	 * Deactivate and clean up Phase 2 integration
	 */
	public async shutdown(): Promise<void> {
		try {
			logger.info('Shutting down Phase 2 Integration Orchestrator')

			// Stop monitoring
			this.stopMonitoring()

			// Deactivate components in reverse order
			await this.deactivateComponents()

			this.status.isActive = false
			this.status.isHealthy = false

			this.emitEvent({
				type: 'component-status',
				data: { status: 'inactive', message: 'Phase 2 integration shut down' },
				timestamp: new Date()
			})

			logger.info('Phase 2 Integration Orchestrator shut down successfully')
		} catch (error) {
			this.handleError('shutdown', error as Error)
		}
	}

	/**
	 * Get current integration status
	 */
	public getStatus(): Phase2Status {
		if (this.status.startTime && this.status.isActive) {
			this.status.uptime = Date.now() - this.status.startTime.getTime()
		}
		return { ...this.status }
	}

	/**
	 * Perform comprehensive health check
	 */
	public async performHealthCheck(): Promise<{
		overall: boolean
		components: Record<string, boolean>
		details: Record<string, any>
	}> {
		try {
			const results = {
				overall: false,
				components: {} as Record<string, boolean>,
				details: {} as Record<string, any>
			}

			// Check each component
			if (this.deployer) {
				results.components.deployer = await this.deployer.performHealthCheck()
				results.details.deployer = this.deployer.getStatus()
			}

			if (this.bridgeActivator) {
				const healthStatus = await this.bridgeActivator.performHealthCheck()
				results.components.bridgeActivator = healthStatus.overall
				results.details.bridgeActivator = healthStatus
			}

			if (this.endpointAdapter) {
				// Test a simple request
				try {
					await this.endpointAdapter.request({
						method: 'GET',
						path: '/',
						auth: false
					})
					results.components.endpointAdapter = true
				} catch {
					results.components.endpointAdapter = false
				}
				results.details.endpointAdapter = this.endpointAdapter.getMetrics()
			}

			// Check authentication
			if (this.authIntegrator) {
				const authStatus = this.authIntegrator.getStatus()
				results.components.authIntegrator = true // Always healthy if initialized
				results.details.authIntegrator = authStatus
			}

			// Check API updater
			if (this.apiUpdater) {
				results.components.apiUpdater = this.apiUpdater.isAdapterActive()
				results.details.apiUpdater = this.apiUpdater.getStatus()
			}

			// Overall health is true if all components are healthy
			results.overall = Object.values(results.components).every(status => status)
			
			// Update status
			this.status.isHealthy = results.overall

			this.emitEvent({
				type: 'health-check',
				data: results,
				timestamp: new Date()
			})

			return results
		} catch (error) {
			this.handleError('performHealthCheck', error as Error)
			return {
				overall: false,
				components: {},
				details: { error: error.message }
			}
		}
	}

	/**
	 * Get performance metrics across all components
	 */
	public async getMetrics(): Promise<{
		requests: {
			total: number
			successful: number
			failed: number
			successRate: number
		}
		performance: {
			averageLatency: number
			p95Latency: number
			throughput: number
		}
		components: Record<string, any>
		errors: {
			total: number
			byComponent: Record<string, number>
		}
	}> {
		try {
			const metrics = {
				requests: {
					total: 0,
					successful: 0,
					failed: 0,
					successRate: 0
				},
				performance: {
					averageLatency: 0,
					p95Latency: 0,
					throughput: 0
				},
				components: {} as Record<string, any>,
				errors: {
					total: 0,
					byComponent: {} as Record<string, number>
				}
			}

			// Aggregate metrics from endpoint adapter
			if (this.endpointAdapter) {
				const adapterMetrics = this.endpointAdapter.getMetrics()
				metrics.requests.total += adapterMetrics.requests.total
				metrics.requests.successful += adapterMetrics.requests.successful
				metrics.requests.failed += adapterMetrics.requests.failed
				metrics.performance.averageLatency = adapterMetrics.performance.averageLatency
				metrics.components.endpointAdapter = adapterMetrics
			}

			// Aggregate metrics from bridge activator
			if (this.bridgeActivator) {
				const bridgeMetrics = await this.bridgeActivator.getMetrics()
				metrics.components.bridgeActivator = bridgeMetrics
				metrics.errors.total += bridgeMetrics.errors.bridgeErrors
			}

			// Aggregate metrics from API updater
			if (this.apiUpdater) {
				const updaterStatus = this.apiUpdater.getStatus()
				metrics.components.apiUpdater = updaterStatus
			}

			// Calculate success rate
			if (metrics.requests.total > 0) {
				metrics.requests.successRate = metrics.requests.successful / metrics.requests.total
			}

			// Calculate throughput (requests per minute)
			if (this.status.startTime) {
				const uptimeMinutes = (Date.now() - this.status.startTime.getTime()) / (1000 * 60)
				metrics.performance.throughput = uptimeMinutes > 0 ? metrics.requests.total / uptimeMinutes : 0
			}

			// Update internal metrics
			this.status.metrics = {
				totalRequests: metrics.requests.total,
				successfulRequests: metrics.requests.successful,
				failedRequests: metrics.requests.failed,
				averageLatency: metrics.performance.averageLatency,
				errorRate: 1 - metrics.requests.successRate
			}

			return metrics
		} catch (error) {
			this.handleError('getMetrics', error as Error)
			throw error
		}
	}

	/**
	 * Add event listener for orchestrator events
	 */
	public addEventListener(listener: (event: Phase2Event) => void): void {
		this.eventListeners.add(listener)
	}

	/**
	 * Remove event listener
	 */
	public removeEventListener(listener: (event: Phase2Event) => void): void {
		this.eventListeners.delete(listener)
	}

	/**
	 * Restart a specific component
	 */
	public async restartComponent(componentName: keyof Phase2Status['components']): Promise<void> {
		try {
			logger.info(`Restarting component: ${componentName}`)

			switch (componentName) {
				case 'deployer':
					if (this.deployer && this.config) {
						await this.deployer.stopPostgREST()
						await this.deployPostgREST()
					}
					break

				case 'bridgeActivator':
					if (this.bridgeActivator && this.config) {
						await this.bridgeActivator.deactivate()
						await this.activateBridge()
					}
					break

				case 'endpointAdapter':
					if (this.endpointAdapter) {
						await this.endpointAdapter.deactivate()
						await this.endpointAdapter.activate()
					}
					break

				case 'apiUpdater':
					if (this.apiUpdater) {
						await this.apiUpdater.deactivate()
						await this.apiUpdater.activate()
					}
					break

				default:
					throw new Error(`Component ${componentName} cannot be restarted`)
			}

			this.status.components[componentName] = 'active'
			
			this.emitEvent({
				type: 'component-status',
				component: componentName,
				data: { status: 'restarted' },
				timestamp: new Date()
			})

			logger.info(`Component ${componentName} restarted successfully`)
		} catch (error) {
			this.status.components[componentName] = 'error'
			this.handleError(`restartComponent:${componentName}`, error as Error)
			throw error
		}
	}

	// Private implementation methods

	private async initializeComponents(): Promise<void> {
		logger.info('Initializing Phase 2 components')

		try {
			// Initialize component instances
			this.deployer = WebVMPostgRESTDeployer.getInstance()
			this.configManager = PostgRESTConfigManager.getInstance()
			this.authIntegrator = JWTAuthIntegrator.getInstance()
			this.bridgeActivator = BridgeActivator.getInstance()
			this.endpointAdapter = PostgRESTEndpointAdapter.getInstance()
			this.apiUpdater = APICallUpdater.getInstance()
			this.pgliteBridge = PGliteBridge.getInstance()

			// Initialize deployer
			this.status.components.deployer = 'initializing'
			await this.deployer.initialize(this.config!.webvmInterface)
			this.status.components.deployer = 'active'

			// Initialize other components
			this.status.components.configManager = 'active'
			this.status.components.pgliteBridge = 'active'

			logger.info('All components initialized successfully')
		} catch (error) {
			logger.error('Failed to initialize components', error)
			throw error
		}
	}

	private async configurePostgREST(): Promise<void> {
		logger.info('Configuring PostgREST for bridge integration')

		if (!this.configManager || !this.config) {
			throw new Error('Components not initialized')
		}

		await this.configManager.createBridgeConfiguration({
			bridgeEndpoint: `http://localhost:${this.config.bridgePort}/pglite-bridge`,
			jwtSecret: this.config.jwtSecret,
			port: this.config.postgrestPort,
			schemas: ['public', 'auth', 'storage'],
			corsOrigins: this.config.corsOrigins
		})

		await this.configManager.configureSchemaIntrospection()

		logger.info('PostgREST configuration completed')
	}

	private async setupAuthentication(): Promise<void> {
		logger.info('Setting up JWT authentication integration')

		if (!this.authIntegrator || !this.config) {
			throw new Error('Components not initialized')
		}

		await this.authIntegrator.initialize({
			jwtSecret: this.config.jwtSecret,
			tokenExpiration: this.config.tokenExpiration,
			refreshThreshold: 300,
			roleClaimKey: 'role',
			userClaimKey: 'user_id',
			enableAutoRefresh: true
		})

		this.status.components.authIntegrator = 'active'
		logger.info('JWT authentication integration completed')
	}

	private async deployPostgREST(): Promise<void> {
		logger.info('Deploying PostgREST service in WebVM')

		if (!this.deployer || !this.config) {
			throw new Error('Components not initialized')
		}

		const postgrestConfig = {
			postgrestVersion: this.config.postgrestVersion,
			dbUri: `http://localhost:${this.config.bridgePort}/pglite-bridge`,
			dbSchema: 'public',
			dbAnonRole: 'anonymous',
			jwtSecret: this.config.jwtSecret,
			port: this.config.postgrestPort
		}

		await this.deployer.deployPostgREST(postgrestConfig)
		await this.deployer.startPostgREST()

		logger.info('PostgREST deployment completed')
	}

	private async activateBridge(): Promise<void> {
		logger.info('Activating hybrid architecture bridge')

		if (!this.bridgeActivator || !this.config) {
			throw new Error('Components not initialized')
		}

		this.status.components.bridgeActivator = 'activating'

		const bridgeConfig = {
			webvmEndpoint: this.config.webvmEndpoint,
			postgrestPort: this.config.postgrestPort,
			bridgePort: this.config.bridgePort,
			jwtSecret: this.config.jwtSecret,
			enableHealthChecks: this.config.enableHealthChecks,
			corsOrigins: this.config.corsOrigins
		}

		await this.bridgeActivator.initialize(this.config.webvmInterface)
		await this.bridgeActivator.activate(bridgeConfig)

		this.status.components.bridgeActivator = 'active'
		logger.info('Hybrid architecture bridge activated')
	}

	private async switchToRealEndpoints(): Promise<void> {
		logger.info('Switching from MSW simulation to real PostgREST endpoints')

		if (!this.endpointAdapter || !this.apiUpdater || !this.config) {
			throw new Error('Components not initialized')
		}

		// Initialize endpoint adapter
		await this.endpointAdapter.initialize({
			baseUrl: `http://localhost:${this.config.postgrestPort}`,
			timeout: this.config.bridgeTimeout,
			retryAttempts: this.config.retryAttempts,
			retryDelay: 1000,
			enableLogging: this.config.enableLogging,
			enableMetrics: this.config.enableMetrics
		})

		// Initialize API updater
		await this.apiUpdater.initialize({
			enableLogging: this.config.enableLogging,
			preserveOriginalBehavior: true,
			fallbackToMSW: this.config.fallbackToMSW,
			updateBatchSize: 10
		})

		// Activate both components
		await this.endpointAdapter.activate()
		await this.apiUpdater.activate()

		this.status.components.endpointAdapter = 'active'
		this.status.components.apiUpdater = 'active'

		logger.info('Successfully switched to real PostgREST endpoints')
	}

	private async deactivateComponents(): Promise<void> {
		logger.info('Deactivating Phase 2 components')

		try {
			// Deactivate in reverse order
			if (this.apiUpdater) {
				await this.apiUpdater.deactivate()
				this.status.components.apiUpdater = 'inactive'
			}

			if (this.endpointAdapter) {
				await this.endpointAdapter.deactivate()
				this.status.components.endpointAdapter = 'inactive'
			}

			if (this.bridgeActivator) {
				await this.bridgeActivator.deactivate()
				this.status.components.bridgeActivator = 'inactive'
			}

			if (this.deployer) {
				await this.deployer.stopPostgREST()
				this.status.components.deployer = 'inactive'
			}

			if (this.authIntegrator) {
				await this.authIntegrator.signOut()
				this.status.components.authIntegrator = 'inactive'
			}

			logger.info('All components deactivated successfully')
		} catch (error) {
			logger.error('Error during component deactivation', error)
		}
	}

	private startMonitoring(): void {
		if (!this.config) return

		// Start health check monitoring
		if (this.config.enableHealthChecks) {
			this.healthCheckInterval = setInterval(async () => {
				await this.performHealthCheck()
			}, 60000) // Check every minute
		}

		// Start metrics collection
		if (this.config.enableMetrics) {
			this.metricsInterval = setInterval(async () => {
				try {
					const metrics = await this.getMetrics()
					this.emitEvent({
						type: 'metrics-update',
						data: metrics,
						timestamp: new Date()
					})
				} catch (error) {
					logger.error('Error collecting metrics', error)
				}
			}, 30000) // Collect every 30 seconds
		}

		logger.info('Monitoring started')
	}

	private stopMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
			this.healthCheckInterval = null
		}

		if (this.metricsInterval) {
			clearInterval(this.metricsInterval)
			this.metricsInterval = null
		}

		logger.info('Monitoring stopped')
	}

	private handleError(operation: string, error: Error): void {
		this.status.errors.count++
		this.status.errors.lastError = error.message
		this.status.errors.lastErrorTime = new Date()

		errorHandler.handleError(error, `Phase2IntegrationOrchestrator.${operation}`)

		this.emitEvent({
			type: 'error',
			data: { operation, error: error.message },
			timestamp: new Date()
		})
	}

	private emitEvent(event: Phase2Event): void {
		this.eventListeners.forEach(listener => {
			try {
				listener(event)
			} catch (error) {
				logger.error('Error in event listener', error)
			}
		})
	}
}

export default Phase2IntegrationOrchestrator