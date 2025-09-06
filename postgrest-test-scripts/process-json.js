import fs from 'fs';
import path from 'path';

const JSON_FILE = '../postgrest.test.json';
const BASE_DIR = './';

// Utility functions
const cleanMarkdownCodeBlock = (content) => {
  if (!content) return '';
  // Remove markdown code block syntax (```js, ```sql, ```json, etc.)
  return content.replace(/^```\w*\n?|```$/gm, '').trim();
};

const parseJsonFromMarkdown = (content) => {
  const cleaned = cleanMarkdownCodeBlock(content);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('Failed to parse JSON from markdown:', e.message);
    return null;
  }
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Create test script template
const createTestScript = (functionId, example, testNumber) => {
  const setupSql = cleanMarkdownCodeBlock(example.data?.sql || '');
  const testCode = cleanMarkdownCodeBlock(example.code || '');
  const expectedResponse = parseJsonFromMarkdown(example.response || '');
  
  return `import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../config/supabase-config.js';

// Test: ${example.name || example.id}
// Function: ${functionId}
// Example ID: ${example.id}

async function executeSetupSQL(sql) {
  if (!sql.trim()) return;
  
  const response = await fetch(SUPABASE_CONFIG.debugSqlEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  
  const result = await response.json();
  if (!result.success) {
    throw new Error(\`Setup SQL failed: \${result.error}\`);
  }
  return result;
}

async function runTest() {
  console.log('='.repeat(60));
  console.log(\`Running test: \${${testNumber}.toString().padStart(3, '0')}-${example.id}\`);
  console.log(\`Function: ${functionId}\`);
  console.log(\`Test: ${example.name || example.id}\`);
  console.log('='.repeat(60));

  try {
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

    // Setup SQL
    const setupSQL = \`${setupSql.replace(/`/g, '\\`')}\`;
    if (setupSQL.trim()) {
      console.log('📋 Executing setup SQL...');
      await executeSetupSQL(setupSQL);
      console.log('✅ Setup completed');
    }

    // Execute test code
    console.log('🧪 Executing test code...');
    ${testCode.replace(/`/g, '\\`')}

    // Expected response for comparison
    const expectedResponse = ${JSON.stringify(expectedResponse, null, 2)};

    // Basic validation
    if (data && expectedResponse && expectedResponse.data) {
      const dataMatches = JSON.stringify(data) === JSON.stringify(expectedResponse.data);
      console.log(\`✅ Test result: \${dataMatches ? 'PASS' : 'FAIL'}\`);
      
      if (!dataMatches) {
        console.log('📊 Expected:', JSON.stringify(expectedResponse.data, null, 2));
        console.log('📊 Actual:', JSON.stringify(data, null, 2));
      }
      
      return {
        testId: '${testNumber.toString().padStart(3, '0')}-${example.id}',
        functionId: '${functionId}',
        name: '${example.name || example.id}',
        passed: dataMatches,
        error: null,
        data: data,
        expected: expectedResponse.data
      };
    } else {
      console.log('⚠️  No expected response data to compare');
      return {
        testId: '${testNumber.toString().padStart(3, '0')}-${example.id}',
        functionId: '${functionId}',
        name: '${example.name || example.id}',
        passed: data ? true : false,
        error: error ? error.message : null,
        data: data,
        expected: expectedResponse ? expectedResponse.data : null
      };
    }

  } catch (err) {
    console.log(\`❌ Test failed with error: \${err.message}\`);
    return {
      testId: '${testNumber.toString().padStart(3, '0')}-${example.id}',
      functionId: '${functionId}',
      name: '${example.name || example.id}',
      passed: false,
      error: err.message,
      data: null,
      expected: expectedResponse ? expectedResponse.data : null
    };
  }
}

// Run the test
export default runTest;

// Allow running directly
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  runTest().then(result => {
    console.log('\\n📋 Final Result:', result);
    process.exit(result.passed ? 0 : 1);
  }).catch(err => {
    console.error('💥 Test runner error:', err);
    process.exit(1);
  });
}
`;
};

// Main processing function
async function processTestSuite() {
  console.log('🔄 Processing PostgREST test suite...');
  
  // Read and parse the JSON file
  const jsonContent = fs.readFileSync(JSON_FILE, 'utf-8');
  const functions = JSON.parse(jsonContent);
  
  console.log(`📊 Found ${functions.length} functions to process`);
  
  let testCounter = 1;
  const allTests = [];
  
  for (const func of functions) {
    console.log(`\n📁 Processing function: ${func.id}`);
    
    // Create directory for this function
    const functionDir = path.join(BASE_DIR, func.id);
    ensureDirectoryExists(functionDir);
    
    // Process each example
    const examples = func.examples || [];
    console.log(`  📝 Found ${examples.length} examples`);
    
    for (const example of examples) {
      const testFileName = `${testCounter.toString().padStart(3, '0')}-${example.id}.js`;
      const testFilePath = path.join(functionDir, testFileName);
      
      // Create test script
      const testScript = createTestScript(func.id, example, testCounter);
      fs.writeFileSync(testFilePath, testScript);
      
      console.log(`    ✅ Created: ${testFilePath}`);
      
      allTests.push({
        number: testCounter,
        functionId: func.id,
        exampleId: example.id,
        fileName: testFileName,
        relativePath: `${func.id}/${testFileName}`,
        name: example.name || example.id
      });
      
      testCounter++;
    }
  }
  
  console.log(`\n🎉 Generated ${testCounter - 1} test scripts across ${functions.length} functions`);
  
  return allTests;
}

// Export for use by master runner
export { processTestSuite };

// If running directly
if (process.argv[1] && process.argv[1].endsWith('process-json.js')) {
  processTestSuite().then(tests => {
    console.log(`\n🎯 Summary:`);
    console.log(`Total tests generated: ${tests.length}`);
    console.log(`Functions processed: ${new Set(tests.map(t => t.functionId)).size}`);
  }).catch(err => {
    console.error('Error processing test suite:', err);
    process.exit(1);
  });
}