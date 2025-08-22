import express from 'express';
import cors from 'cors';
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
  private enableLogging: boolean;
  private connectionMode: 'websocket' | 'postmessage';

  constructor(private options: ProxyServerOptions) {
    this.app = express();
    this.enableLogging = options.enableLogging ?? true;
    
    // Determine connection mode
    this.connectionMode = this.determineConnectionMode();
    
    // Create appropriate client
    if (this.connectionMode === 'websocket') {
      // WebSocket bridge always connects to local WebSocket server
      // This server bridges to your existing browser tab (regardless of dev/prod)
      const wsUrl = 'ws://localhost:5176';
      this.client = new WebSocketClient(wsUrl);
      console.log(`🔌 Using WebSocket mode: ${wsUrl} (bridging to ${this.options.targetUrl})`);
    } else {
      this.client = new PostMessageClient(this.options.targetUrl);
      console.log(`🔗 Using PostMessage mode: ${this.options.targetUrl}`);
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
    
    // Always prefer WebSocket for connecting to existing browser tab
    // PostMessage creates a NEW instance (wrong behavior)
    // WebSocket connects to existing tab (correct behavior)
    return 'websocket';
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
        console.error(`❌ Error proxying ${req.method} ${req.url}:`, error);
        
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
      console.error('❌ Unhandled error:', error);
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect to client first
        this.client.connect()
          .then(() => {
            // Start HTTP server
            this.server = this.app.listen(this.options.port, () => {
              console.log(`🚀 Supabase Lite Proxy Server running on port ${this.options.port}`);
              console.log(`📡 ${this.connectionMode} bridge connected to ${this.options.targetUrl}`);
              console.log(`🌐 Proxy URL: http://localhost:${this.options.port}`);
              console.log(`💡 Use this URL in your Supabase client: http://localhost:${this.options.port}`);
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

        // Handle client disconnections (if it's a WebSocket client)
        if (this.connectionMode === 'websocket') {
          (this.client as any).on('disconnect', () => {
            console.log('⚠️ WebSocket disconnected. Requests will fail until reconnection.');
          });
        }

      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🛑 Stopping proxy server...');
      
      this.client.disconnect();
      
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Proxy server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}