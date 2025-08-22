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
  .option('-w, --websocket <url>', 'WebSocket URL to connect to', 'ws://localhost:5176')
  .option('-q, --quiet', 'Disable request logging', false)
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('❌ Invalid port number. Please provide a port between 1 and 65535.');
      process.exit(1);
    }

    const proxyServer = new ProxyServer({
      port,
      websocketUrl: options.websocket,
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
      console.log(`   Make sure Supabase Lite is running in your browser on the WebSocket port`);
      console.log('   Press Ctrl+C to stop the server');
    } catch (error: any) {
      console.error('❌ Failed to start proxy server:', error.message);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test connection to WebSocket bridge')
  .option('-w, --websocket <url>', 'WebSocket URL to test', 'ws://localhost:5176')
  .action(async (options) => {
    console.log(`🔍 Testing connection to ${options.websocket}...`);
    
    const { WebSocketClient } = await import('./websocket-client.js');
    const client = new WebSocketClient(options.websocket);

    try {
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
      
    } catch (error: any) {
      console.error('❌ Connection test failed:', error.message);
      console.log('💡 Make sure:');
      console.log('   1. Supabase Lite is running in your browser (http://localhost:5173)');
      console.log('   2. The WebSocket bridge is active on the specified port');
      console.log('   3. No firewall is blocking the connection');
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