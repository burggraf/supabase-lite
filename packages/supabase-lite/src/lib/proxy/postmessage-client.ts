import { EventEmitter } from 'events';
import open from 'open';

export interface ProxyRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

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
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private connected = false;
  private tabConnected = false;

  constructor(targetUrl: string) {
    super();
    this.targetUrl = targetUrl;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    console.log(`🔌 Starting PostMessage connection to ${this.targetUrl}`);
    
    // Try to find existing tab first using BroadcastChannel
    const existingTabFound = await this.tryConnectToExistingTab();
    
    if (!existingTabFound) {
      console.log(`🌐 No existing tab found, opening new tab...`);
      // Open new tab with auto-connection parameter
      const targetUrlWithProxy = `${this.targetUrl}${this.targetUrl.includes('?') ? '&' : '?'}proxy-connect=true`;
      
      try {
        await open(targetUrlWithProxy, { wait: false });
      } catch (error) {
        console.warn(`⚠️ Could not auto-open browser. Please manually open: ${targetUrlWithProxy}`);
      }
      
      // Wait a moment for the tab to load and establish connection
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.connected = true;
    console.log('✅ PostMessage connection ready');
  }

  /**
   * Try to connect to existing browser tab via BroadcastChannel
   */
  private async tryConnectToExistingTab(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Check if BroadcastChannel is available (Node.js 16+ or polyfilled)
        if (typeof BroadcastChannel === 'undefined') {
          resolve(false);
          return;
        }
        
        // Create a temporary BroadcastChannel to communicate with existing tabs
        const channel = new (BroadcastChannel as any)('supabase-proxy-connect');
        
        let responded = false;
        const timeout = setTimeout(() => {
          if (!responded) {
            try {
              channel.close();
            } catch (e) {
              // Ignore cleanup errors
            }
            resolve(false);
          }
        }, 3000); // Wait 3 seconds for existing tabs to respond
        
        // Listen for responses from existing tabs
        if (channel.addEventListener) {
          channel.addEventListener('message', (event: any) => {
            if (event.data.type === 'TAB_AVAILABLE' && event.data.url === this.targetUrl) {
              responded = true;
              clearTimeout(timeout);
              
              console.log(`🔄 Found existing tab for ${this.targetUrl}, establishing connection...`);
              
              // Send connection request to the existing tab
              channel.postMessage({
                type: 'ESTABLISH_PROXY_CONNECTION',
                data: {
                  url: this.targetUrl,
                  timestamp: Date.now()
                }
              });
              
              this.tabConnected = true;
              
              // Give the tab a moment to acknowledge, then resolve
              setTimeout(() => {
                try {
                  channel.close();
                } catch (e) {
                  // Ignore cleanup errors
                }
                resolve(true);
              }, 1000);
            }
          });
          
          // Send a discovery message to find existing tabs
          console.log(`📡 Broadcasting discovery message for ${this.targetUrl}...`);
          channel.postMessage({
            type: 'DISCOVER_TABS',
            data: { url: this.targetUrl }
          });
        } else {
          // BroadcastChannel doesn't have addEventListener, fall back
          channel.close();
          resolve(false);
        }
        
      } catch (error) {
        console.log(`⚠️ BroadcastChannel not available, will open new tab`);
        resolve(false);
      }
    });
  }

  async sendRequest(request: ProxyRequest): Promise<ProxyResponse> {
    if (!this.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout for ${request.method} ${request.url}`));
      }, 30000);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      // Send request directly via BroadcastChannel to existing tab
      try {
        const channel = new (BroadcastChannel as any)('supabase-api-proxy');
        
        // Listen for response on this channel
        const responseHandler = (event: any) => {
          if (event.data.type === 'API_RESPONSE' && event.data.data.requestId === request.id) {
            const pending = this.pendingRequests.get(request.id);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(request.id);
              
              // Convert back to ProxyResponse format
              const proxyResponse: ProxyResponse = {
                status: event.data.data.status,
                headers: event.data.data.headers || {},
                body: event.data.data.error ? { error: event.data.data.error } : event.data.data.data
              };
              
              channel.removeEventListener('message', responseHandler);
              channel.close();
              pending.resolve(proxyResponse);
            }
          }
        };
        
        channel.addEventListener('message', responseHandler);
        
        // Send the API request
        channel.postMessage({
          type: 'API_REQUEST',
          data: {
            method: request.method,
            path: request.url,
            headers: request.headers,
            body: request.body ? JSON.parse(request.body) : undefined,
            requestId: request.id
          }
        });
        
      } catch (error) {
        const pending = this.pendingRequests.get(request.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(request.id);
          pending.reject(new Error(`BroadcastChannel error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();
    
    this.connected = false;
    this.tabConnected = false;
    console.log('🔌 PostMessage connection disconnected');
  }

  /**
   * Send command completion signal to browser
   */
  async sendCommandComplete(): Promise<void> {
    try {
      const channel = new (BroadcastChannel as any)('supabase-proxy-connect');
      channel.postMessage({
        type: 'COMMAND_COMPLETE',
        data: { 
          url: this.targetUrl,
          timestamp: Date.now() 
        }
      });
      channel.close();
    } catch (error) {
      console.error('Error sending command completion signal:', error);
    }
  }
}