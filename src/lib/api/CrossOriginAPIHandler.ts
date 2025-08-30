// Cross-origin API handler for the main app
// Listens for postMessage requests from test app and executes them on browser database

import { EnhancedSupabaseAPIBridge } from '../../mocks/enhanced-bridge';
import { vfsDirectHandler } from '../vfs/VFSDirectHandler';

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
  private apibridge: EnhancedSupabaseAPIBridge;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.apibridge = new EnhancedSupabaseAPIBridge();
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
    }
  }

  private async handleMessage(event: MessageEvent) {
    // Allow localhost origins and any HTTPS origin since this is a local-only app
    if (!this.isAllowedOrigin(event.origin)) {
      return;
    }

    const { type, data } = event.data;
    
    if (type === 'API_REQUEST') {
      const request: APIRequest = data;
      try {
        const response = await this.executeRequest(request);
        
        // Send response back to requesting origin
        event.source?.postMessage({
          type: 'API_RESPONSE',
          data: {
            requestId: request.requestId,
            ...response
          }
        }, { targetOrigin: event.origin });
        
      } catch (error: any) {
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
      
      // Execute the request using the enhanced bridge
      const supabaseRequest = {
        table,
        method: request.method,
        body: request.body,
        headers,
        url
      };
      
      const result = await this.apibridge.handleRestRequest(supabaseRequest);
      return {
        data: result.data,
        status: result.status,
        headers: result.headers
      };
    } else {
      // For other endpoints, use fetch to forward to MSW handlers
      try {
        const fetchOptions: RequestInit = {
          method: request.method,
          headers: request.headers
        };
        
        // Only add body for methods that support it
        if (request.body && (request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT')) {
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
}