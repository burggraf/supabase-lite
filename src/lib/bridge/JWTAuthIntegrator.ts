/**
 * JWT Authentication Integrator
 * 
 * Integrates existing Supabase Lite auth system with PostgREST JWT authentication
 * Ensures seamless authentication between browser and WebVM contexts
 */

import { logger } from '@/lib/infrastructure/Logger'
import { errorHandler } from '@/lib/infrastructure/ErrorHandler'
import { AuthBridge } from '@/lib/auth/AuthBridge'
import { JWTService } from '@/lib/auth/core/JWTService'

export interface JWTAuthConfig {
	jwtSecret: string
	tokenExpiration: number // in seconds
	refreshThreshold: number // refresh when token expires in X seconds
	roleClaimKey: string
	userClaimKey: string
	enableAutoRefresh: boolean
}

export interface AuthContext {
	userId?: string
	role: string
	email?: string
	isAnonymous: boolean
	permissions: string[]
	exp?: number
	iat?: number
}

export interface JWTAuthStatus {
	isAuthenticated: boolean
	currentUser?: AuthContext
	tokenExpiresAt?: Date
	needsRefresh: boolean
	lastRefresh?: Date
}

/**
 * Bridges Supabase Lite authentication with PostgREST JWT authentication
 * Manages token generation, validation, and automatic refresh
 */
export class JWTAuthIntegrator {
	private static instance: JWTAuthIntegrator
	private config: JWTAuthConfig | null = null
	private authBridge: AuthBridge | null = null
	private jwtService: JWTService | null = null
	private status: JWTAuthStatus
	private refreshInterval: NodeJS.Timeout | null = null

	private constructor() {
		this.status = {
			isAuthenticated: false,
			needsRefresh: false
		}
	}

	public static getInstance(): JWTAuthIntegrator {
		if (!JWTAuthIntegrator.instance) {
			JWTAuthIntegrator.instance = new JWTAuthIntegrator()
		}
		return JWTAuthIntegrator.instance
	}

	/**
	 * Initialize JWT authentication integration
	 */
	public async initialize(config: JWTAuthConfig): Promise<void> {
		try {
			logger.info('Initializing JWT authentication integration')
			
			this.config = config
			this.authBridge = AuthBridge.getInstance()
			this.jwtService = JWTService.getInstance()

			// Configure JWT service with PostgREST requirements
			await this.configureJWTService()

			// Set up automatic token refresh if enabled
			if (config.enableAutoRefresh) {
				this.startTokenRefreshMonitoring()
			}

			logger.info('JWT authentication integration initialized', {
				tokenExpiration: config.tokenExpiration,
				autoRefresh: config.enableAutoRefresh
			})
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'JWTAuthIntegrator.initialize' })
			logger.error('JWTAuthIntegrator.initialize failed', error)
			throw error
		}
	}

	/**
	 * Generate PostgREST-compatible JWT token for current user
	 */
	public async generatePostgRESTToken(userId?: string): Promise<string> {
		try {
			if (!this.config || !this.jwtService) {
				throw new Error('JWT auth integration not initialized')
			}

			// Get current user session
			const currentUser = await this.getCurrentUser(userId)
			
			// Create PostgREST-compatible JWT payload
			const payload = {
				[this.config.userClaimKey]: currentUser.userId,
				[this.config.roleClaimKey]: currentUser.role,
				email: currentUser.email,
				exp: Math.floor(Date.now() / 1000) + this.config.tokenExpiration,
				iat: Math.floor(Date.now() / 1000),
				iss: 'supabase-lite',
				aud: 'postgrest'
			}

			// Add custom claims for permissions
			if (currentUser.permissions && currentUser.permissions.length > 0) {
				payload.permissions = currentUser.permissions
			}

			const token = await this.jwtService.generateCustomToken(payload)
			
			// Update status
			this.status = {
				isAuthenticated: true,
				currentUser,
				tokenExpiresAt: new Date((payload.exp) * 1000),
				needsRefresh: false,
				lastRefresh: new Date()
			}

			logger.info('PostgREST JWT token generated', {
				userId: currentUser.userId,
				role: currentUser.role,
				expiresAt: this.status.tokenExpiresAt
			})

			return token
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'JWTAuthIntegrator.generatePostgRESTToken' })
			logger.error('JWTAuthIntegrator.generatePostgRESTToken failed', error)
			throw error
		}
	}

	/**
	 * Validate PostgREST JWT token and extract auth context
	 */
	public async validatePostgRESTToken(token: string): Promise<AuthContext> {
		try {
			if (!this.config || !this.jwtService) {
				throw new Error('JWT auth integration not initialized')
			}

			const payload = await this.jwtService.verifyToken(token)
			
			// Extract PostgREST-compatible auth context
			const authContext: AuthContext = {
				userId: payload[this.config.userClaimKey],
				role: payload[this.config.roleClaimKey] || 'anonymous',
				email: payload.email,
				isAnonymous: !payload[this.config.userClaimKey],
				permissions: payload.permissions || [],
				exp: payload.exp,
				iat: payload.iat
			}

			// Check if token is expired
			if (authContext.exp && Date.now() / 1000 > authContext.exp) {
				throw new Error('Token has expired')
			}

			return authContext
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'JWTAuthIntegrator.validatePostgRESTToken' })
			logger.error('JWTAuthIntegrator.validatePostgRESTToken failed', error)
			throw error
		}
	}

	/**
	 * Refresh JWT token if needed
	 */
	public async refreshTokenIfNeeded(): Promise<string | null> {
		try {
			if (!this.status.isAuthenticated || !this.status.tokenExpiresAt) {
				return null
			}

			const timeUntilExpiry = this.status.tokenExpiresAt.getTime() - Date.now()
			const refreshThresholdMs = (this.config?.refreshThreshold || 300) * 1000

			if (timeUntilExpiry <= refreshThresholdMs) {
				logger.info('Token refresh needed', { 
					expiresAt: this.status.tokenExpiresAt,
					timeUntilExpiry: Math.round(timeUntilExpiry / 1000) 
				})

				const newToken = await this.generatePostgRESTToken(this.status.currentUser?.userId)
				return newToken
			}

			return null
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'JWTAuthIntegrator.refreshTokenIfNeeded' })
			logger.error('JWTAuthIntegrator.refreshTokenIfNeeded failed', error)
			return null
		}
	}

	/**
	 * Get authentication status
	 */
	public getStatus(): JWTAuthStatus {
		// Update needs refresh status
		if (this.status.tokenExpiresAt && this.config) {
			const timeUntilExpiry = this.status.tokenExpiresAt.getTime() - Date.now()
			const refreshThresholdMs = this.config.refreshThreshold * 1000
			this.status.needsRefresh = timeUntilExpiry <= refreshThresholdMs
		}

		return { ...this.status }
	}

	/**
	 * Create anonymous authentication context
	 */
	public async createAnonymousContext(): Promise<AuthContext> {
		return {
			role: 'anonymous',
			isAnonymous: true,
			permissions: ['read:public']
		}
	}

	/**
	 * Extract auth context from request headers
	 */
	public async extractAuthContextFromRequest(headers: Headers): Promise<AuthContext> {
		try {
			const authHeader = headers.get('Authorization')
			
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				return this.createAnonymousContext()
			}

			const token = authHeader.substring(7) // Remove 'Bearer ' prefix
			return await this.validatePostgRESTToken(token)
		} catch (error) {
			logger.warn('Failed to extract auth context from request', error)
			return this.createAnonymousContext()
		}
	}

	/**
	 * Create PostgREST-compatible auth headers
	 */
	public async createAuthHeaders(userId?: string): Promise<Record<string, string>> {
		try {
			const token = await this.generatePostgRESTToken(userId)
			
			return {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			}
		} catch (error) {
			logger.warn('Failed to create auth headers, using anonymous access')
			return {
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			}
		}
	}

	/**
	 * Sign out and clear authentication state
	 */
	public async signOut(): Promise<void> {
		try {
			logger.info('Signing out user')

			// Stop token refresh monitoring
			this.stopTokenRefreshMonitoring()

			// Clear status
			this.status = {
				isAuthenticated: false,
				needsRefresh: false
			}

			// Sign out from auth bridge if available
			if (this.authBridge) {
				await this.authBridge.signOut()
			}

			logger.info('User signed out successfully')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'JWTAuthIntegrator.signOut' })
			logger.error('JWTAuthIntegrator.signOut failed', error)
		}
	}

	// Private helper methods

	private async configureJWTService(): Promise<void> {
		if (!this.config || !this.jwtService) {
			return
		}

		// JWTService initializes automatically with default config
		await this.jwtService.initialize()

		logger.info('JWT service configured for PostgREST compatibility')
	}

	private async getCurrentUser(userId?: string): Promise<AuthContext> {
		if (!this.authBridge) {
			throw new Error('Auth bridge not available')
		}

		try {
			// Get user from auth bridge
			const user = userId 
				? await this.authBridge.getUserById(userId)
				: await this.authBridge.getCurrentUser()

			if (!user) {
				return this.createAnonymousContext()
			}

			// Map Supabase Lite user to auth context
			return {
				userId: user.id,
				role: user.role || 'authenticated',
				email: user.email,
				isAnonymous: false,
				permissions: this.getUserPermissions(user.role || 'authenticated')
			}
		} catch (error) {
			logger.warn('Failed to get current user, using anonymous context', error)
			return this.createAnonymousContext()
		}
	}

	private getUserPermissions(role: string): string[] {
		// Define role-based permissions for PostgREST
		const rolePermissions: Record<string, string[]> = {
			'anonymous': ['read:public'],
			'authenticated': ['read:public', 'read:private', 'write:own'],
			'admin': ['read:*', 'write:*', 'delete:*'],
			'service_role': ['*']
		}

		return rolePermissions[role] || ['read:public']
	}

	private startTokenRefreshMonitoring(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval)
		}

		// Check every 30 seconds for token refresh needs
		this.refreshInterval = setInterval(async () => {
			try {
				const refreshedToken = await this.refreshTokenIfNeeded()
				if (refreshedToken) {
					logger.info('Token automatically refreshed')
					
					// Emit event for components that need to update their tokens
					if (typeof window !== 'undefined') {
						window.dispatchEvent(new CustomEvent('auth-token-refreshed', {
							detail: { token: refreshedToken }
						}))
					}
				}
			} catch (error) {
				logger.error('Automatic token refresh failed', error)
			}
		}, 30000)
	}

	private stopTokenRefreshMonitoring(): void {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval)
			this.refreshInterval = null
		}
	}
}

export default JWTAuthIntegrator