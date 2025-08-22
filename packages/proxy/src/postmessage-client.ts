import { EventEmitter } from 'events';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
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
  private bridgeServer: any = null;
  private bridgeApp: any = null;
  private bridgePort = 8765; // Different from proxy port to avoid conflicts
  private targetUrl: string;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();
  private isServerRunning = false;
  private messageListener: ((event: MessageEvent) => void) | null = null;

  constructor(targetUrl: string) {
    super();
    this.targetUrl = targetUrl;
  }

  async connect(): Promise<void> {
    if (this.isServerRunning) {
      return;
    }

    console.log(`🔌 Starting PostMessage bridge for ${this.targetUrl}`);
    
    // Start local bridge server
    await this.startBridgeServer();
    
    // Open browser to bridge page
    const bridgeUrl = `http://localhost:${this.bridgePort}`;
    console.log(`🌐 Opening bridge at ${bridgeUrl}`);
    
    try {
      await open(bridgeUrl, { wait: false });
    } catch (error) {
      console.warn(`⚠️ Could not auto-open browser. Please manually open: ${bridgeUrl}`);
    }
    
    // Setup message listener (for when we add browser automation later)
    this.setupMessageListener();
    
    this.isServerRunning = true;
    console.log('✅ PostMessage bridge ready');
  }

  private async startBridgeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const app = express();
      
      // Get current directory for ESM
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      // Serve bridge HTML file
      app.get('/', (req, res) => {
        const bridgeHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Supabase Lite Proxy Bridge</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            background: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .status {
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .loading { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .log {
            font-family: monospace;
            font-size: 12px;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔗 Supabase Lite Proxy Bridge</h1>
        <p>This bridge connects your local proxy to your <strong>EXISTING</strong> Supabase Lite tab.</p>
        <p><strong>Target:</strong> ${this.targetUrl}</p>
        <p><strong>Method:</strong> PostMessage (connects to your existing browser tab)</p>
        
        <div id="status" class="status loading">
            🔄 Ready to connect - click button below to establish connection
        </div>
        
        <button id="connectBtn" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; margin: 20px 0; font-size: 14px; display: block;">Connect to Existing Tab</button>
        
        <div class="log" id="log">
            <div>🚀 Bridge server started</div>
        </div>
    </div>

    <script>
        const statusDiv = document.getElementById('status');
        const logDiv = document.getElementById('log');
        
        let broadcastChannel;
        let isConnected = false;
        const pendingRequests = new Map();
        
        function log(message) {
            const timestamp = new Date().toLocaleTimeString();
            logDiv.innerHTML += '<div>' + timestamp + ' - ' + message + '</div>';
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        
        // Manual connection to existing Supabase Lite tab
        let supabaseWindow = null;
        
        function updateStatus(connected) {
            isConnected = connected;
            if (connected) {
                statusDiv.className = 'status connected';
                statusDiv.innerHTML = '✅ Connected to your EXISTING Supabase Lite tab';
            } else {
                statusDiv.className = 'status disconnected';
                statusDiv.innerHTML = '❌ Not connected - click "Connect to Existing Tab" button';
            }
        }
        
        // Get the connect button from HTML
        const connectBtn = document.getElementById('connectBtn');
        
        connectBtn.addEventListener('click', function() {
            try {
                log('🌐 Opening connection to existing tab: ${this.targetUrl}');
                supabaseWindow = window.open('${this.targetUrl}', '_blank');
                
                if (supabaseWindow) {
                    log('✅ Tab opened - waiting for connection to existing tab');
                    isConnected = true;
                    updateStatus(true);
                    connectBtn.textContent = 'Connected';
                    connectBtn.disabled = true;
                    connectBtn.style.background = '#059669';
                } else {
                    throw new Error('Failed to open new tab - check popup blocker');
                }
            } catch (error) {
                log('❌ Failed to connect to existing tab: ' + error.message);
                updateStatus(false);
            }
        });
        
        // Listen for responses from existing Supabase Lite tab
        window.addEventListener('message', function(event) {
            // Only accept messages from the target origin
            if (event.origin !== '${new URL(this.targetUrl).origin}') {
                return;
            }
            
            log('📥 Response from existing tab: ' + JSON.stringify(event.data).substring(0, 100) + '...');
            
            if (event.data.type === 'API_RESPONSE') {
                const requestId = event.data.data.requestId;
                const pending = pendingRequests.get(requestId);
                
                if (pending) {
                    pendingRequests.delete(requestId);
                    
                    // Forward response to proxy server via fetch
                    fetch('/api/response', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(event.data)
                    }).catch(err => {
                        log('❌ Failed to forward response: ' + err.message);
                    });
                }
            }
        });
        
        // Poll for requests from proxy server
        async function pollForRequests() {
            try {
                const response = await fetch('/api/request');
                if (response.ok) {
                    const request = await response.json();
                    if (request && supabaseWindow && isConnected) {
                        log('📤 Sending to existing tab: ' + request.data.method + ' ' + request.data.path);
                        
                        // Store pending request
                        pendingRequests.set(request.data.requestId, request);
                        
                        // Send to existing Supabase Lite tab via PostMessage
                        supabaseWindow.postMessage({
                            type: 'API_REQUEST',
                            data: request.data
                        }, '${new URL(this.targetUrl).origin}');
                    }
                }
            } catch (error) {
                log('❌ Poll error: ' + error.message);
            }
            
            // Continue polling
            setTimeout(pollForRequests, 100);
        }
        
        // Start polling immediately
        pollForRequests();
    </script>
</body>
</html>`;
        res.send(bridgeHtml);
      });
      
      // API endpoints for request/response handling
      let pendingRequest: PostMessageRequest | null = null;
      let pendingResponse: PostMessageResponse | null = null;
      
      app.get('/api/request', (req, res) => {
        if (pendingRequest) {
          const request = pendingRequest;
          pendingRequest = null;
          res.json(request);
        } else {
          res.json(null);
        }
      });
      
      app.use(express.json());
      app.post('/api/response', (req, res) => {
        pendingResponse = req.body;
        res.json({ success: true });
      });
      
      // Store app with methods for later access
      const appWithMethods = app as any;
      appWithMethods.sendRequest = (request: PostMessageRequest) => {
        pendingRequest = request;
      };
      
      appWithMethods.getResponse = (): PostMessageResponse | null => {
        const response = pendingResponse;
        pendingResponse = null;
        return response;
      };
      
      this.bridgeApp = appWithMethods;
      
      this.bridgeServer = app.listen(this.bridgePort, () => {
        console.log(`🌐 Bridge server running on http://localhost:${this.bridgePort}`);
        resolve();
      });
      
      this.bridgeServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          this.bridgePort++;
          console.log(`Port in use, trying ${this.bridgePort}`);
          this.bridgeServer = app.listen(this.bridgePort, () => resolve());
        } else {
          reject(error);
        }
      });
    });
  }

  private setupMessageListener(): void {
    // This will be enhanced later when we add browser automation
    console.log('📡 PostMessage listener setup complete');
  }

  async sendRequest(request: ProxyRequest): Promise<ProxyResponse> {
    if (!this.isServerRunning) {
      await this.connect();
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

      // Send request to bridge server
      if (this.bridgeApp) {
        this.bridgeApp.sendRequest(postMessageRequest);
        
        // Poll for response
        const pollForResponse = () => {
          const response = this.bridgeApp.getResponse();
          if (response && response.data.requestId === request.id) {
            const pending = this.pendingRequests.get(request.id);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(request.id);
              
              // Convert back to ProxyResponse format
              const proxyResponse: ProxyResponse = {
                status: response.data.status,
                headers: response.data.headers,
                body: response.data.error ? { error: response.data.error } : response.data.data
              };
              
              pending.resolve(proxyResponse);
            }
          } else if (this.pendingRequests.has(request.id)) {
            setTimeout(pollForResponse, 50);
          }
        };
        
        setTimeout(pollForResponse, 100);
      }
    });
  }

  isConnected(): boolean {
    return this.isServerRunning;
  }

  disconnect(): void {
    if (this.bridgeServer) {
      this.bridgeServer.close();
      this.bridgeServer = null;
    }
    
    // Reject all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();
    
    this.isServerRunning = false;
    console.log('🔌 PostMessage bridge disconnected');
  }
}