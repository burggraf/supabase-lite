#!/usr/bin/env node

/**
 * Test Summary Generator
 * Generates a comprehensive test coverage summary for both main app and supabase-lite package
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function getEmoji(percentage) {
  if (percentage >= 90) return '🟢';
  if (percentage >= 75) return '🟡';
  if (percentage >= 60) return '🟠';
  return '🔴';
}

function formatPercentage(pct, covered, total) {
  const emoji = getEmoji(pct);
  const color = pct >= 75 ? 'green' : pct >= 60 ? 'yellow' : 'red';
  return `${emoji} ${colorize(`${pct.toFixed(1)}%`, color)} (${covered}/${total})`;
}

function readCoverageData(coveragePath) {
  try {
    const summaryPath = path.join(coveragePath, 'coverage-summary.json');
    if (!fs.existsSync(summaryPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch (error) {
    console.error(`Error reading coverage from ${coveragePath}:`, error.message);
    return null;
  }
}

function countTestFiles(testDir) {
  if (!fs.existsSync(testDir)) {
    return { total: 0, files: [] };
  }

  const files = [];
  
  function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
        files.push(fullPath);
      }
    }
  }
  
  scanDirectory(testDir);
  return { total: files.length, files };
}

function generateSummary() {
  console.log(colorize('\n📊 Supabase Lite Test Coverage Summary', 'bright'));
  console.log(colorize('=' .repeat(50), 'blue'));

  // Main Application Coverage
  console.log(colorize('\n🎯 Main Application', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));
  
  const mainCoverageData = readCoverageData(path.join(projectRoot, 'coverage'));
  const mainTestFiles = countTestFiles(path.join(projectRoot, 'src'));
  
  console.log(`Test Files: ${colorize(mainTestFiles.total.toString(), 'blue')}`);
  
  if (mainCoverageData && mainCoverageData.total) {
    const { total } = mainCoverageData;
    console.log(`Lines:      ${formatPercentage(total.lines.pct, total.lines.covered, total.lines.total)}`);
    console.log(`Functions:  ${formatPercentage(total.functions.pct, total.functions.covered, total.functions.total)}`);
    console.log(`Branches:   ${formatPercentage(total.branches.pct, total.branches.covered, total.branches.total)}`);
    console.log(`Statements: ${formatPercentage(total.statements.pct, total.statements.covered, total.statements.total)}`);
  } else {
    console.log(colorize('❌ No coverage data found. Run `npm run test:coverage` first.', 'red'));
  }

  // Supabase Lite Package Coverage
  console.log(colorize('\n📦 Supabase Lite Package', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));
  
  const packageCoverageData = readCoverageData(path.join(projectRoot, 'packages/supabase-lite/coverage'));
  const packageTestFiles = countTestFiles(path.join(projectRoot, 'packages/supabase-lite/tests'));
  
  console.log(`Test Files: ${colorize(packageTestFiles.total.toString(), 'blue')}`);
  
  if (packageCoverageData && packageCoverageData.total) {
    const { total } = packageCoverageData;
    console.log(`Lines:      ${formatPercentage(total.lines.pct, total.lines.covered, total.lines.total)}`);
    console.log(`Functions:  ${formatPercentage(total.functions.pct, total.functions.covered, total.functions.total)}`);
    console.log(`Branches:   ${formatPercentage(total.branches.pct, total.branches.covered, total.branches.total)}`);
    console.log(`Statements: ${formatPercentage(total.statements.pct, total.statements.covered, total.statements.total)}`);
  } else {
    console.log(colorize('❌ No coverage data found. Run `npm run test:coverage` in packages/supabase-lite first.', 'red'));
  }

  // Coverage Targets
  console.log(colorize('\n🎯 Coverage Targets', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));
  console.log(`Main App:     Lines ${colorize('75%', 'yellow')}, Functions ${colorize('80%', 'yellow')}, Branches ${colorize('75%', 'yellow')}`);
  console.log(`Package:      Lines ${colorize('80%', 'yellow')}, Functions ${colorize('85%', 'yellow')}, Branches ${colorize('80%', 'yellow')}`);

  // Test Categories
  console.log(colorize('\n🧪 Test Categories', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));
  
  const categories = [
    'Unit Tests (components, hooks, utilities)',
    'Integration Tests (user workflows)',
    'Performance Tests (database, queries)',
    'API Tests (REST endpoints, authentication)',
    'UI Tests (component interactions)'
  ];
  
  categories.forEach(category => {
    console.log(`✅ ${category}`);
  });

  // Quick Commands
  console.log(colorize('\n🚀 Quick Commands', 'bright'));
  console.log(colorize('-'.repeat(30), 'cyan'));
  console.log(`Run all tests:           ${colorize('npm test', 'green')}`);
  console.log(`Watch mode:              ${colorize('npm run test:watch', 'green')}`);
  console.log(`Coverage report:         ${colorize('npm run test:coverage', 'green')}`);
  console.log(`Integration tests:       ${colorize('npm run test:integration', 'green')}`);
  console.log(`Performance tests:       ${colorize('npm run test:performance', 'green')}`);
  console.log(`Package tests:           ${colorize('cd packages/supabase-lite && npm test', 'green')}`);

  console.log(colorize('\n' + '='.repeat(50), 'blue'));
  console.log(colorize('📝 For detailed coverage, open coverage/index.html in your browser', 'bright'));
  console.log(colorize('🔗 CI/CD integration available via GitHub Actions workflow', 'bright'));
  console.log('');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSummary();
}

export { generateSummary };