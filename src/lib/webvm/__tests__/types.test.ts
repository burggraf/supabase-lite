/**
 * WebVM Types Tests
 * 
 * These tests validate the type definitions and ensure type safety
 * for the WebVM integration.
 */

import { describe, it, expect } from 'vitest'
import { 
  WebVMConfig, 
  WebVMStatus, 
  FunctionInvocation, 
  FunctionResponse, 
  FunctionDeployment,
  WebVMMetrics,
  WebVMEvent
} from '../types'

describe('WebVM Types', () => {
  describe('WebVMConfig', () => {
    it('should accept valid configuration object', () => {
      const config: WebVMConfig = {
        memory: '2G',
        cpu: 4,
        networking: {
          enabled: true,
          tailscale: {
            authKey: 'tskey-123456',
            exitNode: 'exit-node-1'
          }
        },
        storage: {
          persistent: true,
          size: '5G'
        }
      }
      
      expect(config.memory).toBe('2G')
      expect(config.cpu).toBe(4)
      expect(config.networking.enabled).toBe(true)
      expect(config.networking.tailscale?.authKey).toBe('tskey-123456')
      expect(config.storage.persistent).toBe(true)
    })

    it('should accept minimal configuration', () => {
      const config: WebVMConfig = {
        memory: '1G',
        cpu: 1,
        networking: {
          enabled: false,
          tailscale: {
            authKey: 'test-key'
          }
        },
        storage: {
          persistent: false,
          size: '1G'
        }
      }
      
      expect(config.networking.tailscale?.exitNode).toBeUndefined()
    })
  })

  describe('WebVMStatus', () => {
    it('should represent running WebVM state', () => {
      const status: WebVMStatus = {
        state: 'running',
        ready: true,
        error: null,
        uptime: 12345,
        deno: {
          available: true,
          version: '1.40.0'
        },
        network: {
          connected: true,
          tailscaleStatus: 'connected'
        },
        functions: {
          deployed: ['func1', 'func2'],
          active: 1,
          total: 2
        },
        resources: {
          memory: {
            used: '256M',
            total: '1G',
            limit: '1G'
          },
          cpu: {
            usage: 0.25,
            cores: 1
          },
          storage: {
            used: '100M',
            total: '1G'
          }
        }
      }
      
      expect(status.state).toBe('running')
      expect(status.ready).toBe(true)
      expect(status.deno.available).toBe(true)
      expect(status.functions.deployed).toHaveLength(2)
    })

    it('should represent error WebVM state', () => {
      const status: WebVMStatus = {
        state: 'error',
        ready: false,
        error: 'WebVM failed to initialize',
        uptime: 0,
        deno: {
          available: false,
          version: null
        },
        network: {
          connected: false,
          tailscaleStatus: 'disconnected'
        },
        functions: {
          deployed: [],
          active: 0,
          total: 0
        },
        resources: {
          memory: {
            used: '0M',
            total: '0M',
            limit: '1G'
          },
          cpu: {
            usage: 0,
            cores: 0
          },
          storage: {
            used: '0M',
            total: '0M'
          }
        }
      }
      
      expect(status.state).toBe('error')
      expect(status.error).toBe('WebVM failed to initialize')
      expect(status.deno.available).toBe(false)
    })
  })

  describe('FunctionInvocation', () => {
    it('should represent complete function invocation', () => {
      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Supabase-Lite'
        },
        body: {
          name: 'test',
          data: [1, 2, 3]
        },
        context: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'authenticated'
          },
          project: {
            id: 'proj-456',
            name: 'Test Project'
          }
        }
      }
      
      expect(invocation.method).toBe('POST')
      expect(invocation.headers['Content-Type']).toBe('application/json')
      expect(invocation.context.user?.id).toBe('user-123')
      expect(invocation.context.project.name).toBe('Test Project')
    })

    it('should handle minimal invocation without user context', () => {
      const invocation: FunctionInvocation = {
        method: 'GET',
        headers: {},
        body: undefined,
        context: {
          project: {
            id: 'proj-123',
            name: 'Anonymous Project'
          }
        }
      }
      
      expect(invocation.context.user).toBeUndefined()
      expect(invocation.body).toBeUndefined()
    })
  })

  describe('FunctionResponse', () => {
    it('should represent successful function response', () => {
      const response: FunctionResponse = {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Function-Name': 'test-func'
        },
        body: {
          success: true,
          data: 'Hello World'
        },
        logs: [
          'Function started',
          'Processing request',
          'Function completed'
        ],
        metrics: {
          duration: 125,
          memory: 45,
          cpu: 0.15
        }
      }
      
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: 'Hello World'
      })
      expect(response.metrics.duration).toBe(125)
      expect(response.logs).toHaveLength(3)
    })

    it('should represent error function response', () => {
      const response: FunctionResponse = {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          error: 'Internal server error',
          message: 'Function execution failed'
        },
        logs: [
          'Function started',
          'Error: Cannot read property of undefined'
        ],
        metrics: {
          duration: 50,
          memory: 20,
          cpu: 0.05
        }
      }
      
      expect(response.status).toBe(500)
      expect(response.logs).toContain('Error: Cannot read property of undefined')
    })
  })

  describe('FunctionDeployment', () => {
    it('should represent successful deployment', () => {
      const deployment: FunctionDeployment = {
        success: true,
        functionName: 'hello-world',
        version: 1,
        deployedAt: new Date('2025-01-01T12:00:00Z'),
        error: null,
        codeSize: 1024,
        compilationTime: 500
      }
      
      expect(deployment.success).toBe(true)
      expect(deployment.functionName).toBe('hello-world')
      expect(deployment.error).toBeNull()
      expect(deployment.codeSize).toBe(1024)
    })

    it('should represent failed deployment', () => {
      const deployment: FunctionDeployment = {
        success: false,
        functionName: 'invalid-func',
        version: null,
        deployedAt: null,
        error: 'TypeScript compilation failed: Unexpected token',
        codeSize: 512,
        compilationTime: null
      }
      
      expect(deployment.success).toBe(false)
      expect(deployment.error).toContain('TypeScript compilation failed')
      expect(deployment.version).toBeNull()
    })
  })

  describe('WebVMMetrics', () => {
    it('should represent system metrics', () => {
      const metrics: WebVMMetrics = {
        memory: {
          used: 512000000,
          total: 1073741824,
          available: 561741824
        },
        cpu: {
          usage: 0.35,
          cores: 4,
          load: [0.5, 0.3, 0.2]
        },
        network: {
          bytesIn: 1048576,
          bytesOut: 524288,
          connectionsActive: 3
        },
        functions: {
          totalExecutions: 150,
          averageExecutionTime: 200,
          errorRate: 0.02
        }
      }
      
      expect(metrics.memory.used).toBe(512000000)
      expect(metrics.cpu.cores).toBe(4)
      expect(metrics.cpu.load).toHaveLength(3)
      expect(metrics.functions.errorRate).toBe(0.02)
    })
  })

  describe('WebVMEvent', () => {
    it('should represent lifecycle events', () => {
      const startEvent: WebVMEvent = {
        type: 'started',
        timestamp: new Date(),
        data: {
          bootTime: 5000,
          denoVersion: '1.40.0'
        }
      }
      
      const stopEvent: WebVMEvent = {
        type: 'stopped',
        timestamp: new Date(),
        data: {
          uptime: 3600000,
          reason: 'user_requested'
        }
      }
      
      expect(startEvent.type).toBe('started')
      expect(stopEvent.type).toBe('stopped')
      expect(startEvent.data.bootTime).toBe(5000)
      expect(stopEvent.data.reason).toBe('user_requested')
    })

    it('should represent function events', () => {
      const deployEvent: WebVMEvent = {
        type: 'function-deployed',
        timestamp: new Date(),
        data: {
          functionName: 'test-func',
          success: true,
          version: 2
        }
      }
      
      const executeEvent: WebVMEvent = {
        type: 'function-executed',
        timestamp: new Date(),
        data: {
          functionName: 'test-func',
          duration: 150,
          status: 200
        }
      }
      
      expect(deployEvent.type).toBe('function-deployed')
      expect(executeEvent.type).toBe('function-executed')
      expect(deployEvent.data.functionName).toBe('test-func')
    })
  })
})