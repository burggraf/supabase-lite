import Table from 'cli-table3';
import { QueryResult, QueryError, QueryField, FileExecutionSummary } from '../types/index.js';
import { FileExecutionResult, StatementResult } from './file-executor.js';

export class ResultFormatter {
  private static readonly MAX_COLUMN_WIDTH = 50;
  private static readonly MAX_ROWS_DISPLAY = 1000;

  /**
   * Format query results for display
   */
  static formatResult(result: QueryResult): string {
    if (!result.data || result.data.length === 0) {
      return this.formatEmptyResult(result);
    }

    const output: string[] = [];
    
    // Create table
    const table = this.createTable(result);
    output.push(table.toString());
    
    // Add summary information
    output.push(this.formatSummary(result));
    
    return output.join('\n');
  }

  /**
   * Format error messages
   */
  static formatError(error: QueryError): string {
    const output: string[] = [];
    
    output.push(`❌ ${error.error}: ${error.message}`);
    
    if (error.details) {
      output.push(`   Details: ${error.details}`);
    }
    
    if (error.hint) {
      output.push(`   Hint: ${error.hint}`);
    }
    
    return output.join('\n');
  }

  /**
   * Format general error messages
   */
  static formatGeneralError(message: string): string {
    return `❌ Error: ${message}`;
  }

  /**
   * Format success messages
   */
  static formatSuccess(message: string): string {
    return `✅ ${message}`;
  }

  /**
   * Format connection information
   */
  static formatConnection(url: string, projectId?: string): string {
    const output: string[] = [];
    output.push('🔗 Connected to Supabase Lite');
    output.push(`   URL: ${url}`);
    
    if (projectId) {
      output.push(`   Project: ${projectId}`);
    }
    
    output.push('   Type "\\?" for help or "\\q" to quit.');
    
    return output.join('\n');
  }

  /**
   * Format help message
   */
  static formatHelp(): string {
    const output: string[] = [];
    output.push('📖 Supabase Lite CLI Help');
    output.push('');
    output.push('Meta Commands:');
    output.push('  \\q              Quit the session');
    output.push('  \\l              List databases/projects');
    output.push('  \\dt             List tables in current schema');
    output.push('  \\dt *.*         List all tables in all schemas');
    output.push('  \\d <table>      Describe table structure');
    output.push('  \\dn             List schemas');
    output.push('  \\du             List users/roles');
    output.push('  \\?              Show this help');
    output.push('');
    output.push('SQL Commands:');
    output.push('  Enter SQL statements and press Enter');
    output.push('  Multi-line statements are supported');
    output.push('  Terminate statements with semicolon (;)');
    output.push('');
    output.push('Examples:');
    output.push('  SELECT * FROM auth.users LIMIT 5;');
    output.push('  \\dt auth.*');
    output.push('  \\d auth.users');
    
    return output.join('\n');
  }

  private static createTable(result: QueryResult): any {
    const headers = this.extractHeaders(result);
    const rows = this.extractRows(result, headers);

    const table = new Table({
      head: headers,
      style: { 
        head: ['cyan'],
        border: ['gray'],
        compact: true
      },
      colWidths: this.calculateColumnWidths(result, headers),
      wordWrap: true,
      wrapOnWordBoundary: false
    });

    // Limit number of rows displayed
    const displayRows = rows.slice(0, this.MAX_ROWS_DISPLAY);
    table.push(...displayRows);

    return table;
  }

  private static extractHeaders(result: QueryResult): string[] {
    if (result.fields && result.fields.length > 0) {
      return result.fields.map(field => field.name);
    }
    
    if (result.data && result.data.length > 0) {
      return Object.keys(result.data[0]);
    }
    
    return [];
  }

  private static extractRows(result: QueryResult, headers: string[]): string[][] {
    return result.data.map(row => {
      return headers.map(header => {
        const value = row[header];
        return this.formatValue(value);
      });
    });
  }

  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    const str = String(value);
    
    // Truncate very long values
    if (str.length > this.MAX_COLUMN_WIDTH) {
      return str.substring(0, this.MAX_COLUMN_WIDTH - 3) + '...';
    }
    
    return str;
  }

  private static calculateColumnWidths(result: QueryResult, headers: string[]): number[] {
    const minWidth = 10;
    const maxWidth = this.MAX_COLUMN_WIDTH;
    
    return headers.map(header => {
      // Start with header length
      let maxLen = header.length;
      
      // Check data lengths
      result.data.forEach(row => {
        const value = this.formatValue(row[header]);
        maxLen = Math.max(maxLen, value.length);
      });
      
      // Apply constraints
      return Math.max(minWidth, Math.min(maxWidth, maxLen + 2));
    });
  }

  private static formatEmptyResult(result: QueryResult): string {
    if (result.rowCount === 0) {
      return '(0 rows)';
    }
    return 'Query completed successfully.';
  }

  private static formatSummary(result: QueryResult): string {
    const output: string[] = [];
    
    // Row count
    if (result.rowCount === 1) {
      output.push('(1 row)');
    } else {
      output.push(`(${result.rowCount} rows)`);
    }
    
    // Execution time
    if (result.executionTime !== undefined) {
      output.push(`Time: ${result.executionTime}ms`);
    }
    
    // Truncation warning
    if (result.data.length > this.MAX_ROWS_DISPLAY) {
      output.push(`⚠️  Output truncated to ${this.MAX_ROWS_DISPLAY} rows`);
    }
    
    return output.join('  ');
  }

  /**
   * Format table list for \dt command
   */
  static formatTableList(tables: any[]): string {
    if (!tables || tables.length === 0) {
      return 'No tables found.';
    }

    const table = new Table({
      head: ['Schema', 'Name', 'Type', 'Owner'],
      style: { 
        head: ['cyan'],
        border: ['gray'],
        compact: true
      }
    });

    tables.forEach(tableInfo => {
      table.push([
        tableInfo.schema_name || 'public',
        tableInfo.table_name,
        tableInfo.table_type || 'table',
        tableInfo.owner || ''
      ]);
    });

    return table.toString() + `\n(${tables.length} ${tables.length === 1 ? 'table' : 'tables'})`;
  }

  /**
   * Format table description for \d command
   */
  static formatTableDescription(columns: any[], tableName: string): string {
    if (!columns || columns.length === 0) {
      return `Table "${tableName}" not found or has no columns.`;
    }

    const output: string[] = [];
    output.push(`Table "${tableName}"`);
    
    const table = new Table({
      head: ['Column', 'Type', 'Nullable', 'Default'],
      style: { 
        head: ['cyan'],
        border: ['gray'],
        compact: true
      }
    });

    columns.forEach(col => {
      table.push([
        col.column_name,
        col.data_type + (col.character_maximum_length ? `(${col.character_maximum_length})` : ''),
        col.is_nullable === 'YES' ? 'null' : 'not null',
        col.column_default || ''
      ]);
    });

    output.push(table.toString());
    return output.join('\n');
  }

  /**
   * Format file execution results
   */
  static formatFileExecutionResult(result: FileExecutionResult, quiet: boolean = false): string {
    const output: string[] = [];

    if (!quiet) {
      output.push(`📁 File: ${result.filePath}`);
      output.push(`📊 Summary: ${result.successfulStatements}/${result.totalStatements} statements executed successfully`);
      if (result.failedStatements > 0) {
        output.push(`❌ Failed: ${result.failedStatements} statements`);
      }
      output.push(`⏱️  Total time: ${result.totalExecutionTime.toFixed(2)}ms`);
      output.push('');
    }

    // Show results for each statement
    for (let i = 0; i < result.results.length; i++) {
      const stmtResult = result.results[i];
      
      if (!quiet) {
        const status = stmtResult.success ? '✅' : '❌';
        output.push(`${status} Statement ${i + 1} (line ${stmtResult.statement.lineNumber}, ${stmtResult.executionTime.toFixed(2)}ms):`);
        
        // Show the SQL if not quiet
        const sqlPreview = stmtResult.statement.sql.length > 100 
          ? stmtResult.statement.sql.substring(0, 100) + '...'
          : stmtResult.statement.sql;
        output.push(`   SQL: ${sqlPreview.replace(/\n/g, ' ')}`);
      }

      if (stmtResult.success && stmtResult.result) {
        // Show query results
        if (stmtResult.result.data && stmtResult.result.data.length > 0) {
          if (quiet) {
            // In quiet mode, just show the data
            stmtResult.result.data.forEach(row => {
              output.push(JSON.stringify(row));
            });
          } else {
            output.push(this.formatResult(stmtResult.result));
          }
        } else if (!quiet) {
          output.push(`   Result: Query executed successfully (${stmtResult.result.rowCount || 0} rows affected)`);
        }
      } else if (stmtResult.error) {
        if (!quiet) {
          if (this.isQueryError(stmtResult.error)) {
            output.push(`   Error: ${this.formatError(stmtResult.error)}`);
          } else {
            output.push(`   Error: ${stmtResult.error.message}`);
          }
        }
      }

      if (!quiet && i < result.results.length - 1) {
        output.push(''); // Add spacing between statements
      }
    }

    return output.join('\n');
  }

  /**
   * Format file execution summary
   */
  static formatFileExecutionSummary(summary: FileExecutionSummary): string {
    const output: string[] = [];
    
    output.push('📋 Execution Summary:');
    output.push(`   File: ${summary.filePath}`);
    output.push(`   Statements: ${summary.totalStatements}`);
    output.push(`   Successful: ${summary.successfulStatements}`);
    output.push(`   Failed: ${summary.failedStatements}`);
    output.push(`   Total time: ${summary.totalExecutionTime.toFixed(2)}ms`);
    
    if (summary.failedStatements === 0) {
      output.push('   Status: ✅ All statements executed successfully');
    } else {
      output.push(`   Status: ❌ ${summary.failedStatements} statement(s) failed`);
    }

    return output.join('\n');
  }

  /**
   * Format multiple file execution results
   */
  static formatMultipleFileResults(results: FileExecutionResult[], quiet: boolean = false): string {
    const output: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      output.push(this.formatFileExecutionResult(result, quiet));
      
      if (i < results.length - 1) {
        output.push('');
        output.push('─'.repeat(50));
        output.push('');
      }
    }

    if (!quiet && results.length > 1) {
      output.push('');
      output.push('🎯 Overall Summary:');
      
      const totalStatements = results.reduce((sum, r) => sum + r.totalStatements, 0);
      const totalSuccessful = results.reduce((sum, r) => sum + r.successfulStatements, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failedStatements, 0);
      const totalTime = results.reduce((sum, r) => sum + r.totalExecutionTime, 0);
      
      output.push(`   Files processed: ${results.length}`);
      output.push(`   Total statements: ${totalStatements}`);
      output.push(`   Total successful: ${totalSuccessful}`);
      output.push(`   Total failed: ${totalFailed}`);
      output.push(`   Total execution time: ${totalTime.toFixed(2)}ms`);
    }

    return output.join('\n');
  }

  /**
   * Type guard for QueryError
   */
  private static isQueryError(error: any): error is QueryError {
    return typeof error === 'object' && error !== null && 'error' in error && 'message' in error;
  }
}