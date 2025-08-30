import { Command } from 'commander';
import { SqlClient } from '../lib/sql-client.js';
import { Repl } from '../lib/repl.js';
import { UrlParser } from '../lib/url-parser.js';
import { ResultFormatter } from '../lib/result-formatter.js';

interface PsqlOptions {
  url: string;
  command?: string;
  file?: string;
  quiet?: boolean;
}

export function createPsqlCommand(): Command {
  const psqlCommand = new Command('psql');
  
  psqlCommand
    .description('Connect to Supabase Lite database (psql-compatible interface)')
    .requiredOption('-u, --url <url>', 'Supabase Lite URL (e.g., http://localhost:5173)')
    .option('-c, --command <sql>', 'Execute a single SQL command and exit')
    .option('-f, --file <path>', 'Execute SQL commands from a file (not yet supported)')
    .option('-q, --quiet', 'Run quietly (suppress connection messages)', false)
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

    // Create SQL client
    const sqlClient = new SqlClient(options.url);

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
      // File mode (not yet implemented)
      console.error(ResultFormatter.formatGeneralError(
        'File execution mode is not yet supported'
      ));
      process.exit(1);
    } else {
      // Interactive mode
      await executeInteractiveMode(sqlClient);
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

async function executeInteractiveMode(sqlClient: SqlClient): Promise<void> {
  const repl = new Repl(sqlClient);

  // Handle graceful shutdown
  const cleanup = () => {
    repl.stop();
    sqlClient.disconnect();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    await repl.start();
  } catch (error) {
    console.error(ResultFormatter.formatGeneralError(
      error instanceof Error ? error.message : 'REPL session failed'
    ));
    process.exit(1);
  } finally {
    cleanup();
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