import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { WebVMManager } from '../WebVMManager'
import { WebVMSupabaseClient } from '../WebVMSupabaseClient'
import type { FunctionInvocation } from '../types'
import { projectManager } from '../../projects/ProjectManager'
import { DatabaseManager } from '../../database/connection'

describe('WebVM Function Deployment with Database Integration', () => {
  let webvmManager: WebVMManager
  let mockSupabaseClient: WebVMSupabaseClient

  beforeEach(async () => {
    // Set up test project for MSW handlers with unique name
    const testProjectName = `Test Project ${Date.now()}`
    const testProject = await projectManager.createProject(testProjectName)
    await projectManager.switchToProject(testProject.id)
    
    // Mock the WebVMSupabaseClient
    mockSupabaseClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({
          data: [{ id: 1, name: 'Test User' }],
          error: null
        })
      }),
      rpc: vi.fn().mockResolvedValue({
        data: { result: 'success' },
        error: null
      }),
      setAuth: vi.fn(),
      clearAuth: vi.fn()
    } as any

    // Get WebVMManager instance and reset its state
    webvmManager = WebVMManager.getInstance()
    
    // Mock WebVM embed
    const mockEmbed = {
      sendMessage: vi.fn()
    }
    webvmManager.registerWebVMEmbed(mockEmbed as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Function Deployment with Supabase Client Injection', () => {
    it('should deploy function with injected Supabase client', async () => {
      // Start WebVM
      await webvmManager.start()
      
      // Wait for WebVM to be ready (reduced wait time)
      await new Promise(resolve => setTimeout(resolve, 3500))

      const functionCode = `
        export default async function handler(req) {
          // Access injected Supabase client
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .limit(10)
          
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({ users: data }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      `

      const deployment = await webvmManager.deployFunction('database-func', functionCode)

      expect(deployment.success).toBe(true)
      expect(deployment.functionName).toBe('database-func')
      expect(deployment.version).toBe(1)
      expect(deployment.deployedAt).toBeInstanceOf(Date)
      expect(deployment.error).toBeNull()
      expect(deployment.codeSize).toBe(functionCode.length)
      expect(deployment.compilationTime).toBeGreaterThan(0)
    }, 10000)

    it('should handle function deployment with TypeScript compilation errors', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      const invalidCode = `
        export default async function handler(req) {
          // Invalid TypeScript - missing types
          const invalidSyntax = This is not valid TypeScript code!
          return new Response('Hello')
        }
      `

      const deployment = await webvmManager.deployFunction('invalid-func', invalidCode)

      expect(deployment.success).toBe(false)
      expect(deployment.error).toContain('TypeScript compilation failed')
      expect(deployment.version).toBeNull()
      expect(deployment.compilationTime).toBeNull()
    }, 10000)

    it('should support function versioning on redeployment', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      const functionCode = `
        export default async function handler(req) {
          return new Response('Version 1')
        }
      `

      // First deployment
      const deployment1 = await webvmManager.deployFunction('versioned-func', functionCode)
      expect(deployment1.success).toBe(true)
      expect(deployment1.version).toBe(1)

      // Second deployment (should increment version)
      const updatedCode = `
        export default async function handler(req) {
          return new Response('Version 2')
        }
      `

      const deployment2 = await webvmManager.deployFunction('versioned-func', updatedCode)
      expect(deployment2.success).toBe(true)
      expect(deployment2.version).toBe(2)
    }, 10000)
  })

  describe('Function Execution with Database Access', () => {
    it('should execute function with database connectivity', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      // Deploy a function that queries the database
      const functionCode = `
        export default async function handler(req) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .limit(5)
          
          return new Response(JSON.stringify({ profiles: data }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      `

      await webvmManager.deployFunction('profile-list', functionCode)

      const invocation: FunctionInvocation = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-jwt-token'
        },
        body: undefined,
        context: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'authenticated'
          },
          project: {
            id: 'project-456',
            name: 'Test Project'
          }
        }
      }

      const response = await webvmManager.invokeFunction('profile-list', invocation)

      expect(response.status).toBe(200)
      expect(response.headers['Content-Type']).toBe('application/json')
      expect(response.body).toContain('profiles')
      expect(response.logs).toContain('Function started')
      expect(response.logs).toContain('Function completed')
      expect(response.metrics.duration).toBeGreaterThan(0)
      expect(response.metrics.memory).toBeGreaterThan(0)
    }, 10000)

    it('should execute function with RPC call', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      const functionCode = `
        export default async function handler(req) {
          const body = await req.json()
          const { data, error } = await supabase.rpc('calculate_user_score', {
            user_id: body.userId
          })
          
          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({ score: data }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      `

      await webvmManager.deployFunction('user-score', functionCode)

      const invocation: FunctionInvocation = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-jwt-token'
        },
        body: { userId: 123 },
        context: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'authenticated'
          },
          project: {
            id: 'project-456',
            name: 'Test Project'
          }
        }
      }

      const response = await webvmManager.invokeFunction('user-score', invocation)

      expect(response.status).toBe(200)
      expect(response.body).toContain('score')
      expect(response.metrics.duration).toBeGreaterThan(0)
    }, 10000)

    it('should handle authentication context in function execution', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      const functionCode = `
        export default async function handler(req) {
          // Function should have access to user context through injected JWT
          const { data, error } = await supabase
            .from('user_private_data')
            .select('*')
            .eq('user_id', req.headers.get('x-user-id'))
          
          return new Response(JSON.stringify({ 
            userContext: req.headers.get('x-user-id'),
            data: data 
          }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      `

      await webvmManager.deployFunction('private-data', functionCode)

      const invocation: FunctionInvocation = {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer jwt-with-user-context',
          'x-user-id': 'user-123'
        },
        body: undefined,
        context: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            role: 'authenticated'
          },
          project: {
            id: 'project-456',
            name: 'Test Project'
          }
        }
      }

      const response = await webvmManager.invokeFunction('private-data', invocation)

      expect(response.status).toBe(200)
      expect(response.body).toContain('user-123')
      expect(response.body).toContain('userContext')
    }, 10000)
  })

  describe('Function Error Handling', () => {
    it('should handle database connection errors in functions', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      // Mock database error
      const mockClientWithError = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          then: vi.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'Connection failed',
              code: 'DATABASE_ERROR'
            }
          })
        }),
        setAuth: vi.fn()
      } as any

      const functionCode = `
        export default async function handler(req) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
          
          if (error) {
            return new Response(JSON.stringify({ 
              error: 'Database error: ' + error.message 
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify(data))
        }
      `

      await webvmManager.deployFunction('db-error-func', functionCode)

      const invocation: FunctionInvocation = {
        method: 'GET',
        headers: {},
        body: undefined,
        context: {
          project: {
            id: 'project-456',
            name: 'Test Project'
          }
        }
      }

      const response = await webvmManager.invokeFunction('db-error-func', invocation)

      expect(response.status).toBe(500)
      expect(response.body).toContain('Database error')
    }, 10000)

    it('should handle function execution timeouts', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      const response = await webvmManager.invokeFunction('timeout-func', {
        method: 'GET',
        headers: {},
        body: undefined,
        context: {
          project: { id: 'test', name: 'Test' }
        }
      })

      expect(response.status).toBe(408)
      expect(response.body).toContain('timeout')
      expect(response.metrics.duration).toBeGreaterThanOrEqual(5000)
    }, 15000) // Increased timeout for the 5-second wait
  })

  describe('Environment Variable Management', () => {
    it('should inject environment variables into function execution', async () => {
      await webvmManager.start()
      await new Promise(resolve => setTimeout(resolve, 3500))

      const functionCode = `
        export default async function handler(req) {
          const databaseUrl = Deno.env.get('SUPABASE_DB_URL')
          const apiKey = Deno.env.get('SUPABASE_ANON_KEY')
          
          return new Response(JSON.stringify({
            hasDbUrl: !!databaseUrl,
            hasApiKey: !!apiKey,
            env: {
              nodeEnv: Deno.env.get('NODE_ENV'),
              projectId: Deno.env.get('SUPABASE_PROJECT_ID')
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          })
        }
      `

      await webvmManager.deployFunction('env-test', functionCode)

      const invocation: FunctionInvocation = {
        method: 'GET',
        headers: {},
        body: undefined,
        context: {
          project: {
            id: 'project-456',
            name: 'Test Project'
          }
        }
      }

      const response = await webvmManager.invokeFunction('env-test', invocation)

      expect(response.status).toBe(200)
      const responseBody = JSON.parse(response.body as string)
      expect(responseBody.hasDbUrl).toBe(true)
      expect(responseBody.hasApiKey).toBe(true)
      expect(responseBody.env.projectId).toBe('project-456')
    }, 10000)
  })
})