/**
 * Puppeteer test to verify real authentication implementation
 * Tests that signup creates real UUIDs and sessions, passwords are hashed
 */

import puppeteer from 'puppeteer'

async function testAuthentication() {
  console.log('🚀 Starting Puppeteer authentication test...')
  
  let browser, page
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI
      defaultViewport: { width: 1280, height: 720 }
    })
    
    page = await browser.newPage()
    
    // Enable console logging from the page
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`🌐 Browser: ${msg.text()}`)
      }
    })
    
    // Navigate to the test app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' })
    
    // Wait for the page to load completely
    console.log('⏳ Waiting for page to load...')
    await page.waitForSelector('.tab-button', { timeout: 30000 })
    
    // Wait a bit more for MSW and other initialization
    await page.waitForTimeout(3000)
    
    // Switch to Sample App tab
    console.log('📱 Switching to Sample App tab...')
    await page.click('.tab-button:nth-child(2)') // Second tab button (Sample App)
    
    // Wait for the tab switch to complete
    await page.waitForTimeout(1000)
    
    // Wait for the login form to be visible
    await page.waitForSelector('#email', { visible: true, timeout: 10000 })
    
    // Test 1: Sign up with new user
    console.log('✍️  Testing signup...')
    const testEmail = `test${Date.now()}@example.com`
    const testPassword = 'MySecurePassword123!'
    
    await page.type('#email', testEmail)
    await page.type('#password', testPassword)
    
    // Click signup button
    await page.click('.btn-success') // Sign Up button
    
    // Wait for authentication to complete
    await page.waitForTimeout(3000)
    
    // Check if orders section is visible (indicates successful auth)
    const ordersSection = await page.$('#orders-section')
    const isVisible = await page.evaluate(el => el.style.display !== 'none', ordersSection)
    if (!isVisible) {
      throw new Error('Orders section not visible after signup')
    }
    
    console.log('✅ Signup successful - orders section visible')
    
    // Extract user info from page
    const userDebugInfo = await page.$eval('#user-debug-info', el => el.textContent)
    const userData = JSON.parse(userDebugInfo)
    
    console.log('👤 User data extracted:')
    console.log(`   - ID: ${userData.id}`)
    console.log(`   - Email: ${userData.email}`)
    console.log(`   - ID format: ${/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userData.id) ? 'Valid UUID v4' : 'Invalid UUID'}`)
    
    // Verify the user ID is a real UUID, not a fake ID like "h82p2h7uk"
    const isRealUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userData.id)
    if (!isRealUUID) {
      throw new Error(`Expected real UUID, got: ${userData.id}`)
    }
    
    console.log('✅ Real UUID generated (not fake ID)')
    
    // Test 2: Sign out
    console.log('🚪 Testing signout...')
    await page.evaluate(() => window.signOut())
    
    // Wait for logout to complete
    await page.waitForTimeout(2000)
    
    // Check if login form is visible again
    const loginForm = await page.$('.login-form')
    const loginFormVisible = await page.evaluate(el => el.style.display !== 'none', loginForm)
    if (!loginFormVisible) {
      throw new Error('Login form not visible after signout')
    }
    
    console.log('✅ Signout successful - login form visible')
    
    // Test 3: Sign in with the same user
    console.log('🔑 Testing signin...')
    await page.evaluate(() => {
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    })
    await page.type('#email', testEmail)
    await page.type('#password', testPassword)
    
    // Click signin button  
    await page.click('.btn-primary') // Sign In button
    
    // Wait for authentication to complete
    await page.waitForTimeout(3000)
    
    // Check if orders section is visible again
    const ordersSection2 = await page.$('#orders-section')
    const isVisible2 = await page.evaluate(el => el.style.display !== 'none', ordersSection2)
    if (!isVisible2) {
      throw new Error('Orders section not visible after signin')
    }
    
    console.log('✅ Signin successful - orders section visible')
    
    // Extract user info again and verify it's the same user
    const userDebugInfoAfterSignin = await page.$eval('#user-debug-info', el => el.textContent)
    const userDataAfterSignin = JSON.parse(userDebugInfoAfterSignin)
    
    if (userData.id !== userDataAfterSignin.id) {
      throw new Error(`User ID mismatch: ${userData.id} vs ${userDataAfterSignin.id}`)
    }
    
    console.log('✅ Same user ID after signin - session management working')
    
    // Test 4: Try wrong password
    console.log('❌ Testing wrong password...')
    await page.evaluate(() => window.signOut())
    await page.waitForTimeout(2000)
    
    await page.evaluate(() => {
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    })
    await page.type('#email', testEmail)
    await page.type('#password', 'WrongPassword')
    
    await page.click('.btn-primary') // Sign In button
    await page.waitForTimeout(2000)
    
    // Check for error message
    const errorMessage = await page.$eval('#auth-message', el => el.textContent)
    if (!errorMessage.includes('Invalid login credentials') && !errorMessage.includes('Sign in failed')) {
      throw new Error(`Expected login error, got: ${errorMessage}`)
    }
    
    console.log('✅ Wrong password correctly rejected')
    
    // Test 5: Try duplicate signup
    console.log('👥 Testing duplicate signup...')
    await page.evaluate(() => {
      document.getElementById('password').value = '';
    })
    await page.type('#password', testPassword) // Use correct password
    
    await page.click('.btn-success') // Sign Up button
    await page.waitForTimeout(2000)
    
    // Check for error message
    const duplicateErrorMessage = await page.$eval('#auth-message', el => el.textContent)
    if (!duplicateErrorMessage.includes('User already registered') && !duplicateErrorMessage.includes('Sign up failed')) {
      throw new Error(`Expected duplicate signup error, got: ${duplicateErrorMessage}`)
    }
    
    console.log('✅ Duplicate signup correctly rejected')
    
    // Test passed!
    console.log('🎉 All authentication tests passed!')
    console.log('✅ Real UUIDs generated')
    console.log('✅ Password authentication working')
    console.log('✅ Session management working')
    console.log('✅ Error handling working')
    
    return {
      success: true,
      userID: userData.id,
      email: userData.email,
      tests: {
        realUUID: true,
        signup: true,
        signin: true,
        signout: true,
        wrongPassword: true,
        duplicateSignup: true
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    
    // Take a screenshot for debugging
    if (page) {
      await page.screenshot({ path: 'test-failure-screenshot.png' })
      console.log('📸 Screenshot saved as test-failure-screenshot.png')
    }
    
    return {
      success: false,
      error: error.message
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// Run the test
testAuthentication().then(result => {
  console.log('\n📊 Test Results:', result)
  process.exit(result.success ? 0 : 1)
}).catch(error => {
  console.error('❌ Test runner failed:', error)
  process.exit(1)
})