#!/usr/bin/env node

import { Command } from 'commander';
import { ProxyServer } from './proxy-server.js';

const program = new Command();

program
  .name('supabase-lite-proxy')
  .description('HTTP proxy server for Supabase Lite browser instances')
  .version('1.0.0');

program
  .command('start')
  .description('Start the proxy server')
  .option('-p, --port <port>', 'Port to run the proxy server on', '54321')
  .option('-t, --target <url>', 'Target Supabase Lite URL', 'https://supabase-lite.pages.dev')
  .option('-m, --mode <mode>', 'Connection mode: websocket, postmessage, or auto', 'auto')
  .option('-q, --quiet', 'Disable request logging', false)
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('❌ Invalid port number. Please provide a port between 1 and 65535.');
      process.exit(1);
    }

    if (!['websocket', 'postmessage', 'auto'].includes(options.mode)) {
      console.error('❌ Invalid mode. Must be: websocket, postmessage, or auto');
      process.exit(1);
    }

    const proxyServer = new ProxyServer({
      port,
      targetUrl: options.target,
      mode: options.mode as 'websocket' | 'postmessage' | 'auto',
      enableLogging: !options.quiet
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Received shutdown signal...');
      await proxyServer.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
      await proxyServer.start();
      console.log('✅ Proxy server started successfully');
      console.log('📋 Usage:');
      console.log(`   Set your Supabase URL to: http://localhost:${port}`);
      console.log(`   Target: ${options.target}`);
      console.log(`   Mode: ${options.mode} (auto-detected or manual)`);
      console.log('   Press Ctrl+C to stop the server');
    } catch (error: any) {
      console.error('❌ Failed to start proxy server:', error.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test connection to Supabase Lite')
  .option('-t, --target <url>', 'Target Supabase Lite URL to test', 'https://supabase-lite.pages.dev')
  .option('-m, --mode <mode>', 'Test mode: websocket, postmessage, or auto', 'auto')
  .action(async (options) => {
    console.log(`🔍 Testing connection to ${options.target} (mode: ${options.mode})...`);
    
    // Determine test mode
    let testMode = options.mode;
    if (testMode === 'auto') {
      testMode = options.target.includes('localhost') ? 'websocket' : 'postmessage';
    }
    
    console.log(`📡 Using ${testMode} mode for testing`);

    try {
      if (testMode === 'websocket') {
        // Test WebSocket connection
        const { WebSocketClient } = await import('./websocket-client.js');
        const wsUrl = options.target.replace('http', 'ws').replace(':5173', ':5176');
        const client = new WebSocketClient(wsUrl);
        
        await client.connect();
        console.log('✅ Successfully connected to WebSocket bridge');
        
        // Test a simple health check request
        const response = await client.sendRequest({
          id: 'test_health_check',
          method: 'GET',
          url: '/health',
          headers: {}
        });
        
        console.log('✅ Health check successful:', response);
        client.disconnect();
        
      } else {
        // Test PostMessage connection
        const { PostMessageClient } = await import('./postmessage-client.js');
        const client = new PostMessageClient(options.target);
        
        await client.connect();
        console.log('✅ Successfully connected to PostMessage bridge');
        
        // Test a simple health check request
        const response = await client.sendRequest({
          id: 'test_health_check',
          method: 'GET',
          url: '/health',
          headers: {}
        });
        
        console.log('✅ Health check successful:', response);
        client.disconnect();
      }
      
    } catch (error: any) {
      console.error('❌ Connection test failed:', error.message);
      console.log('💡 Make sure:');
      if (testMode === 'websocket') {
        console.log('   1. Supabase Lite is running in your browser (http://localhost:5173)');
        console.log('   2. The WebSocket bridge is active on the specified port');
        console.log('   3. No firewall is blocking the connection');
      } else {
        console.log('   1. The target URL is accessible in your browser');
        console.log('   2. Supabase Lite is deployed and working at the target URL');
        console.log('   3. Your browser allows the proxy to open the bridge page');
      }
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error('❌ Invalid command. Use --help to see available commands.');
  process.exit(1);
});

// Parse command line arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}