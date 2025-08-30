import { Command } from 'commander';
import { ProxyServer } from '../lib/proxy/proxy-server.js';
import { AutoProxyManager } from '../lib/proxy/auto-proxy-manager.js';
import { UrlParser } from '../lib/url-parser.js';
import { ResultFormatter } from '../lib/result-formatter.js';

interface ProxyStartOptions {
  target: string;
  port?: number;
  mode?: 'websocket' | 'auto';
  quiet?: boolean;
}

interface ProxyStopOptions {
  target?: string;
}

interface ProxyListOptions {
  // No options needed for list
}

export function createProxyCommand(): Command {
  const proxyCommand = new Command('proxy');
  
  proxyCommand
    .description('Manage proxy servers for Supabase Lite instances');

  // Start proxy command
  proxyCommand
    .command('start')
    .description('Start a proxy server for a Supabase Lite instance')
    .requiredOption('-t, --target <url>', 'Target Supabase Lite URL (e.g., https://supabase-lite.pages.dev)')
    .option('-p, --port <port>', 'Port to run the proxy server on (auto-selected if not specified)')
    .option('-m, --mode <mode>', 'Connection mode: websocket or auto', 'auto')
    .option('-q, --quiet', 'Run quietly (suppress logging)', false)
    .action(async (options: ProxyStartOptions) => {
      await executeProxyStart(options);
    });

  // Stop proxy command
  proxyCommand
    .command('stop')
    .description('Stop a running proxy server')
    .option('-t, --target <url>', 'Target URL of the proxy to stop (stops all if not specified)')
    .action(async (options: ProxyStopOptions) => {
      await executeProxyStop(options);
    });

  // List proxies command
  proxyCommand
    .command('list')
    .description('List all running proxy servers')
    .action(async (options: ProxyListOptions) => {
      await executeProxyList(options);
    });

  return proxyCommand;
}

async function executeProxyStart(options: ProxyStartOptions): Promise<void> {
  try {
    // Validate URL
    const validation = UrlParser.validate(options.target);
    if (!validation.valid) {
      console.error(ResultFormatter.formatGeneralError(`Invalid URL: ${validation.error}`));
      process.exit(1);
    }

    // Check if this is a deployed instance and provide helpful info
    const url = new URL(options.target);
    const isDeployedInstance = !['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'https:';
    
    if (isDeployedInstance) {
      console.log(`\n🔗 Starting proxy for deployed instance: ${options.target}`);
      console.log(`\n💡 This will open a bridge page in your browser to connect to your existing Supabase Lite tab.`);
      console.log(`\nOnce running, you can use the proxy URL in your CLI commands.\n`);
    }

    // Continue with proxy setup for all instances (local and deployed)
    // Validate mode
    if (options.mode && !['websocket', 'auto'].includes(options.mode)) {
      console.error(ResultFormatter.formatGeneralError('Invalid mode. Must be: websocket or auto'));
      process.exit(1);
    }

    // Validate port if provided
    let port: number | undefined;
    if (options.port) {
      port = parseInt(options.port.toString(), 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(ResultFormatter.formatGeneralError('Invalid port number. Please provide a port between 1 and 65535.'));
        process.exit(1);
      }
    }

    if (!options.quiet) {
      console.log(`🚀 Starting proxy for ${options.target}...`);
    }

    // If no port specified, find an available one
    if (!port) {
      const portfinder = await import('portfinder');
      portfinder.setBasePort(3000);
      port = await portfinder.getPortPromise();
    }

    // Create and start proxy server
    const proxyServer = new ProxyServer({
      port,
      targetUrl: options.target,
      mode: options.mode,
      enableLogging: !options.quiet
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      if (!options.quiet) {
        console.log('\n🛑 Received shutdown signal...');
      }
      await proxyServer.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await proxyServer.start();
    
    // For deployed instances, open browser tab to establish connection
    const targetUrl = new URL(options.target);
    const isDeployedTarget = !['localhost', '127.0.0.1'].includes(targetUrl.hostname) && targetUrl.protocol === 'https:';
    
    if (isDeployedTarget) {
      if (!options.quiet) {
        console.log(`🔍 Checking for existing browser tabs...`);
      }
      
      if (!options.quiet) {
        console.log(`🌐 Opening browser tab to establish connection...`);
      }
      
      // Open browser with proxy parameter
      const open = await import('open');
      const browserUrl = `${options.target}?proxy=ws://localhost:${port}`;
      await open.default(browserUrl);
      
      if (!options.quiet) {
        console.log(`⏳ Waiting for browser connection...`);
      }
      
      // Wait for browser connection (with timeout)
      const connected = await waitForProxyConnection(proxyServer, 15000);
      if (!connected) {
        console.log(`⚠️  Browser connection not established within 15 seconds`);
        console.log(`   The proxy will continue running, but API requests may fail`);
      } else {
        console.log(`🔗 Browser connected successfully!`);
      }
    }
    
    if (!options.quiet) {
      console.log(`✅ Proxy server started successfully on port ${port}`);
      console.log(`📋 Usage:`);
      console.log(`   Set your Supabase URL to: http://localhost:${port}`);
      console.log(`   Target: ${options.target}`);
      console.log(`   Mode: ${options.mode}`);
      console.log(`   Proxy server is now running in the background`);
      console.log(`   Use 'supabase-lite proxy stop' to stop the server`);
    }

  } catch (error: any) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'Failed to start proxy server'
    ));
    process.exit(1);
  }
}

async function executeProxyStop(options: ProxyStopOptions): Promise<void> {
  try {
    const autoProxyManager = AutoProxyManager.getInstance();
    
    if (options.target) {
      // Stop specific proxy
      const validation = UrlParser.validate(options.target);
      if (!validation.valid) {
        console.error(ResultFormatter.formatGeneralError(`Invalid URL: ${validation.error}`));
        process.exit(1);
      }
      
      await autoProxyManager.stopProxy(options.target);
      console.log(`✅ Proxy for ${options.target} stopped`);
    } else {
      // Stop all proxies
      await autoProxyManager.cleanup();
      console.log('✅ All proxy servers stopped');
    }

  } catch (error: any) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'Failed to stop proxy server'
    ));
    process.exit(1);
  }
}

async function executeProxyList(options: ProxyListOptions): Promise<void> {
  try {
    const autoProxyManager = AutoProxyManager.getInstance();
    const runningProxies = autoProxyManager.getRunningProxies();

    if (runningProxies.length === 0) {
      console.log('📋 No proxy servers currently running');
      return;
    }

    console.log('📋 Running proxy servers:');
    console.log('');
    
    runningProxies.forEach(proxy => {
      console.log(`  • ${proxy.url}`);
      console.log(`    ↳ http://localhost:${proxy.port}`);
      console.log('');
    });

  } catch (error: any) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'Failed to list proxy servers'
    ));
    process.exit(1);
  }
}

/**
 * Wait for proxy connection to be established
 */
async function waitForProxyConnection(proxyServer: ProxyServer, timeoutMs: number): Promise<boolean> {
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

export { executeProxyStart, executeProxyStop, executeProxyList };