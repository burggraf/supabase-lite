import express from 'express';
import cors from 'cors';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import { WebSocketClient, ProxyRequest } from './websocket-client.js';
import { PostMessageClient } from './postmessage-client.js';

export interface ProxyServerOptions {
  port: number;
  targetUrl: string;
  mode?: 'websocket' | 'postmessage' | 'auto';
  enableLogging?: boolean;
}

// Abstract interface for both client types
interface ProxyClient {
  connect(): Promise<void>;
  disconnect(): void;
  sendRequest(request: ProxyRequest): Promise<any>;
  isConnected(): boolean;
}

export class ProxyServer {
  private app: express.Application;
  private client: ProxyClient;
  private server: any;
  private httpServer: any;
  private wsServer: WebSocketServer | null = null;
  private browserClients = new Set<WebSocket>();
  private enableLogging: boolean;
  private connectionMode: 'websocket' | 'postmessage';

  constructor(private options: ProxyServerOptions) {
    this.app = express();
    this.enableLogging = options.enableLogging ?? false; // Default to quiet for integrated mode
    
    // Determine connection mode
    this.connectionMode = this.determineConnectionMode();
    
    // Create appropriate client
    if (this.connectionMode === 'websocket') {
      // WebSocket bridge always connects to local WebSocket server
      const wsUrl = 'ws://localhost:5176';
      this.client = new WebSocketClient(wsUrl);
      if (this.enableLogging) {
        console.log(`🔌 Using WebSocket mode: ${wsUrl} (bridging to ${this.options.targetUrl})`);
      }
    } else {
      this.client = new PostMessageClient(this.options.targetUrl);
      if (this.enableLogging) {
        console.log(`🔗 Using PostMessage mode: ${this.options.targetUrl}`);
      }
    }
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private determineConnectionMode(): 'websocket' | 'postmessage' {
    // Manual override
    if (this.options.mode && this.options.mode !== 'auto') {
      return this.options.mode;
    }
    
    // Auto-detect based on URL
    const url = this.options.targetUrl.toLowerCase();
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      // Use WebSocket for local development (has WebSocket server)
      return 'websocket';
    } else {
      // Use PostMessage + BroadcastChannel for production (connects to existing tab)
      return 'postmessage';
    }
  }

  private setupMiddleware(): void {
    // Enable CORS for all origins
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'apikey', 
        'prefer', 
        'range', 
        'x-supabase-api-version', 
        'x-client-info', 
        'accept-profile', 
        'content-profile'
      ]
    }));

    // Parse JSON bodies
    this.app.use(express.json({ limit: '10mb' }));
    
    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    if (this.enableLogging) {
      this.app.use((req, res, next) => {
        console.log(`📥 ${req.method} ${req.url} - ${new Date().toISOString()}`);
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        connected: this.client.isConnected(),
        mode: this.connectionMode,
        targetUrl: this.options.targetUrl,
        timestamp: new Date().toISOString(),
        version: '1.0.1'
      });
    });

    // Catch-all route for proxying requests
    this.app.all('*', async (req, res) => {
      try {
        // Check if we have browser clients connected via WebSocket
        if (this.browserClients.size > 0) {
          // Route through WebSocket to browser
          await this.handleRequestViaWebSocket(req, res);
          return;
        }

        // Fallback to traditional client routing
        // Check if client is connected
        if (!this.client.isConnected()) {
          await this.client.connect();
        }

        // Generate unique request ID
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Prepare request for client
        const proxyRequest: ProxyRequest = {
          id: requestId,
          method: req.method,
          url: req.url,
          headers: req.headers as Record<string, string>,
          body: req.body ? JSON.stringify(req.body) : undefined
        };

        if (this.enableLogging) {
          console.log(`🔄 Proxying ${req.method} ${req.url} via ${this.connectionMode} (ID: ${requestId})`);
        }

        // Send request via client and wait for response
        const response = await this.client.sendRequest(proxyRequest);

        if (this.enableLogging) {
          console.log(`✅ Response received for ${requestId} (status: ${response.status})`);
        }

        // Set response headers
        if (response.headers) {
          Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, String(value));
          });
        }

        // Send response
        res.status(response.status || 200);
        
        if (typeof response.body === 'string') {
          res.send(response.body);
        } else {
          res.json(response.body);
        }

      } catch (error: any) {
        if (this.enableLogging) {
          console.error(`❌ Error proxying ${req.method} ${req.url}:`, error);
        }
        
        res.status(500).json({
          error: 'Proxy server error',
          message: error.message,
          path: req.url,
          method: req.method,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Handle HTTP request by routing through WebSocket to browser
   */
  private async handleRequestViaWebSocket(req: express.Request, res: express.Response): Promise<void> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (this.enableLogging) {
      console.log(`🔄 Routing ${req.method} ${req.url} via WebSocket to browser (ID: ${requestId})`);
    }

    // Get the first connected browser client
    const browserClient = Array.from(this.browserClients)[0];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`WebSocket request timeout: ${req.method} ${req.url}`));
      }, 10000);

      // Set up response handler  
      const responseHandler = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'API_RESPONSE' && message.data.requestId === requestId) {
            clearTimeout(timeout);
            browserClient.removeListener('message', responseHandler);
            
            const responseData = message.data;
            
            if (this.enableLogging) {
              console.log(`✅ WebSocket response received for ${requestId} (status: ${responseData.status})`);
            }

            // Set response headers
            if (responseData.headers) {
              Object.entries(responseData.headers).forEach(([key, value]) => {
                res.setHeader(key, String(value));
              });
            }

            // Send response
            res.status(responseData.status || 200);
            
            if (responseData.error) {
              res.json({ error: responseData.error });
            } else if (typeof responseData.data === 'string') {
              res.send(responseData.data);
            } else {
              res.json(responseData.data);
            }
            
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          browserClient.removeListener('message', responseHandler);
          reject(error);
        }
      };

      browserClient.on('message', responseHandler);

      // Send request to browser via WebSocket
      browserClient.send(JSON.stringify({
        type: 'API_REQUEST',
        data: {
          method: req.method,
          path: req.url,
          headers: req.headers || {},
          body: req.body,
          requestId
        }
      }));
    });
  }

  private setupErrorHandling(): void {
    // Handle 404s
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (this.enableLogging) {
        console.error('❌ Unhandled error:', error);
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Set up WebSocket server for browser connections
   */
  private setupWebSocketServer(): void {
    this.wsServer = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws'
    });

    this.wsServer.on('connection', (ws: WebSocket) => {
      if (this.enableLogging) {
        console.log(`🔗 Browser WebSocket client connected`);
      }
      
      this.browserClients.add(ws);
      
      // Send connection status
      this.sendStatusToBrowser(ws, 'connected', '🟢 Proxy Connected');
      
      // Handle messages from browser
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'API_REQUEST') {
            await this.handleBrowserAPIRequest(ws, message.data);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.sendStatusToBrowser(ws, 'error', `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      ws.on('close', () => {
        if (this.enableLogging) {
          console.log(`🔌 Browser WebSocket client disconnected`);
        }
        this.browserClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.browserClients.delete(ws);
      });
    });
  }

  /**
   * Handle API request from browser via WebSocket
   */
  private async handleBrowserAPIRequest(ws: WebSocket, requestData: any): Promise<void> {
    try {
      const { method, path, headers, body, requestId } = requestData;
      
      if (this.enableLogging) {
        console.log(`🔄 Handling browser API request: ${method} ${path} (ID: ${requestId})`);
      }

      // Send status update
      this.sendStatusToBrowser(ws, 'executing', `🟡 Executing: ${method} ${path}...`);

      // Create proxy request
      const proxyRequest: ProxyRequest = {
        id: requestId,
        method,
        url: path,
        headers: headers || {},
        body: body ? JSON.stringify(body) : undefined
      };

      // Forward to the actual client (WebSocket or PostMessage)
      const response = await this.client.sendRequest(proxyRequest);

      // Send response back to browser
      ws.send(JSON.stringify({
        type: 'API_RESPONSE',
        data: {
          requestId,
          status: response.status,
          headers: response.headers,
          data: response.body
        }
      }));

      this.sendStatusToBrowser(ws, 'completed', `✅ Request completed: ${method} ${path}`);

    } catch (error: any) {
      // Send error response to browser
      ws.send(JSON.stringify({
        type: 'API_RESPONSE',
        data: {
          requestId: requestData.requestId,
          error: error.message,
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      }));

      this.sendStatusToBrowser(ws, 'error', `❌ Error: ${error.message}`);
    }
  }

  /**
   * Send status update to a specific browser client
   */
  private sendStatusToBrowser(ws: WebSocket, status: string, message: string): void {
    try {
      ws.send(JSON.stringify({
        type: 'STATUS_UPDATE',
        data: { status, message, timestamp: new Date().toISOString() }
      }));
    } catch (error) {
      console.error('Error sending status to browser:', error);
    }
  }

  /**
   * Send status update to all connected browser clients
   */
  public sendStatusToAllBrowsers(status: string, message: string): void {
    this.browserClients.forEach(ws => {
      this.sendStatusToBrowser(ws, status, message);
    });
  }

  /**
   * Check if any browsers are connected
   */
  public hasBrowserClients(): boolean {
    return this.browserClients.size > 0;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server first
        this.httpServer = createServer(this.app);

        // Set up WebSocket server
        this.setupWebSocketServer();

        // Connect to client first
        this.client.connect()
          .then(() => {
            // Start HTTP server
            this.server = this.httpServer.listen(this.options.port, () => {
              if (this.enableLogging) {
                console.log(`🚀 Supabase Lite Proxy Server running on port ${this.options.port}`);
                console.log(`📡 ${this.connectionMode} bridge connected to ${this.options.targetUrl}`);
                console.log(`🌐 Proxy URL: http://localhost:${this.options.port}`);
                console.log(`🔌 WebSocket server ready for browser connections`);
              }
              resolve();
            });

            this.server.on('error', (error: any) => {
              if (error.code === 'EADDRINUSE') {
                reject(new Error(`Port ${this.options.port} is already in use. Please choose a different port.`));
              } else {
                reject(error);
              }
            });
          })
          .catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.enableLogging) {
        console.log('🛑 Stopping proxy server...');
      }
      
      // Notify browser clients that proxy is shutting down
      this.sendStatusToAllBrowsers('disconnecting', '🔴 Proxy shutting down...');
      
      // Close WebSocket connections
      this.browserClients.forEach(ws => {
        try {
          ws.close();
        } catch (error) {
          console.error('Error closing WebSocket:', error);
        }
      });
      this.browserClients.clear();

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      // Disconnect client
      this.client.disconnect();
      
      if (this.server) {
        this.server.close(() => {
          if (this.enableLogging) {
            console.log('✅ Proxy server stopped');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.options.port;
  }

  getTargetUrl(): string {
    return this.options.targetUrl;
  }
}