import WebSocket from 'ws';
import { EventEmitter } from 'events';

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

export interface WebSocketMessage {
  type: 'request' | 'response' | 'command_complete';
  requestId: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
  response?: ProxyResponse;
  projectContext?: {
    projectId: string;
    apiType: string;
  };
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 1000;
  private connectionPromise: Promise<void> | null = null;

  constructor(private url: string) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._connect();
    return this.connectionPromise;
  }

  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Attempting to connect to WebSocket at ${this.url}`);
      
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('✅ Connected to Supabase Lite WebSocket bridge');
        this.reconnectAttempts = 0;
        this.connectionPromise = null;
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.emit('message', message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket connection closed (${code}): ${reason}`);
        this.ws = null;
        this.connectionPromise = null;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('❌ Max reconnection attempts reached');
          this.emit('disconnect');
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.connectionPromise = null;
        
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect().catch((error) => {
          console.error('❌ Reconnection failed:', error);
        });
      }
    }, delay);
  }

  async sendRequest(request: ProxyRequest): Promise<ProxyResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout for ${request.method} ${request.url}`));
      }, 30000);

      const messageHandler = (message: WebSocketMessage) => {
        if (message.type === 'response' && message.requestId === request.id) {
          clearTimeout(timeout);
          this.removeListener('message', messageHandler);
          
          if (message.response) {
            resolve(message.response);
          } else {
            reject(new Error('Invalid response format'));
          }
        }
      };

      this.on('message', messageHandler);

      const wsMessage: WebSocketMessage = {
        type: 'request',
        requestId: request.id,
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body
      };

      this.ws!.send(JSON.stringify(wsMessage));
    });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async sendCommandComplete(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending command completion signal to browser');
      this.ws.send(JSON.stringify({
        type: 'command_complete',
        requestId: `complete_${Date.now()}`,
        timestamp: new Date().toISOString()
      }));
      // Give some time for the message to be sent before closing
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionPromise = null;
  }
}