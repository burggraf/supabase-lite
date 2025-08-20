import { setEnvironment, getCurrentEnvironment } from './config.js'
import { runOnBothEnvironments, getSupabaseClient } from './supabase.js'
import { basicCrudTests } from './tests/basic-crud.js'
import { advancedQueryTests } from './tests/advanced-queries.js'
import { postgrestOperatorTests } from './tests/postgrest-operators.js'
import { rpcFunctionTests } from './tests/rpc-functions.js'
import { authTests } from './tests/auth-tests.js'
// import { worker } from './mocks/browser.js' // Disabled - using main app's MSW

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

// Global debugging functions removed since we're not using local AuthManager anymore
// Local tests now go directly to the main app on localhost:5173

// Sample App functions
window.switchTab = switchTab
window.signIn = signIn
window.signUp = signUp
window.signOut = signOut
window.forgotPassword = forgotPassword

// Order management functions
window.showAddOrderForm = showAddOrderForm
window.hideAddOrderForm = hideAddOrderForm
window.handleAddOrder = handleAddOrder
window.editOrder = editOrder
window.deleteOrder = deleteOrder

// Session management functions
window.checkExistingSession = checkExistingSession

// New simple tab functions  
window.showTestSuite = function() {
  document.getElementById('test-suite-tab').style.display = 'block';
  document.getElementById('sample-app-tab').style.display = 'none';
  const buttons = document.querySelectorAll('.tab-button');
  buttons[0].style.background = 'white';
  buttons[0].style.color = '#007bff';
  buttons[0].style.fontWeight = '600';
  buttons[1].style.background = '#f8f9fa';
  buttons[1].style.color = '#6c757d';
  buttons[1].style.fontWeight = 'normal';
}

window.showSampleApp = async function() {
  document.getElementById('test-suite-tab').style.display = 'none';
  document.getElementById('sample-app-tab').style.display = 'block';
  const buttons = document.querySelectorAll('.tab-button');
  buttons[1].style.background = 'white';
  buttons[1].style.color = '#007bff';
  buttons[1].style.fontWeight = '600';
  buttons[0].style.background = '#f8f9fa';
  buttons[0].style.color = '#6c757d';
  buttons[0].style.fontWeight = 'normal';
  
  // Check for existing session when switching to Sample App tab
  await checkExistingSession();
}

// Initialize MSW in test-app context with main app's handlers
// Each context needs its own MSW initialization even with shared service worker
// MSW initialization removed - test-app uses HTTP middleware from main app
function initializeMSW() {
  console.log('Test-app running independently - using HTTP middleware from main app')
  return Promise.resolve()
}

initializeMSW()

// Initialize environment switcher and check for existing session
document.addEventListener('DOMContentLoaded', async () => {
  const radios = document.querySelectorAll('input[name="environment"]')
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setEnvironment(e.target.value)
      console.log('Environment changed to:', e.target.value)
    })
  })
  
  // Check for existing session when page loads
  await checkExistingSession()
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

// Tab switching functionality
function switchTab(tabName) {
  // Remove active class from all tab buttons and content
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'))
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'))
  
  // Add active class to clicked tab button and corresponding content
  document.querySelector(`button[onclick="switchTab('${tabName}')"]`).classList.add('active')
  document.getElementById(`${tabName}-tab`).classList.add('active')
}

// Sample App state
let currentUser = null
let isAuthenticated = false

// Session management
async function checkExistingSession() {
  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    const { data: session, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error checking session:', error)
      return
    }
    
    if (session?.session?.user) {
      // User is already logged in
      currentUser = session.session.user
      isAuthenticated = true
      console.log('Found existing session for:', currentUser.email)
      await showOrdersSection()
    } else {
      // No active session
      showAuthSection()
    }
  } catch (error) {
    console.error('Error checking session:', error)
    showAuthSection()
  }
}

// Authentication functions
async function signIn() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  
  if (!email || !password) {
    showAuthMessage('Please enter both email and password', 'error')
    return
  }

  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    showAuthMessage('Signing in...', 'loading')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      showAuthMessage(`Sign in failed: ${error.message}`, 'error')
      return
    }

    if (data.user) {
      currentUser = data.user
      isAuthenticated = true
      showAuthMessage('Successfully signed in!', 'success')
      // Small delay to ensure session is established
      setTimeout(async () => {
        await showOrdersSection()
      }, 100)
    }
  } catch (error) {
    showAuthMessage(`Error: ${error.message}`, 'error')
  }
}

async function signUp() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  
  if (!email || !password) {
    showAuthMessage('Please enter both email and password', 'error')
    return
  }

  if (password.length < 6) {
    showAuthMessage('Password must be at least 6 characters long', 'error')
    return
  }

  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    showAuthMessage('Creating account...', 'loading')
    
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    })

    if (error) {
      showAuthMessage(`Sign up failed: ${error.message}`, 'error')
      return
    }

    if (data.user) {
      currentUser = data.user
      isAuthenticated = true
      showAuthMessage('Account created successfully!', 'success')
      // Small delay to ensure session is established
      setTimeout(async () => {
        await showOrdersSection()
      }, 100)
    }
  } catch (error) {
    showAuthMessage(`Error: ${error.message}`, 'error')
  }
}

async function signOut() {
  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Sign out error:', error)
    }
    
    currentUser = null
    isAuthenticated = false
    showAuthSection()
    showAuthMessage('Successfully signed out', 'success')
  } catch (error) {
    console.error('Sign out error:', error)
    // Still clear the local state even if the API call fails
    currentUser = null
    isAuthenticated = false
    showAuthSection()
  }
}

async function forgotPassword() {
  const email = document.getElementById('email').value
  
  if (!email) {
    showAuthMessage('Please enter your email address first', 'error')
    return
  }

  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    showAuthMessage('Sending reset email...', 'loading')
    
    const { error } = await supabase.auth.resetPasswordForEmail(email)

    if (error) {
      showAuthMessage(`Reset failed: ${error.message}`, 'error')
      return
    }

    showAuthMessage('Password reset email sent! Check your inbox.', 'success')
  } catch (error) {
    showAuthMessage(`Error: ${error.message}`, 'error')
  }
}

// UI helper functions
function showAuthMessage(message, type) {
  const messageDiv = document.getElementById('auth-message')
  if (!messageDiv) return
  
  messageDiv.className = type === 'error' ? 'error-message' : 
                        type === 'success' ? 'success-message' : 
                        type === 'loading' ? 'status-badge loading' : ''
  messageDiv.textContent = message
  messageDiv.style.display = 'block'
  
  // Clear message after 5 seconds for success/error messages
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      messageDiv.textContent = ''
      messageDiv.className = ''
      messageDiv.style.display = 'none'
    }, 5000)
  }
}

function showAuthSection() {
  // In the new structure, we need to show the login form and hide orders
  const loginForm = document.querySelector('.login-form')
  const ordersSection = document.getElementById('orders-section')
  
  if (loginForm) loginForm.style.display = 'block'
  if (ordersSection) ordersSection.style.display = 'none'
  
  // Clear form
  const emailField = document.getElementById('email')
  const passwordField = document.getElementById('password')
  const authMessage = document.getElementById('auth-message')
  
  if (emailField) emailField.value = ''
  if (passwordField) passwordField.value = ''
  if (authMessage) {
    authMessage.textContent = ''
    authMessage.style.display = 'none'
  }
}

async function showOrdersSection() {
  // In the new structure, hide the login form and show orders
  const loginForm = document.querySelector('.login-form')
  const ordersSection = document.getElementById('orders-section')
  
  if (loginForm) loginForm.style.display = 'none'
  if (ordersSection) ordersSection.style.display = 'block'
  
  // Update user info
  if (currentUser) {
    const userEmailElement = document.getElementById('user-email')
    const userDebugInfo = document.getElementById('user-debug-info')
    
    if (userEmailElement) {
      userEmailElement.textContent = `Logged in as: ${currentUser.email}`
    }
    
    if (userDebugInfo) {
      userDebugInfo.textContent = JSON.stringify(currentUser, null, 2)
    }
    
    // Load orders from API
    await loadOrders()
  }
}

async function loadOrders() {
  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    // Debug: Check current session
    const { data: session } = await supabase.auth.getSession()
    console.log('Current session when loading orders:', session)
    
    // Get orders for the current user
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading orders:', error)
      document.getElementById('orders-list').innerHTML = `
        <div class="error-message">
          Failed to load orders: ${error.message}
        </div>
      `
      return
    }
    
    // Display orders
    displayOrders(orders || [])
    
  } catch (error) {
    console.error('Error loading orders:', error)
    document.getElementById('orders-list').innerHTML = `
      <div class="error-message">
        Failed to load orders: ${error.message}
      </div>
    `
  }
}

function displayOrders(orders) {
  const ordersContainer = document.getElementById('orders-list')
  
  // Add header with "Add New Order" button
  let ordersHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3>My Orders</h3>
      <button onclick="showAddOrderForm()" style="background: #28a745;">Add New Order</button>
    </div>
    <div id="add-order-form" style="display: none; background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h4>Add New Order</h4>
      <form onsubmit="handleAddOrder(event)">
        <div style="margin-bottom: 15px;">
          <label>Product ID:</label>
          <input type="number" id="order-product-id" required placeholder="1" value="1" style="width: 100%; padding: 8px; margin-top: 5px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label>Quantity:</label>
          <input type="number" id="order-quantity" required placeholder="1" value="1" style="width: 100%; padding: 8px; margin-top: 5px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label>Status:</label>
          <select id="order-status" style="width: 100%; padding: 8px; margin-top: 5px;">
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="submit" style="background: #007bff;">Create Order</button>
          <button type="button" onclick="hideAddOrderForm()" style="background: #6c757d;">Cancel</button>
        </div>
      </form>
    </div>
  `
  
  if (!orders || orders.length === 0) {
    ordersHTML += `
      <div class="order-card">
        <p>No orders found. Create your first order using the "Add New Order" button above.</p>
      </div>
    `
  } else {
    ordersHTML += orders.map(order => `
      <div class="order-card" id="order-${order.id}">
        <div class="order-header">
          <span class="order-id">Order #${order.id}</span>
          <span class="order-status status-${order.status}">${capitalizeFirst(order.status)}</span>
          <div style="margin-left: auto;">
            <button onclick="editOrder(${order.id})" style="background: #ffc107; color: #000; padding: 5px 10px; font-size: 12px;">Edit</button>
            <button onclick="deleteOrder(${order.id})" style="background: #dc3545; padding: 5px 10px; font-size: 12px;">Delete</button>
          </div>
        </div>
        <p><strong>Product ID:</strong> ${order.product_id}</p>
        <p><strong>Quantity:</strong> ${order.quantity}</p>
        <p><strong>Date:</strong> ${formatDate(order.created_at)}</p>
      </div>
    `).join('')
  }
  
  ordersContainer.innerHTML = ordersHTML
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

// Order CRUD Operations
function showAddOrderForm() {
  document.getElementById('add-order-form').style.display = 'block'
}

function hideAddOrderForm() {
  document.getElementById('add-order-form').style.display = 'none'
  // Reset form
  document.getElementById('order-product-id').value = '1'
  document.getElementById('order-quantity').value = '1'
  document.getElementById('order-status').value = 'pending'
}

async function handleAddOrder(event) {
  event.preventDefault()
  
  const productId = parseInt(document.getElementById('order-product-id').value)
  const quantity = parseInt(document.getElementById('order-quantity').value)
  const status = document.getElementById('order-status').value
  
  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    // Insert new order - user_id will be automatically set by RLS in the enhanced bridge
    const { data, error } = await supabase
      .from('orders')
      .insert({
        product_id: productId,
        quantity: quantity,
        status: status
      })
      .select()
    
    if (error) {
      throw error
    }
    
    console.log('Order created:', data)
    hideAddOrderForm()
    await loadOrders() // Refresh the orders list
    
  } catch (error) {
    console.error('Error creating order:', error)
    alert(`Failed to create order: ${error.message}`)
  }
}

async function editOrder(orderId) {
  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    // Get current order data
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (error) {
      throw error
    }
    
    const order = orders
    
    // Populate form with current data
    document.getElementById('order-items').value = order.items || ''
    document.getElementById('order-total').value = order.total_price || 0
    document.getElementById('order-status').value = order.status || 'pending'
    
    // Show form and change submit handler
    showAddOrderForm()
    
    // Change form title and button text
    document.querySelector('#add-order-form h4').textContent = 'Edit Order'
    document.querySelector('#add-order-form button[type="submit"]').textContent = 'Update Order'
    
    // Change form handler to update instead of create
    const form = document.querySelector('#add-order-form form')
    form.onsubmit = (event) => handleUpdateOrder(event, orderId)
    
  } catch (error) {
    console.error('Error loading order for edit:', error)
    alert(`Failed to load order: ${error.message}`)
  }
}

async function handleUpdateOrder(event, orderId) {
  event.preventDefault()
  
  const items = document.getElementById('order-items').value
  const totalPrice = parseFloat(document.getElementById('order-total').value)
  const status = document.getElementById('order-status').value
  
  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    const { data, error } = await supabase
      .from('orders')
      .update({
        items: items,
        total_price: totalPrice,
        status: status
      })
      .eq('id', orderId)
      .select()
    
    if (error) {
      throw error
    }
    
    console.log('Order updated:', data)
    resetOrderForm()
    await loadOrders() // Refresh the orders list
    
  } catch (error) {
    console.error('Error updating order:', error)
    alert(`Failed to update order: ${error.message}`)
  }
}

async function deleteOrder(orderId) {
  if (!confirm('Are you sure you want to delete this order?')) {
    return
  }
  
  try {
    const environment = getCurrentEnvironment() || 'local'
    const supabase = getSupabaseClient(environment)
    
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
    
    if (error) {
      throw error
    }
    
    console.log('Order deleted:', orderId)
    await loadOrders() // Refresh the orders list
    
  } catch (error) {
    console.error('Error deleting order:', error)
    alert(`Failed to delete order: ${error.message}`)
  }
}

function resetOrderForm() {
  hideAddOrderForm()
  
  // Reset form title and button text
  document.querySelector('#add-order-form h4').textContent = 'Add New Order'
  document.querySelector('#add-order-form button[type="submit"]').textContent = 'Create Order'
  
  // Reset form handler
  const form = document.querySelector('#add-order-form form')
  form.onsubmit = handleAddOrder
}

// Initialize
console.log('Supabase Lite Compatibility Test Suite initialized')
console.log('Available tests:', Object.keys(allTests))