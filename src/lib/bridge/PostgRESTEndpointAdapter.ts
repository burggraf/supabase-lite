/**
 * PostgREST Endpoint Adapter
 * 
 * Replaces MSW simulation with real PostgREST endpoint integration
 * Provides seamless transition from mock to real API calls
 */

import { logger } from '@/lib/infrastructure/Logger'
import { errorHandler } from '@/lib/infrastructure/ErrorHandler'
import { JWTAuthIntegrator } from './JWTAuthIntegrator'

export interface PostgRESTEndpointConfig {
	baseUrl: string
	timeout: number
	retryAttempts: number
	retryDelay: number
	enableLogging: boolean
	enableMetrics: boolean
}

export interface PostgRESTRequest {
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
	table?: string
	path?: string
	query?: Record<string, any>
	body?: any
	headers?: Record<string, string>
	auth?: boolean
}

export interface PostgRESTResponse<T = any> {
	data: T
	count?: number
	status: number
	statusText: string
	headers: Record<string, string>
	error?: string
}

export interface EndpointMetrics {
	requests: {
		total: number
		successful: number
		failed: number
		byMethod: Record<string, number>
		byTable: Record<string, number>
	}
	performance: {
		averageLatency: number
		minLatency: number
		maxLatency: number
		p95Latency: number
	}
	errors: {
		networkErrors: number
		authErrors: number
		serverErrors: number
		clientErrors: number
	}
}

/**
 * Adapts application to use real PostgREST endpoints instead of MSW simulation
 * Provides backwards compatibility while enabling real database operations
 */
export class PostgRESTEndpointAdapter {
	private static instance: PostgRESTEndpointAdapter
	private config: PostgRESTEndpointConfig | null = null
	private authIntegrator: JWTAuthIntegrator | null = null
	private metrics: EndpointMetrics
	private isActive: boolean = false

	private constructor() {
		this.metrics = {
			requests: {
				total: 0,
				successful: 0,
				failed: 0,
				byMethod: {},
				byTable: {}
			},
			performance: {
				averageLatency: 0,
				minLatency: Infinity,
				maxLatency: 0,
				p95Latency: 0
			},
			errors: {
				networkErrors: 0,
				authErrors: 0,
				serverErrors: 0,
				clientErrors: 0
			}
		}
	}

	public static getInstance(): PostgRESTEndpointAdapter {
		if (!PostgRESTEndpointAdapter.instance) {
			PostgRESTEndpointAdapter.instance = new PostgRESTEndpointAdapter()
		}
		return PostgRESTEndpointAdapter.instance
	}

	/**
	 * Initialize the PostgREST endpoint adapter
	 */
	public async initialize(config: PostgRESTEndpointConfig): Promise<void> {
		try {
			logger.info('Initializing PostgREST endpoint adapter')
			
			this.config = config
			this.authIntegrator = JWTAuthIntegrator.getInstance()

			// Test connectivity to PostgREST
			await this.testConnectivity()

			logger.info('PostgREST endpoint adapter initialized', {
				baseUrl: config.baseUrl,
				timeout: config.timeout
			})
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'PostgRESTEndpointAdapter.initialize' })
			throw error
		}
	}

	/**
	 * Activate the adapter to replace MSW handlers
	 */
	public async activate(): Promise<void> {
		try {
			if (this.isActive) {
				logger.warn('PostgREST endpoint adapter is already active')
				return
			}

			logger.info('Activating PostgREST endpoint adapter')

			// Disable MSW handlers
			await this.disableMSWHandlers()

			// Install fetch interceptor for PostgREST requests
			this.installFetchInterceptor()

			this.isActive = true
			logger.info('PostgREST endpoint adapter activated')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'PostgRESTEndpointAdapter.activate' })
			throw error
		}
	}

	/**
	 * Deactivate the adapter and restore MSW handlers
	 */
	public async deactivate(): Promise<void> {
		try {
			if (!this.isActive) {
				logger.warn('PostgREST endpoint adapter is not active')
				return
			}

			logger.info('Deactivating PostgREST endpoint adapter')

			// Restore MSW handlers
			await this.enableMSWHandlers()

			// Remove fetch interceptor
			this.removeFetchInterceptor()

			this.isActive = false
			logger.info('PostgREST endpoint adapter deactivated')
		} catch (error) {
			errorHandler.handleError(error as Error, { context: 'PostgRESTEndpointAdapter.deactivate' })
		}
	}

	/**
	 * Make a PostgREST API request
	 */
	public async request<T = any>(request: PostgRESTRequest): Promise<PostgRESTResponse<T>> {
		const startTime = performance.now()
		
		try {
			if (!this.config) {
				throw new Error('PostgREST endpoint adapter not initialized')
			}

			// Build URL
			const url = this.buildUrl(request)

			// Prepare headers
			const headers = await this.prepareHeaders(request)

			// Prepare request options
			const requestOptions: RequestInit = {
				method: request.method,
				headers,
				signal: AbortSignal.timeout(this.config.timeout)
			}

			// Add body for POST/PATCH/PUT requests
			if (request.body && ['POST', 'PATCH', 'PUT'].includes(request.method)) {
				requestOptions.body = JSON.stringify(request.body)
			}

			// Make the request with retry logic
			const response = await this.makeRequestWithRetry(url, requestOptions)
			
			// Parse response
			const responseData = await this.parseResponse<T>(response)
			
			// Update metrics
			this.updateMetrics(request, startTime, true, response.status)
			
			return responseData
		} catch (error) {
			// Update metrics for failed request
			this.updateMetrics(request, startTime, false, 0, error as Error)
			throw error
		}
	}

	/**
	 * GET request helper
	 */
	public async get<T = any>(table: string, query?: Record<string, any>): Promise<PostgRESTResponse<T[]>> {
		return this.request<T[]>({
			method: 'GET',
			table,
			query,
			auth: true
		})
	}

	/**
	 * POST request helper
	 */
	public async post<T = any>(table: string, body: any): Promise<PostgRESTResponse<T>> {
		return this.request<T>({
			method: 'POST',
			table,
			body,
			auth: true
		})
	}

	/**
	 * PATCH request helper
	 */
	public async patch<T = any>(table: string, body: any, query?: Record<string, any>): Promise<PostgRESTResponse<T[]>> {
		return this.request<T[]>({
			method: 'PATCH',
			table,
			body,
			query,
			auth: true
		})
	}

	/**
	 * DELETE request helper
	 */
	public async delete<T = any>(table: string, query: Record<string, any>): Promise<PostgRESTResponse<T[]>> {
		return this.request<T[]>({
			method: 'DELETE',
			table,
			query,
			auth: true
		})
	}

	/**
	 * Execute RPC function call
	 */
	public async rpc<T = any>(functionName: string, params?: any): Promise<PostgRESTResponse<T>> {
		return this.request<T>({
			method: 'POST',
			path: `rpc/${functionName}`,
			body: params || {},
			auth: true
		})
	}

	/**
	 * Get adapter metrics
	 */
	public getMetrics(): EndpointMetrics {
		return { ...this.metrics }
	}

	/**
	 * Reset adapter metrics
	 */
	public resetMetrics(): void {
		this.metrics = {
			requests: {
				total: 0,
				successful: 0,
				failed: 0,
				byMethod: {},
				byTable: {}
			},
			performance: {
				averageLatency: 0,
				minLatency: Infinity,
				maxLatency: 0,
				p95Latency: 0
			},
			errors: {
				networkErrors: 0,
				authErrors: 0,
				serverErrors: 0,
				clientErrors: 0
			}
		}
	}

	/**
	 * Check if adapter is active
	 */
	public isAdapterActive(): boolean {
		return this.isActive
	}

	// Private helper methods

	private buildUrl(request: PostgRESTRequest): string {
		if (!this.config) {
			throw new Error('Configuration not available')
		}

		let path = request.path
		if (!path && request.table) {
			path = request.table
		}

		if (!path) {
			throw new Error('Either table or path must be specified')
		}

		const url = new URL(path, this.config.baseUrl)

		// Add query parameters
		if (request.query) {
			for (const [key, value] of Object.entries(request.query)) {
				if (value !== undefined && value !== null) {
					url.searchParams.append(key, String(value))
				}
			}
		}

		return url.toString()
	}

	private async prepareHeaders(request: PostgRESTRequest): Promise<Record<string, string>> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		}

		// Add custom headers
		if (request.headers) {
			Object.assign(headers, request.headers)
		}

		// Add authentication headers if needed
		if (request.auth !== false && this.authIntegrator) {
			try {
				const authHeaders = await this.authIntegrator.createAuthHeaders()
				Object.assign(headers, authHeaders)
			} catch (error) {
				logger.warn('Failed to add auth headers, proceeding without authentication', error)
			}
		}

		return headers
	}

	private async makeRequestWithRetry(url: string, options: RequestInit): Promise<Response> {
		const maxRetries = this.config?.retryAttempts || 3
		const retryDelay = this.config?.retryDelay || 1000

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await fetch(url, options)
				
				// Don't retry on client errors (4xx), only on server errors (5xx) or network errors
				if (response.ok || (response.status >= 400 && response.status < 500)) {
					return response
				}

				if (attempt === maxRetries) {
					return response // Return the last failed response
				}

				// Wait before retrying
				await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
			} catch (error) {
				if (attempt === maxRetries) {
					throw error
				}

				// Wait before retrying
				await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
			}
		}

		throw new Error('Maximum retry attempts exceeded')
	}

	private async parseResponse<T>(response: Response): Promise<PostgRESTResponse<T>> {
		const headers: Record<string, string> = {}
		response.headers.forEach((value, key) => {
			headers[key] = value
		})

		let data: T
		let error: string | undefined

		try {
			const text = await response.text()
			
			if (text) {
				data = JSON.parse(text) as T
			} else {
				data = null as T
			}

			if (!response.ok) {
				error = typeof data === 'object' && data && 'message' in data 
					? (data as any).message 
					: `HTTP ${response.status}: ${response.statusText}`
			}
		} catch (parseError) {
			throw new Error(`Failed to parse response: ${parseError}`)
		}

		return {
			data,
			count: headers['content-range'] ? this.parseContentRange(headers['content-range']) : undefined,
			status: response.status,
			statusText: response.statusText,
			headers,
			error
		}
	}

	private parseContentRange(contentRange: string): number | undefined {
		// Parse Content-Range header: "0-24/137"
		const match = contentRange.match(/\/(\d+)$/)
		return match ? parseInt(match[1], 10) : undefined
	}

	private updateMetrics(
		request: PostgRESTRequest,
		startTime: number,
		success: boolean,
		status: number,
		error?: Error
	): void {
		if (!this.config?.enableMetrics) {
			return
		}

		const latency = performance.now() - startTime

		// Update request counts
		this.metrics.requests.total++
		if (success) {
			this.metrics.requests.successful++
		} else {
			this.metrics.requests.failed++
		}

		// Update method counts
		this.metrics.requests.byMethod[request.method] = 
			(this.metrics.requests.byMethod[request.method] || 0) + 1

		// Update table counts
		if (request.table) {
			this.metrics.requests.byTable[request.table] = 
				(this.metrics.requests.byTable[request.table] || 0) + 1
		}

		// Update performance metrics
		this.metrics.performance.averageLatency = 
			(this.metrics.performance.averageLatency * (this.metrics.requests.total - 1) + latency) / 
			this.metrics.requests.total

		this.metrics.performance.minLatency = Math.min(this.metrics.performance.minLatency, latency)
		this.metrics.performance.maxLatency = Math.max(this.metrics.performance.maxLatency, latency)

		// Update error counts
		if (!success && error) {
			if (error.name === 'AbortError' || error.message.includes('fetch')) {
				this.metrics.errors.networkErrors++
			} else if (status === 401 || status === 403) {
				this.metrics.errors.authErrors++
			} else if (status >= 500) {
				this.metrics.errors.serverErrors++
			} else if (status >= 400) {
				this.metrics.errors.clientErrors++
			}
		}
	}

	private async testConnectivity(): Promise<void> {
		try {
			if (!this.config) {
				throw new Error('Configuration not available')
			}

			const response = await fetch(this.config.baseUrl, {
				method: 'GET',
				signal: AbortSignal.timeout(5000)
			})

			if (!response.ok && response.status !== 404) {
				throw new Error(`Connectivity test failed: ${response.status} ${response.statusText}`)
			}

			logger.info('PostgREST connectivity test passed')
		} catch (error) {
			logger.error('PostgREST connectivity test failed', error)
			throw error
		}
	}

	private async disableMSWHandlers(): Promise<void> {
		// Signal to MSW to disable handlers
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('msw-disable'))
		}
		logger.info('MSW handlers disabled')
	}

	private async enableMSWHandlers(): Promise<void> {
		// Signal to MSW to enable handlers
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('msw-enable'))
		}
		logger.info('MSW handlers enabled')
	}

	private installFetchInterceptor(): void {
		// Install a global fetch interceptor to route PostgREST calls
		// This is a simplified implementation - in practice you might use a more sophisticated approach
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('postgrest-adapter-active', {
				detail: { baseUrl: this.config?.baseUrl }
			}))
		}
		logger.info('Fetch interceptor installed for PostgREST routing')
	}

	private removeFetchInterceptor(): void {
		// Remove the fetch interceptor
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('postgrest-adapter-inactive'))
		}
		logger.info('Fetch interceptor removed')
	}
}

export default PostgRESTEndpointAdapter