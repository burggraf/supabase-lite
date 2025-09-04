/**
 * API Call Updater
 * 
 * Updates existing API calls throughout the application to use real PostgREST
 * instead of MSW simulation, maintaining compatibility with existing code
 */

import { logger } from '@/lib/infrastructure/Logger'
import { errorHandler } from '@/lib/infrastructure/ErrorHandler'
import { PostgRESTEndpointAdapter } from './PostgRESTEndpointAdapter'

export interface APICallMapping {
	pattern: string | RegExp
	transformation: (originalUrl: string, options?: RequestInit) => {
		url: string
		options: RequestInit
	}
}

export interface APICallUpdateConfig {
	enableLogging: boolean
	preserveOriginalBehavior: boolean
	fallbackToMSW: boolean
	updateBatchSize: number
}

export interface APIUpdateStatus {
	totalCalls: number
	updatedCalls: number
	failedCalls: number
	patterns: {
		pattern: string
		matches: number
		lastUsed?: Date
	}[]
}

/**
 * Updates existing API calls to use PostgREST endpoints instead of MSW simulation
 * Provides transparent migration from mock to real API integration
 */
export class APICallUpdater {
	private static instance: APICallUpdater
	private config: APICallUpdateConfig | null = null
	private adapter: PostgRESTEndpointAdapter | null = null
	private status: APIUpdateStatus
	private mappings: APICallMapping[]
	private originalFetch: typeof fetch
	private isActive: boolean = false

	private constructor() {
		this.originalFetch = globalThis.fetch
		this.status = {
			totalCalls: 0,
			updatedCalls: 0,
			failedCalls: 0,
			patterns: []
		}
		this.mappings = this.createDefaultMappings()
	}

	public static getInstance(): APICallUpdater {
		if (!APICallUpdater.instance) {
			APICallUpdater.instance = new APICallUpdater()
		}
		return APICallUpdater.instance
	}

	/**
	 * Initialize the API call updater
	 */
	public async initialize(config: APICallUpdateConfig): Promise<void> {
		try {
			logger.info('Initializing API call updater')
			
			this.config = config
			this.adapter = PostgRESTEndpointAdapter.getInstance()

			logger.info('API call updater initialized', {
				preserveOriginalBehavior: config.preserveOriginalBehavior,
				fallbackToMSW: config.fallbackToMSW
			})
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'APICallUpdater.initialize' })
			throw error
		}
	}

	/**
	 * Activate API call interception and updating
	 */
	public async activate(): Promise<void> {
		try {
			if (this.isActive) {
				logger.warn('API call updater is already active')
				return
			}

			logger.info('Activating API call updater')

			// Install fetch interceptor
			this.installFetchInterceptor()

			this.isActive = true
			logger.info('API call updater activated')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'APICallUpdater.activate' })
			throw error
		}
	}

	/**
	 * Deactivate API call interception
	 */
	public async deactivate(): Promise<void> {
		try {
			if (!this.isActive) {
				logger.warn('API call updater is not active')
				return
			}

			logger.info('Deactivating API call updater')

			// Restore original fetch
			this.restoreOriginalFetch()

			this.isActive = false
			logger.info('API call updater deactivated')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'APICallUpdater.deactivate' })
		}
	}

	/**
	 * Add custom API call mapping
	 */
	public addMapping(mapping: APICallMapping): void {
		this.mappings.push(mapping)
		
		// Update status tracking
		this.status.patterns.push({
			pattern: mapping.pattern.toString(),
			matches: 0
		})

		if (this.config?.enableLogging) {
			logger.info('Added custom API mapping', { pattern: mapping.pattern.toString() })
		}
	}

	/**
	 * Get API call update status
	 */
	public getStatus(): APIUpdateStatus {
		return { ...this.status }
	}

	/**
	 * Reset status counters
	 */
	public resetStatus(): void {
		this.status = {
			totalCalls: 0,
			updatedCalls: 0,
			failedCalls: 0,
			patterns: this.status.patterns.map(p => ({ ...p, matches: 0 }))
		}
	}

	/**
	 * Update a specific API call to use PostgREST
	 */
	public async updateAPICall(
		originalUrl: string, 
		originalOptions?: RequestInit
	): Promise<{ url: string; options: RequestInit; updated: boolean }> {
		try {
			this.status.totalCalls++

			// Find matching transformation
			const mapping = this.findMatchingMapping(originalUrl)
			
			if (!mapping) {
				if (this.config?.enableLogging) {
					logger.debug('No mapping found for API call', { url: originalUrl })
				}
				return {
					url: originalUrl,
					options: originalOptions || {},
					updated: false
				}
			}

			// Apply transformation
			const transformed = mapping.transformation(originalUrl, originalOptions)
			
			// Update status
			this.status.updatedCalls++
			this.updatePatternStats(mapping.pattern.toString())

			if (this.config?.enableLogging) {
				logger.debug('API call updated', {
					original: originalUrl,
					updated: transformed.url,
					pattern: mapping.pattern.toString()
				})
			}

			return {
				url: transformed.url,
				options: transformed.options,
				updated: true
			}
		} catch (error) {
			this.status.failedCalls++
			if (this.config?.enableLogging) {
				logger.warn('Failed to update API call', { url: originalUrl, error })
			}
			
			return {
				url: originalUrl,
				options: originalOptions || {},
				updated: false
			}
		}
	}

	// Private helper methods

	private createDefaultMappings(): APICallMapping[] {
		return [
			// PostgREST REST API calls
			{
				pattern: /\/rest\/v1\/([^?]+)/,
				transformation: (originalUrl: string, options?: RequestInit) => {
					const match = originalUrl.match(/\/rest\/v1\/([^?]+)/)
					if (!match) {
						return { url: originalUrl, options: options || {} }
					}

					const table = match[1].split('?')[0]
					const searchParams = new URL(originalUrl, 'http://localhost').searchParams
					
					// Convert to PostgREST endpoint
					const postgrestUrl = this.buildPostgRESTUrl(table, searchParams)
					
					// Update headers for PostgREST compatibility
					const updatedOptions = this.updateHeadersForPostgREST(options || {})

					return {
						url: postgrestUrl,
						options: updatedOptions
					}
				}
			},

			// Auth API calls
			{
				pattern: /\/auth\/v1\/([^?]+)/,
				transformation: (originalUrl: string, options?: RequestInit) => {
					// Auth calls might still go through the bridge or be handled differently
					return this.transformAuthCall(originalUrl, options || {})
				}
			},

			// Storage API calls  
			{
				pattern: /\/storage\/v1\/([^?]+)/,
				transformation: (originalUrl: string, options?: RequestInit) => {
					// Storage calls might still go through the bridge or be handled differently
					return this.transformStorageCall(originalUrl, options || {})
				}
			},

			// RPC function calls
			{
				pattern: /\/rest\/v1\/rpc\/([^?]+)/,
				transformation: (originalUrl: string, options?: RequestInit) => {
					const match = originalUrl.match(/\/rest\/v1\/rpc\/([^?]+)/)
					if (!match) {
						return { url: originalUrl, options: options || {} }
					}

					const functionName = match[1]
					const postgrestUrl = this.buildRPCUrl(functionName)
					const updatedOptions = this.updateHeadersForPostgREST(options || {})

					return {
						url: postgrestUrl,
						options: updatedOptions
					}
				}
			},

			// Generic Supabase API pattern
			{
				pattern: /\/rest\/v1/,
				transformation: (originalUrl: string, options?: RequestInit) => {
					// Generic transformation for any remaining REST calls
					const updatedUrl = originalUrl.replace(/^.*\/rest\/v1/, this.getPostgRESTBaseUrl())
					const updatedOptions = this.updateHeadersForPostgREST(options || {})

					return {
						url: updatedUrl,
						options: updatedOptions
					}
				}
			}
		]
	}

	private findMatchingMapping(url: string): APICallMapping | null {
		for (const mapping of this.mappings) {
			if (typeof mapping.pattern === 'string') {
				if (url.includes(mapping.pattern)) {
					return mapping
				}
			} else {
				if (mapping.pattern.test(url)) {
					return mapping
				}
			}
		}
		return null
	}

	private updatePatternStats(pattern: string): void {
		const patternStat = this.status.patterns.find(p => p.pattern === pattern)
		if (patternStat) {
			patternStat.matches++
			patternStat.lastUsed = new Date()
		}
	}

	private buildPostgRESTUrl(table: string, searchParams: URLSearchParams): string {
		const baseUrl = this.getPostgRESTBaseUrl()
		const url = new URL(`${table}`, baseUrl)

		// Convert Supabase query parameters to PostgREST format
		for (const [key, value] of searchParams.entries()) {
			url.searchParams.append(key, value)
		}

		return url.toString()
	}

	private buildRPCUrl(functionName: string): string {
		const baseUrl = this.getPostgRESTBaseUrl()
		return new URL(`rpc/${functionName}`, baseUrl).toString()
	}

	private getPostgRESTBaseUrl(): string {
		// This should be configured based on the actual PostgREST deployment
		return 'http://localhost:3000'
	}

	private updateHeadersForPostgREST(options: RequestInit): RequestInit {
		const updatedOptions = { ...options }
		const headers = new Headers(updatedOptions.headers)

		// Ensure proper content type
		if (!headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json')
		}

		// Add Accept header
		if (!headers.has('Accept')) {
			headers.set('Accept', 'application/json')
		}

		// Convert apikey header to Authorization if needed
		const apikey = headers.get('apikey')
		if (apikey && !headers.has('Authorization')) {
			headers.set('Authorization', `Bearer ${apikey}`)
			headers.delete('apikey')
		}

		updatedOptions.headers = headers

		return updatedOptions
	}

	private transformAuthCall(originalUrl: string, options: RequestInit): { url: string; options: RequestInit } {
		// Auth calls might be handled by a different service or bridge
		// For now, keep them as-is or route through auth bridge
		return {
			url: originalUrl.replace('/auth/v1', '/auth/v1'), // Could be changed to auth bridge endpoint
			options
		}
	}

	private transformStorageCall(originalUrl: string, options: RequestInit): { url: string; options: RequestInit } {
		// Storage calls might be handled by a different service or bridge  
		// For now, keep them as-is or route through storage bridge
		return {
			url: originalUrl.replace('/storage/v1', '/storage/v1'), // Could be changed to storage bridge endpoint
			options
		}
	}

	private installFetchInterceptor(): void {
		const self = this

		// Override global fetch
		globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
			let url: string
			let options: RequestInit = init || {}

			// Extract URL from input
			if (typeof input === 'string') {
				url = input
			} else if (input instanceof URL) {
				url = input.toString()
			} else if (input instanceof Request) {
				url = input.url
				// Merge request properties with init options
				options = {
					method: input.method,
					headers: input.headers,
					body: input.body,
					...options
				}
			} else {
				// Fallback to original fetch for edge cases
				return self.originalFetch.call(this, input, init)
			}

			try {
				// Update the API call if applicable
				const updated = await self.updateAPICall(url, options)
				
				// Make the request (updated or original)
				return await self.originalFetch.call(this, updated.url, updated.options)
			} catch (error) {
				// Fallback to original behavior if update fails
				if (self.config?.fallbackToMSW) {
					return await self.originalFetch.call(this, input, init)
				}
				throw error
			}
		}

		logger.info('Fetch interceptor installed for API call updating')
	}

	private restoreOriginalFetch(): void {
		globalThis.fetch = this.originalFetch
		logger.info('Original fetch restored')
	}

	/**
	 * Check if the API adapter is currently active
	 */
	public isAdapterActive(): boolean {
		return this.isActive
	}
}

export default APICallUpdater