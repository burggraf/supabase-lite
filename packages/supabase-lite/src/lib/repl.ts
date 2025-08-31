import * as readline from 'readline';
import { SqlClient } from './sql-client.js';
import { ResultFormatter } from './result-formatter.js';
import { MetaCommandResult, QueryError } from '../types/index.js';

export class Repl {
  private rl: readline.Interface;
  private sqlClient: SqlClient;
  private multilineBuffer: string = '';
  private prompt: string = 'supabase-lite=# ';
  private continuationPrompt: string = 'supabase-lite-# ';
  private exitCallback?: () => Promise<void>;

  constructor(sqlClient: SqlClient, exitCallback?: () => Promise<void>) {
    this.sqlClient = sqlClient;
    this.exitCallback = exitCallback;
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.prompt,
      history: [],
      historySize: 100
    });

    // Set up readline event handlers
    this.setupEventHandlers();
  }

  /**
   * Start the interactive REPL session
   */
  async start(): Promise<void> {
    // Display connection info
    const config = this.sqlClient.getConnectionInfo();
    console.log(ResultFormatter.formatConnection(config.url, config.projectId));
    console.log('');

    return new Promise((resolve) => {
      this.rl.on('close', () => {
        resolve();
      });

      // Start the prompt
      this.showPrompt();
    });
  }

  /**
   * Stop the REPL session
   */
  stop(): void {
    this.rl.removeAllListeners();
    this.rl.close();
  }

  private setupEventHandlers(): void {
    this.rl.on('line', async (input: string) => {
      await this.handleInput(input.trim());
    });

    this.rl.on('SIGINT', async () => {
      if (this.multilineBuffer) {
        // Cancel multiline input
        console.log('\nCanceled.');
        this.multilineBuffer = '';
        this.showPrompt();
      } else {
        // Exit cleanly
        console.log('\nGoodbye!');
        this.rl.close();
        
        // Call exit callback if provided (for proxy cleanup)
        if (this.exitCallback) {
          try {
            await this.exitCallback();
          } catch (error) {
            console.error('Error during exit cleanup:', error);
            process.exit(1);
          }
        }
      }
    });
  }

  private async handleInput(input: string): Promise<void> {
    try {
      // Handle empty input
      if (!input) {
        this.showPrompt();
        return;
      }

      // Check for meta commands (only if not in multiline mode)
      if (!this.multilineBuffer && input.startsWith('\\')) {
        const result = await this.handleMetaCommand(input);
        
        if (result.type === 'exit') {
          this.rl.close();
          return;
        }

        if (result.type === 'error' && result.message) {
          console.log(ResultFormatter.formatGeneralError(result.message));
        } else if (result.message) {
          console.log(result.message);
        }

        this.showPrompt();
        return;
      }

      // Handle SQL input
      await this.handleSqlInput(input);

    } catch (error) {
      console.log(ResultFormatter.formatGeneralError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      ));
      this.showPrompt();
    }
  }

  private async handleSqlInput(input: string): Promise<void> {
    // Add to multiline buffer
    if (this.multilineBuffer) {
      this.multilineBuffer += ' ' + input;
    } else {
      this.multilineBuffer = input;
    }

    // Check if statement is complete (ends with semicolon)
    if (this.multilineBuffer.trim().endsWith(';')) {
      const sql = this.multilineBuffer.trim();
      this.multilineBuffer = '';

      try {
        const result = await this.sqlClient.executeQuery(sql);
        console.log(ResultFormatter.formatResult(result));
      } catch (error) {
        if (this.isQueryError(error)) {
          console.log(ResultFormatter.formatError(error));
        } else {
          console.log(ResultFormatter.formatGeneralError(
            error instanceof Error ? error.message : 'Query execution failed'
          ));
        }
      }

      this.showPrompt();
    } else {
      // Continue multiline input
      this.showContinuationPrompt();
    }
  }

  private async handleMetaCommand(input: string): Promise<MetaCommandResult> {
    const command = input.toLowerCase();

    switch (command) {
      case '\\q':
      case '\\quit':
        console.log('Goodbye!');
        return { type: 'exit' };

      case '\\?':
      case '\\help':
        return {
          type: 'success',
          message: ResultFormatter.formatHelp()
        };

      case '\\dt':
        return await this.listTables();

      case '\\dn':
        return await this.listSchemas();

      case '\\l':
        return await this.listDatabases();

      case '\\du':
        return await this.listUsers();

      default:
        // Check for \d <table> command
        if (command.startsWith('\\d ')) {
          const tableName = input.substring(3).trim();
          return await this.describeTable(tableName);
        }

        // Check for \dt with schema pattern
        if (command.startsWith('\\dt ')) {
          const pattern = input.substring(4).trim();
          return await this.listTables(pattern);
        }

        return {
          type: 'error',
          message: `Unknown command: ${input}. Type \\? for help.`
        };
    }
  }

  private async listTables(pattern?: string): Promise<MetaCommandResult> {
    try {
      let sql: string;
      
      if (pattern === '*.*') {
        // List all tables in all schemas
        sql = `
          SELECT schemaname as schema_name, tablename as table_name, 'table' as table_type
          FROM pg_tables 
          ORDER BY schemaname, tablename;
        `;
      } else if (pattern) {
        // Parse schema.table pattern
        const [schemaPattern, tablePattern] = pattern.split('.');
        sql = `
          SELECT schemaname as schema_name, tablename as table_name, 'table' as table_type
          FROM pg_tables 
          WHERE schemaname LIKE '${schemaPattern.replace('*', '%')}'
          ${tablePattern ? `AND tablename LIKE '${tablePattern.replace('*', '%')}'` : ''}
          ORDER BY schemaname, tablename;
        `;
      } else {
        // List tables in public schema by default
        sql = `
          SELECT schemaname as schema_name, tablename as table_name, 'table' as table_type
          FROM pg_tables 
          WHERE schemaname = 'public'
          ORDER BY tablename;
        `;
      }

      const result = await this.sqlClient.executeQuery(sql);
      
      return {
        type: 'success',
        message: ResultFormatter.formatTableList(result.data)
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async describeTable(tableName: string): Promise<MetaCommandResult> {
    try {
      const [schema, table] = tableName.includes('.') 
        ? tableName.split('.', 2)
        : ['public', tableName];

      const sql = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = '${schema}' AND table_name = '${table}'
        ORDER BY ordinal_position;
      `;

      const result = await this.sqlClient.executeQuery(sql);
      
      return {
        type: 'success',
        message: ResultFormatter.formatTableDescription(result.data, tableName)
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to describe table: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async listSchemas(): Promise<MetaCommandResult> {
    try {
      const sql = `
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schema_name;
      `;

      const result = await this.sqlClient.executeQuery(sql);
      
      return {
        type: 'success',
        message: ResultFormatter.formatResult(result)
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to list schemas: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async listDatabases(): Promise<MetaCommandResult> {
    return {
      type: 'success',
      message: 'Database listing not supported in browser-based PostgreSQL.\nYou are connected to the active project database.'
    };
  }

  private async listUsers(): Promise<MetaCommandResult> {
    try {
      const sql = `
        SELECT 
          id,
          email,
          created_at,
          email_confirmed_at IS NOT NULL as email_confirmed
        FROM auth.users 
        ORDER BY created_at DESC 
        LIMIT 20;
      `;

      const result = await this.sqlClient.executeQuery(sql);
      
      return {
        type: 'success',
        message: ResultFormatter.formatResult(result)
      };
    } catch (error) {
      return {
        type: 'error',
        message: `Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private showPrompt(): void {
    this.rl.setPrompt(this.prompt);
    this.rl.prompt();
  }

  private showContinuationPrompt(): void {
    this.rl.setPrompt(this.continuationPrompt);
    this.rl.prompt();
  }

  private isQueryError(error: any): error is QueryError {
    return typeof error === 'object' && error !== null && 'error' in error && 'message' in error;
  }
}