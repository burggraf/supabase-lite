import { ProxyServer, ProxyServerOptions } from './proxy-server.js';
import portfinder from 'portfinder';
import open from 'open';

interface ProxyInstance {
  server: ProxyServer;
  port: number;
  targetUrl: string;
  isTemporary?: boolean;
}

export class AutoProxyManager {
  private static instance: AutoProxyManager;
  private runningProxies = new Map<string, ProxyInstance>();
  private temporaryProxies = new Map<string, ProxyInstance>();
  private isCleanupRegistered = false;

  private constructor() {
    // Singleton pattern
  }

  static getInstance(): AutoProxyManager {
    if (!AutoProxyManager.instance) {
      AutoProxyManager.instance = new AutoProxyManager();
    }
    return AutoProxyManager.instance;
  }

  /**
   * Check if a URL needs to be proxied (is HTTPS and not localhost)
   */
  isProxyNeeded(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Don't proxy localhost or 127.0.0.1
      if (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1') {
        return false;
      }
      
      // Don't proxy HTTP URLs (they might be local development)
      if (parsedUrl.protocol === 'http:') {
        return false;
      }
      
      // Proxy HTTPS URLs (deployed instances)
      return parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Ensure a proxy is running for the given URL and return the proxied URL
   */
  async ensureProxy(url: string, options: { persistent?: boolean } = {}): Promise<string> {
    // If proxy is not needed, return the original URL
    if (!this.isProxyNeeded(url)) {
      return url;
    }

    console.log(`🔗 Deployed instance detected: ${url}`);
    console.log(`🚀 Starting automatic proxy...`);

    // Check if we already have a running proxy for this URL
    const existingProxy = this.runningProxies.get(url);
    if (existingProxy) {
      console.log(`✅ Using existing proxy on port ${existingProxy.port}`);
      return `http://localhost:${existingProxy.port}`;
    }

    // Start a new temporary proxy
    const proxyInstance = await this.startTemporaryProxy(url, options.persistent);
    
    if (!options.persistent) {
      // For single command mode, we'll handle shutdown explicitly from the admin commands
      // No automatic shutdown mechanism needed here
    }

    return `http://localhost:${proxyInstance.port}`;
  }

  /**
   * Find an available port starting from 3000
   */
  private async findAvailablePort(): Promise<number> {
    try {
      // Set starting port to 3000 and look upward
      portfinder.setBasePort(3000);
      return await portfinder.getPortPromise();
    } catch (error) {
      // Fallback to a random high port if portfinder fails
      return 3000 + Math.floor(Math.random() * 1000);
    }
  }

  /**
   * Start a temporary proxy for the given URL
   */
  private async startTemporaryProxy(url: string, persistent: boolean = false): Promise<ProxyInstance> {
    const port = await this.findAvailablePort();
    
    console.log(`🔌 Starting proxy server on port ${port}...`);
    
    const proxyServer = new ProxyServer({
      port,
      targetUrl: url,
      mode: 'auto', // Auto-detect mode based on target URL
      enableLogging: true // Enable logging to debug the issue
    });

    // Start the proxy server
    await proxyServer.start();
    
    console.log(`✅ Proxy server started on http://localhost:${port}`);
    
    // Try to communicate with existing browser tabs first
    console.log(`🔍 Checking for existing browser tabs...`);
    const existingTabConnected = await this.tryConnectToExistingTab(url, port);
    
    if (!existingTabConnected) {
      console.log(`🌐 No existing tab found, opening new browser tab...`);
      
      // Open browser with proxy parameter
      const browserUrl = `${url}?proxy=ws://localhost:${port}`;
      await open(browserUrl);
    }
    
    console.log(`⏳ Waiting for browser connection...`);
    
    // Wait for connection (with timeout)
    const connected = await this.waitForProxyConnection(proxyServer, 15000);
    if (!connected) {
      console.log(`⚠️  Browser connection not established within 15 seconds`);
      console.log(`   The proxy will continue running, but connection may be slower`);
    } else {
      console.log(`🔗 Browser connected successfully!`);
    }

    const proxyInstance: ProxyInstance = {
      server: proxyServer,
      port,
      targetUrl: url,
      isTemporary: !persistent
    };

    // Track the proxy
    this.runningProxies.set(url, proxyInstance);
    if (!persistent) {
      this.temporaryProxies.set(url, proxyInstance);
    }

    return proxyInstance;
  }

  /**
   * Wait for proxy connection to be established
   */
  private async waitForProxyConnection(proxyServer: ProxyServer, timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkConnection = () => {
        // Check if we've exceeded timeout
        if (Date.now() - startTime > timeoutMs) {
          resolve(false);
          return;
        }

        // Check if any browsers are connected to the proxy's WebSocket server
        if (proxyServer.hasBrowserClients && proxyServer.hasBrowserClients()) {
          console.log('🎉 Browser WebSocket client connected!');
          resolve(true);
          return;
        }

        // Keep checking every 500ms
        setTimeout(checkConnection, 500);
      };

      // Start checking after 2 seconds to allow browser to load
      setTimeout(checkConnection, 2000);
    });
  }

  /**
   * Try to connect to existing browser tab via BroadcastChannel
   * Note: This only works if Node.js has BroadcastChannel support, otherwise falls back to opening new tab
   */
  private async tryConnectToExistingTab(url: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Check if BroadcastChannel is available (Node.js 16+ or browser environment)
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
            if (event.data.type === 'TAB_AVAILABLE' && event.data.url === url) {
              responded = true;
              clearTimeout(timeout);
              
              console.log(`🔄 Found existing tab for ${url}, requesting proxy connection...`);
              
              // Send proxy connection request to the existing tab
              channel.postMessage({
                type: 'CONNECT_TO_PROXY',
                data: {
                  url,
                  proxyUrl: `ws://localhost:${port}`,
                  port
                }
              });
              
              // Give the tab a moment to connect, then resolve
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
          console.log(`📡 Broadcasting discovery message for ${url}...`);
          channel.postMessage({
            type: 'DISCOVER_TABS',
            data: { url }
          });
        } else {
          // BroadcastChannel doesn't have addEventListener, fall back
          channel.close();
          resolve(false);
        }
        
      } catch (error) {
        console.log(`⚠️  BroadcastChannel not available in Node.js environment, will open new tab`);
        resolve(false);
      }
    });
  }

  /**
   * Register cleanup handlers for temporary proxy
   */
  private registerTemporaryProxyCleanup(proxyInstance: ProxyInstance): void {
    const cleanup = async () => {
      console.log(`🧹 Cleaning up temporary proxy for ${proxyInstance.targetUrl}...`);
      try {
        await proxyInstance.server.stop();
        this.runningProxies.delete(proxyInstance.targetUrl);
        this.temporaryProxies.delete(proxyInstance.targetUrl);
        console.log(`✅ Temporary proxy cleaned up`);
      } catch (error) {
        console.error(`❌ Error cleaning up proxy:`, error);
      }
    };

    // Register cleanup on process exit
    process.once('beforeExit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);

    // This is now handled in ensureProxy method
  }

  /**
   * Schedule auto-shutdown after the first successful command
   */
  private scheduleAutoShutdown(proxyInstance: ProxyInstance): void {
    let requestCount = 0;
    let shutdownTimer: NodeJS.Timeout | null = null;

    // Set up a timer that shuts down the proxy after successful requests
    const scheduleShutdown = () => {
      if (shutdownTimer) {
        clearTimeout(shutdownTimer);
      }
      
      shutdownTimer = setTimeout(async () => {
        console.log('🔄 Auto-shutting down proxy after command completion...');
        try {
          await proxyInstance.server.stop();
          this.runningProxies.delete(proxyInstance.targetUrl);
          this.temporaryProxies.delete(proxyInstance.targetUrl);
          console.log('✅ Proxy auto-shutdown completed');
          
          // Use setImmediate to ensure console.log completes, then force kill
          setImmediate(() => {
            process.kill(process.pid, 'SIGTERM');
          });
        } catch (error) {
          console.error('❌ Error during auto-shutdown:', error);
          setImmediate(() => {
            process.kill(process.pid, 'SIGTERM');
          });
        }
      }, 1000); // Reduced wait time to 1 second
    };

    // Register callback for command completion
    proxyInstance.server.onCommandComplete(() => {
      requestCount++;
      console.log(`📊 Command completed (${requestCount} total), scheduling auto-shutdown...`);
      scheduleShutdown();
    });
  }

  /**
   * Stop a specific proxy
   */
  async stopProxy(url: string): Promise<void> {
    const proxyInstance = this.runningProxies.get(url);
    if (proxyInstance) {
      console.log(`🛑 Stopping proxy for ${url}...`);
      
      // Send completion signal before stopping
      try {
        console.log('📤 Sending completion signal before proxy shutdown...');
        await proxyInstance.server.sendCompletionSignal();
      } catch (error) {
        console.error('Error sending completion signal:', error);
      }
      
      // Small delay to ensure signal is processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await proxyInstance.server.stop();
      this.runningProxies.delete(url);
      console.log(`✅ Proxy stopped`);
    }
  }

  /**
   * Stop all running proxies
   */
  async cleanup(): Promise<void> {
    if (this.runningProxies.size === 0) {
      return;
    }

    console.log(`🧹 Cleaning up ${this.runningProxies.size} running proxy(ies)...`);
    
    const stopPromises = Array.from(this.runningProxies.values()).map(proxy => 
      proxy.server.stop().catch(console.error)
    );
    
    await Promise.all(stopPromises);
    this.runningProxies.clear();
    console.log('✅ All proxies cleaned up');
  }

  /**
   * Get info about running proxies
   */
  getRunningProxies(): Array<{ url: string; port: number }> {
    return Array.from(this.runningProxies.entries()).map(([url, instance]) => ({
      url,
      port: instance.port
    }));
  }

  /**
   * Send completion signal to browser and exit gracefully
   */
  async sendCompletionSignalAndExit(url: string): Promise<void> {
    const proxyInstance = this.runningProxies.get(url);
    if (!proxyInstance) {
      return;
    }

    console.log('📤 Sending completion signal to browser...');
    
    try {
      // Send completion signal to all browser connections
      proxyInstance.server.sendStatusToAllBrowsers('completed', '✅ Command completed - Connection will close');
      
      // Give the browser time to process the completion signal
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Stop the proxy server
      await proxyInstance.server.stop();
      this.runningProxies.delete(url);
      this.temporaryProxies.delete(url);
      
      console.log('✅ Proxy gracefully shut down');
      
      // Exit the process
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Register cleanup handlers for process exit
   */
  private registerCleanupHandlers(): void {
    const cleanup = () => {
      // Run cleanup synchronously on exit
      this.cleanup().catch(console.error);
    };

    // Handle different exit scenarios
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, cleaning up...');
      this.cleanup().then(() => process.exit(0)).catch(() => process.exit(1));
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, cleaning up...');
      this.cleanup().then(() => process.exit(0)).catch(() => process.exit(1));
    });

    process.on('exit', cleanup);
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      cleanup();
    });

    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled rejection:', reason);
      cleanup();
    });
  }
}