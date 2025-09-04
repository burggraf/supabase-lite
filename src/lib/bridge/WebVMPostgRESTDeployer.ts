/**
 * WebVM PostgREST Deployer
 * 
 * Phase 2 implementation for deploying real PostgREST service in WebVM 2.0
 * Replaces simulation with actual PostgREST binary running inside WebVM
 */

import { logger } from '@/lib/infrastructure/Logger'
import { errorHandler } from '@/lib/infrastructure/ErrorHandler'

export interface PostgRESTDeploymentConfig {
	postgrestVersion: string
	dbUri: string
	dbSchema: string
	dbAnonRole: string
	jwtSecret: string
	port: number
	maxRows?: number
	preRequest?: string
	roleClaimKey?: string
}

export interface WebVMPostgRESTStatus {
	isDeployed: boolean
	isRunning: boolean
	version: string
	port: number
	pid?: number
	uptime?: number
	lastHealthCheck?: Date
	errorCount: number
}

/**
 * Manages real PostgREST deployment inside WebVM 2.0
 * Replaces MSW simulation with actual PostgREST service
 */
export class WebVMPostgRESTDeployer {
	private static instance: WebVMPostgRESTDeployer
	private deploymentStatus: WebVMPostgRESTStatus
	private config: PostgRESTDeploymentConfig | null = null
	private healthCheckInterval: NodeJS.Timeout | null = null
	private webvmInterface: any = null

	private constructor() {
		this.deploymentStatus = {
			isDeployed: false,
			isRunning: false,
			version: '',
			port: 3000,
			errorCount: 0
		}
	}

	public static getInstance(): WebVMPostgRESTDeployer {
		if (!WebVMPostgRESTDeployer.instance) {
			WebVMPostgRESTDeployer.instance = new WebVMPostgRESTDeployer()
		}
		return WebVMPostgRESTDeployer.instance
	}

	/**
	 * Initialize WebVM interface for PostgREST deployment
	 */
	public async initialize(webvmInterface: any): Promise<void> {
		try {
			logger.info('Initializing WebVM PostgREST deployer')
			this.webvmInterface = webvmInterface
			
			// Check if WebVM is available and responsive
			const webvmStatus = await this.checkWebVMAvailability()
			if (!webvmStatus.available) {
				throw new Error('WebVM is not available for PostgREST deployment')
			}
			
			logger.info('WebVM PostgREST deployer initialized successfully')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'WebVMPostgRESTDeployer.initialize' })
			throw error
		}
	}

	/**
	 * Deploy PostgREST binary to WebVM and configure it
	 */
	public async deployPostgREST(config: PostgRESTDeploymentConfig): Promise<void> {
		try {
			logger.info('Starting PostgREST deployment in WebVM', { version: config.postgrestVersion })
			this.config = config

			// Step 1: Download and install PostgREST binary in WebVM
			await this.installPostgRESTBinary(config.postgrestVersion)

			// Step 2: Create configuration file
			await this.createPostgRESTConfig(config)

			// Step 3: Set up systemd service or process manager
			await this.setupPostgRESTService()

			// Step 4: Start PostgREST service
			await this.startPostgRESTService()

			// Step 5: Verify deployment
			await this.verifyDeployment()

			this.deploymentStatus.isDeployed = true
			this.deploymentStatus.version = config.postgrestVersion
			this.deploymentStatus.port = config.port

			logger.info('PostgREST deployed successfully in WebVM')
		} catch (error) {
			this.deploymentStatus.errorCount++
			errorHandler.handleError(error as Error, { context: 'WebVMPostgRESTDeployer.deployPostgREST' })
			throw error
		}
	}

	/**
	 * Start PostgREST service in WebVM
	 */
	public async startPostgREST(): Promise<void> {
		try {
			if (!this.deploymentStatus.isDeployed) {
				throw new Error('PostgREST not deployed yet')
			}

			logger.info('Starting PostgREST service in WebVM')
			
			// Execute PostgREST start command in WebVM
			const result = await this.webvmInterface.executeCommand('systemctl start postgrest')
			
			if (result.exitCode !== 0) {
				throw new Error(`Failed to start PostgREST: ${result.stderr}`)
			}

			// Wait for service to be ready
			await this.waitForServiceReady()

			this.deploymentStatus.isRunning = true
			this.deploymentStatus.lastHealthCheck = new Date()

			// Start health monitoring
			this.startHealthMonitoring()

			logger.info('PostgREST service started successfully')
		} catch (error) {
			this.deploymentStatus.errorCount++
			errorHandler.handleError(error as Error, { context: 'WebVMPostgRESTDeployer.startPostgREST' })
			throw error
		}
	}

	/**
	 * Stop PostgREST service in WebVM
	 */
	public async stopPostgREST(): Promise<void> {
		try {
			logger.info('Stopping PostgREST service in WebVM')

			// Stop health monitoring
			this.stopHealthMonitoring()

			// Execute stop command
			const result = await this.webvmInterface.executeCommand('systemctl stop postgrest')
			
			if (result.exitCode !== 0) {
				logger.warn(`PostgREST stop command failed: ${result.stderr}`)
			}

			this.deploymentStatus.isRunning = false
			logger.info('PostgREST service stopped')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'WebVMPostgRESTDeployer.stopPostgREST' })
		}
	}

	/**
	 * Get current deployment status
	 */
	public getStatus(): WebVMPostgRESTStatus {
		return { ...this.deploymentStatus }
	}

	/**
	 * Perform health check on PostgREST service
	 */
	public async performHealthCheck(): Promise<boolean> {
		try {
			if (!this.deploymentStatus.isRunning) {
				return false
			}

			// Check if PostgREST is responding
			const response = await fetch(`http://localhost:${this.config?.port || 3000}/`, {
				method: 'GET',
				timeout: 5000
			} as RequestInit)

			const isHealthy = response.ok
			this.deploymentStatus.lastHealthCheck = new Date()

			if (!isHealthy) {
				this.deploymentStatus.errorCount++
				logger.warn('PostgREST health check failed', { 
					status: response.status,
					statusText: response.statusText 
				})
			}

			return isHealthy
		} catch (error) {
			this.deploymentStatus.errorCount++
			logger.error('PostgREST health check error', error)
			return false
		}
	}

	/**
	 * Get PostgREST service logs
	 */
	public async getLogs(lines: number = 100): Promise<string[]> {
		try {
			const result = await this.webvmInterface.executeCommand(
				`journalctl -u postgrest -n ${lines} --no-pager`
			)
			
			if (result.exitCode === 0) {
				return result.stdout.split('\n').filter(line => line.trim())
			}
			
			return []
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'WebVMPostgRESTDeployer.getLogs' })
			return []
		}
	}

	/**
	 * Update PostgREST configuration and restart service
	 */
	public async updateConfiguration(newConfig: Partial<PostgRESTDeploymentConfig>): Promise<void> {
		try {
			if (!this.config) {
				throw new Error('No existing configuration to update')
			}

			logger.info('Updating PostgREST configuration')
			
			// Merge new config with existing
			const updatedConfig = { ...this.config, ...newConfig }
			
			// Create new configuration file
			await this.createPostgRESTConfig(updatedConfig)
			
			// Restart service to apply changes
			await this.stopPostgREST()
			await this.startPostgREST()
			
			this.config = updatedConfig
			logger.info('PostgREST configuration updated successfully')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'WebVMPostgRESTDeployer.updateConfiguration' })
			throw error
		}
	}

	// Private helper methods

	private async checkWebVMAvailability(): Promise<{ available: boolean; version?: string }> {
		try {
			const result = await this.webvmInterface.executeCommand('uname -a')
			return {
				available: result.exitCode === 0,
				version: result.stdout.trim()
			}
		} catch (error) {
			return { available: false }
		}
	}

	private async installPostgRESTBinary(version: string): Promise<void> {
		logger.info('Installing PostgREST binary in WebVM', { version })
		
		// Download PostgREST binary
		const downloadUrl = `https://github.com/PostgREST/postgrest/releases/download/v${version}/postgrest-v${version}-linux-static-x64.tar.xz`
		
		const commands = [
			`wget -O /tmp/postgrest.tar.xz "${downloadUrl}"`,
			'cd /tmp && tar -xf postgrest.tar.xz',
			'sudo mv postgrest /usr/local/bin/',
			'sudo chmod +x /usr/local/bin/postgrest',
			'postgrest --version'
		]

		for (const command of commands) {
			const result = await this.webvmInterface.executeCommand(command)
			if (result.exitCode !== 0) {
				throw new Error(`Command failed: ${command}\nError: ${result.stderr}`)
			}
		}

		logger.info('PostgREST binary installed successfully')
	}

	private async createPostgRESTConfig(config: PostgRESTDeploymentConfig): Promise<void> {
		logger.info('Creating PostgREST configuration file')
		
		const configContent = `
# PostgREST Configuration
db-uri = "${config.dbUri}"
db-schema = "${config.dbSchema}"
db-anon-role = "${config.dbAnonRole}"
jwt-secret = "${config.jwtSecret}"
server-port = ${config.port}

# Optional settings
${config.maxRows ? `max-rows = ${config.maxRows}` : '# max-rows = 1000'}
${config.preRequest ? `pre-request = "${config.preRequest}"` : '# pre-request = ""'}
${config.roleClaimKey ? `role-claim-key = "${config.roleClaimKey}"` : '# role-claim-key = "role"'}

# Logging
log-level = "info"
`

		// Write configuration to file
		const writeResult = await this.webvmInterface.executeCommand(
			`sudo tee /etc/postgrest.conf > /dev/null << 'EOF'\n${configContent}\nEOF`
		)
		
		if (writeResult.exitCode !== 0) {
			throw new Error(`Failed to write PostgREST config: ${writeResult.stderr}`)
		}

		logger.info('PostgREST configuration file created')
	}

	private async setupPostgRESTService(): Promise<void> {
		logger.info('Setting up PostgREST systemd service')
		
		const serviceContent = `
[Unit]
Description=PostgREST API Server
After=network.target

[Service]
Type=simple
User=postgrest
Group=postgrest
ExecStart=/usr/local/bin/postgrest /etc/postgrest.conf
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`

		// Create user for PostgREST service
		await this.webvmInterface.executeCommand('sudo useradd -r -s /bin/false postgrest')
		
		// Write systemd service file
		const writeResult = await this.webvmInterface.executeCommand(
			`sudo tee /etc/systemd/system/postgrest.service > /dev/null << 'EOF'\n${serviceContent}\nEOF`
		)
		
		if (writeResult.exitCode !== 0) {
			throw new Error(`Failed to create systemd service: ${writeResult.stderr}`)
		}

		// Reload systemd
		await this.webvmInterface.executeCommand('sudo systemctl daemon-reload')
		await this.webvmInterface.executeCommand('sudo systemctl enable postgrest')

		logger.info('PostgREST systemd service configured')
	}

	private async startPostgRESTService(): Promise<void> {
		const result = await this.webvmInterface.executeCommand('sudo systemctl start postgrest')
		
		if (result.exitCode !== 0) {
			throw new Error(`Failed to start PostgREST service: ${result.stderr}`)
		}
	}

	private async waitForServiceReady(timeoutMs: number = 30000): Promise<void> {
		const startTime = Date.now()
		const port = this.config?.port || 3000
		
		while (Date.now() - startTime < timeoutMs) {
			try {
				const response = await fetch(`http://localhost:${port}/`, { 
					method: 'GET',
					timeout: 2000 
				} as RequestInit)
				
				if (response.ok) {
					logger.info('PostgREST service is ready')
					return
				}
			} catch {
				// Service not ready yet
			}
			
			await new Promise(resolve => setTimeout(resolve, 1000))
		}
		
		throw new Error(`PostgREST service did not become ready within ${timeoutMs}ms`)
	}

	private async verifyDeployment(): Promise<void> {
		logger.info('Verifying PostgREST deployment')
		
		// Check systemd service status
		const statusResult = await this.webvmInterface.executeCommand('systemctl is-active postgrest')
		if (statusResult.stdout.trim() !== 'active') {
			throw new Error('PostgREST service is not active')
		}

		// Check if PostgREST is responding
		const isHealthy = await this.performHealthCheck()
		if (!isHealthy) {
			throw new Error('PostgREST health check failed')
		}

		logger.info('PostgREST deployment verified successfully')
	}

	private startHealthMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
		}

		this.healthCheckInterval = setInterval(async () => {
			const isHealthy = await this.performHealthCheck()
			
			if (!isHealthy && this.deploymentStatus.isRunning) {
				logger.warn('PostgREST health check failed, service may be unhealthy')
				
				// Attempt automatic restart if error count is high
				if (this.deploymentStatus.errorCount > 3) {
					logger.info('Attempting automatic PostgREST restart due to health issues')
					try {
						await this.stopPostgREST()
						await this.startPostgREST()
						this.deploymentStatus.errorCount = 0
					} catch (error) {
						logger.error('Automatic restart failed', error)
					}
				}
			}
		}, 30000) // Check every 30 seconds
	}

	private stopHealthMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
			this.healthCheckInterval = null
		}
	}
}

export default WebVMPostgRESTDeployer