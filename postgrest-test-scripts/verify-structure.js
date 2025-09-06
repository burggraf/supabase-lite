import fs from 'fs';
import path from 'path';

// Verify test suite structure and completeness
function verifyTestSuite() {
  console.log('🔍 Verifying PostgREST test suite structure...\n');

  let totalTests = 0;
  let totalFunctions = 0;
  const issues = [];

  // Check if manifest exists
  const manifestPath = './test-manifest.json';
  if (!fs.existsSync(manifestPath)) {
    issues.push('❌ Test manifest missing: test-manifest.json');
    return;
  }

  // Load manifest
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  totalTests = manifest.length;
  
  const functionIds = new Set(manifest.map(t => t.functionId));
  totalFunctions = functionIds.size;

  console.log(`📊 Expected: ${totalTests} tests across ${totalFunctions} functions`);

  // Check each function directory and test file
  let foundTests = 0;
  let foundFunctions = 0;
  
  for (const functionId of functionIds) {
    const functionDir = `./${functionId}`;
    foundFunctions++;
    
    if (!fs.existsSync(functionDir)) {
      issues.push(`❌ Missing function directory: ${functionId}/`);
      continue;
    }

    const functionTests = manifest.filter(t => t.functionId === functionId);
    console.log(`📁 ${functionId}/ (${functionTests.length} tests)`);
    
    for (const test of functionTests) {
      const testPath = `./${test.relativePath}`;
      
      if (!fs.existsSync(testPath)) {
        issues.push(`❌ Missing test file: ${testPath}`);
        continue;
      }
      
      // Basic file validation
      const content = fs.readFileSync(testPath, 'utf-8');
      const requiredElements = [
        'import { createClient }',
        'import { SUPABASE_CONFIG }',
        'async function runTest()',
        'export default runTest'
      ];
      
      for (const element of requiredElements) {
        if (!content.includes(element)) {
          issues.push(`⚠️  ${testPath}: Missing '${element}'`);
        }
      }
      
      foundTests++;
      console.log(`  ✅ ${test.fileName}`);
    }
  }

  // Check config file
  const configPath = './config/supabase-config.js';
  if (!fs.existsSync(configPath)) {
    issues.push('❌ Missing config file: config/supabase-config.js');
  } else {
    console.log('✅ Config file exists');
  }

  // Check master runner
  const runnerPath = './run-all-tests.js';
  if (!fs.existsSync(runnerPath)) {
    issues.push('❌ Missing runner: run-all-tests.js');
  } else {
    console.log('✅ Master runner exists');
  }

  // Check package.json
  const packagePath = './package.json';
  if (!fs.existsSync(packagePath)) {
    issues.push('❌ Missing package.json');
  } else {
    console.log('✅ Package.json exists');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`📊 Functions: ${foundFunctions}/${totalFunctions}`);
  console.log(`🧪 Tests: ${foundTests}/${totalTests}`);
  
  if (issues.length === 0) {
    console.log('✅ Test suite structure is complete and valid!');
    console.log('\n🚀 Ready to run tests with: npm test');
  } else {
    console.log(`❌ Found ${issues.length} issues:`);
    issues.forEach(issue => console.log(`  ${issue}`));
  }

  console.log('='.repeat(60));
  
  return issues.length === 0;
}

// Run verification
const isValid = verifyTestSuite();
process.exit(isValid ? 0 : 1);