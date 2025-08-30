import { EventEmitter } from 'events';
import open from 'open';
import { ProxyRequest, ProxyResponse } from './websocket-client.js';

interface PostMessageRequest {
  type: 'API_REQUEST';
  data: {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: any;
    requestId: string;
  };
}

interface PostMessageResponse {
  type: 'API_RESPONSE';
  data: {
    requestId: string;
    data?: any;
    error?: string;
    status: number;
    headers: Record<string, string>;
  };
}

export class PostMessageClient extends EventEmitter {
  private targetUrl: string;
  private broadcastChannel: any | null = null;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private connected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(targetUrl: string) {
    super();
    this.targetUrl = targetUrl;
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    console.log(`🔗 Connecting to ${this.targetUrl} via PostMessage...`);
    
    try {
      // Try to create BroadcastChannel for communication
      this.broadcastChannel = new BroadcastChannel('supabase-api');
      
      // Set up message handling
      this.broadcastChannel.addEventListener('message', (event: MessageEvent) => {
        this.handleBroadcastMessage(event);
      });

      console.log(`✅ BroadcastChannel created for ${this.targetUrl}`);
      this.connected = true;
      
      // Test the connection
      console.log(`🔍 Testing connection to deployed instance...`);
      const connectionEstablished = await this.testConnection();
      
      if (!connectionEstablished) {
        console.log(`⚠️  No active browser tab detected for ${this.targetUrl}`);
        console.log(`   Connection will be established when browser opens`);
      }

    } catch (error) {
      console.error(`❌ Failed to create BroadcastChannel:`, error);
      throw new Error(`Failed to initialize PostMessage connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async testConnection(): Promise<boolean> {
    if (!this.broadcastChannel) {
      console.log('🔍 No BroadcastChannel available');
      return false;
    }

    return new Promise((resolve) => {
      const testId = `test_${Date.now()}`;
      const timeout = setTimeout(() => {
        console.log('🔍 Test connection timeout - no response from browser tab');
        resolve(false);
      }, 3000); // Increase timeout slightly

      const testHandler = (event: any) => {
        console.log('🔍 Received test response:', event.data);
        if (event.data.type === 'API_RESPONSE' && event.data.data.requestId === testId) {
          clearTimeout(timeout);
          this.broadcastChannel!.removeEventListener('message', testHandler);
          console.log('🔍 Test connection successful!');
          resolve(true);
        }
      };

      this.broadcastChannel.addEventListener('message', testHandler);
      
      // Send a test request
      console.log(`🔍 Sending test request: ${testId}`);
      this.broadcastChannel.postMessage({
        type: 'API_REQUEST',
        data: {
          method: 'GET',
          path: '/health',
          headers: {},
          requestId: testId
        }
      });
    });
  }

  private async waitForConnection(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`⏰ Connection timeout after ${timeoutMs/1000}s`);
        resolve(false);
      }, timeoutMs);
      
      let attempts = 0;
      const maxAttempts = timeoutMs / 1000; // 1 attempt per second
      
      const checkConnection = async () => {
        attempts++;
        console.log(`🔍 Connection attempt ${attempts}/${maxAttempts}...`);
        
        const connected = await this.testConnection();
        if (connected) {
          clearTimeout(timeout);
          console.log(`✅ Connected after ${attempts} attempts`);
          resolve(true);
        } else if (attempts >= maxAttempts) {
          clearTimeout(timeout);
          console.log(`❌ Failed to connect after ${attempts} attempts`);
          resolve(false);
        } else {
          setTimeout(checkConnection, 1000);
        }
      };

      // Start checking after a brief delay to let the browser load
      setTimeout(checkConnection, 2000);
    });
  }

  private handleBroadcastMessage(event: any) {
    const { type, data } = event.data;
    
    if (type === 'API_RESPONSE') {
      const requestId = data.requestId;
      const pending = this.pendingRequests.get(requestId);
      
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(requestId);
        
        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          const response: ProxyResponse = {
            status: data.status,
            headers: data.headers,
            body: data.data
          };
          pending.resolve(response);
        }
      }
    }
  }

  async sendRequest(request: ProxyRequest): Promise<ProxyResponse> {
    if (!this.connected) {
      await this.connect();
    }

    if (!this.broadcastChannel) {
      throw new Error('BroadcastChannel not available');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout for ${request.method} ${request.url}`));
      }, 30000);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      // Convert to PostMessage format
      const postMessageRequest: PostMessageRequest = {
        type: 'API_REQUEST',
        data: {
          method: request.method,
          path: request.url,
          headers: request.headers,
          body: request.body ? JSON.parse(request.body) : undefined,
          requestId: request.id
        }
      };

      // Send via BroadcastChannel
      this.broadcastChannel.postMessage(postMessageRequest);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendCommandComplete(): Promise<void> {
    if (this.broadcastChannel && this.connected) {
      console.log('📤 Sending command completion signal to browser via BroadcastChannel');
      this.broadcastChannel.postMessage({
        type: 'COMMAND_COMPLETE',
        timestamp: new Date().toISOString()
      });
      // Give some time for the message to be sent before closing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  disconnect(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    
    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();
    
    this.connected = false;
    this.connectionPromise = null;
    console.log('🔌 PostMessage client disconnected');
  }
}