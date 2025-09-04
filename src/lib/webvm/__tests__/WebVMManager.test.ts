/**
 * WebVM Manager Tests
 * 
 * These tests define the expected behavior of the WebVM integration
 * for browser-native Edge Functions execution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebVMManager, WebVMStatus, WebVMConfig, FunctionDeployment } from '../WebVMManager'
import { FunctionInvocation, FunctionResponse } from '../types'

describe('WebVMManager', () => {
  let webvmManager: WebVMManager
  
  beforeEach(() => {
    webvmManager = WebVMManager.getInstance()
  })
  
  afterEach(() => {
    // Reset singleton instance for clean test isolation
    ;(WebVMManager as any).instance = undefined
    vi.clearAllMocks()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance across multiple calls', () => {
      const instance1 = WebVMManager.getInstance()
      const instance2 = WebVMManager.getInstance()
      
      expect(instance1).toBe(instance2)
    })
  })

  describe('WebVM Lifecycle Management', () => {
    it('should start with stopped status', () => {
      const status = webvmManager.getStatus()
      
      expect(status.state).toBe('stopped')
      expect(status.ready).toBe(false)
      expect(status.error).toBeNull()
    })

    it('should start WebVM and update status to starting', async () => {
      const startPromise = webvmManager.start()
      
      // Should immediately update to starting state
      const status = webvmManager.getStatus()
      expect(status.state).toBe('starting')
      expect(status.ready).toBe(false)
      
      await startPromise
    })

    it('should complete WebVM startup and update status to running', async () => {
      await webvmManager.start()
      
      const status = webvmManager.getStatus()
      expect(status.state).toBe('running')
      expect(status.ready).toBe(true)
      expect(status.deno.available).toBe(true)
      expect(status.network.connected).toBe(true)
    })

    it('should stop WebVM and update status to stopped', async () => {
      await webvmManager.start()
      await webvmManager.stop()
      
      const status = webvmManager.getStatus()
      expect(status.state).toBe('stopped')
      expect(status.ready).toBe(false)
    })

    it('should restart WebVM maintaining deployed functions', async () => {
      await webvmManager.start()
      await webvmManager.deployFunction('test-func', 'console.log("test")')
      
      await webvmManager.restart()
      
      const status = webvmManager.getStatus()
      expect(status.state).toBe('running')
      expect(status.functions.deployed).toContain('test-func')
    })

    it('should handle WebVM startup failures gracefully', async () => {
      // Mock WebVM startup failure
      vi.spyOn(webvmManager as any, 'initializeWebVM').mockRejectedValue(
        new Error('WebVM failed to start')
      )
      
      await expect(webvmManager.start()).rejects.toThrow('WebVM failed to start')
      
      const status = webvmManager.getStatus()
      expect(status.state).toBe('error')
      expect(status.error).toContain('WebVM failed to start')
    })
  })

  describe('Configuration Management', () => {
    it('should accept and store WebVM configuration', () => {
      const config: WebVMConfig = {
        memory: '2G',
        cpu: 2,
        networking: {
          enabled: true,
          tailscale: {
            authKey: 'test-key'
          }
        },
        storage: {
          persistent: true,
          size: '1G'
        }
      }
      
      webvmManager.configure(config)
      
      const storedConfig = webvmManager.getConfig()
      expect(storedConfig).toEqual(config)
    })

    it('should use default configuration when none provided', () => {
      const defaultConfig = webvmManager.getConfig()
      
      expect(defaultConfig.memory).toBe('1G')
      expect(defaultConfig.cpu).toBe(1)
      expect(defaultConfig.networking.enabled).toBe(true)
    })
  })

  describe('Function Deployment', () => {
    beforeEach(async () => {
      await webvmManager.start()
    })

    it('should deploy a function to WebVM Deno runtime', async () => {
      const functionCode = `
        Deno.serve(async (req) => {
          return new Response(JSON.stringify({ message: "Hello World" }), {
            headers: { "Content-Type": "application/json" }
          })
        })
      `
      
      const deployment = await webvmManager.deployFunction('hello', functionCode)
      
      expect(deployment.success).toBe(true)
      expect(deployment.functionName).toBe('hello')
      expect(deployment.deployedAt).toBeInstanceOf(Date)
      
      const status = webvmManager.getStatus()
      expect(status.functions.deployed).toContain('hello')
    })

    it('should handle function deployment failures', async () => {
      const invalidCode = 'This is not valid TypeScript code!'
      
      const deployment = await webvmManager.deployFunction('invalid', invalidCode)
      
      expect(deployment.success).toBe(false)
      expect(deployment.error).toContain('compilation failed')
    })

    it('should update existing function deployment', async () => {
      const code1 = 'Deno.serve(() => new Response("v1"))'
      const code2 = 'Deno.serve(() => new Response("v2"))'
      
      await webvmManager.deployFunction('updatable', code1)
      const deployment2 = await webvmManager.deployFunction('updatable', code2)
      
      expect(deployment2.success).toBe(true)
      expect(deployment2.version).toBe(2)
    })

    it('should remove deployed function', async () => {
      const functionCode = 'Deno.serve(() => new Response("test"))'
      await webvmManager.deployFunction('removable', functionCode)
      
      const removal = await webvmManager.removeFunction('removable')
      
      expect(removal.success).toBe(true)
      
      const status = webvmManager.getStatus()
      expect(status.functions.deployed).not.toContain('removable')
    })
  })

  describe('Function Execution', () => {
    beforeEach(async () => {
      await webvmManager.start()
      await webvmManager.deployFunction('test-func', `
        Deno.serve(async (req) => {
          const body = await req.json()
          return new Response(JSON.stringify({
            message: "Hello " + (body.name || "World")
          }), {
            headers: { "Content-Type": "application/json" }
          })
        })
      `)
    })

    it('should execute deployed function and return response', async () => {
      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'WebVM' },
        context: {
          project: { id: 'test-project', name: 'Test Project' }
        }
      }
      
      const response = await webvmManager.invokeFunction('test-func', invocation)
      
      expect(response.status).toBe(200)
      expect(response.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(response.body as string)).toEqual({
        message: 'Hello WebVM'
      })
      expect(response.metrics.duration).toBeGreaterThan(0)
    })

    it('should handle function execution errors', async () => {
      await webvmManager.deployFunction('error-func', `
        Deno.serve(() => {
          throw new Error('Function error')
        })
      `)
      
      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: {},
        body: {},
        context: { project: { id: 'test', name: 'Test' } }
      }
      
      const response = await webvmManager.invokeFunction('error-func', invocation)
      
      expect(response.status).toBe(500)
      expect(response.logs).toContain('Function error')
    })

    it('should timeout long-running functions', async () => {
      await webvmManager.deployFunction('timeout-func', `
        Deno.serve(async () => {
          await new Promise(resolve => setTimeout(resolve, 10000))
          return new Response('too slow')
        })
      `)
      
      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: {},
        body: {},
        context: { project: { id: 'test', name: 'Test' } }
      }
      
      const response = await webvmManager.invokeFunction('timeout-func', invocation)
      
      expect(response.status).toBe(408)
      expect(response.body).toContain('timeout')
    }, { timeout: 6000 })

    it('should return 404 for non-existent functions', async () => {
      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: {},
        body: {},
        context: { project: { id: 'test', name: 'Test' } }
      }
      
      const response = await webvmManager.invokeFunction('non-existent', invocation)
      
      expect(response.status).toBe(404)
      expect(response.body).toContain('Function not found')
    })
  })

  describe('Resource Management', () => {
    it('should track memory and CPU usage', async () => {
      await webvmManager.start()
      
      const metrics = await webvmManager.getMetrics()
      
      expect(metrics.memory.used).toBeGreaterThanOrEqual(0)
      expect(metrics.memory.total).toBeGreaterThan(0)
      expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0)
      expect(metrics.cpu.cores).toBeGreaterThan(0)
    })

    it('should enforce memory limits', async () => {
      webvmManager.configure({ 
        memory: '512M',
        cpu: 1,
        networking: { enabled: true, tailscale: { authKey: 'test' } },
        storage: { persistent: true, size: '1G' }
      })
      
      await webvmManager.start()
      
      const status = webvmManager.getStatus()
      expect(status.resources.memory.limit).toBe('512M')
    })
  })

  describe('Network Bridge', () => {
    beforeEach(async () => {
      await webvmManager.start()
    })

    it('should enable external HTTP requests from functions', async () => {
      await webvmManager.deployFunction('external-api', `
        Deno.serve(async () => {
          const response = await fetch('https://api.github.com/users/octocat')
          const data = await response.json()
          return new Response(JSON.stringify(data))
        })
      `)
      
      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: {},
        body: {},
        context: { project: { id: 'test', name: 'Test' } }
      }
      
      const response = await webvmManager.invokeFunction('external-api', invocation)
      
      expect(response.status).toBe(200)
      const responseData = JSON.parse(response.body as string)
      expect(responseData.login).toBe('octocat')
    })

    it('should bridge database calls to PGlite via MSW', async () => {
      await webvmManager.deployFunction('db-func', `
        Deno.serve(async () => {
          const response = await fetch('http://localhost:5173/rest/v1/users?select=*', {
            headers: {
              'apikey': 'test-key',
              'Authorization': 'Bearer test-key'
            }
          })
          const data = await response.json()
          return new Response(JSON.stringify(data))
        })
      `)
      
      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: {},
        body: {},
        context: { 
          project: { id: 'test', name: 'Test' },
          user: { id: 'user-1', email: 'test@example.com', role: 'authenticated' }
        }
      }
      
      const response = await webvmManager.invokeFunction('db-func', invocation)
      
      expect(response.status).toBe(200)
      // Should receive data from PGlite via MSW bridge
      expect(Array.isArray(JSON.parse(response.body as string))).toBe(true)
    })
  })

  describe('Event Handling', () => {
    it('should emit events for lifecycle changes', async () => {
      const startedHandler = vi.fn()
      const stoppedHandler = vi.fn()
      
      webvmManager.on('started', startedHandler)
      webvmManager.on('stopped', stoppedHandler)
      
      await webvmManager.start()
      await webvmManager.stop()
      
      expect(startedHandler).toHaveBeenCalledTimes(1)
      expect(stoppedHandler).toHaveBeenCalledTimes(1)
    })

    it('should emit events for function deployments', async () => {
      const deployedHandler = vi.fn()
      
      webvmManager.on('function-deployed', deployedHandler)
      
      await webvmManager.start()
      await webvmManager.deployFunction('event-func', 'Deno.serve(() => new Response("test"))')
      
      expect(deployedHandler).toHaveBeenCalledWith({
        functionName: 'event-func',
        success: true,
        deployedAt: expect.any(Date)
      })
    })
  })
})