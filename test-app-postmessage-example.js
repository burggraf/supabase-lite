// Example of how to use PostMessage bridge with the deployed app

// In your test app, instead of using fetch directly:

async function makeApiCall(method, endpoint, body = null) {
  // Open the Supabase Lite app in a popup or iframe
  const supabaseWindow = window.open('https://supabase-lite.pages.dev', 'supabase-lite');
  
  // Wait for the app to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return new Promise((resolve, reject) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Listen for response
    const handleMessage = (event) => {
      if (event.origin !== 'https://supabase-lite.pages.dev') return;
      if (event.data.requestId !== requestId) return;
      
      window.removeEventListener('message', handleMessage);
      resolve(event.data);
    };
    
    window.addEventListener('message', handleMessage);
    
    // Send request to Supabase Lite
    supabaseWindow.postMessage({
      type: 'api-request',
      requestId,
      method,
      path: endpoint,
      body,
      headers: {
        'Content-Type': 'application/json'
      }
    }, 'https://supabase-lite.pages.dev');
    
    // Timeout after 10 seconds
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      reject(new Error('Request timeout'));
    }, 10000);
  });
}

// Usage:
// const response = await makeApiCall('GET', '/rest/v1/products');