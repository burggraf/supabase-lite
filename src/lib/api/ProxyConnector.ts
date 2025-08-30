/**
 * ProxyConnector - Browser-side component that connects to CLI proxy via WebSocket
 * Detects proxy query parameter and establishes bidirectional communication
 */

interface ProxyConfig {
  wsUrl: string;
  port: number;
}

interface StatusUpdate {
  status: string;
  message: string;
  timestamp: string;
}

export class ProxyConnector {
  private ws: WebSocket | null = null;
  private proxyConfig: ProxyConfig | null = null;
  private statusElement: HTMLElement | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private discoveryChannel: BroadcastChannel | null = null;
  private commandCompleted = false; // Track if command completed gracefully

  constructor() {
    this.init();
    this.setupDiscoveryChannel();
  }

  /**
   * Set up discovery channel to listen for existing tab detection
   */
  private setupDiscoveryChannel(): void {
    try {
      this.discoveryChannel = new BroadcastChannel('supabase-proxy-connect');
      
      this.discoveryChannel.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        if (type === 'DISCOVER_TABS') {
          // CLI is looking for existing tabs for this URL
          const currentUrl = window.location.origin;
          if (data.url === currentUrl) {
            console.log(`📡 Responding to discovery request for ${currentUrl}`);
            
            // Respond that we're available
            this.discoveryChannel?.postMessage({
              type: 'TAB_AVAILABLE',
              url: currentUrl
            });
          }
        } else if (type === 'CONNECT_TO_PROXY') {
          // CLI wants us to connect to a new proxy
          const currentUrl = window.location.origin;
          if (data.url === currentUrl) {
            console.log(`🔄 Received proxy connection request: ${data.proxyUrl}`);
            this.connectToNewProxy(data.proxyUrl, data.port);
          }
        }
      });
      
    } catch (error) {
      console.warn('BroadcastChannel not available for tab discovery:', error);
    }
  }

  /**
   * Connect to a new proxy (when requested by CLI via BroadcastChannel)
   */
  private connectToNewProxy(proxyUrl: string, port: number): void {
    console.log(`🔄 Switching to new proxy: ${proxyUrl}`);
    
    // Disconnect from current proxy if connected
    if (this.ws) {
      this.disconnect();
    }
    
    // Set new proxy config
    this.proxyConfig = {
      wsUrl: `${proxyUrl}/ws`,
      port
    };
    
    // Create status element if not exists
    if (!this.statusElement) {
      this.createStatusElement();
    }
    
    // Connect to new proxy
    this.connectToProxy();
  }

  /**
   * Initialize the proxy connector by checking for proxy parameter
   */
  private init(): void {
    // Check for proxy parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const proxyParam = urlParams.get('proxy');

    if (proxyParam) {
      console.log('🔗 Proxy parameter detected:', proxyParam);
      this.parseProxyConfig(proxyParam);
      this.createStatusElement();
      this.connectToProxy();
    }
  }

  /**
   * Parse proxy configuration from URL parameter
   */
  private parseProxyConfig(proxyParam: string): void {
    try {
      // Expected format: ws://localhost:3000
      const url = new URL(proxyParam);
      if (url.protocol !== 'ws:') {
        throw new Error('Invalid proxy protocol. Expected ws://');
      }

      this.proxyConfig = {
        wsUrl: `${proxyParam}/ws`,
        port: parseInt(url.port) || 3000
      };

      console.log('📋 Proxy config parsed:', this.proxyConfig);
    } catch (error) {
      console.error('❌ Failed to parse proxy config:', error);
      this.showError('Invalid proxy configuration');
    }
  }

  /**
   * Create status element to show connection status
   */
  private createStatusElement(): void {
    // Check if status element already exists to prevent duplicates
    const existingStatus = document.getElementById('proxy-status');
    if (existingStatus) {
      this.statusElement = existingStatus as HTMLElement;
      return;
    }

    // Create status banner
    this.statusElement = document.createElement('div');
    this.statusElement.id = 'proxy-status';
    this.statusElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      padding: 12px 48px 12px 48px;
      text-align: center;
      font-weight: bold;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create close button (LEFT side)
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      left: 12px;
      background: none;
      border: none;
      font-size: 20px;
      font-weight: bold;
      color: inherit;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      transition: opacity 0.2s ease;
    `;

    closeButton.onmouseover = () => closeButton.style.opacity = '1';
    closeButton.onmouseout = () => closeButton.style.opacity = '0.7';
    closeButton.onclick = () => this.dismissStatusBar();

    // Create content div
    const contentDiv = document.createElement('div');
    contentDiv.id = 'proxy-status-content';
    contentDiv.style.cssText = 'flex: 1; text-align: center;';

    this.statusElement.appendChild(closeButton);
    this.statusElement.appendChild(contentDiv);

    // Insert at top of body
    document.body.insertBefore(this.statusElement, document.body.firstChild);

    // Add some top margin to the main content to avoid overlap
    const appElement = document.getElementById('root') || document.body.children[1];
    if (appElement instanceof HTMLElement) {
      appElement.style.marginTop = '60px';
    }
  }

  /**
   * Update status display
   */
  private updateStatus(status: string, message: string): void {
    if (!this.statusElement) return;

    const statusStyles: Record<string, string> = {
      connecting: 'background: #f59e0b; color: white;',
      connected: 'background: #10b981; color: white;',
      executing: 'background: #3b82f6; color: white;',
      completed: 'background: #6366f1; color: white;',
      disconnected: 'background: #6b7280; color: white;',
      error: 'background: #ef4444; color: white;'
    };

    const baseStyle = this.statusElement.style.cssText.split('background')[0];
    this.statusElement.style.cssText = baseStyle + (statusStyles[status] || statusStyles.connected);
    
    const disconnectedSuffix = status === 'disconnected' || status === 'error' 
      ? '<br><small>This tab can remain open or be closed</small>' 
      : '';

    // Update only the content div, preserving the close button
    const contentDiv = document.getElementById('proxy-status-content');
    if (contentDiv) {
      contentDiv.innerHTML = `
        <div>${message}</div>
        ${disconnectedSuffix}
      `;
    }
  }

  /**
   * Connect to the proxy WebSocket server
   */
  private async connectToProxy(): Promise<void> {
    if (!this.proxyConfig) {
      this.showError('No proxy configuration available');
      return;
    }

    this.updateStatus('connecting', '🟡 Connecting to CLI proxy...');

    try {
      this.ws = new WebSocket(this.proxyConfig.wsUrl);

      this.ws.onopen = () => {
        console.log('✅ Connected to proxy WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateStatus('connected', '🟢 Proxy Connected - Ready for CLI commands');
      };

      this.ws.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.ws.onclose = () => {
        console.log('🔌 Proxy WebSocket connection closed');
        this.isConnected = false;
        this.updateStatus('disconnected', '🔴 Proxy Disconnected');
        
        // Attempt to reconnect if not too many attempts
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ Proxy WebSocket error:', error);
        this.isConnected = false;
        this.showError('Connection to CLI proxy failed');
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      this.showError('Failed to connect to proxy');
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'STATUS_UPDATE') {
        const statusData: StatusUpdate = message.data;
        console.log('📊 Status update:', statusData);
        this.updateStatus(statusData.status, statusData.message);
        
        // Check if this is a completion status update
        if (statusData.status === 'completed') {
          console.log('✅ Detected completion via status update');
          this.commandCompleted = true;
          // Close connection gracefully after a short delay
          setTimeout(() => {
            this.disconnect();
            this.updateStatus('disconnected', '✅ Command completed - Connection closed');
          }, 1000);
        }
      } else if (message.type === 'API_RESPONSE') {
        // This would be handled by the API integration
        console.log('📡 API Response received:', message.data);
      } else if (message.type === 'API_REQUEST') {
        // Handle incoming API request from proxy server
        this.handleIncomingAPIRequest(message.data);
      } else if (message.type === 'COMMAND_COMPLETE') {
        // Command completed gracefully
        console.log('✅ CLI command completed successfully');
        this.commandCompleted = true;
        this.updateStatus('completed', '✅ Command completed successfully');
        // Close connection gracefully after a short delay
        setTimeout(() => {
          this.disconnect();
          this.updateStatus('disconnected', '✅ Command completed - Connection closed');
        }, 1000);
      }

    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle incoming API request from proxy server
   */
  private async handleIncomingAPIRequest(requestData: any): Promise<void> {
    const { method, path, headers, body, requestId } = requestData;
    
    console.log(`📡 Handling API request from proxy: ${method} ${path} (ID: ${requestId})`);
    
    try {
      // Update status to show we're processing
      this.updateStatus('executing', `🟡 Executing: ${method} ${path}...`);
      
      // Get the CrossOriginAPIHandler instance from the global scope
      // We need to access it through the window object or similar
      const apiHandler = (window as any).crossOriginAPIHandler;
      if (!apiHandler) {
        throw new Error('CrossOriginAPIHandler not available');
      }
      
      // Create API request object
      const request = {
        method: method as 'GET' | 'POST' | 'PATCH' | 'DELETE',
        path,
        headers: headers || {},
        body
      };
      
      // Execute the request locally (bypass proxy routing)
      const response = await apiHandler.executeRequest(request);
      
      console.log(`✅ API request completed: ${method} ${path} (status: ${response.status})`);
      
      // Send response back to proxy server
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type: 'API_RESPONSE',
          data: {
            requestId,
            status: response.status,
            headers: response.headers,
            data: response.data
          }
        }));
      }
      
      // Update status
      this.updateStatus('completed', `✅ Request completed: ${method} ${path}`);
      
    } catch (error: any) {
      console.error(`❌ Error handling API request: ${method} ${path}:`, error);
      
      // Send error response back to proxy server
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type: 'API_RESPONSE',
          data: {
            requestId,
            error: error.message,
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        }));
      }
      
      // Update status
      this.updateStatus('error', `❌ Error: ${error.message}`);
    }
  }

  /**
   * Send API request to proxy
   */
  public async sendAPIRequest(method: string, path: string, headers?: Record<string, string>, body?: any): Promise<any> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Proxy not connected');
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not available'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout: ${method} ${path}`));
      }, 30000);

      // Set up response handler
      const responseHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'API_RESPONSE' && message.data.requestId === requestId) {
            clearTimeout(timeout);
            this.ws!.removeEventListener('message', responseHandler);
            
            if (message.data.error) {
              reject(new Error(message.data.error));
            } else {
              resolve({
                status: message.data.status,
                headers: message.data.headers,
                data: message.data.data
              });
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          this.ws!.removeEventListener('message', responseHandler);
          reject(error);
        }
      };

      this.ws.addEventListener('message', responseHandler);

      // Send request
      this.ws.send(JSON.stringify({
        type: 'API_REQUEST',
        data: {
          method,
          path,
          headers: headers || {},
          body,
          requestId
        }
      }));
    });
  }

  /**
   * Attempt to reconnect to proxy
   */
  private attemptReconnect(): void {
    // Don't reconnect if command completed gracefully
    if (this.commandCompleted) {
      console.log('🚫 Not attempting reconnect - command completed gracefully');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.updateStatus('error', '❌ Connection lost - max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.updateStatus('connecting', `🟡 Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connectToProxy();
    }, this.reconnectDelay);
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    console.error('❌ ProxyConnector error:', message);
    this.updateStatus('error', `❌ Error: ${message}`);
  }

  /**
   * Check if proxy is active
   */
  public isProxyActive(): boolean {
    return this.proxyConfig !== null && this.isConnected;
  }

  /**
   * Get proxy configuration
   */
  public getProxyConfig(): ProxyConfig | null {
    return this.proxyConfig;
  }

  /**
   * Disconnect from proxy
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Dismiss the status bar
   */
  private dismissStatusBar(): void {
    if (this.statusElement) {
      // Animate out
      this.statusElement.style.transform = 'translateY(-100%)';
      
      setTimeout(() => {
        if (this.statusElement) {
          this.statusElement.remove();
          this.statusElement = null;
          
          // Remove margin from app element
          const appElement = document.getElementById('root') || document.body.children[1];
          if (appElement instanceof HTMLElement) {
            appElement.style.marginTop = '';
          }
        }
      }, 300); // Match transition duration
    }
  }

  /**
   * Handle command completion (public method for CrossOriginAPIHandler)
   */
  public handleCommandComplete(): void {
    console.log('✅ CLI command completed successfully');
    this.commandCompleted = true;
    this.updateStatus('completed', '✅ Command completed successfully');
    // Close connection gracefully after a short delay
    setTimeout(() => {
      this.disconnect();
      this.updateStatus('disconnected', '✅ Command completed - Connection closed');
    }, 1000);
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.disconnect();
    
    if (this.discoveryChannel) {
      this.discoveryChannel.close();
      this.discoveryChannel = null;
    }
    
    if (this.statusElement) {
      this.statusElement.remove();
      
      // Remove margin from app element
      const appElement = document.getElementById('root') || document.body.children[1];
      if (appElement instanceof HTMLElement) {
        appElement.style.marginTop = '';
      }
    }
  }
}