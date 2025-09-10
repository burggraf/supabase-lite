#!/usr/bin/env -S deno run --allow-all

/**
 * PostgREST Test Runner for Supabase Lite
 * 
 * This script processes the postgrest.test.json file and runs each example
 * against a local Supabase Lite instance to verify API compatibility.
 */

import { join } from "https://deno.land/std@0.208.0/path/mod.ts";

interface TestLog {
  type: 'info' | 'error' | 'debug';
  message: string;
  timestamp: string;
}

interface TestResults {
  passed: boolean;
  log: TestLog[];
  skip: boolean;
}

interface Example {
  id: string;
  name: string;
  code: string;
  data: {
    sql: string;
  };
  response: string;
  results?: TestResults;
  description?: string;
  hideCodeBlock?: boolean;
}

interface TestItem {
  id: string;
  title: string;
  $ref: string;
  notes: string;
  examples: Example[];
}

interface Config {
  supabaseLiteUrl: string;
  serverPort: number;
  healthCheckRetries: number;
  healthCheckDelay: number;
  workingDir: string;
  testJsonFile: string;
  templateFile: string;
}

class PostgRESTTestRunner {
  private config: Config;
  private currentProjectId: string | null = null;
  private browserTabOpen = false;
  private isRestarting = false;
  private isRetestMode = false;

  constructor(isRetestMode = false) {
    this.isRetestMode = isRetestMode;
    const currentDir = Deno.cwd();
    this.config = {
      supabaseLiteUrl: 'http://localhost:5173',
      serverPort: 5173,
      healthCheckRetries: 15,
      healthCheckDelay: 5000,
      workingDir: currentDir,
      testJsonFile: join(currentDir, 'postgrest.test.json'),
      templateFile: join(currentDir, 'postgrest.test.template.ts.txt'),
    };
  }

  private log(level: 'info' | 'error' | 'debug', message: string) {
    const timestamp = new Date().toISOString();
    const prefix = level.toUpperCase().padEnd(5);
    console.log(`[${timestamp}] ${prefix}: ${message}`);
  }

  private createTestLog(type: 'info' | 'error' | 'debug', message: string): TestLog {
    return {
      type,
      message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Kill existing servers on ports 5173-5179
   */
  private async killExistingServers(): Promise<void> {
    this.log('info', 'Killing existing servers on ports 5173-5179...');

    try {
      const lsofProcess = new Deno.Command('lsof', {
        args: ['-ti:5173-5179'],
        stdout: 'piped',
        stderr: 'piped'
      });

      const lsofResult = await lsofProcess.output();

      if (lsofResult.code === 0) {
        const pids = new TextDecoder().decode(lsofResult.stdout).trim();
        if (pids) {
          const killProcess = new Deno.Command('kill', {
            args: ['-9', ...pids.split('\n')],
            stdout: 'piped',
            stderr: 'piped'
          });

          const killResult = await killProcess.output();
          if (killResult.code === 0) {
            this.log('info', `Killed processes: ${pids.replace(/\n/g, ', ')}`);
          } else {
            this.log('error', `Failed to kill processes: ${new TextDecoder().decode(killResult.stderr)}`);
          }
        } else {
          this.log('info', 'No existing servers found');
        }
      } else {
        this.log('info', 'No existing servers found');
      }
    } catch (error) {
      this.log('error', `Error killing servers: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Wait a moment for processes to fully terminate
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Start the Supabase Lite development server
   */
  private async startServer(): Promise<void> {
    this.log('info', 'Starting Supabase Lite development server...');

    try {
      const process = new Deno.Command('npm', {
        args: ['run', 'dev'],
        cwd: this.config.workingDir,
        stdout: 'piped',
        stderr: 'piped'
      });

      // Start the process in the background
      process.spawn();

      // Don't wait for the process to complete, just let it run in background
      this.log('info', 'Server starting in background...');

    } catch (error) {
      throw new Error(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Open browser tab to initialize PGLite database context
   */
  private async openBrowserTab(): Promise<void> {
    this.log('info', 'Initializing browser context for database...');

    try {
      // Use MCP browser tools to navigate/refresh the page
      await this.navigateToBrowser(this.config.supabaseLiteUrl);
      this.browserTabOpen = true;
      this.log('info', 'Browser context initialized successfully');

      // Wait for the database to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
      throw new Error(`Failed to initialize browser context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close browser tab when done
   */
  private async closeBrowserTab(): Promise<void> {
    if (this.browserTabOpen) {
      this.log('info', 'Closing browser tab...');
      try {
        await this.closeBrowser();
        this.browserTabOpen = false;
        this.log('info', 'Browser tab closed');
      } catch (error) {
        this.log('error', `Failed to close browser tab: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Navigate browser to URL - reuses existing browser tab via MCP browser tools
   */
  private async navigateToBrowser(url: string): Promise<void> {
    // Simply log that the page should be refreshed - the MCP browser tools
    // will handle refreshing the existing tab instead of opening new windows
    this.log('info', `Refreshing browser to: ${url}`);

    // Give a brief moment for any pending operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Close browser
   */
  private async closeBrowser(): Promise<void> {
    // For now we'll just log that the browser tab should be closed
    // In a more advanced implementation, we could track and close specific browser processes
    this.log('info', 'Browser tab should be manually closed if it remains open');
  }

  /**
   * Wait for the server to be ready by checking the health endpoint
   */
  private async waitForServerReady(): Promise<void> {
    this.log('info', 'Waiting for server to be ready...');

    for (let attempt = 1; attempt <= this.config.healthCheckRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.supabaseLiteUrl}/health`);

        if (response.ok) {
          const health = await response.json();
          if (health.status === 'ok') {
            this.log('info', `Server is ready! Response: ${JSON.stringify(health)}`);
            return;
          }
        }
      } catch (error) {
        this.log('debug', `Health check attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (attempt < this.config.healthCheckRetries) {
        this.log('info', `Health check attempt ${attempt} failed, waiting ${this.config.healthCheckDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.config.healthCheckDelay));
      }
    }

    throw new Error('Server failed to start within timeout period');
  }

  /**
   * Wait for a specific project to be ready by checking its health endpoint
   */
  private async waitForProjectReady(projectId: string): Promise<void> {
    this.log('info', `Waiting for project ${projectId} to be ready...`);

    for (let attempt = 1; attempt <= this.config.healthCheckRetries; attempt++) {
      try {
        const projectUrl = `${this.config.supabaseLiteUrl}/${projectId}`;
        const response = await fetch(`${projectUrl}/health`);

        if (response.ok) {
          const health = await response.json();
          if (health.status === 'ok') {
            this.log('info', `Project is ready! Response: ${JSON.stringify(health)}`);
            return;
          }
        }
      } catch (error) {
        this.log('debug', `Project health check attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (attempt < this.config.healthCheckRetries) {
        this.log('info', `Project health check attempt ${attempt} failed, waiting ${this.config.healthCheckDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.config.healthCheckDelay));
      }
    }

    throw new Error(`Project ${projectId} failed to be ready within timeout period`);
  }

  /**
   * List existing projects and find project ID by name
   */
  private async findProjectId(projectName: string): Promise<string | null> {
    try {
      const process = new Deno.Command('supabase-lite', {
        args: ['admin', 'list-projects', '-u', this.config.supabaseLiteUrl],
        stdout: 'piped',
        stderr: 'piped'
      });

      const result = await process.output();
      const stdout = new TextDecoder().decode(result.stdout);

      if (result.code !== 0) {
        return null;
      }

      // Parse the table output to find project ID
      // Looking for a line containing the project name
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes(projectName)) {
          // Extract UUID from the line (36 character UUID pattern)
          const uuidMatch = line.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
          if (uuidMatch) {
            return uuidMatch[1];
          }
        }
      }

      return null;

    } catch (error) {
      this.log('debug', `Project lookup failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Delete existing test project if it exists
   */
  private async deleteExistingProject(projectName: string): Promise<void> {
    this.log('info', `Cleaning up existing project: ${projectName}`);

    try {
      // First, find the project ID
      const projectId = await this.findProjectId(projectName);

      if (!projectId) {
        this.log('debug', `Project ${projectName} not found - nothing to delete`);
        return;
      }

      this.log('info', `Found existing project ${projectName} with ID: ${projectId}`);

      // Delete using the project ID with auto-confirmation
      const process = new Deno.Command('bash', {
        args: ['-c', `echo "y" | supabase-lite admin delete-project ${projectId} -u ${this.config.supabaseLiteUrl}`],
        stdout: 'piped',
        stderr: 'piped'
      });

      const result = await process.output();
      const stdout = new TextDecoder().decode(result.stdout);
      const stderr = new TextDecoder().decode(result.stderr);

      if (result.code === 0) {
        this.log('info', `Existing project deleted successfully`);
      } else {
        this.log('debug', `Project deletion failed: ${stderr}`);
      }

    } catch (error) {
      this.log('debug', `Project deletion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a new test project using the supabase-lite CLI
   */
  private async createProject(projectName: string): Promise<string> {
    this.log('info', `Creating project: ${projectName}`);

    try {
      const process = new Deno.Command('supabase-lite', {
        args: ['admin', 'create-project', projectName, '-u', this.config.supabaseLiteUrl],
        stdout: 'piped',
        stderr: 'piped'
      });

      const result = await process.output();
      const stdout = new TextDecoder().decode(result.stdout);
      const stderr = new TextDecoder().decode(result.stderr);

      if (result.code !== 0) {
        throw new Error(`Failed to create project: ${stderr}`);
      }

      // Extract project ID from output
      // Expected format: "ID: c0fdaae9-c161-490a-ae46-463d5f81500d"
      const idMatch = stdout.match(/ID:\s+([a-f0-9-]+)/);
      if (!idMatch) {
        throw new Error(`Could not extract project ID from output: ${stdout}`);
      }

      const projectId = idMatch[1];
      this.currentProjectId = projectId;
      this.log('info', `Project created successfully with ID: ${projectId}`);
      return projectId;

    } catch (error) {
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract SQL from the data.sql property
   */
  private extractSQLFromData(sqlData: string): string {
    // Remove ```sql and ``` markers, then clean up the SQL
    const cleanedSql = sqlData
      .replace(/^```sql\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    return cleanedSql;
  }

  /**
   * Check if server is still responding
   */
  private async isServerResponding(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.supabaseLiteUrl}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Restart server if it's not responding
   */
  private async ensureServerRunning(): Promise<void> {
    // Prevent multiple concurrent restarts
    if (this.isRestarting) {
      this.log('debug', 'Server restart already in progress, waiting...');
      // Wait for current restart to complete
      while (this.isRestarting) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return;
    }

    const isResponding = await this.isServerResponding();
    if (!isResponding) {
      this.isRestarting = true;
      try {
        this.log('info', '🔧 Server appears to have crashed, restarting...');

        // Kill any remaining processes and restart
        await this.killExistingServers();
        await this.startServer();

        // Only reopen browser tab if we had one open before
        if (this.browserTabOpen) {
          await this.closeBrowserTab();
          await this.openBrowserTab();
        }

        // Wait for server to be ready
        await this.waitForServerReady();

        // Recreate the project since the database was reset
        if (this.currentProjectId) {
          this.log('info', '♻️ Recreating project after server restart...');
          console.log("deleteExistingProject", this.currentProjectId);
          await this.deleteExistingProject('postgrest-test-project');
          console.log("createProject");
          await this.createProject('postgrest-test-project');
          console.log('project recreated');
        }

        this.log('info', '✅ Server restarted successfully');
      } finally {
        this.isRestarting = false;
      }
    }
  }

  /**
   * Execute a single SQL statement via the debug endpoint
   */
  private async executeSingleSQL(statement: string): Promise<any> {
    const projectUrl = `${this.config.supabaseLiteUrl}/${this.currentProjectId}`;
    const debugUrl = `${projectUrl}/debug/sql`;

    const response = await fetch(debugUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: statement })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SQL execution failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`SQL execution failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Split SQL into individual statements
   */
  private splitSQLStatements(sql: string): string[] {
    // Split by semicolon and clean up each statement
    return sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
      .map(stmt => stmt.endsWith(';') ? stmt : stmt + ';');
  }

  /**
   * Seed the database with test data
   */
  private async seedDatabase(sqlData: string): Promise<void> {
    // Ensure server is still running before seeding
    await this.ensureServerRunning();

    const sql = this.extractSQLFromData(sqlData);
    const statements = this.splitSQLStatements(sql);

    this.log('info', `Seeding database with ${statements.length} SQL statements`);

    // Execute each statement individually with retry logic
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.log('debug', `Executing statement ${i + 1}/${statements.length} (attempt ${attempt}/${maxRetries}): ${statement.substring(0, 50)}...`);

          const result = await this.executeSingleSQL(statement);
          
          this.log('debug', `Statement ${i + 1} executed successfully`);
          break; // Success - move to next statement

        } catch (error) {
          // If it's the last attempt, throw the error
          if (attempt === maxRetries) {
            this.log('error', `Failed to execute statement ${i + 1}:`);
            this.log('error', `SQL: ${statement}`);
            this.log('error', `Error: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Database seeding failed on statement ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          // For other attempts, log and continue to retry
          this.log('debug', `Statement ${i + 1} attempt ${attempt} failed, retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    this.log('info', 'Database seeded successfully');
  }

  /**
   * Extract code block from example
   */
  private extractCodeFromExample(codeData: string): string {
    // Remove ```js, ```ts, or ``` markers and clean up
    let cleanedCode = codeData
      .replace(/^```(?:js|ts)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    // Handle duplicate const { data, error } declarations by using only the last one
    const lines = cleanedCode.split('\n');
    const queryLines: number[] = [];

    // Find all lines with const { data, error } declarations
    lines.forEach((line, index) => {
      if (line.trim().startsWith('const { data, error }')) {
        queryLines.push(index);
      }
    });

    // If there are multiple queries, extract only the last complete query block
    if (queryLines.length > 1) {
      const lastQueryStart = queryLines[queryLines.length - 1];
      const relevantLines = lines.slice(lastQueryStart);
      cleanedCode = relevantLines.join('\n');
    }

    // Ensure we always destructure both data and error for status code extraction
    // Transform "const { error }" to "const { data, error }"
    // Transform "const { count, error }" to "const { data, count, error }"
    cleanedCode = cleanedCode.replace(
      /const\s*{\s*error\s*}/g,
      'const { data, error }'
    );

    cleanedCode = cleanedCode.replace(
      /const\s*{\s*count,\s*error\s*}/g,
      'const { data, count, error }'
    );

    return cleanedCode;
  }

  /**
   * Extract expected response from example
   */
  private extractExpectedResponse(responseData: string): any {
    // Remove ```json and ``` markers, then parse JSON
    const cleanedJson = responseData
      .replace(/^```json\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    try {
      return JSON.parse(cleanedJson);
    } catch (error) {
      throw new Error(`Failed to parse expected response JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate test script from template
   */
  private async generateTestScript(example: Example): Promise<string> {
    const templateContent = await Deno.readTextFile(this.config.templateFile);
    const code = this.extractCodeFromExample(example.code);
    const expectedResponse = this.extractExpectedResponse(example.response);

    // Use the specific project URL to ensure we're testing against the correct database
    const projectUrl = `${this.config.supabaseLiteUrl}/${this.currentProjectId}`;

    // Use JSON.stringify for code_content (string analysis) but raw code for execution
    const escapedCodeContent = JSON.stringify(code);
    
    const testScript = templateContent
      .replace('<id>', example.id)
      .replace('<name>', example.name)
      .replace('<project_url>', projectUrl)
      .replaceAll('<code>', code)
      .replaceAll('<code_content>', escapedCodeContent)
      .replace('<response>', JSON.stringify(expectedResponse, null, 2));

    const tempScriptFile = join(this.config.workingDir, 'tmp-script.ts');
    await Deno.writeTextFile(tempScriptFile, testScript);

    return tempScriptFile;
  }

  /**
   * Run a test script and capture results
   */
  private async runTest(scriptPath: string): Promise<{ success: boolean; output: string; error?: string }> {
    try {
      const process = new Deno.Command('deno', {
        args: ['run', '--allow-all', scriptPath],
        stdout: 'piped',
        stderr: 'piped'
      });

      const result = await process.output();
      const stdout = new TextDecoder().decode(result.stdout);
      const stderr = new TextDecoder().decode(result.stderr);

      return {
        success: result.code === 0,
        output: stdout,
        error: stderr || undefined
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Display prominent test header with asterisk borders
   */
  private displayTestHeader(item: TestItem, example: Example): void {
    const headerText = `Running Test: ${item.id} - ${example.name}`;
    const border = '*'.repeat(headerText.length + 4);

    console.log('\n' + border);
    console.log(`* ${headerText} *`);
    console.log(border + '\n');
  }

  /**
   * Display clean test result without timestamps and log prefixes
   */
  private displayTestResult(passed: boolean, testName: string, isRetestContinue = false): void {
    const emoji = passed ? '✅' : '❌';
    const status = passed ? 'PASSED' : 'FAILED';
    const suffix = isRetestContinue ? ' (continuing in retest mode)' : '';
    const resultText = `${emoji} ${status}: ${testName}${suffix}`;
    const border = '*'.repeat(resultText.length + 4);

    console.log('\n' + border);
    console.log(`* ${resultText} *`);
    console.log(border + '\n');
  }

  /**
   * Display comprehensive failure details for debugging
   */
  private displayFailureDetails(item: TestItem, example: Example, results: TestResults): void {
    const border = '='.repeat(80);
    
    console.log('\n' + border);
    console.log('🔍 COMPREHENSIVE FAILURE REPORT');
    console.log(border);
    
    console.log('\n📋 TEST INFORMATION:');
    console.log(`ID: ${example.id}`);
    console.log(`Name: ${example.name}`);
    console.log(`Category: ${item.id} - ${item.title}`);
    
    if (example.description) {
      console.log(`Description: ${example.description}`);
    }
    
    console.log('\n💻 TEST CODE:');
    console.log(this.extractCodeFromExample(example.code));
    
    console.log('\n🗃️ SEED DATA:');
    console.log(this.extractSQLFromData(example.data.sql));
    
    console.log('\n🎯 EXPECTED RESPONSE:');
    const expectedData = this.extractExpectedResponse(example.response);
    console.log(JSON.stringify(expectedData, null, 2));
    
    console.log('\n❌ FAILURE DETAILS:');
    for (const logEntry of results.log) {
      if (logEntry.type === 'error') {
        console.log(`• ${logEntry.message}`);
      }
    }
    
    console.log('\n' + border);
    console.log('END FAILURE REPORT');
    console.log(border + '\n');
  }

  /**
   * Determine if a test should be skipped based on mode and previous results
   */
  private shouldSkipTest(example: Example): string | null {
    const results = example.results;

    if (!results) {
      // No previous results, don't skip
      return null;
    }

    if (this.isRetestMode) {
      // In retest mode, only skip tests that previously failed and are marked to skip
      if (!results.passed && results.skip) {
        return "previously failed with skip=true (manually bypassed)";
      }
      // Run all other tests (previously passed or previously failed without skip flag)
      return null;
    } else {
      // In normal mode, skip tests that are marked to skip (passed previously)
      if (results.skip) {
        return "already passed";
      }
      return null;
    }
  }

  /**
   * Compare actual results with expected results
   */
  private compareResults(actual: any, expected: any): { match: boolean; differences?: string } {
    try {
      // Deep comparison of objects
      const actualStr = JSON.stringify(actual, null, 2);
      const expectedStr = JSON.stringify(expected, null, 2);

      if (actualStr === expectedStr) {
        return { match: true };
      }

      return {
        match: false,
        differences: `Expected:\n${expectedStr}\n\nActual:\n${actualStr}`
      };

    } catch (error) {
      return {
        match: false,
        differences: `Comparison failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Reset public schema instead of recreating entire project for faster test isolation
   */
  private async resetPublicSchema(): Promise<void> {
    this.log('debug', 'Resetting public schema for test isolation');
    
    // Drop and recreate public schema to clean all data and tables
    await this.executeSingleSQL('DROP SCHEMA IF EXISTS public CASCADE;');
    await this.executeSingleSQL('CREATE SCHEMA public;');
    
    // Restore default permissions for public schema
    await this.executeSingleSQL('GRANT ALL ON SCHEMA public TO postgres;');
    await this.executeSingleSQL('GRANT ALL ON SCHEMA public TO public;');
    
    this.log('debug', 'Public schema reset completed');
  }

  /**
   * Process a single example
   */
  private async processExample(_item: TestItem, example: Example): Promise<TestResults> {
    const log: TestLog[] = [];

    try {
      this.log('info', `Processing example: ${example.id} - ${example.name}`);
      log.push(this.createTestLog('info', `Starting test: ${example.name}`));

      // Fast schema reset instead of project recreation for better performance
      await this.resetPublicSchema();
      log.push(this.createTestLog('info', 'Public schema reset for test isolation'));

      // Seed the database
      await this.seedDatabase(example.data.sql);
      log.push(this.createTestLog('info', 'Database seeded successfully'));

      // Generate and run test script
      const scriptPath = await this.generateTestScript(example);
      log.push(this.createTestLog('info', 'Test script generated'));

      const testResult = await this.runTest(scriptPath);

      if (!testResult.success) {
        this.log('info', `Test script available for debugging: ${scriptPath}`);
        const errorMsg = `Test execution failed: ${testResult.error}`;
        log.push(this.createTestLog('error', errorMsg));
        return { passed: false, log, skip: false };
      }

      // Keep test script for debugging - don't clean up

      // Parse actual output (should be JSON)
      let actualData: any;
      try {
        // Extract the data from the output (look for "Data: " prefix)
        const outputLines = testResult.output.split('\n');
        const dataLine = outputLines.find(line => line.startsWith('Data: '));
        if (!dataLine) {
          throw new Error('No data output found in test result');
        }
        actualData = JSON.parse(dataLine.substring(6)); // Remove "Data: " prefix
      } catch (error) {
        const errorMsg = `Failed to parse test output: ${error instanceof Error ? error.message : String(error)}`;
        log.push(this.createTestLog('error', errorMsg));
        return { passed: false, log, skip: false };
      }

      // Compare results
      const expectedData = this.extractExpectedResponse(example.response);
      const comparison = this.compareResults(actualData, expectedData);

      if (comparison.match) {
        log.push(this.createTestLog('info', 'Test passed - results match expected output'));
        return { passed: true, log, skip: true }; // Mark as skip for future runs
      } else {
        const errorMsg = `Test failed - results don't match:\n${comparison.differences}`;
        log.push(this.createTestLog('error', errorMsg));
        return { passed: false, log, skip: false };
      }

    } catch (error) {
      const errorMsg = `Test execution error: ${error instanceof Error ? error.message : String(error)}`;
      log.push(this.createTestLog('error', errorMsg));
      return { passed: false, log, skip: false };
    }
  }

  /**
   * Process all test items and examples
   */
  private async processTests(testData: TestItem[], targetTestId?: string): Promise<void> {
    let regressionFailures: Array<{ item: TestItem, example: Example, error: string }> = [];

    // If a specific test ID is provided, find and run only that test
    if (targetTestId) {
      let foundTest = false;
      
      for (const item of testData) {
        for (const example of item.examples) {
          if (example.id === targetTestId) {
            foundTest = true;
            this.log('info', `\n=== Running single test: ${item.id} - ${example.name} (${targetTestId}) ===`);
            
            // Display prominent header for current test
            this.displayTestHeader(item, example);

            // Process this example (always run it, don't skip)
            const results = await this.processExample(item, example);

            // Update the example with results
            example.results = results;

            // Save results after the test
            await this.saveResults(testData);

            // Display clean test result
            const testName = `${item.id} - ${example.name}`;
            this.displayTestResult(results.passed, testName);

            if (!results.passed) {
              // Display comprehensive failure information
              this.displayFailureDetails(item, example, results);
              Deno.exit(1);
            }
            
            this.log('info', '\n=== Single test completed successfully! ===');
            Deno.exit(0);
          }
        }
      }
      
      if (!foundTest) {
        this.log('error', `Test with ID "${targetTestId}" not found`);
        Deno.exit(1);
      }
      return;
    }

    // Original logic for running all tests
    for (const item of testData) {
      this.log('info', `\n=== Processing item: ${item.id} - ${item.title} ===`);

      for (const example of item.examples) {
        const shouldSkip = this.shouldSkipTest(example);

        if (shouldSkip) {
          this.log('info', `Skipping example: ${example.id} (${shouldSkip})`);
          continue;
        }

        // Display prominent header for current test
        this.displayTestHeader(item, example);

        // Process this example
        const results = await this.processExample(item, example);

        // Handle regression testing logic
        if (this.isRetestMode && example.results?.passed && !results.passed) {
          // This is a regression - test previously passed but now fails
          this.log('error', `REGRESSION DETECTED: Test ${example.id} previously passed but now fails`);
          example.results.skip = false; // Unmark skip flag
          regressionFailures.push({
            item,
            example,
            error: results.log.filter(log => log.type === 'error').map(log => log.message).join('\n')
          });
        }

        // Update the example with results
        example.results = results;

        // Save results after each test
        await this.saveResults(testData);

        // In normal mode, stop on first failure. In retest mode, continue collecting regressions
        if (!results.passed && !this.isRetestMode) {
          const testName = `${item.id} - ${example.name}`;
          this.displayTestResult(false, testName);
          this.log('error', 'Stopping execution on first failure for debugging');

          // Display comprehensive failure information
          this.displayFailureDetails(item, example, results);

          Deno.exit(1);
        }

        // Display clean test result
        const testName = `${item.id} - ${example.name}`;
        this.displayTestResult(results.passed, testName, this.isRetestMode && !results.passed);
      }
    }

    // Handle regression failures
    if (this.isRetestMode && regressionFailures.length > 0) {
      this.log('error', `\n=== REGRESSION TEST FAILURES (${regressionFailures.length}) ===`);
      for (const failure of regressionFailures) {
        this.log('error', `${failure.item.id} - ${failure.example.name}:`);
        this.log('error', failure.error);
        this.log('error', '---');
      }
      throw new Error(`${regressionFailures.length} regression test(s) failed`);
    }

    this.log('info', '\n=== All tests completed successfully! ===');
  }

  /**
   * Save updated test results back to JSON file
   */
  private async saveResults(testData: TestItem[]): Promise<void> {
    try {
      const jsonContent = JSON.stringify(testData, null, 2);
      await Deno.writeTextFile(this.config.testJsonFile, jsonContent);
      this.log('debug', 'Test results saved to file');
    } catch (error) {
      this.log('error', `Failed to save results: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load test data from JSON file
   */
  private async loadTestData(): Promise<TestItem[]> {
    try {
      const jsonContent = await Deno.readTextFile(this.config.testJsonFile);
      return JSON.parse(jsonContent) as TestItem[];
    } catch (error) {
      throw new Error(`Failed to load test data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Main execution method
   */
  async run(targetTestId?: string): Promise<void> {
    try {
      this.log('info', '🚀 Starting PostgREST Test Runner');

      // Load test data
      const testData = await this.loadTestData();
      this.log('info', `Loaded ${testData.length} test items`);

      // Setup test environment
      await this.killExistingServers();
      await this.startServer();

      // Open browser tab to initialize PGLite database context
      await this.openBrowserTab();

      await this.waitForServerReady();

      // Create test project once at startup - we'll reset schema between tests for efficiency  
      await this.deleteExistingProject('postgrest-test-project');
      await this.createProject('postgrest-test-project');

      // Process tests (single test if targetTestId provided, all tests otherwise)
      await this.processTests(testData, targetTestId);

      // Clean up browser tab
      await this.closeBrowserTab();

    } catch (error) {
      this.log('error', `Test runner failed: ${error instanceof Error ? error.message : String(error)}`);

      // Make sure to clean up browser tab on error too
      await this.closeBrowserTab();

      Deno.exit(1);
    }
  }
}

// Main execution
if (import.meta.main) {
  // Parse command line arguments
  const args = Deno.args;
  const isRetestMode = args.includes('--retest');
  
  // Look for --test-id argument
  let targetTestId: string | undefined;
  const testIdArgIndex = args.findIndex(arg => arg === '--test-id');
  if (testIdArgIndex >= 0 && testIdArgIndex < args.length - 1) {
    targetTestId = args[testIdArgIndex + 1];
  }

  if (targetTestId) {
    console.log(`🎯 Running single test with ID: ${targetTestId}`);
    console.log('   - Will run only this specific test, ignoring skip flags');
    console.log('   - Will stop immediately if the test fails\n');
  } else if (isRetestMode) {
    console.log('🔄 Running in regression test mode (--retest)');
    console.log('   - Will run all tests except those that previously failed with skip=true');
    console.log('   - Will detect regressions (tests that previously passed but now fail)');
    console.log('   - Will continue running all tests even if failures occur\n');
  } else {
    console.log('🚀 Running in normal test mode');
    console.log('   - Will skip tests that previously passed (skip=true)');
    console.log('   - Will stop on first failure for debugging\n');
  }

  const runner = new PostgRESTTestRunner(isRetestMode);
  await runner.run(targetTestId);
}