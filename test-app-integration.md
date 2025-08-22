# How to Connect Your Test App to Supabase Lite Production

## The Problem
MSW (Mock Service Worker) only intercepts requests from within the same browser context. 
Cross-origin requests from your test app to `supabase-lite.pages.dev` cannot be intercepted by MSW.

## Solution 1: PostMessage Bridge (Recommended)

### Step 1: Update your test app to use PostMessage
Replace direct fetch calls with PostMessage communication:

```javascript
// In your test app (localhost:5173)
class SupabaseLiteClient {
  constructor() {
    this.targetOrigin = 'https://supabase-lite.pages.dev';
    this.pendingRequests = new Map();
    this.setupMessageListener();
    
    // Open Supabase Lite in iframe or popup
    this.setupConnection();
  }
  
  setupConnection() {
    // Option A: Use iframe (recommended)
    this.iframe = document.createElement('iframe');
    this.iframe.src = this.targetOrigin;
    this.iframe.style.display = 'none';
    document.body.appendChild(this.iframe);
    
    // Option B: Use popup window
    // this.targetWindow = window.open(this.targetOrigin, 'supabase-lite');
  }
  
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.targetOrigin) return;
      
      const { requestId, data, error, status } = event.data;
      const pending = this.pendingRequests.get(requestId);
      
      if (pending) {
        this.pendingRequests.delete(requestId);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve({ data, status });
        }
      }
    });
  }
  
  async apiCall(method, path, body = null) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Send request via PostMessage
      const target = this.iframe?.contentWindow || this.targetWindow;
      target?.postMessage({
        type: 'api-request',
        requestId,
        method,
        path,
        body,
        headers: { 'Content-Type': 'application/json' }
      }, this.targetOrigin);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }
}

// Usage in your test app
const client = new SupabaseLiteClient();
const products = await client.apiCall('GET', '/rest/v1/products');
```

### Step 2: Ensure CrossOriginAPIHandler is working
The main Supabase Lite app already has the `CrossOriginAPIHandler` that listens for PostMessage requests.

## Solution 2: Run Test App on Same Origin
Deploy your test app to the same domain (e.g., as a subdirectory of supabase-lite.pages.dev).

## Solution 3: Development Only
Keep external API testing for development only and use in-browser testing for production.