import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config/supabase-config.js';

// Test runner configuration
const CONFIG = {
  maxConcurrency: 1,  // Sequential execution prevents table conflicts
  timeoutMs: 30000,
  retryAttempts: 2,
  outputDir: './results',
  logLevel: 'INFO' // DEBUG, INFO, WARN, ERROR
};

class TestRunner {
  constructor() {
    this.results = [];
    this.summary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      startTime: null,
      endTime: null
    };
    
    // Ensure results directory exists
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  }

  log(level, message, ...args) {
    const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    if (levels[level] >= levels[CONFIG.logLevel]) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${level}: ${message}`, ...args);
    }
  }

  async checkSupabaseConnection() {
    this.log('INFO', 'Checking Supabase connection...');
    
    try {
      const response = await fetch(`${SUPABASE_CONFIG.url}/health`);
      if (response.ok) {
        this.log('INFO', '✅ Supabase connection healthy');
        return true;
      }
    } catch (err) {
      this.log('WARN', 'Health check failed, trying debug endpoint...');
    }

    try {
      const response = await fetch(SUPABASE_CONFIG.debugSqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: 'SELECT 1 as test' })
      });
      
      const result = await response.json();
      if (result.success) {
        this.log('INFO', '✅ Debug SQL endpoint available');
        return true;
      }
    } catch (err) {
      this.log('ERROR', '❌ Cannot connect to Supabase:', err.message);
      return false;
    }
    
    return false;
  }

  async loadTestManifest() {
    try {
      const manifestPath = './test-manifest.json';
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);
      
      this.log('INFO', `📋 Loaded test manifest with ${manifest.length} tests`);
      return manifest;
    } catch (err) {
      this.log('ERROR', 'Failed to load test manifest:', err.message);
      throw err;
    }
  }

  async runSingleTest(testInfo) {
    const startTime = Date.now();
    const testPath = testInfo.relativePath;
    
    this.log('DEBUG', `🧪 Running test: ${testInfo.testId || testInfo.fileName}`);

    try {
      // Dynamic import of the test module
      const testModule = await import(`./${testPath}`);
      const runTest = testModule.default;
      
      if (typeof runTest !== 'function') {
        throw new Error('Test module does not export a default function');
      }

      // Run test with timeout
      const result = await Promise.race([
        runTest(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), CONFIG.timeoutMs)
        )
      ]);

      const duration = Date.now() - startTime;
      
      return {
        ...result,
        testPath,
        duration,
        timestamp: new Date().toISOString()
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      
      return {
        testId: testInfo.testId || testInfo.fileName,
        functionId: testInfo.functionId,
        name: testInfo.name,
        passed: false,
        error: err.message,
        data: null,
        expected: null,
        testPath,
        duration,
        timestamp: new Date().toISOString()
      };
    }
  }

  async runTestsWithConcurrency(tests) {
    const results = [];
    const chunks = [];
    
    // Split tests into chunks for concurrency
    for (let i = 0; i < tests.length; i += CONFIG.maxConcurrency) {
      chunks.push(tests.slice(i, i + CONFIG.maxConcurrency));
    }

    for (const chunk of chunks) {
      this.log('INFO', `🏃 Running batch of ${chunk.length} tests...`);
      
      const batchPromises = chunk.map(test => this.runSingleTest(test));
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          const status = result.value.passed ? '✅ PASS' : '❌ FAIL';
          this.log('INFO', `${status}: ${result.value.testId} (${result.value.duration}ms)`);
        } else {
          results.push({
            testId: 'unknown',
            functionId: 'unknown',
            name: 'unknown',
            passed: false,
            error: result.reason.message,
            data: null,
            expected: null,
            duration: 0,
            timestamp: new Date().toISOString()
          });
          this.log('ERROR', `💥 CRASHED: ${result.reason.message}`);
        }
      }
      
      // Brief pause between batches
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  generateSummary(results) {
    this.summary.total = results.length;
    this.summary.passed = results.filter(r => r.passed).length;
    this.summary.failed = results.filter(r => !r.passed).length;
    this.summary.duration = this.summary.endTime - this.summary.startTime;

    const passRate = ((this.summary.passed / this.summary.total) * 100).toFixed(1);
    
    return {
      ...this.summary,
      passRate: `${passRate}%`,
      averageTestDuration: Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length),
      failedTests: results.filter(r => !r.passed).map(r => ({
        testId: r.testId,
        functionId: r.functionId,
        error: r.error
      }))
    };
  }

  async saveResults(results, summary) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save detailed results
    const resultsFile = path.join(CONFIG.outputDir, `test-results-${timestamp}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify({
      summary,
      results,
      config: CONFIG,
      timestamp
    }, null, 2));

    // Save summary report
    const reportFile = path.join(CONFIG.outputDir, `test-report-${timestamp}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(summary, null, 2));

    // Save latest results (for easy access)
    const latestResults = path.join(CONFIG.outputDir, 'latest-results.json');
    fs.writeFileSync(latestResults, JSON.stringify({
      summary,
      results: results.slice(0, 50), // Just first 50 for size
      timestamp
    }, null, 2));

    this.log('INFO', `📊 Results saved to ${resultsFile}`);
    this.log('INFO', `📈 Summary saved to ${reportFile}`);
  }

  printSummary(summary) {
    console.log('\\n' + '='.repeat(80));
    console.log('🏁 TEST SUITE SUMMARY');
    console.log('='.repeat(80));
    console.log(`📊 Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📈 Pass Rate: ${summary.passRate}`);
    console.log(`⏱️  Total Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    console.log(`📊 Average Test Duration: ${summary.averageTestDuration}ms`);
    
    if (summary.failedTests.length > 0) {
      console.log('\\n❌ Failed Tests:');
      summary.failedTests.slice(0, 10).forEach(test => {
        console.log(`  • ${test.testId} (${test.functionId}): ${test.error}`);
      });
      
      if (summary.failedTests.length > 10) {
        console.log(`  ... and ${summary.failedTests.length - 10} more`);
      }
    }
    
    console.log('='.repeat(80));
  }

  async run(options = {}) {
    this.summary.startTime = Date.now();
    
    console.log('🚀 Starting PostgREST Test Suite');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`⚙️  Concurrency: ${CONFIG.maxConcurrency}`);
    console.log(`⏰ Timeout: ${CONFIG.timeoutMs}ms`);
    
    try {
      // Check connection
      const connected = await this.checkSupabaseConnection();
      if (!connected) {
        throw new Error('Cannot connect to Supabase instance');
      }

      // Load tests
      const tests = await this.loadTestManifest();
      
      // Filter tests if requested
      let filteredTests = tests;
      if (options.function) {
        filteredTests = tests.filter(t => t.functionId === options.function);
        this.log('INFO', `🔍 Filtered to ${filteredTests.length} tests for function: ${options.function}`);
      }
      
      if (options.testId) {
        filteredTests = tests.filter(t => t.testId === options.testId);
        this.log('INFO', `🔍 Filtered to ${filteredTests.length} tests for testId: ${options.testId}`);
      }

      // Run tests
      this.log('INFO', `🏃 Running ${filteredTests.length} tests...`);
      const results = await this.runTestsWithConcurrency(filteredTests);
      
      this.summary.endTime = Date.now();
      const summary = this.generateSummary(results);

      // Save and display results
      await this.saveResults(results, summary);
      this.printSummary(summary);

      return {
        success: summary.failed === 0,
        summary,
        results
      };

    } catch (err) {
      this.log('ERROR', '💥 Test suite failed:', err.message);
      throw err;
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--function':
      case '-f':
        options.function = args[++i];
        break;
      case '--test':
      case '-t':
        options.testId = args[++i];
        break;
      case '--verbose':
      case '-v':
        CONFIG.logLevel = 'DEBUG';
        break;
      case '--help':
      case '-h':
        console.log(`
PostgREST Test Suite Runner

Usage: node run-all-tests.js [options]

Options:
  -f, --function <name>   Run tests for specific function only
  -t, --test <id>         Run specific test only  
  -v, --verbose          Enable verbose logging
  -h, --help             Show this help message

Examples:
  node run-all-tests.js                    # Run all tests
  node run-all-tests.js -f select          # Run only select() tests (by function ID)
  node run-all-tests.js -t 001-getting-your-data  # Run specific test
  node run-all-tests.js -v                 # Run with verbose output
        `);
        process.exit(0);
    }
  }

  try {
    const runner = new TestRunner();
    const result = await runner.run(options);
    
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error('💥 Fatal error:', err.message);
    process.exit(1);
  }
}

// Export for programmatic use
export default TestRunner;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}