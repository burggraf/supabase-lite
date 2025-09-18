import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebVMManager } from '../WebVMManager'
import { RuntimeEnvironment } from '../RuntimeEnvironment'
import { ProcessManager } from '../ProcessManager'
import { type RuntimeMetadata } from '../types'

describe('WebVM Integration Tests', () => {
  let webvmManager: WebVMManager
  let runtimeEnv: RuntimeEnvironment
  let processManager: ProcessManager

  beforeEach(async () => {
    // Reset singleton
    ;(WebVMManager as any).instance = null

    // Initialize WebVM system with mock provider
    webvmManager = WebVMManager.getInstance({
      type: 'mock',
      mock: {
        simulateLatency: false,
        errorRate: 0,
        minLatency: 1,
        maxLatency: 5,
        testMode: true
      }
    })

    await webvmManager.initialize()

    processManager = new ProcessManager(webvmManager)
    runtimeEnv = new RuntimeEnvironment('test-app-id', 'node', '18.0.0', webvmManager)
  })

  afterEach(async () => {
    try {
      await webvmManager.shutdown()
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  })

  describe('End-to-End Application Deployment and HTTP Proxy', () => {
    it('should deploy and serve a Node.js application end-to-end', async () => {
      // Prepare application files
      const appFiles = new Map<string, string>([
        ['package.json', JSON.stringify({
          name: 'test-app',
          main: 'server.js',
          scripts: {
            start: 'node server.js'
          },
          dependencies: {
            express: '^4.18.0'
          }
        })],
        ['server.js', `
          const express = require('express');
          const app = express();
          const port = process.env.PORT || 3000;

          app.use(express.json());

          app.get('/', (req, res) => {
            res.json({ message: 'Hello from WebVM!', timestamp: new Date().toISOString() });
          });

          app.get('/api/status', (req, res) => {
            res.json({ status: 'running', uptime: process.uptime() });
          });

          app.post('/api/echo', (req, res) => {
            res.json({ echo: req.body, received: new Date().toISOString() });
          });

          app.listen(port, () => {
            console.log(\`Server running on port \${port}\`);
          });
        `],
        ['README.md', '# Test Application\n\nA simple Express.js application for testing WebVM deployment.']
      ])

      const metadata: RuntimeMetadata = {
        appId: 'integration-test-app',
        entryPoint: 'server.js',
        environmentVariables: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        workingDirectory: '/app'
      }

      // Deploy application
      await runtimeEnv.deploy(appFiles, metadata)

      // Get runtime status after deployment
      const deployedRuntime = await runtimeEnv.getStatus()
      expect(deployedRuntime).toBeDefined()
      expect(deployedRuntime.runtime.type).toBe('node')
      expect(deployedRuntime.runtime.status).toBe('running')
      expect(deployedRuntime.runtime.metadata.appId).toBe('integration-test-app')

      // Wait for application startup
      await new Promise(resolve => setTimeout(resolve, 100))

      // Test HTTP proxy requests
      
      // 1. Test GET request to root
      const rootRequest = new Request('http://localhost:3000/')
      const rootResponse = await runtimeEnv.proxyRequest(rootRequest)
      
      expect(rootResponse.status).toBe(200)
      const rootBody = await rootResponse.json()
      expect(rootBody).toMatchObject({
        message: 'Hello from WebVM!',
        timestamp: expect.any(String)
      })

      // 2. Test GET request to API endpoint
      const statusRequest = new Request('http://localhost:3000/api/status')
      const statusResponse = await runtimeEnv.proxyRequest(statusRequest)
      
      expect(statusResponse.status).toBe(200)
      const statusBody = await statusResponse.json()
      expect(statusBody).toMatchObject({
        status: 'running',
        uptime: expect.any(Number)
      })

      // 3. Test POST request with JSON body
      const echoRequest = new Request('http://localhost:3000/api/echo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: 'Test message from integration test',
          data: { key: 'value', numbers: [1, 2, 3] }
        })
      })
      
      const echoResponse = await runtimeEnv.proxyRequest(echoRequest)
      
      expect(echoResponse.status).toBe(200)
      const echoBody = await echoResponse.json()
      expect(echoBody).toMatchObject({
        echo: {
          message: 'Test message from integration test',
          data: { key: 'value', numbers: [1, 2, 3] }
        },
        received: expect.any(String)
      })

      // 4. Test 404 for unknown route
      const notFoundRequest = new Request('http://localhost:3000/unknown/route')
      const notFoundResponse = await runtimeEnv.proxyRequest(notFoundRequest)
      
      expect(notFoundResponse.status).toBe(404)
    })

    it('should deploy and serve a Python Flask application', async () => {
      // Prepare Python Flask application files
      const appFiles = new Map<string, string>([
        ['requirements.txt', 'flask==2.3.0\nwerkzeug==2.3.0'],
        ['app.py', `
import os
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)
port = int(os.environ.get('PORT', 5000))

@app.route('/')
def home():
    return jsonify({
        'message': 'Hello from Python Flask in WebVM!',
        'timestamp': datetime.now().isoformat(),
        'python_version': '3.9.0'
    })

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'flask-app',
        'version': '1.0.0'
    })

@app.route('/api/data', methods=['POST'])
def process_data():
    data = request.get_json()
    return jsonify({
        'processed': True,
        'input': data,
        'result': f"Processed {len(str(data))} characters",
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=port, debug=False)
        `],
        ['wsgi.py', `
from app import app

if __name__ == "__main__":
    app.run()
        `]
      ])

      const metadata: RuntimeMetadata = {
        appId: 'python-integration-test',
        entryPoint: 'app.py',
        environmentVariables: {
          FLASK_ENV: 'production',
          PORT: '5000'
        },
        workingDirectory: '/app'
      }

      // Deploy Python application  
      const pythonRuntimeEnv = new RuntimeEnvironment('python-integration-test', 'python', '3.9.0', webvmManager)
      await pythonRuntimeEnv.deploy(appFiles, metadata)

      // Get runtime status after deployment
      const deployedRuntime = await pythonRuntimeEnv.getStatus()
      expect(deployedRuntime).toBeDefined()
      expect(deployedRuntime.runtime.type).toBe('python')
      expect(deployedRuntime.runtime.status).toBe('running')
      expect(deployedRuntime.runtime.metadata.appId).toBe('python-integration-test')

      // Wait for Flask startup
      await new Promise(resolve => setTimeout(resolve, 150))

      // Test HTTP proxy requests to Python application

      // 1. Test GET request to home
      const homeRequest = new Request('http://localhost:5000/')
      const homeResponse = await pythonRuntimeEnv.proxyRequest(homeRequest)
      
      expect(homeResponse.status).toBe(200)
      const homeBody = await homeResponse.json()
      expect(homeBody).toMatchObject({
        message: 'Hello from Python Flask in WebVM!',
        timestamp: expect.any(String),
        python_version: '3.9.0'
      })

      // 2. Test health endpoint
      const healthRequest = new Request('http://localhost:5000/api/health')
      const healthResponse = await pythonRuntimeEnv.proxyRequest(healthRequest)
      
      expect(healthResponse.status).toBe(200)
      const healthBody = await healthResponse.json()
      expect(healthBody).toMatchObject({
        status: 'healthy',
        service: 'flask-app',
        version: '1.0.0'
      })

      // 3. Test POST request with data processing
      const dataRequest = new Request('http://localhost:5000/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Integration Test',
          values: [10, 20, 30],
          config: { enabled: true, mode: 'test' }
        })
      })
      
      const dataResponse = await pythonRuntimeEnv.proxyRequest(dataRequest)
      
      expect(dataResponse.status).toBe(200)
      const dataBody = await dataResponse.json()
      expect(dataBody).toMatchObject({
        processed: true,
        input: {
          name: 'Integration Test',
          values: [10, 20, 30],
          config: { enabled: true, mode: 'test' }
        },
        result: expect.stringContaining('Processed'),
        timestamp: expect.any(String)
      })
    })

    it('should handle multiple concurrent applications', async () => {
      // Deploy multiple applications concurrently
      const nodeApp = new Map([
        ['package.json', JSON.stringify({ name: 'node-app', main: 'index.js' })],
        ['index.js', `
          const http = require('http');
          const server = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ app: 'node', port: 3000, path: req.url }));
          });
          server.listen(3000);
        `]
      ])

      const pythonApp = new Map([
        ['requirements.txt', 'flask==2.3.0'],
        ['main.py', `
import json
from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return json.dumps({'app': 'python', 'port': 5000, 'framework': 'flask'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
        `]
      ])

      // Deploy both applications
      const nodeRuntimeEnv = new RuntimeEnvironment('concurrent-node-app', 'node', '18.0.0', webvmManager)
      const pythonRuntimeEnv = new RuntimeEnvironment('concurrent-python-app', 'python', '3.9.0', webvmManager)
      
      await Promise.all([
        nodeRuntimeEnv.deploy(nodeApp, {
          appId: 'concurrent-node-app',
          entryPoint: 'index.js',
          environmentVariables: { PORT: '3000' },
          workingDirectory: '/app'
        }),
        pythonRuntimeEnv.deploy(pythonApp, {
          appId: 'concurrent-python-app', 
          entryPoint: 'main.py',
          environmentVariables: { PORT: '5000' },
          workingDirectory: '/app'
        })
      ])

      // Get status after deployment
      const nodeStatus = await nodeRuntimeEnv.getStatus()
      const pythonStatus = await pythonRuntimeEnv.getStatus()
      
      expect(nodeStatus.runtime.status).toBe('running')
      expect(pythonStatus.runtime.status).toBe('running')

      // Wait for both apps to start
      await new Promise(resolve => setTimeout(resolve, 200))

      // Test requests to both applications
      const [nodeResponse, pythonResponse] = await Promise.all([
        runtimeEnv.proxyRequest(
          new Request('http://localhost:3000/test'),
          'concurrent-node-app'
        ),
        runtimeEnv.proxyRequest(
          new Request('http://localhost:5000/'),
          'concurrent-python-app'
        )
      ])

      expect(nodeResponse.status).toBe(200)
      const nodeBody = await nodeResponse.json()
      expect(nodeBody).toMatchObject({
        app: 'node',
        port: 3000,
        path: '/test'
      })

      expect(pythonResponse.status).toBe(200)
      const pythonBody = await pythonResponse.json()
      expect(pythonBody).toMatchObject({
        app: 'python',
        port: 5000,
        framework: 'flask'
      })
    })

    it('should handle application failures and recovery', async () => {
      // Deploy application that can be stopped/restarted
      const appFiles = new Map([
        ['package.json', JSON.stringify({ name: 'recovery-test', main: 'server.js' })],
        ['server.js', `
          const http = require('http');
          let requestCount = 0;
          
          const server = http.createServer((req, res) => {
            requestCount++;
            
            // Simulate failure after 3 requests
            if (requestCount > 3) {
              process.exit(1);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              status: 'ok', 
              requestCount,
              pid: process.pid 
            }));
          });
          
          server.listen(3000, () => console.log('Server started'));
        `]
      ])

      const metadata: RuntimeMetadata = {
        appId: 'recovery-test-app',
        entryPoint: 'server.js',
        environmentVariables: { NODE_ENV: 'test' },
        workingDirectory: '/app',
        autoRestart: true
      }

      await runtimeEnv.deploy(appFiles, metadata)
      
      const status = await runtimeEnv.getStatus()
      expect(status.runtime.status).toBe('running')

      await new Promise(resolve => setTimeout(resolve, 100))

      // Make requests to trigger failure
      for (let i = 0; i < 3; i++) {
        const response = await runtimeEnv.proxyRequest(
          new Request('http://localhost:3000/'),
          'recovery-test-app'
        )
        expect(response.status).toBe(200)
      }

      // Next request should trigger process exit
      const failureResponse = await runtimeEnv.proxyRequest(
        new Request('http://localhost:3000/'),
        'recovery-test-app'
      )
      
      // Should get service unavailable
      expect(failureResponse.status).toBe(503)

      // Test recovery attempt
      const recoverySuccessful = await runtimeEnv.attemptRecovery('recovery-test-app')
      expect(recoverySuccessful).toBe(true)

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify application is working again
      const recoveredResponse = await runtimeEnv.proxyRequest(
        new Request('http://localhost:3000/'),
        'recovery-test-app'
      )
      
      expect(recoveredResponse.status).toBe(200)
      const recoveredBody = await recoveredResponse.json()
      expect(recoveredBody).toMatchObject({
        status: 'ok',
        requestCount: 1 // Reset after restart
      })
    })

    it('should handle HTTP methods and headers correctly', async () => {
      // Deploy app that echoes request details
      const appFiles = new Map([
        ['package.json', JSON.stringify({ name: 'http-test', main: 'server.js' })],
        ['server.js', `
          const http = require('http');
          
          const server = http.createServer((req, res) => {
            let body = '';
            
            req.on('data', chunk => {
              body += chunk.toString();
            });
            
            req.on('end', () => {
              const response = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: body ? JSON.parse(body) : null,
                timestamp: new Date().toISOString()
              };
              
              res.writeHead(200, { 
                'Content-Type': 'application/json',
                'X-Custom-Header': 'WebVM-Response',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify(response));
            });
          });
          
          server.listen(3000);
        `]
      ])

      const runtime = await runtimeEnv.deploy(appFiles, {
        appId: 'http-test-app',
        entryPoint: 'server.js',
        environmentVariables: {},
        workingDirectory: '/app'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Test different HTTP methods
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      
      for (const method of methods) {
        const requestBody = method === 'GET' ? undefined : JSON.stringify({
          testData: `${method} request data`,
          timestamp: new Date().toISOString()
        })

        const request = new Request(`http://localhost:3000/api/${method.toLowerCase()}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Test-Header': `Test-${method}`,
            'User-Agent': 'WebVM-Integration-Test'
          },
          body: requestBody
        })

        const response = await runtimeEnv.proxyRequest(request, 'http-test-app')
        
        expect(response.status).toBe(200)
        expect(response.headers.get('X-Custom-Header')).toBe('WebVM-Response')
        
        const responseBody = await response.json()
        expect(responseBody).toMatchObject({
          method,
          url: `/api/${method.toLowerCase()}`,
          headers: expect.objectContaining({
            'x-test-header': `Test-${method}`,
            'user-agent': 'WebVM-Integration-Test'
          }),
          timestamp: expect.any(String)
        })

        if (method !== 'GET' && requestBody) {
          expect(responseBody.body).toMatchObject({
            testData: `${method} request data`,
            timestamp: expect.any(String)
          })
        }
      }
    })
  })

  describe('Process Management Integration', () => {
    it('should monitor and control application processes', async () => {
      // Deploy application
      const appFiles = new Map([
        ['package.json', JSON.stringify({ name: 'process-test', main: 'app.js' })],
        ['app.js', `
          const http = require('http');
          console.log('Application starting, PID:', process.pid);
          
          const server = http.createServer((req, res) => {
            console.log('Request received:', req.url);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ pid: process.pid, uptime: process.uptime() }));
          });
          
          server.listen(3000, () => {
            console.log('Server listening on port 3000');
          });
        `]
      ])

      await runtimeEnv.deploy(appFiles, {
        appId: 'process-monitoring-test',
        entryPoint: 'app.js',
        environmentVariables: {},
        workingDirectory: '/app'
      })

      await new Promise(resolve => setTimeout(resolve, 150))

      // Get runtime status and process information
      const status = await runtimeEnv.getStatus()
      const processes = await processManager.getProcesses(status.runtime.id)
      expect(processes.length).toBeGreaterThan(0)

      const nodeProcess = processes.find(p => p.command.includes('node'))
      expect(nodeProcess).toBeDefined()
      expect(nodeProcess.status).toBe('running')
      expect(nodeProcess.pid).toBeGreaterThan(0)

      // Test application health
      const isHealthy = await processManager.isProcessResponding(runtime.id, 3000)
      expect(isHealthy).toBe(true)

      // Make a request to generate logs
      await runtimeEnv.proxyRequest(
        new Request('http://localhost:3000/test'),
        'process-monitoring-test'
      )

      // Get process logs
      const logs = await processManager.getProcessLogs(runtime.id, nodeProcess.pid, 10)
      expect(logs.length).toBeGreaterThan(0)
      expect(logs.some(log => log.includes('Application starting'))).toBe(true)
      expect(logs.some(log => log.includes('Server listening'))).toBe(true)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle WebVM system errors gracefully', async () => {
      // Test with invalid application
      const invalidFiles = new Map([
        ['package.json', 'invalid json content {{{'],
        ['index.js', 'console.log("invalid syntax"']
      ])

      try {
        await runtimeEnv.deploy(invalidFiles, {
          appId: 'invalid-app',
          entryPoint: 'index.js',
          environmentVariables: {},
          workingDirectory: '/app'
        })
      } catch (error) {
        expect(error).toBeDefined()
        expect(error.message).toContain('Dependency installation failed')
      }

      // Test request to non-existent application
      const response = await runtimeEnv.proxyRequest(
        new Request('http://localhost:3000/'),
        'non-existent-app'
      )

      expect(response.status).toBe(404)
      const body = await response.json()
      expect(body.error).toBe('Application not found')
    })
  })
})