import { setEnvironment, getCurrentEnvironment } from './config.js'
import { runOnBothEnvironments, getSupabaseClient } from './supabase.js'
import { basicCrudTests } from './tests/basic-crud.js'
import { advancedQueryTests } from './tests/advanced-queries.js'
import { postgrestOperatorTests } from './tests/postgrest-operators.js'
import { rpcFunctionTests } from './tests/rpc-functions.js'
import { authTests } from './tests/auth-tests.js'

// Combine all test suites
const allTests = {
  ...basicCrudTests,
  ...advancedQueryTests,
  ...postgrestOperatorTests,
  ...rpcFunctionTests,
  ...authTests
}

// Global functions for HTML buttons
window.runTest = runTest
window.runAllTests = runAllTests

// Initialize environment switcher
document.addEventListener('DOMContentLoaded', () => {
  const radios = document.querySelectorAll('input[name="environment"]')
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setEnvironment(e.target.value)
      console.log('Environment changed to:', e.target.value)
    })
  })
})

async function runTest(testName) {
  console.log(`Running test: ${testName}`)
  
  const environment = getCurrentEnvironment()
  const testFunction = allTests[testName]
  
  if (!testFunction) {
    console.error(`Test not found: ${testName}`)
    return
  }

  // Show loading state
  showLoadingState(testName)

  try {
    if (environment === 'both') {
      // Run on both environments for comparison
      const results = await runOnBothEnvironments(testFunction)
      displayComparisonResults(testName, results)
      updateCompatibilityMatrix(testName, results)
    } else {
      // Run on single environment
      const supabase = getSupabaseClient(environment)
      const result = await testFunction(supabase, environment)
      displaySingleResult(testName, result, environment)
    }
  } catch (error) {
    console.error(`Test ${testName} failed:`, error)
    displayError(testName, error)
  }
}

function showLoadingState(testName) {
  const category = getTestCategory(testName)
  const resultsContainer = document.getElementById(`${category}-results`)
  const localResult = document.getElementById(`${category}-local-result`)
  const remoteResult = document.getElementById(`${category}-remote-result`)
  
  if (resultsContainer) {
    resultsContainer.style.display = 'grid'
  }
  
  if (localResult) {
    localResult.innerHTML = '<div class="status-badge loading">Loading...</div>'
  }
  
  if (remoteResult) {
    remoteResult.innerHTML = '<div class="status-badge loading">Loading...</div>'
  }
}

function displayComparisonResults(testName, results) {
  const category = getTestCategory(testName)
  const localResult = document.getElementById(`${category}-local-result`)
  const remoteResult = document.getElementById(`${category}-remote-result`)
  
  if (localResult) {
    localResult.innerHTML = formatResult(results.local, 'local')
  }
  
  if (remoteResult) {
    remoteResult.innerHTML = formatResult(results.remote, 'remote')
  }
}

function displaySingleResult(testName, result, environment) {
  const category = getTestCategory(testName)
  const resultsContainer = document.getElementById(`${category}-results`)
  
  if (resultsContainer) {
    resultsContainer.style.display = 'block'
    resultsContainer.innerHTML = `
      <div class="result-panel">
        <div class="result-header">${environment.charAt(0).toUpperCase() + environment.slice(1)} Result</div>
        <div class="result-content">${formatResult(result, environment)}</div>
      </div>
    `
  }
}

function displayError(testName, error) {
  const category = getTestCategory(testName)
  const resultsContainer = document.getElementById(`${category}-results`)
  
  if (resultsContainer) {
    resultsContainer.style.display = 'block'
    resultsContainer.innerHTML = `
      <div class="result-panel">
        <div class="result-header error">Error</div>
        <div class="result-content">
          <div class="status-badge error">Error</div>
          <pre>${JSON.stringify({ error: error.message, stack: error.stack }, null, 2)}</pre>
        </div>
      </div>
    `
  }
}

function formatResult(result, environment) {
  if (!result) {
    return '<div class="status-badge error">No result</div>'
  }

  const hasError = result.error
  const statusClass = hasError ? 'error' : 'success'
  const statusText = hasError ? 'Error' : 'Success'

  // Create summary
  let summary = `<div class="status-badge ${statusClass}">${statusText}</div>`
  
  if (result.count !== undefined) {
    summary += ` <span class="info">Records: ${result.count}</span>`
  }
  
  if (result.status) {
    summary += ` <span class="info">HTTP ${result.status}</span>`
  }

  // Create detailed view
  const details = {
    operation: result.operation,
    timestamp: result.timestamp,
    data: result.data,
    error: result.error,
    status: result.status,
    ...result
  }

  // Remove redundant fields for cleaner display
  delete details.timestamp

  return `
    ${summary}
    <pre>${JSON.stringify(details, null, 2)}</pre>
  `
}

function getTestCategory(testName) {
  if (testName.startsWith('basic-')) return 'basic'
  if (testName.startsWith('select-') || testName.startsWith('filters-') || testName.startsWith('ordering') || testName.startsWith('pagination') || testName.startsWith('count')) return 'advanced'
  if (testName.startsWith('operators-')) return 'operators'
  if (testName.startsWith('rpc-')) return 'rpc'
  if (testName.startsWith('auth_')) return 'auth'
  return 'basic'
}

function updateCompatibilityMatrix(testName, results) {
  const matrix = document.getElementById('compatibility-matrix')
  if (!matrix) return

  const category = getTestCategory(testName)
  const localOk = results.local && !results.local.error
  const remoteOk = results.remote && !results.remote.error
  const compatible = localOk && remoteOk && compareResults(results.local, results.remote)

  // Find the matrix item for this category
  const items = matrix.children
  for (let item of items) {
    if (item.textContent.toLowerCase().includes(category)) {
      item.className = `matrix-item ${compatible ? 'matrix-pass' : 'matrix-fail'}`
      item.textContent = `${item.textContent.split(':')[0]}: ${compatible ? 'Compatible' : 'Issues Found'}`
      break
    }
  }
}

function compareResults(local, remote) {
  // Basic compatibility check - both should succeed or both should fail
  const localSuccess = !local.error
  const remoteSuccess = !remote.error
  
  if (localSuccess !== remoteSuccess) {
    return false // One succeeded, one failed
  }

  if (localSuccess && remoteSuccess) {
    // Both succeeded - check if data structures are similar
    const localDataLength = local.data?.length || 0
    const remoteDataLength = remote.data?.length || 0
    
    // Allow for some differences in data length (test data might be different)
    return Math.abs(localDataLength - remoteDataLength) <= 5
  }

  // Both failed - that's also a form of compatibility
  return true
}

async function runAllTests() {
  console.log('Running all compatibility tests...')
  
  const testNames = Object.keys(allTests)
  const originalEnvironment = getCurrentEnvironment()
  
  // Set to both environments for comprehensive testing
  setEnvironment('both')
  document.querySelector('input[value="both"]').checked = true
  
  // Run tests with a small delay between each
  for (const testName of testNames) {
    await runTest(testName)
    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  // Restore original environment
  setEnvironment(originalEnvironment)
  console.log('All tests completed!')
}

// Initialize
console.log('Supabase Lite Compatibility Test Suite initialized')
console.log('Available tests:', Object.keys(allTests))