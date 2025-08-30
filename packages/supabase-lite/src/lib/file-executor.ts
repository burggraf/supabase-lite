import { readFileSync } from 'fs';
import { resolve } from 'path';
import { SqlClient } from './sql-client.js';
import { SqlScriptParser, ParsedStatement } from './sql-script-parser.js';
import { QueryResult, QueryError } from '../types/index.js';

export interface StatementResult {
  statement: ParsedStatement;
  result?: QueryResult;
  error?: QueryError | Error;
  executionTime: number;
  success: boolean;
}

export interface FileExecutionOptions {
  continueOnError?: boolean;
  showProgress?: boolean;
  quiet?: boolean;
}

export interface FileExecutionResult {
  filePath: string;
  totalStatements: number;
  successfulStatements: number;
  failedStatements: number;
  results: StatementResult[];
  totalExecutionTime: number;
  success: boolean;
}

export class FileExecutor {
  private sqlClient: SqlClient;

  constructor(sqlClient: SqlClient) {
    this.sqlClient = sqlClient;
  }

  /**
   * Execute a SQL script file
   */
  async executeFile(
    filePath: string, 
    options: FileExecutionOptions = {}
  ): Promise<FileExecutionResult> {
    const {
      continueOnError = false,
      showProgress = false,
      quiet = false
    } = options;

    const startTime = performance.now();
    let scriptContent: string;
    
    // Resolve and read the file
    try {
      const resolvedPath = resolve(filePath);
      scriptContent = readFileSync(resolvedPath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read SQL file "${filePath}": ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    // Validate the script
    const validation = SqlScriptParser.validateScript(scriptContent);
    if (!validation.valid) {
      throw new Error(
        `Invalid SQL script: ${validation.errors.join(', ')}`
      );
    }

    // Parse the script into statements
    const statements = SqlScriptParser.parseScript(scriptContent, {
      removeComments: true,
      skipEmptyStatements: true
    });

    if (statements.length === 0) {
      throw new Error('No executable SQL statements found in file');
    }

    if (!quiet && showProgress) {
      console.log(`📁 Executing ${statements.length} statements from ${filePath}...`);
    }

    // Execute statements
    const results: StatementResult[] = [];
    let successfulStatements = 0;
    let failedStatements = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const stmtStartTime = performance.now();

      if (!quiet && showProgress) {
        console.log(`⏳ [${i + 1}/${statements.length}] Executing statement at line ${statement.lineNumber}...`);
      }

      try {
        const result = await this.sqlClient.executeQuery(statement.sql);
        const executionTime = performance.now() - stmtStartTime;
        
        const statementResult: StatementResult = {
          statement,
          result,
          executionTime,
          success: true
        };
        
        results.push(statementResult);
        successfulStatements++;

        if (!quiet && showProgress) {
          console.log(`✅ [${i + 1}/${statements.length}] Statement completed (${executionTime.toFixed(2)}ms)`);
        }

      } catch (error) {
        const executionTime = performance.now() - stmtStartTime;
        
        const statementResult: StatementResult = {
          statement,
          error: error as QueryError | Error,
          executionTime,
          success: false
        };
        
        results.push(statementResult);
        failedStatements++;

        if (!quiet && showProgress) {
          console.error(`❌ [${i + 1}/${statements.length}] Statement failed (${executionTime.toFixed(2)}ms)`);
        }

        // Stop execution if continueOnError is false
        if (!continueOnError) {
          break;
        }
      }
    }

    const totalExecutionTime = performance.now() - startTime;
    const success = failedStatements === 0;

    return {
      filePath,
      totalStatements: statements.length,
      successfulStatements,
      failedStatements,
      results,
      totalExecutionTime,
      success
    };
  }

  /**
   * Execute multiple SQL files in sequence
   */
  async executeFiles(
    filePaths: string[],
    options: FileExecutionOptions = {}
  ): Promise<FileExecutionResult[]> {
    const results: FileExecutionResult[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.executeFile(filePath, options);
        results.push(result);

        // Stop if a file fails and continueOnError is false
        if (!result.success && !options.continueOnError) {
          break;
        }
      } catch (error) {
        // Create a failed result for files that couldn't be read/parsed
        const failedResult: FileExecutionResult = {
          filePath,
          totalStatements: 0,
          successfulStatements: 0,
          failedStatements: 0,
          results: [],
          totalExecutionTime: 0,
          success: false
        };
        
        results.push(failedResult);

        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Get summary statistics for multiple file execution results
   */
  static summarizeResults(results: FileExecutionResult[]): {
    totalFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalStatements: number;
    successfulStatements: number;
    failedStatements: number;
    totalExecutionTime: number;
  } {
    return {
      totalFiles: results.length,
      successfulFiles: results.filter(r => r.success).length,
      failedFiles: results.filter(r => !r.success).length,
      totalStatements: results.reduce((sum, r) => sum + r.totalStatements, 0),
      successfulStatements: results.reduce((sum, r) => sum + r.successfulStatements, 0),
      failedStatements: results.reduce((sum, r) => sum + r.failedStatements, 0),
      totalExecutionTime: results.reduce((sum, r) => sum + r.totalExecutionTime, 0)
    };
  }
}