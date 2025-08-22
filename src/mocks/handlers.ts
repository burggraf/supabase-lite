import { http, HttpResponse } from 'msw'
import { SupabaseAPIBridge } from './supabase-bridge'
import { EnhancedSupabaseAPIBridge } from './enhanced-bridge'
import { AuthBridge } from '../lib/auth/AuthBridge'
import { resolveAndSwitchToProject, normalizeApiPath } from './project-resolver'
import { projectManager } from '../lib/projects/ProjectManager'
import { DatabaseManager } from '../lib/database/connection'

const bridge = new SupabaseAPIBridge()
const enhancedBridge = new EnhancedSupabaseAPIBridge()
const authBridge = AuthBridge.getInstance()

/**
 * Higher-order function that wraps handlers with project resolution
 * Extracts project ID from URL and switches to the correct database before handling the request
 */
function withProjectResolution<T extends Parameters<typeof http.get>[1]>(
  handler: T
): T {
  return (async ({ params, request, ...rest }) => {
    const startTime = performance.now();
    const url = new URL(request.url);
    
    // Resolve and switch to the appropriate project database
    const resolution = await resolveAndSwitchToProject(url);
    
    if (!resolution.success) {
      console.error(`❌ MSW: Project resolution failed for ${url.pathname}:`, resolution.error);
      return HttpResponse.json(
        { error: 'Project not found', message: resolution.error },
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const resolutionTime = performance.now() - startTime;
    console.log(`🔄 MSW: Using project "${resolution.projectName}" (${resolution.projectId}) for ${url.pathname} (${resolutionTime.toFixed(1)}ms)`);

    // Normalize the URL to remove project identifier for the handler
    const normalizedUrl = normalizeApiPath(url);
    const normalizedRequest = new Request(normalizedUrl, request);

    // Call the original handler with normalized parameters
    const handleStartTime = performance.now();
    const result = await handler({ 
      params, 
      request: normalizedRequest, 
      ...rest 
    } as any);
    
    const totalTime = performance.now() - startTime;
    const handleTime = performance.now() - handleStartTime;
    console.log(`✅ MSW: Request completed in ${totalTime.toFixed(1)}ms (resolution: ${resolutionTime.toFixed(1)}ms, handler: ${handleTime.toFixed(1)}ms)`);
    
    return result;
  }) as T;
}

// Helper functions for common REST operations
const createRestGetHandler = () => async ({ params, request }: any) => {
  console.log(`🔍 MSW: GET /rest/v1/${params.table} called`)
  try {
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'GET',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    console.log(`✅ MSW: GET response for ${params.table}:`, { status: response.status, dataLength: response.data?.length })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error: any) {
    console.error(`❌ MSW: GET error for ${params.table}:`, error)
    
    // Fallback for unexpected errors (should not happen with Enhanced Bridge)
    return HttpResponse.json(
      { 
        code: 'PGRST100',
        message: error.message || 'Request failed',
        details: null,
        hint: null
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
};

const createRestPostHandler = () => async ({ params, request }: any) => {
  try {
    const body = await request.json()
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'POST',
      body,
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE'
      }
    })
  } catch (error: any) {
    return HttpResponse.json(
      { 
        code: 'PGRST100',
        message: error.message || 'Request failed',
        details: null,
        hint: null
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
};

const createRestPatchHandler = () => async ({ params, request }: any) => {
  try {
    const body = await request.json()
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'PATCH',
      body,
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE'
      }
    })
  } catch (error: any) {
    return HttpResponse.json(
      { 
        code: 'PGRST100',
        message: error.message || 'Request failed',
        details: null,
        hint: null
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
};

const createRestDeleteHandler = () => async ({ params, request }: any) => {
  try {
    const response = await enhancedBridge.handleRestRequest({
      table: params.table as string,
      method: 'DELETE',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE'
      }
    })
  } catch (error: any) {
    return HttpResponse.json(
      { 
        code: 'PGRST100',
        message: error.message || 'Request failed',
        details: null,
        hint: null
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
};

// Helper functions for RPC operations
const createRpcHandler = () => async ({ params, request }: any) => {
  try {
    const body = await request.json().catch(() => ({}))
    const response = await enhancedBridge.handleRpc(
      params.functionName as string,
      body
    )
    
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
        'Access-Control-Allow-Methods': 'POST'
      }
    })
  } catch (error: any) {
    return HttpResponse.json(
      { 
        code: 'PGRST100',
        message: error.message || 'Request failed',
        details: null,
        hint: null
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
};

// Helper functions for auth operations
const createAuthSignupHandler = () => async ({ request }: any) => {
  console.log('🔐 MSW: Handling signup request')
  try {
    let body: any = {}
    try {
      // Debug: Let's see the raw request first
      const rawBody = await request.text()
      console.log('🔍 Raw request body:', JSON.stringify(rawBody))
      console.log('🔍 Request content-type:', request.headers.get('content-type'))
      
      // Parse the JSON - handle double-escaped characters
      try {
        body = JSON.parse(rawBody)
      } catch (firstParseError) {
        // Try to fix common escaping issues
        const fixedBody = rawBody.replace(/\\!/g, '!')
        body = JSON.parse(fixedBody)
      }
      console.log('📝 MSW signup parsed body:', body)
    } catch (parseError) {
      console.error('❌ MSW signup JSON parse error:', parseError)
      return HttpResponse.json(
        { error: 'invalid_request', error_description: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const response = await authBridge.handleAuthRequest({
      endpoint: 'signup',
      method: 'POST',
      body: body,
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    console.log('✅ MSW signup response:', { status: response.status, hasError: !!response.error })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  } catch (error) {
    console.error('💥 MSW signup error:', error)
    return HttpResponse.json(
      { error: 'invalid_request', error_description: (error as any)?.message || 'Request failed' },
      { status: 500 }
    )
  }
};

const createAuthSigninHandler = () => async ({ request }: any) => {
  const callId = Math.random().toString(36).substring(7)
  console.log(`🔥 MSW /auth/v1/signin handler called [${callId}]`)
  console.log(`🔍 Request URL [${callId}]:`, request.url)
  console.log(`🔍 Request method [${callId}]:`, request.method)
  console.log(`🔍 Request headers [${callId}]:`, Object.fromEntries(request.headers.entries()))
  
  // Check if this is a fresh request or reused
  console.log(`🔍 Request bodyUsed [${callId}]:`, (request as any).bodyUsed)
  
  let body: any = {}
  try {
    body = await request.json()
    console.log(`✅ MSW signin parsed JSON body [${callId}]:`, body)
  } catch (error) {
    console.log(`❌ MSW signin failed to parse JSON [${callId}]:`, (error as any)?.message)
    body = {}
  }
  
  console.log(`🚀 Calling authBridge.handleAuthRequest [${callId}]`)
  
  try {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'signin',
      method: 'POST',
      body: body,
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    console.log(`✅ AuthBridge response [${callId}]:`, { status: response.status, hasError: !!response.error })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  } catch (error) {
    console.log(`💥 AuthBridge error [${callId}]:`, (error as any)?.message)
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
};

const createAuthTokenHandler = () => async ({ request }: any) => {
  console.log('🎯 MSW /auth/v1/token handler called')
  console.log('🔍 Token request URL:', request.url)
  console.log('🔍 Token request stack trace:', new Error().stack?.split('\n').slice(1, 5))
  
  let body: any = {}
  
  // Handle both JSON and form-encoded data
  const contentType = request.headers.get('content-type') || ''
  console.log('MSW /auth/v1/token handler - Content-Type:', contentType)
  
  if (contentType.includes('application/json')) {
    body = await request.json()
    console.log('MSW parsed JSON body:', body)
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.text()
    const params = new URLSearchParams(formData)
    body = Object.fromEntries(params.entries())
    console.log('MSW parsed form body:', body)
  } else {
    // Try JSON as fallback
    try {
      body = await request.json()
      console.log('MSW parsed JSON (fallback) body:', body)
    } catch {
      const formData = await request.text()
      const params = new URLSearchParams(formData)
      body = Object.fromEntries(params.entries())
      console.log('MSW parsed form (fallback) body:', body)
    }
  }

  // Extract grant_type from URL query parameters since Supabase sends it there
  const url = new URL(request.url)
  const grantType = url.searchParams.get('grant_type')
  console.log('MSW extracted grant_type from URL:', grantType)
  
  // Merge query params with body
  const mergedBody = {
    ...body,
    grant_type: grantType || body.grant_type
  }
  
  console.log('MSW final merged body:', mergedBody)

  const response = await authBridge.handleAuthRequest({
    endpoint: 'token',
    method: 'POST',
    body: mergedBody,
    headers: Object.fromEntries(request.headers.entries()),
    url: url
  })

  return HttpResponse.json(
    response.error || response.data,
    {
      status: response.status,
      headers: response.headers
    }
  )
};

export const handlers = [
  // ==== ORIGINAL ROUTES (use active project) ====
  
  // PostgREST-compatible REST API endpoints with enhanced features
  http.get('/rest/v1/:table', withProjectResolution(createRestGetHandler())),
  http.post('/rest/v1/:table', withProjectResolution(createRestPostHandler())),
  http.patch('/rest/v1/:table', withProjectResolution(createRestPatchHandler())),
  http.delete('/rest/v1/:table', withProjectResolution(createRestDeleteHandler())),

  // ==== PROJECT-SPECIFIC ROUTES ====
  
  // PostgREST-compatible REST API endpoints with project identifier
  http.get('/:projectId/rest/v1/:table', withProjectResolution(createRestGetHandler())),
  http.post('/:projectId/rest/v1/:table', withProjectResolution(createRestPostHandler())),
  http.patch('/:projectId/rest/v1/:table', withProjectResolution(createRestPatchHandler())),
  http.delete('/:projectId/rest/v1/:table', withProjectResolution(createRestDeleteHandler())),

  // RPC (Remote Procedure Call) endpoints for stored functions
  http.post('/rest/v1/rpc/:functionName', withProjectResolution(createRpcHandler())),
  http.post('/:projectId/rest/v1/rpc/:functionName', withProjectResolution(createRpcHandler())),

  // Authentication endpoints - Use AuthBridge for all auth operations
  http.post('/auth/v1/signup', withProjectResolution(createAuthSignupHandler())),
  http.post('/:projectId/auth/v1/signup', withProjectResolution(createAuthSignupHandler())),

  http.post('/auth/v1/signin', withProjectResolution(createAuthSigninHandler())),
  http.post('/:projectId/auth/v1/signin', withProjectResolution(createAuthSigninHandler())),

  http.post('/auth/v1/token', withProjectResolution(createAuthTokenHandler())),
  http.post('/:projectId/auth/v1/token', withProjectResolution(createAuthTokenHandler())),

  // Logout endpoint
  http.post('/auth/v1/logout', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'logout',
      method: 'POST',
      body: await request.json().catch(() => ({})),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  })),
  http.post('/:projectId/auth/v1/logout', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'logout',
      method: 'POST',
      body: await request.json().catch(() => ({})),
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })

    return HttpResponse.json(
      response.error || response.data,
      {
        status: response.status,
        headers: response.headers
      }
    )
  })),

  // Session and user endpoints
  http.get('/auth/v1/session', async ({ request }) => {
    // Return empty session for unauthenticated users
    return HttpResponse.json({
      access_token: null,
      refresh_token: null,
      expires_in: null,
      expires_at: null,
      token_type: null,
      user: null
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }),
  http.get('/:projectId/auth/v1/session', async ({ request }) => {
    // Return empty session for unauthenticated users
    return HttpResponse.json({
      access_token: null,
      refresh_token: null,
      expires_in: null,
      expires_at: null,
      token_type: null,
      user: null
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }),

  http.get('/auth/v1/user', withProjectResolution(async ({ request }: any) => {
    // For HTTP middleware context, always return unauthorized for unauthenticated requests
    // This prevents the "Failed to fetch" error in Supabase client initialization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({
        code: 401,
        msg: 'Invalid JWT: token not provided'
      }, {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // If there is an auth header, try to use AuthBridge
    try {
      const response = await authBridge.handleAuthRequest({
        endpoint: 'user',
        method: 'GET',
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })

      return HttpResponse.json(
        response.error || response.data,
        {
          status: response.status,
          headers: response.headers
        }
      )
    } catch (error) {
      // Fallback for HTTP middleware context when database is unavailable
      return HttpResponse.json({
        code: 401,
        msg: 'Invalid JWT: token not provided'
      }, {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  })),
  http.get('/:projectId/auth/v1/user', withProjectResolution(async ({ request }: any) => {
    // For HTTP middleware context, always return unauthorized for unauthenticated requests
    // This prevents the "Failed to fetch" error in Supabase client initialization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json({
        code: 401,
        msg: 'Invalid JWT: token not provided'
      }, {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // If there is an auth header, try to use AuthBridge
    try {
      const response = await authBridge.handleAuthRequest({
        endpoint: 'user',
        method: 'GET',
        headers: Object.fromEntries(request.headers.entries()),
        url: new URL(request.url)
      })

      return HttpResponse.json(
        response.error || response.data,
        {
          status: response.status,
          headers: response.headers
        }
      )
    } catch (error) {
      // Fallback for HTTP middleware context when database is unavailable
      return HttpResponse.json({
        code: 401,
        msg: 'Invalid JWT: token not provided'
      }, {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  })),

  // Projects listing endpoint
  http.get('/projects', () => {
    try {
      const projects = projectManager.getProjects();
      const activeProject = projectManager.getActiveProject();
      
      return HttpResponse.json({
        projects: projects.map(project => ({
          id: project.id,
          name: project.name,
          isActive: project.isActive,
          createdAt: project.createdAt.toISOString(),
          lastAccessed: project.lastAccessed.toISOString()
        })),
        activeProjectId: activeProject?.id || null,
        totalCount: projects.length
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('❌ MSW: Error listing projects:', error);
      return HttpResponse.json({
        error: 'Failed to list projects',
        message: (error as Error).message
      }, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }),

  // Debug SQL endpoint - uses active project by default
  http.post('/debug/sql', withProjectResolution(async ({ request }: any) => {
    try {
      const { sql } = await request.json();
      
      if (!sql || typeof sql !== 'string') {
        return HttpResponse.json({
          error: 'SQL query is required',
          message: 'Request body must contain a "sql" field with a valid SQL string'
        }, {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      console.log('🐛 MSW: Executing debug SQL:', sql);
      
      const dbManager = DatabaseManager.getInstance();
      if (!dbManager.isConnected()) {
        throw new Error('Database is not connected');
      }

      const result = await dbManager.query(sql);
      
      console.log('✅ MSW: Debug SQL executed successfully:', { rowCount: result.rows?.length || 0 });
      
      return HttpResponse.json({
        data: result.rows || [],
        rowCount: result.rows?.length || 0,
        executedAt: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      console.error('❌ MSW: Debug SQL error:', error);
      return HttpResponse.json({
        error: 'SQL execution failed',
        message: (error as Error).message
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  })),

  // Debug SQL endpoint for specific project
  http.post('/:projectId/debug/sql', withProjectResolution(async ({ request }: any) => {
    try {
      const { sql } = await request.json();
      
      if (!sql || typeof sql !== 'string') {
        return HttpResponse.json({
          error: 'SQL query is required',
          message: 'Request body must contain a "sql" field with a valid SQL string'
        }, {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      console.log('🐛 MSW: Executing debug SQL on specific project:', sql);
      
      const dbManager = DatabaseManager.getInstance();
      if (!dbManager.isConnected()) {
        throw new Error('Database is not connected');
      }

      const result = await dbManager.query(sql);
      
      console.log('✅ MSW: Debug SQL executed successfully:', { rowCount: result.rows?.length || 0 });
      
      return HttpResponse.json({
        data: result.rows || [],
        rowCount: result.rows?.length || 0,
        executedAt: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      console.error('❌ MSW: Debug SQL error:', error);
      return HttpResponse.json({
        error: 'SQL execution failed',
        message: (error as Error).message
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  })),

  // Health check endpoint for testing
  http.get('/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Supabase Lite API is running'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }),

  // CORS preflight requests
  http.options('*', () => {
    return new HttpResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range, content-range',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    })
  })
]