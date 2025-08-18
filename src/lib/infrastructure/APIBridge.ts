import type { 
  APIBridge, 
  APIRequest, 
  APIResponse, 
  RequestInterceptor, 
  ResponseInterceptor 
} from '@/types/infrastructure';
import { logger } from './Logger';
import { errorHandler, createAPIError, ERROR_CODES } from './ErrorHandler';
import { configManager } from './ConfigManager';

export class InfrastructureAPIBridge implements APIBridge {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  async request<T = any>(request: APIRequest): Promise<APIResponse<T>> {
    const startTime = performance.now();
    let processedRequest = { ...request };

    try {
      // Validate request
      this.validateRequest(processedRequest);

      // Apply request interceptors
      for (const interceptor of this.requestInterceptors) {
        processedRequest = await interceptor(processedRequest);
      }

      logger.debug('API request', {
        method: processedRequest.method,
        url: processedRequest.url,
        headers: Object.keys(processedRequest.headers),
      });

      // Execute the request
      const response = await this.executeRequest<T>(processedRequest);

      // Apply response interceptors
      let processedResponse = response;
      for (const interceptor of this.responseInterceptors) {
        processedResponse = await interceptor(processedResponse);
      }

      const duration = performance.now() - startTime;
      logger.debug('API request completed', {
        method: processedRequest.method,
        url: processedRequest.url,
        status: processedResponse.status,
        duration,
      });

      return processedResponse;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('API request failed', error as Error, {
        method: processedRequest.method,
        url: processedRequest.url,
        duration,
      });

      throw errorHandler.handleError(error, {
        method: processedRequest.method,
        url: processedRequest.url,
      });
    }
  }

  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
    logger.debug('Request interceptor added', { count: this.requestInterceptors.length });
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
    logger.debug('Response interceptor added', { count: this.responseInterceptors.length });
  }

  validateRequest(request: APIRequest): boolean {
    // Validate method
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      throw createAPIError(`Invalid HTTP method: ${request.method}`, undefined, 'Supported methods: GET, POST, PUT, PATCH, DELETE');
    }

    // Validate URL
    try {
      new URL(request.url);
    } catch {
      throw createAPIError(`Invalid URL: ${request.url}`, undefined, 'URL must be a valid HTTP/HTTPS URL');
    }

    // Validate headers
    if (request.headers && typeof request.headers !== 'object') {
      throw createAPIError('Headers must be an object', undefined, 'Headers should be key-value pairs');
    }

    // Validate body for appropriate methods
    if (['POST', 'PUT', 'PATCH'].includes(request.method) && request.body !== undefined) {
      try {
        if (typeof request.body === 'object') {
          JSON.stringify(request.body); // Test if serializable
        }
      } catch {
        throw createAPIError('Request body is not serializable', undefined, 'Ensure the request body can be converted to JSON');
      }
    }

    return true;
  }

  formatResponse<T>(
    data: T, 
    status: number, 
    headers: Record<string, string> = {}
  ): APIResponse<T> {
    const success = status >= 200 && status < 300;
    
    return {
      data,
      status,
      headers,
      success,
      error: !success ? {
        code: this.getErrorCodeFromStatus(status),
        message: `HTTP ${status} error`,
        context: { status },
      } : undefined,
    };
  }

  // Utility methods for common API patterns
  async get<T = any>(url: string, headers?: Record<string, string>): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      headers: { ...this.getDefaultHeaders(), ...headers },
    });
  }

  async post<T = any>(
    url: string, 
    body?: any, 
    headers?: Record<string, string>
  ): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      body,
      headers: { ...this.getDefaultHeaders(), ...headers },
    });
  }

  async put<T = any>(
    url: string, 
    body?: any, 
    headers?: Record<string, string>
  ): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      body,
      headers: { ...this.getDefaultHeaders(), ...headers },
    });
  }

  async patch<T = any>(
    url: string, 
    body?: any, 
    headers?: Record<string, string>
  ): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      body,
      headers: { ...this.getDefaultHeaders(), ...headers },
    });
  }

  async delete<T = any>(url: string, headers?: Record<string, string>): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      headers: { ...this.getDefaultHeaders(), ...headers },
    });
  }

  private async executeRequest<T>(request: APIRequest): Promise<APIResponse<T>> {
    const apiConfig = configManager.getAPIConfig();
    const timeout = request.timeout || apiConfig.timeout;

    // Create fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: request.headers,
      signal: AbortSignal.timeout(timeout),
    };

    // Add body for appropriate methods
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (typeof request.body === 'object') {
        fetchOptions.body = JSON.stringify(request.body);
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Content-Type': 'application/json',
        };
      } else {
        fetchOptions.body = String(request.body);
      }
    }

    try {
      const response = await this.fetchWithRetry(request.url, fetchOptions);
      
      // Parse response data
      let data: T;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : null;
      } else {
        data = (await response.text()) as T;
      }

      // Convert Headers to plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return this.formatResponse(data, response.status, headers);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw createAPIError('Request timeout', error, `Request timed out after ${timeout}ms`);
        }
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw createAPIError('Network error', error, 'Check network connection and server availability');
        }
      }
      throw error;
    }
  }

  private async fetchWithRetry(
    url: string, 
    options: RequestInit, 
    attempt: number = 1
  ): Promise<Response> {
    const apiConfig = configManager.getAPIConfig();
    
    try {
      const response = await fetch(url, options);
      
      // Check if we should retry based on status
      if (!response.ok && this.shouldRetry(response.status) && attempt <= apiConfig.retryAttempts) {
        const delay = this.calculateRetryDelay(attempt, apiConfig.retryDelay);
        logger.debug('Retrying API request', { 
          url, 
          status: response.status, 
          attempt, 
          delay 
        });
        
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      
      return response;
    } catch (error) {
      // Retry on network errors
      if (attempt <= apiConfig.retryAttempts && this.isRetryableError(error)) {
        const delay = this.calculateRetryDelay(attempt, apiConfig.retryDelay);
        logger.debug('Retrying API request after error', { 
          url, 
          error: (error as Error).message, 
          attempt, 
          delay 
        });
        
        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }
      
      throw error;
    }
  }

  private shouldRetry(status: number): boolean {
    // Retry on server errors and rate limiting
    return status >= 500 || status === 429 || status === 408;
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    // Retry on network errors but not on timeout
    return (
      error.name === 'TypeError' && 
      error.message.includes('fetch') && 
      !error.message.includes('timeout')
    );
  }

  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * delay;
    return Math.min(delay + jitter, 30000); // Max 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getDefaultHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json',
      'User-Agent': 'Supabase-Lite/1.0',
    };
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return ERROR_CODES.API_VALIDATION_FAILED;
      case 401:
        return ERROR_CODES.API_UNAUTHORIZED;
      case 403:
        return ERROR_CODES.API_FORBIDDEN;
      case 404:
        return ERROR_CODES.API_NOT_FOUND;
      case 408:
        return ERROR_CODES.API_TIMEOUT;
      case 429:
        return ERROR_CODES.API_RATE_LIMITED;
      default:
        return ERROR_CODES.API_REQUEST_FAILED;
    }
  }
}

// Singleton instance
export const apiBridge = new InfrastructureAPIBridge();

// Add common request interceptors
apiBridge.addRequestInterceptor(async (request) => {
  // Add API key if available
  const apiKey = configManager.get('auth.apiKey');
  if (apiKey && !request.headers['Authorization']) {
    request.headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  return request;
});

// Add common response interceptors
apiBridge.addResponseInterceptor(async (response) => {
  // Log API errors
  if (!response.success && response.error) {
    logger.warn('API request returned error', response.error);
  }
  
  return response;
});