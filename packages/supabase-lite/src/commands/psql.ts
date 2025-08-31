import { Command } from 'commander';
import { SqlClient } from '../lib/sql-client.js';
import { Repl } from '../lib/repl.js';
import { UrlParser } from '../lib/url-parser.js';
import { ResultFormatter } from '../lib/result-formatter.js';
import { FileExecutor } from '../lib/file-executor.js';
import { AutoProxyManager } from '../lib/proxy/auto-proxy-manager.js';

interface PsqlOptions {
  url: string;
  command?: string;
  file?: string;
  quiet?: boolean;
  continueOnError?: boolean;
  showProgress?: boolean;
}

export function createPsqlCommand(): Command {
  const psqlCommand = new Command('psql');
  
  psqlCommand
    .description('Connect to Supabase Lite database (psql-compatible interface)')
    .requiredOption('-u, --url <url>', 'Supabase Lite URL (e.g., http://localhost:5173)')
    .option('-c, --command <sql>', 'Execute a single SQL command and exit')
    .option('-f, --file <path>', 'Execute SQL commands from a file')
    .option('-q, --quiet', 'Run quietly (suppress connection messages)', false)
    .option('--continue-on-error', 'Continue executing statements even if one fails', false)
    .option('--show-progress', 'Show progress when executing multiple statements', false)
    .action(async (options: PsqlOptions) => {
      await executePsqlCommand(options);
    });

  return psqlCommand;
}

async function executePsqlCommand(options: PsqlOptions): Promise<void> {
  try {
    // Validate URL
    const validation = UrlParser.validate(options.url);
    if (!validation.valid) {
      console.error(ResultFormatter.formatGeneralError(`Invalid URL: ${validation.error}`));
      process.exit(1);
    }

    // Set up proxy if needed for HTTPS URLs
    const autoProxyManager = AutoProxyManager.getInstance();
    const effectiveUrl = await autoProxyManager.ensureProxy(options.url);

    // Create SQL client
    const sqlClient = new SqlClient(effectiveUrl);

    if (!options.quiet) {
      console.log('🔗 Connecting to Supabase Lite...');
    }

    try {
      // Test connection
      await sqlClient.connect();
      
      if (!options.quiet) {
        const config = sqlClient.getConnectionInfo();
        console.log(ResultFormatter.formatConnection(config.url, config.projectId));
      }

    } catch (error) {
      console.error(ResultFormatter.formatGeneralError(
        error instanceof Error ? error.message : 'Connection failed'
      ));
      console.error('\n💡 Make sure:');
      console.error('   • Supabase Lite is running at the specified URL');
      console.error('   • The URL is correct and accessible');
      console.error('   • No firewall is blocking the connection');
      process.exit(1);
    }

    // Handle different modes
    if (options.command) {
      // Single command mode
      await executeSingleCommand(sqlClient, options.command, options.quiet || false);
    } else if (options.file) {
      // File mode
      await executeFileCommand(sqlClient, options.file, options);
    } else {
      // Interactive mode
      await executeInteractiveMode(sqlClient, options.url, effectiveUrl);
    }

  } catch (error) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'An unexpected error occurred'
    ));
    process.exit(1);
  }
}

async function executeSingleCommand(
  sqlClient: SqlClient, 
  command: string, 
  quiet: boolean
): Promise<void> {
  try {
    // Handle meta commands
    if (command.startsWith('\\')) {
      console.error(ResultFormatter.formatGeneralError(
        'Meta commands are only supported in interactive mode'
      ));
      process.exit(1);
    }

    // Execute SQL command
    const result = await sqlClient.executeQuery(command);
    
    // Display results
    if (!quiet) {
      console.log(ResultFormatter.formatResult(result));
    } else {
      // In quiet mode, just output the data
      result.data.forEach(row => {
        console.log(JSON.stringify(row));
      });
    }

  } catch (error) {
    if (isQueryError(error)) {
      console.error(ResultFormatter.formatError(error));
    } else {
      console.error(ResultFormatter.formatGeneralError(
        error instanceof Error ? error.message : 'Query execution failed'
      ));
    }
    process.exit(1);
  } finally {
    sqlClient.disconnect();
  }
}

async function executeFileCommand(
  sqlClient: SqlClient,
  filePath: string,
  options: PsqlOptions
): Promise<void> {
  try {
    if (!options.quiet) {
      console.log(`📁 Executing SQL file: ${filePath}`);
    }

    const fileExecutor = new FileExecutor(sqlClient);
    const result = await fileExecutor.executeFile(filePath, {
      continueOnError: options.continueOnError || false,
      showProgress: options.showProgress || false,
      quiet: options.quiet || false
    });

    // Display results
    const output = ResultFormatter.formatFileExecutionResult(result, options.quiet || false);
    console.log(output);

    // Exit with error code if execution failed
    if (!result.success) {
      process.exit(1);
    }

  } catch (error) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'File execution failed'
    ));
    process.exit(1);
  } finally {
    sqlClient.disconnect();
  }
}

async function executeInteractiveMode(sqlClient: SqlClient, originalUrl: string, effectiveUrl: string): Promise<void> {
  const autoProxyManager = AutoProxyManager.getInstance();
  const isProxied = originalUrl !== effectiveUrl;

  // Enhanced cleanup that includes proxy shutdown
  const cleanupWithProxy = async () => {
    sqlClient.disconnect();
    
    if (isProxied) {
      // For deployed instances with proxy, use graceful shutdown
      await autoProxyManager.sendCompletionSignalAndExit(originalUrl);
    } else {
      // For local instances, just exit normally
      process.exit(0);
    }
  };

  // Create REPL with exit callback for Ctrl+C handling
  const repl = new Repl(sqlClient, cleanupWithProxy);

  // Handle graceful shutdown with proxy cleanup
  const cleanup = () => {
    repl.stop();
    sqlClient.disconnect();
  };

  // Set up signal handlers for graceful shutdown
  const handleSignal = async () => {
    await cleanupWithProxy();
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);
  process.on('exit', cleanup);

  try {
    await repl.start();
    // REPL has exited normally (e.g., user typed \q)
    await cleanupWithProxy();
  } catch (error) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'REPL session failed'
    ));
    cleanup();
    
    if (isProxied) {
      try {
        await autoProxyManager.sendCompletionSignalAndExit(originalUrl);
      } catch {
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

// Type guard for query errors
function isQueryError(error: any): error is { error: string; message: string; details?: string; hint?: string } {
  return typeof error === 'object' && 
         error !== null && 
         'error' in error && 
         'message' in error;
}

export { executePsqlCommand };