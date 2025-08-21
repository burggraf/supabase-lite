// Simple test server on port 5174 to test cross-port API access
const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.writeHead(200);
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Cross-Port Test App</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .test-button { background: #007bff; color: white; border: none; padding: 10px 20px; margin: 10px; border-radius: 4px; cursor: pointer; }
        .test-button:hover { background: #0056b3; }
        .result { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .success { border-color: #28a745; background: #d4edda; }
        .error { border-color: #dc3545; background: #f8d7da; }
    </style>
</head>
<body>
    <h1>🧪 Cross-Port Test App (Port 5174)</h1>
    <p>Testing API calls from port 5174 to Supabase Lite on port 5173</p>
    
    <div>
        <button class="test-button" onclick="testGet()">Test GET /rest/v1/products</button>
        <button class="test-button" onclick="testPost()">Test POST /rest/v1/products</button>
        <button class="test-button" onclick="testAuth()">Test Auth Endpoint</button>
    </div>
    
    <div id="results"></div>
    
    <script>
        const API_BASE = 'http://localhost:5173';
        
        function addResult(title, data, success = true) {
            const results = document.getElementById('results');
            const div = document.createElement('div');
            div.className = 'result ' + (success ? 'success' : 'error');
            div.innerHTML = '<h3>' + title + '</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
            results.appendChild(div);
        }
        
        async function testGet() {
            try {
                console.log('Testing GET request...');
                const response = await fetch(API_BASE + '/rest/v1/products?select=*');
                const data = await response.json();
                addResult('✅ GET /rest/v1/products', {
                    status: response.status,
                    data: data
                }, true);
            } catch (error) {
                addResult('❌ GET /rest/v1/products', {
                    error: error.message
                }, false);
            }
        }
        
        async function testPost() {
            try {
                console.log('Testing POST request...');
                const response = await fetch(API_BASE + '/rest/v1/products', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'Cross-port Product',
                        price: 99.99
                    })
                });
                const data = await response.json();
                addResult('✅ POST /rest/v1/products', {
                    status: response.status,
                    data: data
                }, true);
            } catch (error) {
                addResult('❌ POST /rest/v1/products', {
                    error: error.message
                }, false);
            }
        }
        
        async function testAuth() {
            try {
                console.log('Testing auth endpoint...');
                const response = await fetch(API_BASE + '/auth/v1/user');
                const data = await response.json();
                addResult('✅ GET /auth/v1/user', {
                    status: response.status,
                    data: data
                }, true);
            } catch (error) {
                addResult('❌ GET /auth/v1/user', {
                    error: error.message
                }, false);
            }
        }
        
        // Auto-run a test on page load
        setTimeout(() => {
            console.log('Running initial test...');
            testGet();
        }, 1000);
    </script>
</body>
</html>
  `;
  
  res.end(html);
});

server.listen(5174, () => {
  console.log('🚀 Test server running on http://localhost:5174');
  console.log('   This app will test API calls to Supabase Lite on port 5173');
});