// Cross-origin API handler for the main app
// Listens for postMessage requests from test app and executes them on browser database
// Also handles WebSocket proxy connections from CLI

import { QueryEngine } from '../../api/db/QueryEngine';
import type { ApiRequest, ApiContext } from '../../api/types';
import { vfsDirectHandler } from '../vfs/VFSDirectHandler';
import { ProxyConnector } from './ProxyConnector';
import { AuthBridge } from '../auth/AuthBridge';

interface APIRequest {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  body?: any;
  requestId: string;
}

interface APIResponse {
  requestId: string;
  data?: any;
  error?: string;
  status: number;
  headers: Record<string, string>;
}

export class CrossOriginAPIHandler {
  private queryEngine: QueryEngine;
  private broadcastChannel: BroadcastChannel | null = null;
  private proxyConnector: ProxyConnector;
  private authBridge: AuthBridge;

  constructor() {
    this.queryEngine = new QueryEngine();
    this.proxyConnector = new ProxyConnector();
    this.authBridge = new AuthBridge();
    this.setupMessageListener();
    this.setupBroadcastChannel();
  }

  private setupMessageListener() {
    window.addEventListener('message', (event) => {
      this.handleMessage(event);
    });
  }

  private setupBroadcastChannel() {
    try {
      this.broadcastChannel = new BroadcastChannel('supabase-api');
      this.broadcastChannel.addEventListener('message', (event) => {
        this.handleBroadcastMessage(event);
      });
    } catch (error) {
      console.warn('BroadcastChannel not available:', error);
    }
  }

  private isAllowedOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      
      // Allow localhost with any port
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
      
      // Allow HTTPS origins (for deployed versions)
      if (url.protocol === 'https:') {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  private async handleBroadcastMessage(event: MessageEvent) {
    console.log('🔍 BroadcastChannel message received:', event.data);
    const { type, data } = event.data;
    
    if (type === 'API_REQUEST') {
      const request: APIRequest = data;
      try {
        const response = await this.executeRequest(request);
        
        // Send response back via BroadcastChannel
        this.broadcastChannel?.postMessage({
          type: 'API_RESPONSE',
          data: {
            requestId: request.requestId,
            ...response
          }
        });
        
      } catch (error: any) {
        // Send error response
        this.broadcastChannel?.postMessage({
          type: 'API_RESPONSE',
          data: {
            requestId: request.requestId,
            error: error.message,
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        });
        
        console.error(`❌ Cross-origin API error (BC): ${request.method} ${request.path}:`, error);
      }
    } else if (type === 'COMMAND_COMPLETE') {
      // Handle command completion from CLI (PostMessage mode)
      console.log('✅ CLI command completed via BroadcastChannel');
      // Simulate the WebSocket message format for ProxyConnector
      this.proxyConnector.handleCommandComplete();
    } else {
      console.log('🔍 Unknown BroadcastChannel message type:', type);
    }
  }

  private async handleMessage(event: MessageEvent) {
    console.log('🔍 CrossOrigin: Received message from:', event.origin, 'Type:', event.data?.type);
    
    // Allow localhost origins and any HTTPS origin since this is a local-only app
    if (!this.isAllowedOrigin(event.origin)) {
      console.log('❌ CrossOrigin: Origin not allowed:', event.origin);
      return;
    }

    const { type, data } = event.data;
    
    if (type === 'API_REQUEST') {
      const request: APIRequest = data;
      console.log('📨 CrossOrigin: Processing API request:', request.method, request.path, 'RequestId:', request.requestId);
      
      try {
        const response = await this.executeRequest(request);
        
        console.log('✅ CrossOrigin: Sending response back to:', event.origin, 'RequestId:', request.requestId, 'Status:', response.status);
        
        // Send response back to requesting origin
        event.source?.postMessage({
          type: 'API_RESPONSE',
          data: {
            requestId: request.requestId,
            ...response
          }
        }, { targetOrigin: event.origin });
        
      } catch (error: any) {
        console.log('❌ CrossOrigin: Error processing request:', error.message, 'RequestId:', request.requestId);
        
        // Send error response
        event.source?.postMessage({
          type: 'API_RESPONSE',
          data: {
            requestId: request.requestId,
            error: error.message,
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        }, { targetOrigin: event.origin });
        
        console.error(`❌ Cross-origin API error: ${request.method} ${request.path}:`, error);
      }
    }
  }

  private async executeRequest(request: APIRequest): Promise<Omit<APIResponse, 'requestId'>> {
    // Parse the path to extract table and query parameters
    const url = new URL(request.path, 'http://localhost');
    const pathParts = url.pathname.split('/').filter(part => part);
    
    // Handle VFS direct requests (bypass MSW)
    if (pathParts[0] === 'vfs-direct') {
      console.log('🚀 Handling VFS-direct request via CrossOriginAPIHandler');
      
      const result = await vfsDirectHandler.handleRequest(
        request.path,
        request.method,
        request.headers || {}
      );
      
      // DEBUG: Log MSW response details for RPC debugging
      if (request.path.includes('/rpc/')) {
        console.log('🐛 CrossOrigin RPC Response:', {
          path: request.path,
          resultType: typeof result.body,
          resultValue: result.body,
          resultHeaders: result.headers,
          isArrayBuffer: result.body instanceof ArrayBuffer
        })
      }
      
      // Convert ArrayBuffer to base64 string for JSON serialization
      let responseData;
      if (result.body instanceof ArrayBuffer) {
        const bytes = new Uint8Array(result.body);
        const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        responseData = btoa(binary);
        
        // Add encoding info to headers
        result.headers['X-Content-Encoding'] = 'base64';
      } else {
        responseData = result.body;
      }
      
      // DEBUG: Log final response data for RPC debugging
      if (request.path.includes('/rpc/')) {
        console.log('🐛 CrossOrigin Final Response Data:', {
          responseDataType: typeof responseData,
          responseDataValue: responseData
        })
      }
      
      return {
        data: responseData,
        status: result.status,
        headers: result.headers
      };
    }
    
    // Handle different API endpoints
    if (pathParts[0] === 'rest' && pathParts[1] === 'v1') {
      // PostgREST endpoint
      const table = pathParts[2];
      
      if (!table) {
        throw new Error('Table name required');
      }
      
      // Build headers object
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...request.headers
      };
      
      // Execute the request using the unified query engine
      const apiRequest: ApiRequest = {
        method: request.method as any,
        url: url,
        headers,
        body: request.body,
        params: { table }
      };

      const apiContext: ApiContext = {
        requestId: request.requestId || `req_${Date.now()}`,
        projectId: 'default', // Cross-origin requests use default project
        userId: headers.authorization ? 'cross-origin-user' : undefined,
        role: 'authenticated'
      };

      const result = await this.queryEngine.processRequest(apiRequest, apiContext);
      return {
        data: result.data,
        status: result.status,
        headers: result.headers
      };
    } else if (pathParts[0] === 'auth' && pathParts[1] === 'v1') {
      // Authentication endpoint - handle directly via AuthBridge
      console.log('🔐 CrossOrigin: Handling auth request:', request.method, request.path);
      
      const endpoint = pathParts[2]; // signup, signin, token, etc.
      
      try {
        const result = await this.authBridge.handleAuthRequest({
          endpoint,
          method: request.method === 'PATCH' ? 'PUT' : request.method as 'GET' | 'POST' | 'PUT' | 'DELETE',
          url: new URL(request.path, 'http://localhost'),
          headers: request.headers || {},
          body: request.body
        });
        
        console.log('✅ CrossOrigin: Auth response:', { status: result.status, hasData: !!result.data, hasError: !!result.error });
        
        if (result.error) {
          return {
            data: result.error,
            status: result.status || 400,
            headers: result.headers || { 'Content-Type': 'application/json' }
          };
        }
        
        return {
          data: result.data,
          status: result.status || 200,
          headers: result.headers || { 'Content-Type': 'application/json' }
        };
      } catch (error: any) {
        console.error('❌ CrossOrigin: Auth error:', error);
        return {
          data: { error: 'Authentication service failed', message: error.message },
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        };
      }
    } else {
      // For other endpoints, use fetch to forward to MSW handlers
      // This should rarely be reached now that we handle auth directly
      try {
        const fetchOptions: RequestInit = {
          method: request.method,
          headers: request.headers
        };
        
        // Only add body for methods that support it
        if (request.body && (request.method === 'POST' || request.method === 'PATCH')) {
          fetchOptions.body = JSON.stringify(request.body);
        }
        
        const response = await fetch(request.path, fetchOptions);
        
        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = responseText;
        }
        
        return {
          data: responseData,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        };
      } catch (error: any) {
        throw new Error(`Failed to forward request to ${request.path}: ${error.message}`);
      }
    }
  }

  /**
   * Check if proxy connection is active
   */
  public isProxyActive(): boolean {
    return this.proxyConnector.isProxyActive();
  }

  /**
   * Get proxy connector instance
   */
  public getProxyConnector(): ProxyConnector {
    return this.proxyConnector;
  }

  /**
   * Route API request through proxy if available, otherwise use normal handling
   */
  public async routeAPIRequest(request: APIRequest): Promise<Omit<APIResponse, 'requestId'>> {
    if (this.proxyConnector.isProxyActive()) {
      console.log('🔗 Routing request through proxy connector:', request.method, request.path);
      
      try {
        const response = await this.proxyConnector.sendAPIRequest(
          request.method,
          request.path,
          request.headers,
          request.body
        );

        return {
          data: response.data,
          status: response.status,
          headers: response.headers
        };
      } catch (error: any) {
        console.error('❌ Proxy request failed, falling back to local execution:', error);
        // Fall back to local execution if proxy fails
      }
    }

    // Execute locally if proxy is not available or failed
    return this.executeRequest(request);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.proxyConnector.cleanup();
  }
}