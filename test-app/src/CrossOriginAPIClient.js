// Cross-origin API client for test app
// Sends API requests to main app via postMessage and receives responses

class CrossOriginAPIClient {
  constructor(mainAppOrigin = 'http://localhost:5173') {
    this.mainAppOrigin = mainAppOrigin;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.mainAppWindow = null;
    this.broadcastChannel = null;
    this.setupMessageListener();
    this.setupBroadcastChannel();
    this.connectToMainApp();
  }

  setupMessageListener() {
    window.addEventListener('message', (event) => {
      if (event.origin !== this.mainAppOrigin) return;
      
      const { type, data } = event.data;
      
      if (type === 'API_RESPONSE') {
        this.handleResponse(data);
      }
    });
  }

  setupBroadcastChannel() {
    try {
      this.broadcastChannel = new BroadcastChannel('supabase-api');
      this.broadcastChannel.addEventListener('message', (event) => {
        const { type, data } = event.data;
        
        if (type === 'API_RESPONSE') {
          this.handleResponse(data);
        }
      });
      console.log('CrossOriginAPIClient: BroadcastChannel setup complete');
    } catch (error) {
      console.warn('BroadcastChannel not available:', error);
    }
  }

  handleResponse(data) {
    const { requestId, ...response } = data;
    const pendingRequest = this.pendingRequests.get(requestId);
    
    if (pendingRequest) {
      if (response.error) {
        pendingRequest.reject(new Error(response.error));
      } else {
        pendingRequest.resolve(response);
      }
      this.pendingRequests.delete(requestId);
    }
  }

  async connectToMainApp() {
    // Try to find main app window
    try {
      // Open a reference to the main app window if not already open
      this.mainAppWindow = window.open(this.mainAppOrigin, 'mainApp');
      console.log('Connected to main app window');
    } catch (error) {
      console.warn('Could not open main app window, will try postMessage to parent/opener');
    }
  }

  async makeRequest(method, path, body = null, headers = {}) {
    const requestId = (this.requestId++).toString();
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      const request = {
        type: 'API_REQUEST',
        data: {
          method,
          path,
          body,
          headers,
          requestId
        }
      };
      
      // Try multiple ways to send the message
      let messageSent = false;
      
      // Try main app window
      if (this.mainAppWindow && !this.mainAppWindow.closed) {
        try {
          this.mainAppWindow.postMessage(request, this.mainAppOrigin);
          messageSent = true;
        } catch (error) {
          console.warn('Failed to send message to main app window:', error);
        }
      }
      
      // Try parent window
      if (!messageSent && window.parent !== window) {
        try {
          window.parent.postMessage(request, this.mainAppOrigin);
          messageSent = true;
        } catch (error) {
          console.warn('Failed to send message to parent window:', error);
        }
      }
      
      // Try opener window
      if (!messageSent && window.opener) {
        try {
          window.opener.postMessage(request, this.mainAppOrigin);
          messageSent = true;
        } catch (error) {
          console.warn('Failed to send message to opener window:', error);
        }
      }
      
      // Try broadcasting to all windows (last resort)
      if (!messageSent) {
        try {
          // Use BroadcastChannel if available
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('supabase-api');
            channel.postMessage(request);
            channel.close();
            messageSent = true;
          }
        } catch (error) {
          console.warn('Failed to send message via BroadcastChannel:', error);
        }
      }
      
      if (!messageSent) {
        this.pendingRequests.delete(requestId);
        reject(new Error('Could not send message to main app'));
        return;
      }
      
      console.log(`📤 Cross-origin API: ${method} ${path}`);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // Supabase-compatible API methods
  async get(path, headers = {}) {
    return this.makeRequest('GET', path, null, headers);
  }

  async post(path, body, headers = {}) {
    return this.makeRequest('POST', path, body, headers);
  }

  async patch(path, body, headers = {}) {
    return this.makeRequest('PATCH', path, body, headers);
  }

  async delete(path, headers = {}) {
    return this.makeRequest('DELETE', path, null, headers);
  }
}

// Export as ES module
export default CrossOriginAPIClient;