// Cross-origin API handler for the main app
// Listens for postMessage requests from test app and executes them on browser database

import { EnhancedSupabaseAPIBridge } from '../../mocks/enhanced-bridge';

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
  private allowedOrigins = [
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176'
  ];

  constructor() {
    this.apibridge = new EnhancedSupabaseAPIBridge();
    this.setupMessageListener();
    this.setupBroadcastChannel();
  }

  private setupMessageListener() {
    window.addEventListener('message', (event) => {
      this.handleMessage(event);
    });
    console.log('Cross-origin API handler listening for postMessage');
  }

  private setupBroadcastChannel() {
    try {
      this.broadcastChannel = new BroadcastChannel('supabase-api');
      this.broadcastChannel.addEventListener('message', (event) => {
        this.handleBroadcastMessage(event);
      });
      console.log('Cross-origin API handler listening for BroadcastChannel messages');
    } catch (error) {
      console.warn('BroadcastChannel not available:', error);
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
        
        console.log(`✅ Cross-origin API (BC): ${request.method} ${request.path} -> ${response.status}`);
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
    // Check origin
    if (!this.allowedOrigins.includes(event.origin)) {
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
        
        console.log(`✅ Cross-origin API: ${request.method} ${request.path} -> ${response.status}`);
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
    } else if (pathParts[0] === 'auth') {
      // Auth endpoint
      return {
        data: { message: 'Auth endpoint not yet implemented in cross-origin handler' },
        status: 501,
        headers: { 'Content-Type': 'application/json' }
      };
    } else {
      throw new Error(`Unsupported endpoint: ${request.path}`);
    }
  }
}