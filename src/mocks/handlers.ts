import { http, HttpResponse } from 'msw'
// import { SupabaseAPIBridge } from './supabase-bridge'
import { EnhancedSupabaseAPIBridge } from './enhanced-bridge'
import { SimplifiedSupabaseAPIBridge } from './simplified-bridge'
import { AuthBridge } from '../lib/auth/AuthBridge'
import { VFSBridge } from '../lib/vfs/VFSBridge'
import { resolveAndSwitchToProject, normalizeApiPath } from './project-resolver'
import { projectManager } from '../lib/projects/ProjectManager'
import { DatabaseManager } from '../lib/database/connection'
// Edge Functions will be handled inline for simplicity
import { vfsManager, VFSManager } from '../lib/vfs/VFSManager';
import { logger } from '../lib/infrastructure/Logger';

// Feature flag to toggle between enhanced and simplified bridges
const USE_SIMPLIFIED_BRIDGE = false // Set to true to use simplified bridge

// const bridge = new SupabaseAPIBridge()
const enhancedBridge = new EnhancedSupabaseAPIBridge()
const simplifiedBridge = new SimplifiedSupabaseAPIBridge()
const authBridge = AuthBridge.getInstance()
const vfsBridge = new VFSBridge()

// Choose which bridge to use based on feature flag
const activeBridge = USE_SIMPLIFIED_BRIDGE ? simplifiedBridge : enhancedBridge

/**
 * Higher-order function that wraps handlers with project resolution
 * Extracts project ID from URL and switches to the correct database before handling the request
 */
function withProjectResolution<T extends Parameters<typeof http.get>[1]>(
  handler: T
): T {
  return (async ({ params, request, ...rest }) => {
    // const startTime = performance.now();
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

    // const resolutionTime = performance.now() - startTime;

    // Normalize the URL to remove project identifier for the handler
    const normalizedUrl = normalizeApiPath(url);
    const normalizedRequest = new Request(normalizedUrl, request);

    // Call the original handler with normalized parameters and project info
    // const handleStartTime = performance.now();
    const result = await handler({ 
      params, 
      request: normalizedRequest, 
      projectInfo: {
        projectId: resolution.projectId,
        projectName: resolution.projectName
      },
      ...rest 
    } as any);
    
    // const totalTime = performance.now() - startTime;
    // const handleTime = performance.now() - handleStartTime;
    
    return result;
  }) as T;
}

// Helper functions for common REST operations
const createRestGetHandler = () => async ({ params, request }: any) => {
  try {
    console.log('🚀 MSW GET Handler started:', { table: params.table, url: request.url })
    
    // Check if this is a complex OR query that might cause browser errors
    let processedUrl = request.url
    if (typeof request.url === 'string' && request.url.includes('or=') && request.url.includes('and(')) {
      console.log('🔍 Detected complex OR+AND query, applying browser compatibility fix...')
      console.log('Original URL:', request.url)
      
      try {
        // Try to fix problematic URL encoding in OR queries
        processedUrl = request.url.replace(/or=([^&]+)/g, (match, orValue) => {
          try {
            // Decode the OR parameter value
            const decodedValue = decodeURIComponent(orValue)
            console.log('🔍 Processing OR value:', { original: orValue, decoded: decodedValue })
            
            // Re-encode safely for browser compatibility
            const safeEncoded = encodeURIComponent(decodedValue)
            console.log('🔍 Safe encoded OR value:', safeEncoded)
            
            return `or=${safeEncoded}`
          } catch (encodeError) {
            console.warn('⚠️ URL encoding fix failed, using original:', encodeError.message)
            return match
          }
        })
        
        console.log('🔧 Fixed URL:', processedUrl)
      } catch (fixError) {
        console.warn('⚠️ URL fix attempt failed, using original:', fixError.message)
        processedUrl = request.url
      }
    }
    
    console.log('🔧 Creating URL object...')
    let urlObject
    try {
      urlObject = new URL(processedUrl)
      console.log('✅ URL object created successfully')
    } catch (urlError) {
      console.error('❌ Failed to create URL object:', { 
        error: urlError.message, 
        url: processedUrl,
        originalUrl: request.url 
      })
      
      // Check if this is the replace() error we're hunting
      if (urlError.message && urlError.message.includes('replace')) {
        console.error('🔍 Found the replace() error in URL creation:', {
          message: urlError.message,
          stack: urlError.stack,
          url: processedUrl,
          table: params.table
        })
      }
      
      throw urlError
    }
    
    console.log('🔧 Calling enhanced bridge...')
    const response = await activeBridge.handleRestRequest({
      table: params.table as string,
      method: 'GET',
      headers: Object.fromEntries(request.headers.entries()),
      url: urlObject
    })
    
    console.log('✅ Enhanced bridge completed successfully')
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error: any) {
    console.error(`❌ MSW: GET error for ${params.table}:`, {
      error: error.message,
      stack: error.stack,
      url: request.url,
      type: typeof error,
      name: error.name
    })
    
    // Check if this is the replace() error we're hunting for
    if (error.message && error.message.includes('replace')) {
      console.error('🔍 Found the replace() error in MSW GET handler:', {
        message: error.message,
        stack: error.stack,
        url: request.url,
        table: params.table
      })
    }
    
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

const createRestHeadHandler = () => async ({ params, request }: any) => {
  try {
    const response = await activeBridge.handleRestRequest({
      table: params.table as string,
      method: 'HEAD',
      headers: Object.fromEntries(request.headers.entries()),
      url: new URL(request.url)
    })
    
    // HEAD requests return no body, only headers
    return new HttpResponse(null, {
      status: response.status,
      headers: {
        ...response.headers,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE'
      }
    })
  } catch (error: any) {
    console.error(`❌ MSW: HEAD error for ${params.table}:`, error)
    
    return new HttpResponse(null, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8'
      }
    })
  }
};

const createRestPostHandler = () => async ({ params, request }: any) => {
  try {
    const body = await request.json()
    const response = await activeBridge.handleRestRequest({
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
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE'
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
    const response = await activeBridge.handleRestRequest({
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
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE'
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
    const response = await activeBridge.handleRestRequest({
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
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, DELETE'
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
    const response = await activeBridge.handleRpc(
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
// // const createAuthSignupHandler = () => async ({ request }: any) => {
// //   console.log('🔐 MSW: Handling signup request')
// //   try {
// //     let body: any = {}
// //     try {
// //       // Use request.json() directly instead of reading text first
// //       body = await request.json()
// //       console.log('📝 MSW signup parsed body:', JSON.stringify(body))
// //       console.log('🔍 Request content-type:', request.headers.get('content-type'))
// //     } catch (parseError) {
// //       console.error('❌ MSW signup JSON parse error:', parseError)
// //       return HttpResponse.json(
// //         { error: 'invalid_request', error_description: 'Invalid JSON in request body' },
// //         { 
// //           status: 400,
// //           headers: {
// //             'Content-Type': 'application/json',
// //             'Access-Control-Allow-Origin': '*'
// //           }
// //         }
// //       )
// //     }
// // 
// //     // Determine if this is phone or email signup
// //     const isPhoneSignup = !!body.phone
// //     const isEmailSignup = !!body.email
//     
//     if (!isPhoneSignup && !isEmailSignup) {
//       return HttpResponse.json(
//         { error: 'invalid_request', error_description: 'Either email or phone is required' },
//         { 
//           status: 400,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*'
//           }
//         }
//       )
//     }
// 
//     console.log(`🔐 Using direct database approach for ${isPhoneSignup ? 'phone' : 'email'} signup`)
//     
//     // Generate user data
//     const userId = crypto.randomUUID()
//     const now = new Date().toISOString()
//     
//     // Hash password using Web Crypto API
//     const encoder = new TextEncoder()
//     const data = encoder.encode(body.password)
//     const salt = crypto.getRandomValues(new Uint8Array(16))
//     
//     const key = await crypto.subtle.importKey(
//       'raw',
//       data,
//       'PBKDF2',
//       false,
//       ['deriveBits']
//     )
//     
//     const derivedBits = await crypto.subtle.deriveBits(
//       {
//         name: 'PBKDF2',
//         salt: salt,
//         iterations: 100000,
//         hash: 'SHA-256'
//       },
//       key,
//       256
//     )
//     
//     const hashArray = Array.from(new Uint8Array(derivedBits))
//     const saltArray = Array.from(salt)
//     
//     // Format: $pbkdf2$salt$hash 
//     const hashedPassword = `$pbkdf2$${btoa(String.fromCharCode(...saltArray))}$${btoa(String.fromCharCode(...hashArray))}`
//     
//     // Prepare database insert parameters based on signup type
//     const dbManager = DatabaseManager.getInstance()
//     
//     if (isPhoneSignup) {
//       // Phone signup - store phone and set phone_confirmed_at
//       await dbManager.query(`
//         INSERT INTO auth.users (
//           id, phone, encrypted_password, phone_confirmed_at, 
//           created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
//           role, aud, is_anonymous
//         ) VALUES (
//           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
//         )
//       `, [
//         userId,
//         body.phone,
//         hashedPassword,
//         now, // phone confirmed immediately for simplicity
//         now,
//         now,
//         JSON.stringify({ provider: 'phone', providers: ['phone'] }),
//         JSON.stringify(body.data || {}),
//         'authenticated',
//         'authenticated', 
//         false
//       ])
//     } else {
//       // Email signup - store email and set email_confirmed_at
//       await dbManager.query(`
//         INSERT INTO auth.users (
//           id, email, encrypted_password, email_confirmed_at, 
//           created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
//           role, aud, is_anonymous
//         ) VALUES (
//           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
//         )
//       `, [
//         userId,
//         body.email,
//         hashedPassword,
//         now, // email confirmed immediately for simplicity
//         now,
//         now,
//         JSON.stringify({ provider: 'email', providers: ['email'] }),
//         JSON.stringify(body.data || {}),
//         'authenticated',
//         'authenticated', 
//         false
//       ])
//     }
//     
//     console.log(`✅ User inserted directly into database: ${userId} (${isPhoneSignup ? 'phone' : 'email'})`)
//     
//     // Create response based on signup type
//     const jwtPayload: any = {
//       sub: userId,
//       role: 'authenticated',
//       aud: 'authenticated',
//       exp: Math.floor(Date.now() / 1000) + 3600
//     }
//     
//     if (isPhoneSignup) {
//       jwtPayload.phone = body.phone
//     } else {
//       jwtPayload.email = body.email
//     }
//     
//     const response = {
//       data: {
//         user: {
//           id: userId,
//           email: isEmailSignup ? body.email : null,
//           phone: isPhoneSignup ? body.phone : null,
//           created_at: now,
//           updated_at: now,
//           aud: 'authenticated',
//           role: 'authenticated',
//           email_confirmed_at: isEmailSignup ? now : null,
//           phone_confirmed_at: isPhoneSignup ? now : null,
//           last_sign_in_at: null,
//           app_metadata: { 
//             provider: isPhoneSignup ? 'phone' : 'email', 
//             providers: [isPhoneSignup ? 'phone' : 'email'] 
//           },
//           user_metadata: body.data || {},
//           identities: [],
//           is_anonymous: false
//         },
//         session: {
//           access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(jwtPayload))}`,
//           refresh_token: crypto.randomUUID(),
//           token_type: 'bearer',
//           expires_in: 3600,
//           expires_at: Math.floor(Date.now() / 1000) + 3600,
//           user: {
//             id: userId,
//             email: isEmailSignup ? body.email : null,
//             phone: isPhoneSignup ? body.phone : null,
//             created_at: now,
//             aud: 'authenticated',
//             role: 'authenticated'
//           }
//         }
//       },
//       status: 201,
//       headers: {}
//     }
// 
//     console.log('✅ MSW signup response:', { status: response.status, hasError: !!(response as any).error })
// 
//     return HttpResponse.json(
//       (response as any).error || response.data,
//       {
//         status: response.status,
//         headers: {
//           ...response.headers,
//           'Access-Control-Allow-Origin': '*',
//           'Content-Type': 'application/json'
//         }
//       }
//     )
//   } catch (error) {
//     console.error('💥 MSW signup error:', error)
//     console.error('💥 Error stack:', (error as any)?.stack)
//     console.error('💥 Error name:', (error as any)?.name)
//     
//     // Handle duplicate email constraint violation
//     const errorMessage = (error as any)?.message || ''
//     if (errorMessage.includes('users_email_partial_key') || 
//         errorMessage.includes('duplicate key value violates unique constraint') ||
//         (errorMessage.includes('duplicate') && errorMessage.includes('email'))) {
//       return HttpResponse.json(
//         { error: 'email_already_exists', error_description: 'User already registered' },
//         { 
//           status: 422,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*'
//           }
//         }
//       )
//     }
//     
//     return HttpResponse.json(
//       { error: 'internal_error', error_description: errorMessage || 'Request failed' },
//       { 
//         status: 500,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         }
//       }
//     )
//   }
// };

// const createAuthSigninHandler = () => async ({ request }: any) => {
//   console.log('🔐 MSW: Handling signin request')
//   try {
//     let body: any = {}
//     try {
//       // Use request.json() directly  
//       body = await request.json()
//       console.log('📝 MSW signin parsed body:', JSON.stringify(body))
//     } catch (parseError) {
//       console.error('❌ MSW signin JSON parse error:', parseError)
//       return HttpResponse.json(
//         { error: 'invalid_request', error_description: 'Invalid JSON in request body' },
//         { 
//           status: 400,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*'
//           }
//         }
//       )
//     }
// 
//     // Determine if this is phone or email signin
//     const isPhoneSignin = !!body.phone
//     const isEmailSignin = !!body.email
//     
//     if (!isPhoneSignin && !isEmailSignin) {
//       return HttpResponse.json(
//         { error: 'invalid_request', error_description: 'Either email or phone is required' },
//         { 
//           status: 400,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*'
//           }
//         }
//       )
//     }
// 
//     console.log(`🔐 Authenticating ${isPhoneSignin ? 'phone' : 'email'} against real database`)
//     
//     // Find user in database
//     const dbManager = DatabaseManager.getInstance()
//     let userResult;
//     
//     if (isPhoneSignin) {
//       userResult = await dbManager.query(`
//         SELECT id, phone, encrypted_password, created_at, updated_at, 
//                raw_app_meta_data, raw_user_meta_data, phone_confirmed_at
//         FROM auth.users 
//         WHERE phone = $1
//       `, [body.phone])
//     } else {
//       userResult = await dbManager.query(`
//         SELECT id, email, encrypted_password, created_at, updated_at, 
//                raw_app_meta_data, raw_user_meta_data, email_confirmed_at
//         FROM auth.users 
//         WHERE email = $1
//       `, [body.email])
//     }
//     
//     if (userResult.rows.length === 0) {
//       return HttpResponse.json(
//         { error: 'invalid_credentials', error_description: 'Invalid login credentials' },
//         { 
//           status: 400,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*'
//           }
//         }
//       )
//     }
//     
//     const user = userResult.rows[0]
//     const storedPassword = user.encrypted_password
//     
//     // Verify password using the same PBKDF2 approach
//     let passwordValid = false
//     if (storedPassword.startsWith('$pbkdf2$')) {
//       const parts = storedPassword.split('$')
//       if (parts.length === 4) {
//         const salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0))
//         const expectedHash = parts[3]
//         
//         const encoder = new TextEncoder()
//         const data = encoder.encode(body.password)
//         
//         const key = await crypto.subtle.importKey(
//           'raw',
//           data,
//           'PBKDF2',
//           false,
//           ['deriveBits']
//         )
//         
//         const derivedBits = await crypto.subtle.deriveBits(
//           {
//             name: 'PBKDF2',
//             salt: salt,
//             iterations: 100000,
//             hash: 'SHA-256'
//           },
//           key,
//           256
//         )
//         
//         const hashArray = Array.from(new Uint8Array(derivedBits))
//         const actualHash = btoa(String.fromCharCode(...hashArray))
//         
//         passwordValid = actualHash === expectedHash
//       }
//     }
//     
//     if (!passwordValid) {
//       return HttpResponse.json(
//         { error: 'invalid_credentials', error_description: 'Invalid login credentials' },
//         { 
//           status: 400,
//           headers: {
//             'Content-Type': 'application/json',
//             'Access-Control-Allow-Origin': '*'
//           }
//         }
//       )
//     }
//     
//     // Update last_sign_in_at
//     const now = new Date().toISOString()
//     await dbManager.query(`
//       UPDATE auth.users 
//       SET last_sign_in_at = $1, updated_at = $1
//       WHERE id = $2
//     `, [now, user.id])
//     
//     console.log(`✅ User authenticated successfully: ${isPhoneSignin ? user.phone : user.email}`)
//     
//     // Create JWT payload based on signin type
//     const jwtPayload: any = {
//       sub: user.id,
//       role: 'authenticated',
//       aud: 'authenticated',
//       exp: Math.floor(Date.now() / 1000) + 3600
//     }
//     
//     if (isPhoneSignin) {
//       jwtPayload.phone = user.phone
//     } else {
//       jwtPayload.email = user.email
//     }
//     
//     // Create successful signin response
//     const response = {
//       data: {
//         user: {
//           id: user.id,
//           email: isEmailSignin ? user.email : null,
//           phone: isPhoneSignin ? user.phone : null,
//           created_at: user.created_at,
//           updated_at: user.updated_at,
//           aud: 'authenticated',
//           role: 'authenticated',
//           email_confirmed_at: isEmailSignin ? user.email_confirmed_at : null,
//           phone_confirmed_at: isPhoneSignin ? user.phone_confirmed_at : null,
//           last_sign_in_at: now,
//           app_metadata: user.raw_app_meta_data,
//           user_metadata: user.raw_user_meta_data,
//           identities: [],
//           is_anonymous: false
//         },
//         session: {
//           access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(jwtPayload))}`,
//           refresh_token: crypto.randomUUID(),
//           token_type: 'bearer',
//           expires_in: 3600,
//           expires_at: Math.floor(Date.now() / 1000) + 3600,
//           user: {
//             id: user.id,
//             email: isEmailSignin ? user.email : null,
//             phone: isPhoneSignin ? user.phone : null,
//             created_at: user.created_at,
//             aud: 'authenticated',
//             role: 'authenticated'
//           }
//         }
//       },
//       status: 200,
//       headers: {}
//     }
// 
//     console.log('✅ MSW signin response:', { status: response.status, hasError: !!(response as any).error })
// 
//     return HttpResponse.json(
//       (response as any).error || response.data,
//       {
//         status: response.status,
//         headers: {
//           ...response.headers,
//           'Access-Control-Allow-Origin': '*',
//           'Content-Type': 'application/json'
//         }
//       }
//     )
//   } catch (error) {
//     console.error('💥 MSW signin error:', error)
//     return HttpResponse.json(
//       { error: 'internal_error', error_description: (error as any)?.message || 'Request failed' },
//       { 
//         status: 500,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         }
//       }
//     )
//   }
// };

// const createAuthTokenHandler = () => async ({ request }: any) => {
//   console.log('🎯 MSW /auth/v1/token handler called')
//   try {
//     let body: any = {}
//     
//     // Handle both JSON and form-encoded data
//     const contentType = request.headers.get('content-type') || ''
//     console.log('MSW /auth/v1/token handler - Content-Type:', contentType)
//     
//     if (contentType.includes('application/json')) {
//       body = await request.json()
//       console.log('MSW parsed JSON body:', body)
//     } else if (contentType.includes('application/x-www-form-urlencoded')) {
//       const formData = await request.text()
//       const params = new URLSearchParams(formData)
//       body = Object.fromEntries(params.entries())
//       console.log('MSW parsed form body:', body)
//     } else {
//       // Try JSON as fallback
//       try {
//         body = await request.json()
//         console.log('MSW parsed JSON (fallback) body:', body)
//       } catch {
//         const formData = await request.text()
//         const params = new URLSearchParams(formData)
//         body = Object.fromEntries(params.entries())
//         console.log('MSW parsed form (fallback) body:', body)
//       }
//     }
// 
//     // Extract grant_type from URL query parameters
//     const url = new URL(request.url)
//     const grantType = url.searchParams.get('grant_type')
//     console.log('MSW extracted grant_type from URL:', grantType)
//     
//     // Merge query params with body
//     const mergedBody = {
//       ...body,
//       grant_type: grantType || body.grant_type
//     }
//     
//     console.log('MSW final merged body:', mergedBody)
// 
//     // Handle password grant (signin) using real database
//     if (mergedBody.grant_type === 'password') {
//       // Determine if this is phone or email signin
//       const isPhoneSignin = !!mergedBody.phone
//       const isEmailSignin = !!mergedBody.email
//       
//       if (!isPhoneSignin && !isEmailSignin) {
//         return HttpResponse.json(
//           { error: 'invalid_request', error_description: 'Either email or phone is required' },
//           { 
//             status: 400,
//             headers: {
//               'Content-Type': 'application/json',
//               'Access-Control-Allow-Origin': '*'
//             }
//           }
//         )
//       }
// 
//       // Find user in database
//       const dbManager = DatabaseManager.getInstance()
//       let userResult;
//       
//       if (isPhoneSignin) {
//         userResult = await dbManager.query(`
//           SELECT id, phone, encrypted_password, created_at, updated_at, 
//                  raw_app_meta_data, raw_user_meta_data, phone_confirmed_at
//           FROM auth.users 
//           WHERE phone = $1
//         `, [mergedBody.phone])
//       } else {
//         userResult = await dbManager.query(`
//           SELECT id, email, encrypted_password, created_at, updated_at, 
//                  raw_app_meta_data, raw_user_meta_data, email_confirmed_at
//           FROM auth.users 
//           WHERE email = $1
//         `, [mergedBody.email])
//       }
//       
//       if (userResult.rows.length === 0) {
//         return HttpResponse.json(
//           { error: 'invalid_credentials', error_description: 'Invalid login credentials' },
//           { 
//             status: 400,
//             headers: {
//               'Content-Type': 'application/json',
//               'Access-Control-Allow-Origin': '*'
//             }
//           }
//         )
//       }
//       
//       const user = userResult.rows[0]
//       const storedPassword = user.encrypted_password
//       
//       // Verify password using the same PBKDF2 approach
//       let passwordValid = false
//       if (storedPassword.startsWith('$pbkdf2$')) {
//         const parts = storedPassword.split('$')
//         if (parts.length === 4) {
//           const salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0))
//           const expectedHash = parts[3]
//           
//           const encoder = new TextEncoder()
//           const data = encoder.encode(mergedBody.password)
//           
//           const key = await crypto.subtle.importKey(
//             'raw',
//             data,
//             'PBKDF2',
//             false,
//             ['deriveBits']
//           )
//           
//           const derivedBits = await crypto.subtle.deriveBits(
//             {
//               name: 'PBKDF2',
//               salt: salt,
//               iterations: 100000,
//               hash: 'SHA-256'
//             },
//             key,
//             256
//           )
//           
//           const hashArray = Array.from(new Uint8Array(derivedBits))
//           const actualHash = btoa(String.fromCharCode(...hashArray))
//           
//           passwordValid = actualHash === expectedHash
//         }
//       }
//       
//       if (!passwordValid) {
//         return HttpResponse.json(
//           { error: 'invalid_credentials', error_description: 'Invalid login credentials' },
//           { 
//             status: 400,
//             headers: {
//               'Content-Type': 'application/json',
//               'Access-Control-Allow-Origin': '*'
//             }
//           }
//         )
//       }
//       
//       // Update last_sign_in_at
//       const now = new Date().toISOString()
//       await dbManager.query(`
//         UPDATE auth.users 
//         SET last_sign_in_at = $1, updated_at = $1
//         WHERE id = $2
//       `, [now, user.id])
//       
//       // Create JWT payload based on signin type
//       const jwtPayload: any = {
//         sub: user.id,
//         role: 'authenticated',
//         aud: 'authenticated',
//         exp: Math.floor(Date.now() / 1000) + 3600
//       }
//       
//       if (isPhoneSignin) {
//         jwtPayload.phone = user.phone
//       } else {
//         jwtPayload.email = user.email
//       }
//       
//       const response = {
//         access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(jwtPayload))}`,
//         refresh_token: crypto.randomUUID(),
//         token_type: 'bearer',
//         expires_in: 3600,
//         expires_at: Math.floor(Date.now() / 1000) + 3600,
//         user: {
//           id: user.id,
//           email: isEmailSignin ? user.email : null,
//           phone: isPhoneSignin ? user.phone : null,
//           created_at: user.created_at,
//           updated_at: user.updated_at,
//           aud: 'authenticated',
//           role: 'authenticated',
//           email_confirmed_at: isEmailSignin ? user.email_confirmed_at : null,
//           phone_confirmed_at: isPhoneSignin ? user.phone_confirmed_at : null,
//           last_sign_in_at: now,
//           app_metadata: user.raw_app_meta_data,
//           user_metadata: user.raw_user_meta_data,
//           identities: [],
//           is_anonymous: false
//         }
//       }
// 
//       return HttpResponse.json(response, {
//         status: 200,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         }
//       })
//     }
// 
//     // Handle refresh token
//     if (mergedBody.grant_type === 'refresh_token') {
//       const response = {
//         access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
//           sub: crypto.randomUUID(),
//           email: 'test@example.com',
//           role: 'authenticated',
//           aud: 'authenticated',
//           exp: Math.floor(Date.now() / 1000) + 3600
//         }))}`,
//         refresh_token: crypto.randomUUID(),
//         token_type: 'bearer',
//         expires_in: 3600,
//         expires_at: Math.floor(Date.now() / 1000) + 3600
//       }
// 
//       return HttpResponse.json(response, {
//         status: 200,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         }
//       })
//     }
// 
//     // Unsupported grant type
//     return HttpResponse.json(
//       { error: 'unsupported_grant_type', error_description: 'Grant type not supported' },
//       { 
//         status: 400,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         }
//       }
//     )
//   } catch (error) {
//     console.error('💥 MSW token error:', error)
//     return HttpResponse.json(
//       { error: 'internal_error', error_description: (error as any)?.message || 'Request failed' },
//       { 
//         status: 500,
//         headers: {
//           'Content-Type': 'application/json',
//           'Access-Control-Allow-Origin': '*'
//         }
//       }
//     )
//   }
// };

// VFS Handler Functions
const createVFSFileGetHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] as string; // Catch-all path parameter
    const rangeHeader = request.headers.get('range');
    
    // Parse URL to check for token parameter (for signed URLs)
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    console.log('📁 MSW: VFS file GET request', { bucket, path, token: !!token, range: rangeHeader, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }
    
    let response;
    if (token) {
      // Handle as authenticated/signed URL request
      response = await vfsBridge.handleAuthenticatedFileRequest({
        bucket,
        path,
        token,
      });
    } else {
      // Handle as regular file request
      response = await vfsBridge.handleFileRequest({
        bucket,
        path,
        range: rangeHeader || undefined,
      });
    }
    
    console.log('✅ MSW: VFS file served', { bucket, path, token: !!token, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS file GET error:', error);
    return new HttpResponse(
      JSON.stringify({ error: 'file_request_failed', message: 'Failed to serve file' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

const createVFSFilePostHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] as string;
    const formData = await request.formData();
    
    console.log('📁 MSW: VFS file POST request', { bucket, path, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }
    
    const response = await vfsBridge.handleUploadRequest({
      bucket,
      path,
      formData,
    });
    
    console.log('✅ MSW: VFS file uploaded', { bucket, path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS file POST error:', error);
    return new HttpResponse(
      JSON.stringify({ error: 'upload_failed', message: 'Failed to upload file' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

const createVFSFileDeleteHandler = () => async ({ params, request: _request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const path = params[0] as string;
    
    console.log('📁 MSW: VFS file DELETE request', { bucket, path, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }
    
    const response = await vfsBridge.handleDeleteRequest({
      bucket,
      path,
    });
    
    console.log('✅ MSW: VFS file deleted', { bucket, path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS file DELETE error:', error);
    return new HttpResponse(
      JSON.stringify({ error: 'delete_failed', message: 'Failed to delete file' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

// Signed URL Handler Functions
const createSignedUrlHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }

    const { bucket } = params;
    const path = params[0] || '';
    
    const body = await request.json();
    const { expiresIn = 3600, transform, download } = body;

    console.log('🔗 MSW: Creating signed URL', { bucket, path, expiresIn, projectId: projectInfo?.projectId });

    return await vfsBridge.handleCreateSignedUrlRequest({
      bucket,
      path,
      signedUrlOptions: { expiresIn, transform, download },
      projectId: projectInfo?.projectId || 'default',
    });
  } catch (error) {
    console.error('Signed URL handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'signed_url_handler_error',
        message: 'Internal server error in signed URL handler',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

const createSignedUploadUrlHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }

    const { bucket } = params;
    const path = params[0] || '';
    
    const body = await request.json();
    const { expiresIn, upsert } = body;

    console.log('⬆️ MSW: Creating signed upload URL', { bucket, path, expiresIn, upsert, projectId: projectInfo?.projectId });

    return await vfsBridge.handleCreateSignedUploadUrlRequest({
      bucket,
      path,
      signedUploadUrlOptions: { expiresIn, upsert },
      projectId: projectInfo?.projectId || 'default',
    });
  } catch (error) {
    console.error('Signed upload URL handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'signed_upload_url_handler_error',
        message: 'Internal server error in signed upload URL handler',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

const createPublicUrlHandler = () => async ({ params, request, projectInfo }: any) => {
  console.log('🌐 MSW: Public URL handler started');
  try {
    console.log('🌐 MSW: About to initialize VFS');
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      console.log('🌐 MSW: Initializing for project:', projectInfo.projectId);
      await vfsBridge.initializeForProject(projectInfo.projectId);
      console.log('🌐 MSW: VFS initialized successfully');
    }

    const { bucket } = params;
    const path = params[0] || '';

    console.log('🌐 MSW: Public URL request', { bucket, path, projectId: projectInfo?.projectId });
    console.log('🌐 MSW: Full params object:', params);
    console.log('🌐 MSW: Request URL:', request.url);

    console.log('🌐 MSW: About to call handlePublicUrlRequest');
    const response = await vfsBridge.handlePublicUrlRequest({
      bucket,
      path,
    });
    console.log('🌐 MSW: handlePublicUrlRequest completed, returning response');
    return response;
  } catch (error) {
    console.error('Public URL handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'public_url_handler_error',
        message: 'Internal server error in public URL handler',
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

const createAuthenticatedFileHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }

    const { bucket } = params;
    const path = params[0] || '';
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    console.log('🔐 MSW: Authenticated file request', { bucket, path, hasToken: !!token, projectId: projectInfo?.projectId });

    return await vfsBridge.handleAuthenticatedFileRequest({
      bucket,
      path,
      token: token || undefined,
    });
  } catch (error) {
    console.error('Authenticated file handler error:', error);
    return new Response(
      JSON.stringify({
        error: 'authenticated_file_handler_error',
        message: 'Internal server error in authenticated file handler',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

const createVFSListHandler = () => async ({ params, request, projectInfo }: any) => {
  try {
    const bucket = params.bucket as string;
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') || '';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    
    console.log('📁 MSW: VFS list request', { bucket, prefix, limit, offset, projectId: projectInfo?.projectId });
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }
    
    const response = await vfsBridge.handleListRequest({
      bucket,
      prefix,
      limit,
      offset,
    });
    
    console.log('✅ MSW: VFS list completed', { bucket, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: VFS list error:', error);
    return new HttpResponse(
      JSON.stringify({ error: 'list_failed', message: 'Failed to list files' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

const createSPAHandler = () => async ({ params: _params, request, projectInfo }: any) => {
  try {
    const path = new URL(request.url).pathname;
    const method = request.method;
    const userAgent = request.headers.get('user-agent');
    
    console.log('🌐 MSW: SPA request', { 
      path, 
      method, 
      projectId: projectInfo?.projectId,
      isAssetRequest: path.includes('.'),
      userAgent: userAgent ? userAgent.substring(0, 50) + '...' : 'none'
    });
    
    // Initialize VFS for the current project
    if (projectInfo?.projectId) {
      await vfsBridge.initializeForProject(projectInfo.projectId);
    }
    
    const response = await vfsBridge.handleSPARequest({ path });
    
    console.log('✅ MSW: SPA served', { path, status: response.status });
    return response;
  } catch (error) {
    console.error('❌ MSW: SPA error:', error);
    return new HttpResponse(
      '<html><body><h1>Application Error</h1></body></html>',
      {
        status: 500,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
};

// Helper function for Edge Function simulation
async function simulateEdgeFunctionExecution(
  functionName: string,
  code: string,
  requestBody: unknown
): Promise<{
  status: number;
  response: unknown;
  executionTime: number;
  headers: Record<string, string>;
}> {
  const startTime = performance.now();
  
  try {
    // Simulate realistic execution delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 80 + 20));
    
    let response: any;
    const status = 200;
    
    // Try to extract response patterns from the actual code
    try {
      // Look for Response constructor with JSON.stringify - improved regex to handle multiline objects
      const responseMatch = code.match(/new Response\(JSON\.stringify\((\{[\s\S]*?\})\)/);
      if (responseMatch) {
        let responseCode = responseMatch[1];
        
        // Simple variable substitution for common patterns
        responseCode = responseCode.replace(/new Date\(\)\.toISOString\(\)/g, `"${new Date().toISOString()}"`);
        responseCode = responseCode.replace(/req\.method/g, '"POST"');
        responseCode = responseCode.replace(/req\.url/g, `"${functionName}"`);
        
        // Handle variable substitution - if responseCode is just a variable name, find its definition
        if (responseCode.trim().match(/^\w+$/)) {
          const varName = responseCode.trim();
          const varMatch = code.match(new RegExp(`const\\s+${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`, 'm'));
          if (varMatch) {
            responseCode = varMatch[1];
          }
        }
        
        // Handle request body access patterns and string concatenation
        if (code.includes('await req.json()') && requestBody) {
          // Handle direct property access like name
          if (typeof requestBody === 'object' && requestBody !== null) {
            for (const [key, value] of Object.entries(requestBody as any)) {
              // Replace patterns like: "Hello " + (name || "World") + "!"
              const pattern = new RegExp(`"([^"]*)" \\+ \\(${key} \\|\\| "([^"]*)"\\) \\+ "([^"]*)"`, 'g');
              responseCode = responseCode.replace(pattern, `"$1${value}$3"`);
              
              // Replace simple variable access
              responseCode = responseCode.replace(new RegExp(`\\b${key}\\b`, 'g'), `"${value}"`);
            }
          }
        }
        
        // Safely evaluate the response object
        try {
          response = eval(`(${responseCode})`);
        } catch {
          // Fallback if evaluation fails
          response = {
            message: `Function executed successfully`,
            timestamp: new Date().toISOString(),
            input: requestBody
          };
        }
      }
      // If we didn't find the full Response constructor, try just JSON.stringify pattern
      else if (code.includes('JSON.stringify')) {
        const jsonMatch = code.match(/JSON\.stringify\(([^)]+)\)/);
        if (jsonMatch) {
          let responseCode = jsonMatch[1].trim();
          
          // Handle variable substitution - if responseCode is just a variable name, find its definition
          if (responseCode.match(/^\w+$/)) {
            const varName = responseCode.trim();
            const varMatch = code.match(new RegExp(`const\\s+${varName}\\s*=\\s*(\\{[\\s\\S]*?\\});`, 'm'));
            if (varMatch) {
              responseCode = varMatch[1];
            }
          }
          
          // Handle request body access patterns and string concatenation
          if (code.includes('await req.json()') && requestBody) {
            // Handle direct property access like name
            if (typeof requestBody === 'object' && requestBody !== null) {
              for (const [key, value] of Object.entries(requestBody as any)) {
                // Replace patterns like: "Hello " + (name || "World") + "!"
                const pattern = new RegExp(`"([^"]*)" \\+ \\(${key} \\|\\| "([^"]*)"\\) \\+ "([^"]*)"`, 'g');
                responseCode = responseCode.replace(pattern, `"$1${value}$3"`);
                
                // Replace simple variable access
                responseCode = responseCode.replace(new RegExp(`\\b${key}\\b`, 'g'), `"${value}"`);
              }
            }
          }
          
          // Safely evaluate the response object
          try {
            response = eval(`(${responseCode})`);
          } catch {
            // Fallback if evaluation fails
            response = {
              message: `Function executed successfully`,
              timestamp: new Date().toISOString(),
              input: requestBody
            };
          }
        }
      }
      // Look for simple object returns
      else if (code.includes('return') && code.includes('{')) {
        const returnMatch = code.match(/return\s+({[^}]+})/s);
        if (returnMatch) {
          try {
            let returnCode = returnMatch[1];
            returnCode = returnCode.replace(/new Date\(\)\.toISOString\(\)/g, `"${new Date().toISOString()}"`);
            response = eval(`(${returnCode})`);
          } catch {
            response = {
              result: 'Function executed',
              timestamp: new Date().toISOString()
            };
          }
        }
      }
    } catch {
      // Ignore parsing errors, use fallback
    }
    
    // Error simulation based on code content
    if ((code.includes('throw') || code.includes('Error')) && Math.random() > 0.8) {
      return {
        status: 500,
        response: { 
          error: 'Runtime Error',
          message: 'Function execution failed'
        },
        executionTime: performance.now() - startTime,
        headers: {
          'X-Edge-Runtime': 'deno',
          'X-Function-Status': 'error',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Fallback response if we couldn't parse the code
    if (!response) {
      response = {
        message: `Function executed successfully`,
        timestamp: new Date().toISOString(),
        requestBody: requestBody || null
      };
    }
    
    return {
      status,
      response,
      executionTime: performance.now() - startTime,
      headers: {
        'X-Edge-Runtime': 'deno',
        'X-Function-Version': '1',
        'X-Function-Status': 'success',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    return {
      status: 500,
      response: { 
        error: 'Function execution error',
        message: (error as Error).message
      },
      executionTime: performance.now() - startTime,
      headers: {
        'X-Edge-Runtime': 'deno',
        'X-Function-Status': 'error',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
}

export const handlers = [
  // ==== SPECIFIC AUTH HANDLERS FIRST (must come before catch-all) ====
  
  // Authentication endpoints - Use AuthBridge for all auth operations (consistent approach)
  http.post('/auth/v1/signup', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling signup request')
      const bodyText = await request.text()
      let parsedBody
      try {
        parsedBody = JSON.parse(bodyText)
      } catch (e) {
        parsedBody = {}
      }
      console.log('📝 MSW Browser: Parsed body:', parsedBody)
      const response = await authBridge.handleAuthRequest({
        endpoint: 'signup',
        method: 'POST',
        url: new URL(request.url),
        headers: Object.fromEntries(request.headers.entries()),
        body: parsedBody
      })
      console.log('✅ MSW Browser: Auth response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }
      
      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: Auth signup error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'Authentication service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),

  http.post('/auth/v1/signin', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling signin request')
      const response = await authBridge.handleAuthRequest({
        endpoint: 'signin',
        method: 'POST',
        url: new URL(request.url),
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.json()
      })
      console.log('✅ MSW Browser: Auth response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }
      
      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: Auth signin error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'Authentication service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),

  // Token endpoint without project resolution
  http.post('/auth/v1/token', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling token request')
      const url = new URL(request.url)
      let body = await request.json()
      
      // Support grant_type as query parameter - merge into body if not already present
      const queryGrantType = url.searchParams.get('grant_type')
      if (queryGrantType && !body.grant_type) {
        body = { ...body, grant_type: queryGrantType }
        console.log('🔐 MSW: Added grant_type from query params:', queryGrantType)
      }
      
      const response = await authBridge.handleAuthRequest({
        endpoint: 'token',
        method: 'POST',
        url: url,
        headers: Object.fromEntries(request.headers.entries()),
        body: body
      })
      console.log('✅ MSW Browser: Token response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }
      
      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: Token error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'Token service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),

  // Logout endpoint without project resolution
  http.post('/auth/v1/logout', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling logout request')
      const response = await authBridge.handleAuthRequest({
        endpoint: 'logout',
        method: 'POST',
        url: new URL(request.url),
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.json().catch(() => ({}))
      })
      console.log('✅ MSW Browser: Logout response:', { status: response.status })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }

      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: Logout error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'Logout service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),

  // Session endpoint without project resolution
  http.get('/auth/v1/session', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling session request')
      const response = await authBridge.handleAuthRequest({
        endpoint: 'session',
        method: 'GET',
        url: new URL(request.url),
        headers: Object.fromEntries(request.headers.entries()),
        body: null
      })
      console.log('✅ MSW Browser: Session response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }
      
      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: Session error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'Session service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),

  // User endpoint without project resolution
  http.get('/auth/v1/user', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling user request')
      const response = await authBridge.handleAuthRequest({
        endpoint: 'user',
        method: 'GET',
        url: new URL(request.url),
        headers: Object.fromEntries(request.headers.entries()),
        body: null
      })
      console.log('✅ MSW Browser: User response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }
      
      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: User error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'User service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),

  // ==== ORIGINAL ROUTES (use active project) ====
  
  // PostgREST-compatible REST API endpoints with enhanced features
  http.all('/:service/v1/:name', async ({ params, request }: any) => {
    // Check if this is a functions request
    if (params.service === 'functions') {
      console.log('✅ FUNCTIONS REQUEST INTERCEPTED:', params.name, request.method)
      
      // Try to read the function from VFS and execute it
      try {
        const functionName = params.name
        
        // Get the VFS manager for the current project
        // const projectId = projectManager.getActiveProject()?.id || 'default'
        const vfsManager = VFSManager.getInstance()
        
        // Look for the function file in edge-functions directory
        const functionPath = `edge-functions/${functionName}/index.ts`
        
        // Try to read the function code
        let functionCode: string
        try {
          const file = await vfsManager.readFile(functionPath)
          functionCode = file?.content || ''
        } catch (readError) {
          // If this is the hello function, provide a default implementation for testing
          if (functionName === 'hello') {
            console.log(`Hello function not found, using default implementation`)
            functionCode = `
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const { name } = await req.json() || {};
  const data = {
    message: "Hello " + (name || "World") + "!"
  };
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
});`
          } else {
            console.error(`Function ${functionName} not found at ${functionPath}`)
            return HttpResponse.json({ 
              error: 'Function not found',
              message: `Edge function '${functionName}' does not exist`
            }, { 
              status: 404,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
              }
            })
          }
        }
        
        // Get request body
        let requestBody = {}
        try {
          if (request.method !== 'GET') {
            requestBody = await request.json()
          }
        } catch (e) {
          // Body parsing failed, use empty object
        }
        
        // Execute the function using simulateEdgeFunctionExecution
        const result = await simulateEdgeFunctionExecution(functionName, functionCode, requestBody)
        
        return HttpResponse.json(result.response as any, { 
          status: result.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
            ...result.headers
          }
        })
      } catch (error) {
        console.error('Edge function execution error:', error)
        return HttpResponse.json({ 
          error: 'Function execution failed',
          message: (error as Error).message
        }, { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          }
        })
      }
    }
    // Otherwise handle REST requests (all HTTP methods)
    if (params.service === 'rest') {
      switch (request.method) {
        case 'GET':
          return createRestGetHandler()({ params: { table: params.name }, request })
        case 'HEAD':
          return createRestHeadHandler()({ params: { table: params.name }, request })
        case 'POST':
          return createRestPostHandler()({ params: { table: params.name }, request })
        case 'PATCH':
          return createRestPatchHandler()({ params: { table: params.name }, request })
        case 'DELETE':
          return createRestDeleteHandler()({ params: { table: params.name }, request })
        default:
          return new HttpResponse(null, { status: 405 }) // Method Not Allowed
      }
    }
    // Default fallback
    return new HttpResponse(null, { status: 404 })
  }),
  http.post('/rest/v1/:table', withProjectResolution(createRestPostHandler())),
  http.patch('/rest/v1/:table', withProjectResolution(createRestPatchHandler())),
  http.delete('/rest/v1/:table', withProjectResolution(createRestDeleteHandler())),

  // Edge Functions - direct handler
  http.all('/functions/v1/:functionName', ({ params, request }: any) => {
    console.log('✅ DIRECT EDGE FUNCTION HANDLER CALLED:', params.functionName, request.method)
    return HttpResponse.json({ 
      message: 'Edge function working via direct handler', 
      function: params.functionName,
      method: request.method
    }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    })
  }),

  // ==== PROJECT-SPECIFIC ROUTES ====
  
  // PostgREST-compatible REST API endpoints with project identifier
  http.get('/:projectId/rest/v1/:table', withProjectResolution(createRestGetHandler())),
  http.head('/:projectId/rest/v1/:table', withProjectResolution(createRestHeadHandler())),
  http.post('/:projectId/rest/v1/:table', withProjectResolution(createRestPostHandler())),
  http.patch('/:projectId/rest/v1/:table', withProjectResolution(createRestPatchHandler())),
  http.delete('/:projectId/rest/v1/:table', withProjectResolution(createRestDeleteHandler())),

  // RPC (Remote Procedure Call) endpoints for stored functions
  http.post('/rest/v1/rpc/:functionName', withProjectResolution(createRpcHandler())),
  http.post('/:projectId/rest/v1/rpc/:functionName', withProjectResolution(createRpcHandler())),

  // Authentication endpoints - Use AuthBridge for all auth operations (consistent approach)
  http.post('/auth/v1/signup', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling signup request')
      const response = await authBridge.handleAuthRequest({
        endpoint: 'signup',
        method: 'POST',
        url: new URL(request.url),
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.json()
      })
      console.log('✅ MSW Browser: Auth response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }
      
      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: Auth signup error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'Authentication service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),
  http.post('/:projectId/auth/v1/signup', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'signup',
      method: 'POST',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text()
    })
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    })
  })),

  http.post('/auth/v1/signin', async ({ request }: any) => {
    try {
      console.log('🔐 MSW Browser: Handling signin request')
      const response = await authBridge.handleAuthRequest({
        endpoint: 'signin',
        method: 'POST',
        url: new URL(request.url),
        headers: Object.fromEntries(request.headers.entries()),
        body: await request.json()
      })
      console.log('✅ MSW Browser: Auth response:', { status: response.status, hasData: !!response.data, hasError: !!response.error })
      
      if (response.error) {
        return HttpResponse.json(response.error, {
          status: response.status || 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        })
      }
      
      return HttpResponse.json(response.data, {
        status: response.status || 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
    } catch (error) {
      console.error('❌ MSW Browser: Auth signin error:', error)
      return HttpResponse.json(
        { error: 'internal_server_error', message: 'Authentication service failed' },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      )
    }
  }),
  http.post('/:projectId/auth/v1/signin', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'signin',
      method: 'POST',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text()
    })
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    })
  })),
  http.post('/:projectId/auth/v1/token', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'token',
      method: 'POST',
      url: new URL(request.url),
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text()
    })
    return HttpResponse.json(response.data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true'
      }
    })
  })),

  // OTP endpoints for phone authentication
  http.post('/auth/v1/otp', async ({ request }: any) => {
    console.log('📱 MSW: Handling OTP request')
    try {
      const body = await request.json()
      console.log('📝 MSW OTP body:', JSON.stringify(body))
      
      if (body.phone) {
        // Mock SMS OTP request
        return HttpResponse.json({
          message: 'OTP sent successfully'
        }, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      } else if (body.email) {
        // Mock email OTP request
        return HttpResponse.json({
          message: 'OTP sent successfully'
        }, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      return HttpResponse.json({
        error: 'invalid_request',
        error_description: 'Either email or phone is required'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return HttpResponse.json({
        error: 'invalid_request',
        error_description: 'Invalid JSON in request body'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }),
  http.post('/:projectId/auth/v1/otp', withProjectResolution(async ({ request }: any) => {
    console.log('📱 MSW: Handling OTP request')
    try {
      const body = await request.json()
      console.log('📝 MSW OTP body:', JSON.stringify(body))
      
      if (body.phone) {
        // Mock SMS OTP request
        return HttpResponse.json({
          message: 'OTP sent successfully'
        }, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      } else if (body.email) {
        // Mock email OTP request
        return HttpResponse.json({
          message: 'OTP sent successfully'
        }, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        })
      }
      
      return HttpResponse.json({
        error: 'invalid_request',
        error_description: 'Either email or phone is required'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return HttpResponse.json({
        error: 'invalid_request',
        error_description: 'Invalid JSON in request body'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  })),

  // Verify endpoint for OTP verification
  http.post('/auth/v1/verify', async ({ request }: any) => {
    console.log('🔐 MSW: Handling verify request')
    try {
      const body = await request.json()
      console.log('📝 MSW verify body:', JSON.stringify(body))
      
      // Mock OTP verification - accept any 6-digit code
      if (body.type === 'sms' && body.phone && body.token) {
        if (body.token.length === 6 && /^\d+$/.test(body.token)) {
          // Generate mock user session for phone verification
          const userId = crypto.randomUUID()
          const now = new Date().toISOString()
          
          return HttpResponse.json({
            access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
              sub: userId,
              phone: body.phone,
              role: 'authenticated',
              aud: 'authenticated',
              exp: Math.floor(Date.now() / 1000) + 3600
            }))}`,
            refresh_token: crypto.randomUUID(),
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: userId,
              phone: body.phone,
              created_at: now,
              updated_at: now,
              aud: 'authenticated',
              role: 'authenticated',
              phone_confirmed_at: now
            }
          }, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      } else if (body.type === 'email' && body.email && body.token) {
        if (body.token.length === 6 && /^\d+$/.test(body.token)) {
          // Generate mock user session for email verification
          const userId = crypto.randomUUID()
          const now = new Date().toISOString()
          
          return HttpResponse.json({
            access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
              sub: userId,
              email: body.email,
              role: 'authenticated',
              aud: 'authenticated',
              exp: Math.floor(Date.now() / 1000) + 3600
            }))}`,
            refresh_token: crypto.randomUUID(),
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: userId,
              email: body.email,
              created_at: now,
              updated_at: now,
              aud: 'authenticated',
              role: 'authenticated',
              email_confirmed_at: now
            }
          }, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }
      
      return HttpResponse.json({
        error: 'invalid_credentials',
        error_description: 'Invalid verification code'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return HttpResponse.json({
        error: 'invalid_request',
        error_description: 'Invalid JSON in request body'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  }),
  http.post('/:projectId/auth/v1/verify', withProjectResolution(async ({ request }: any) => {
    console.log('🔐 MSW: Handling verify request')
    try {
      const body = await request.json()
      console.log('📝 MSW verify body:', JSON.stringify(body))
      
      // Mock OTP verification - accept any 6-digit code
      if (body.type === 'sms' && body.phone && body.token) {
        if (body.token.length === 6 && /^\d+$/.test(body.token)) {
          // Generate mock user session for phone verification
          const userId = crypto.randomUUID()
          const now = new Date().toISOString()
          
          return HttpResponse.json({
            access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
              sub: userId,
              phone: body.phone,
              role: 'authenticated',
              aud: 'authenticated',
              exp: Math.floor(Date.now() / 1000) + 3600
            }))}`,
            refresh_token: crypto.randomUUID(),
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: userId,
              phone: body.phone,
              created_at: now,
              updated_at: now,
              aud: 'authenticated',
              role: 'authenticated',
              phone_confirmed_at: now
            }
          }, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      } else if (body.type === 'email' && body.email && body.token) {
        if (body.token.length === 6 && /^\d+$/.test(body.token)) {
          // Generate mock user session for email verification
          const userId = crypto.randomUUID()
          const now = new Date().toISOString()
          
          return HttpResponse.json({
            access_token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({
              sub: userId,
              email: body.email,
              role: 'authenticated',
              aud: 'authenticated',
              exp: Math.floor(Date.now() / 1000) + 3600
            }))}`,
            refresh_token: crypto.randomUUID(),
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: userId,
              email: body.email,
              created_at: now,
              updated_at: now,
              aud: 'authenticated',
              role: 'authenticated',
              email_confirmed_at: now
            }
          }, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }
      
      return HttpResponse.json({
        error: 'invalid_credentials',
        error_description: 'Invalid verification code'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    } catch (error) {
      return HttpResponse.json({
        error: 'invalid_request',
        error_description: 'Invalid JSON in request body'
      }, {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  })),

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
  http.get('/auth/v1/session', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'session',
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
  })),
  http.get('/:projectId/auth/v1/session', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'session',
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
  })),

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

  // User profile update endpoints
  http.put('/auth/v1/user', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user',
      method: 'PUT',
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
  http.put('/:projectId/auth/v1/user', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user',
      method: 'PUT',
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

  // Password recovery endpoints
  http.post('/auth/v1/recover', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'recover',
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
  http.post('/:projectId/auth/v1/recover', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'recover',
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

  // Token verification endpoints
  http.post('/auth/v1/verify', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'verify',
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
  http.post('/:projectId/auth/v1/verify', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'verify',
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

  // Magic link endpoints
  http.post('/auth/v1/magiclink', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'magiclink',
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
  http.post('/:projectId/auth/v1/magiclink', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'magiclink',
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

  // OTP endpoints
  http.post('/auth/v1/otp', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'otp',
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
  http.post('/:projectId/auth/v1/otp', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'otp',
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

  // MFA Factor endpoints
  http.get('/auth/v1/factors', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
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
  })),
  http.get('/:projectId/auth/v1/factors', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
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
  })),

  http.post('/auth/v1/factors', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
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
  http.post('/:projectId/auth/v1/factors', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'factors',
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

  // MFA Challenge and Verify endpoints
  http.post('/auth/v1/factors/:factorId/challenge', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}/challenge`,
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
  http.post('/:projectId/auth/v1/factors/:factorId/challenge', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}/challenge`,
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

  http.post('/auth/v1/factors/:factorId/verify', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}/verify`,
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
  http.post('/:projectId/auth/v1/factors/:factorId/verify', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}/verify`,
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

  http.delete('/auth/v1/factors/:factorId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}`,
      method: 'DELETE',
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
  http.delete('/:projectId/auth/v1/factors/:factorId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `factors/${params.factorId}`,
      method: 'DELETE',
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

  // OAuth endpoints
  http.get('/auth/v1/authorize', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'authorize',
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
  })),
  http.get('/:projectId/auth/v1/authorize', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'authorize',
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
  })),

  http.post('/auth/v1/callback', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'callback',
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
  http.post('/:projectId/auth/v1/callback', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'callback',
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

  // User identity management
  http.get('/auth/v1/user/identities', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user/identities',
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
  })),
  http.get('/:projectId/auth/v1/user/identities', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user/identities',
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
  })),

  http.post('/auth/v1/user/identities', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user/identities',
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
  http.post('/:projectId/auth/v1/user/identities', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'user/identities',
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

  http.delete('/auth/v1/user/identities/:identityId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `user/identities/${params.identityId}`,
      method: 'DELETE',
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
  http.delete('/:projectId/auth/v1/user/identities/:identityId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `user/identities/${params.identityId}`,
      method: 'DELETE',
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

  // Admin endpoints
  http.get('/auth/v1/admin/users', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/users',
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
  })),
  http.get('/:projectId/auth/v1/admin/users', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/users',
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
  })),

  http.post('/auth/v1/admin/users', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/users',
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
  http.post('/:projectId/auth/v1/admin/users', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/users',
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

  http.get('/auth/v1/admin/users/:userId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
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
  })),
  http.get('/:projectId/auth/v1/admin/users/:userId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
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
  })),

  http.put('/auth/v1/admin/users/:userId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
      method: 'PUT',
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
  http.put('/:projectId/auth/v1/admin/users/:userId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
      method: 'PUT',
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

  http.delete('/auth/v1/admin/users/:userId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
      method: 'DELETE',
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
  http.delete('/:projectId/auth/v1/admin/users/:userId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `admin/users/${params.userId}`,
      method: 'DELETE',
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

  http.post('/auth/v1/admin/generate_link', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/generate_link',
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
  http.post('/:projectId/auth/v1/admin/generate_link', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'admin/generate_link',
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

  // Session management endpoints
  http.get('/auth/v1/sessions', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'sessions',
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
  })),
  http.get('/:projectId/auth/v1/sessions', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'sessions',
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
  })),

  http.delete('/auth/v1/sessions/:sessionId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `sessions/${params.sessionId}`,
      method: 'DELETE',
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
  http.delete('/:projectId/auth/v1/sessions/:sessionId', withProjectResolution(async ({ request, params }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: `sessions/${params.sessionId}`,
      method: 'DELETE',
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

  // Email resend endpoints
  http.post('/auth/v1/resend', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'resend',
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
  http.post('/:projectId/auth/v1/resend', withProjectResolution(async ({ request }: any) => {
    const response = await authBridge.handleAuthRequest({
      endpoint: 'resend',
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

  // ==== ADMIN ENDPOINTS (server-level) ====

  // List all projects
  http.get('/admin/projects', async ({ request: _request }: any) => {
    try {
      console.log('🔧 MSW: Admin - List projects');
      
      const projects = projectManager.getProjects();
      
      // Convert to admin-friendly format
      const adminProjects = projects.map(project => ({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt.toISOString(),
        lastAccessed: project.lastAccessed.toISOString(),
        isActive: project.isActive
      }));

      return HttpResponse.json({
        projects: adminProjects
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error: any) {
      console.error('❌ MSW: Admin list projects error:', error);
      return HttpResponse.json({
        error: 'ADMIN_ERROR',
        message: error.message || 'Failed to list projects'
      }, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }),

  // Create a new project
  http.post('/admin/projects', async ({ request }: any) => {
    try {
      const { name } = await request.json();
      
      if (!name || typeof name !== 'string') {
        return HttpResponse.json({
          error: 'VALIDATION_ERROR',
          message: 'Project name is required and must be a string'
        }, {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      console.log('🔧 MSW: Admin - Create project:', name);
      
      const newProject = await projectManager.createProject(name.trim());
      
      // Convert to admin-friendly format
      const adminProject = {
        id: newProject.id,
        name: newProject.name,
        createdAt: newProject.createdAt.toISOString(),
        lastAccessed: newProject.lastAccessed.toISOString(),
        isActive: newProject.isActive
      };

      return HttpResponse.json({
        project: adminProject
      }, {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error: any) {
      console.error('❌ MSW: Admin create project error:', error);
      
      // Check for duplicate name error
      if (error.message && error.message.includes('already exists')) {
        return HttpResponse.json({
          error: 'DUPLICATE_NAME',
          message: error.message
        }, {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      return HttpResponse.json({
        error: 'ADMIN_ERROR',
        message: error.message || 'Failed to create project'
      }, {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }),

  // Delete a project
  http.delete('/admin/projects/:projectId', async ({ params, request: _request }: any) => {
    try {
      const projectId = params.projectId;
      
      if (!projectId || typeof projectId !== 'string') {
        return HttpResponse.json({
          error: 'VALIDATION_ERROR',
          message: 'Project ID is required'
        }, {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      console.log('🔧 MSW: Admin - Delete project:', projectId);
      
      // Check if project exists first
      const projects = projectManager.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        return HttpResponse.json({
          error: 'NOT_FOUND',
          message: 'Project not found'
        }, {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      await projectManager.deleteProject(projectId);

      return HttpResponse.json({
        message: 'Project deleted successfully'
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error: any) {
      console.error('❌ MSW: Admin delete project error:', error);
      return HttpResponse.json({
        error: 'ADMIN_ERROR',
        message: error.message || 'Failed to delete project'
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

  // ==== BUCKET MANAGEMENT ENDPOINTS ====

  // Create bucket
  http.post('/storage/v1/bucket', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await request.json();
      const { id, name, public: isPublic = false, file_size_limit, allowed_mime_types, avif_autodetection = false } = body;
      
      if (!id) {
        return HttpResponse.json(
          { error: 'Bucket id is required', message: 'Bucket id must be provided' },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      console.log('🪣 MSW: Creating bucket:', { id, name: name || id, public: isPublic, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleCreateBucketRequest({
        id,
        name: name || id,
        public: isPublic,
        file_size_limit,
        allowed_mime_types,
        avif_autodetection
      });

      console.log('✅ MSW: Bucket created:', { id, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket creation error:', error);
      return HttpResponse.json(
        { error: 'bucket_creation_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.post('/:projectId/storage/v1/bucket', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await request.json();
      const { id, name, public: isPublic = false, file_size_limit, allowed_mime_types, avif_autodetection = false } = body;
      
      if (!id) {
        return HttpResponse.json(
          { error: 'Bucket id is required', message: 'Bucket id must be provided' },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      console.log('🪣 MSW: Creating bucket (with project):', { id, name: name || id, public: isPublic, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleCreateBucketRequest({
        id,
        name: name || id,
        public: isPublic,
        file_size_limit,
        allowed_mime_types,
        avif_autodetection
      });

      console.log('✅ MSW: Bucket created:', { id, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket creation error:', error);
      return HttpResponse.json(
        { error: 'bucket_creation_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // List buckets
  http.get('/storage/v1/bucket', withProjectResolution(async ({ projectInfo }: any) => {
    try {
      console.log('🪣 MSW: Listing buckets for project:', projectInfo?.projectId);

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleListBucketsRequest();
      console.log('✅ MSW: Buckets listed:', { status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket listing error:', error);
      return HttpResponse.json(
        { error: 'bucket_listing_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.get('/:projectId/storage/v1/bucket', withProjectResolution(async ({ projectInfo }: any) => {
    try {
      console.log('🪣 MSW: Listing buckets for project:', projectInfo?.projectId);

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleListBucketsRequest();
      console.log('✅ MSW: Buckets listed:', { status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket listing error:', error);
      return HttpResponse.json(
        { error: 'bucket_listing_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // Get bucket details
  http.get('/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Getting bucket details:', { bucketId, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleGetBucketRequest({ bucketId });
      console.log('✅ MSW: Bucket details retrieved:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket get error:', error);
      return HttpResponse.json(
        { error: 'bucket_get_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.get('/:projectId/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Getting bucket details:', { bucketId, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleGetBucketRequest({ bucketId });
      console.log('✅ MSW: Bucket details retrieved:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket get error:', error);
      return HttpResponse.json(
        { error: 'bucket_get_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // Update bucket
  http.put('/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      const updates = await request.json();
      console.log('🪣 MSW: Updating bucket:', { bucketId, updates, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleUpdateBucketRequest({ bucketId, updates });
      console.log('✅ MSW: Bucket updated:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket update error:', error);
      return HttpResponse.json(
        { error: 'bucket_update_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.put('/:projectId/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      const updates = await request.json();
      console.log('🪣 MSW: Updating bucket:', { bucketId, updates, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleUpdateBucketRequest({ bucketId, updates });
      console.log('✅ MSW: Bucket updated:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket update error:', error);
      return HttpResponse.json(
        { error: 'bucket_update_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // Delete bucket
  http.delete('/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Deleting bucket:', { bucketId, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleDeleteBucketRequest({ bucketId });
      console.log('✅ MSW: Bucket deleted:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket deletion error:', error);
      return HttpResponse.json(
        { error: 'bucket_deletion_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.delete('/:projectId/storage/v1/bucket/:bucketId', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Deleting bucket:', { bucketId, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleDeleteBucketRequest({ bucketId });
      console.log('✅ MSW: Bucket deleted:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket deletion error:', error);
      return HttpResponse.json(
        { error: 'bucket_deletion_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // Empty bucket
  http.post('/storage/v1/bucket/:bucketId/empty', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Emptying bucket:', { bucketId, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleEmptyBucketRequest({ bucketId });
      console.log('✅ MSW: Bucket emptied:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket empty error:', error);
      return HttpResponse.json(
        { error: 'bucket_empty_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.post('/:projectId/storage/v1/bucket/:bucketId/empty', withProjectResolution(async ({ params, projectInfo }: any) => {
    try {
      const bucketId = params.bucketId as string;
      console.log('🪣 MSW: Emptying bucket:', { bucketId, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleEmptyBucketRequest({ bucketId });
      console.log('✅ MSW: Bucket emptied:', { bucketId, status: response.status });
      return response;
    } catch (error) {
      console.error('❌ MSW: Bucket empty error:', error);
      return HttpResponse.json(
        { error: 'bucket_empty_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // ==== VFS (Virtual File System) ENDPOINTS ====
  
  // Directory listing endpoints (more specific patterns first)
  http.get('/storage/v1/object/list/:bucket', withProjectResolution(createVFSListHandler())),
  http.get('/:projectId/storage/v1/object/list/:bucket', withProjectResolution(createVFSListHandler())),
  http.get('/storage/v1/object/list/:bucket/*', withProjectResolution(createVFSListHandler())),
  http.get('/:projectId/storage/v1/object/list/:bucket/*', withProjectResolution(createVFSListHandler())),
  
  // Signed URL endpoints (more specific patterns first)
  http.post('/storage/v1/object/sign/:bucket/*', withProjectResolution(createSignedUrlHandler())),
  http.post('/:projectId/storage/v1/object/sign/:bucket/*', withProjectResolution(createSignedUrlHandler())),
  http.post('/storage/v1/object/upload/sign/:bucket/*', withProjectResolution(createSignedUploadUrlHandler())),
  http.post('/:projectId/storage/v1/object/upload/sign/:bucket/*', withProjectResolution(createSignedUploadUrlHandler())),
  
  // Public file access
  http.get('/storage/v1/object/public/:bucket/*', withProjectResolution(createPublicUrlHandler())),
  http.get('/:projectId/storage/v1/object/public/:bucket/*', withProjectResolution(createPublicUrlHandler())),
  
  // Authenticated file access (with signed URLs)
  http.get('/storage/v1/object/authenticated/:bucket/*', withProjectResolution(createAuthenticatedFileHandler())),
  http.get('/:projectId/storage/v1/object/authenticated/:bucket/*', withProjectResolution(createAuthenticatedFileHandler())),
  
  // File serving endpoints (Supabase Storage API compatible)
  http.get('/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileGetHandler())),
  http.get('/:projectId/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileGetHandler())),
  
  // File upload endpoints
  http.post('/storage/v1/object/:bucket/*', withProjectResolution(createVFSFilePostHandler())),
  http.post('/:projectId/storage/v1/object/:bucket/*', withProjectResolution(createVFSFilePostHandler())),
  
  // File deletion endpoints
  http.delete('/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileDeleteHandler())),
  http.delete('/:projectId/storage/v1/object/:bucket/*', withProjectResolution(createVFSFileDeleteHandler())),
  
  // Advanced file operations
  http.post('/storage/v1/object/move', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await request.json();
      const { bucketId, sourceKey, destinationKey } = body;
      
      console.log('📂 MSW: Moving file:', { bucketId, sourceKey, destinationKey, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleMoveFileRequest({
        bucket: bucketId,
        sourceKey,
        destinationKey
      });

      console.log('✅ MSW: File moved:', { bucketId, sourceKey, destinationKey });
      return response;
    } catch (error) {
      console.error('❌ MSW: File move error:', error);
      return HttpResponse.json(
        { error: 'file_move_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.post('/:projectId/storage/v1/object/move', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await request.json();
      const { bucketId, sourceKey, destinationKey } = body;
      
      console.log('📂 MSW: Moving file:', { bucketId, sourceKey, destinationKey, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleMoveFileRequest({
        bucket: bucketId,
        sourceKey,
        destinationKey
      });

      console.log('✅ MSW: File moved:', { bucketId, sourceKey, destinationKey });
      return response;
    } catch (error) {
      console.error('❌ MSW: File move error:', error);
      return HttpResponse.json(
        { error: 'file_move_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.post('/storage/v1/object/copy', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await request.json();
      const { bucketId, sourceKey, destinationKey } = body;
      
      console.log('📂 MSW: Copying file:', { bucketId, sourceKey, destinationKey, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleCopyFileRequest({
        bucket: bucketId,
        sourceKey,
        destinationKey
      });

      console.log('✅ MSW: File copied:', { bucketId, sourceKey, destinationKey });
      return response;
    } catch (error) {
      console.error('❌ MSW: File copy error:', error);
      return HttpResponse.json(
        { error: 'file_copy_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.post('/:projectId/storage/v1/object/copy', withProjectResolution(async ({ request, projectInfo }: any) => {
    try {
      const body = await request.json();
      const { bucketId, sourceKey, destinationKey } = body;
      
      console.log('📂 MSW: Copying file:', { bucketId, sourceKey, destinationKey, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleCopyFileRequest({
        bucket: bucketId,
        sourceKey,
        destinationKey
      });

      console.log('✅ MSW: File copied:', { bucketId, sourceKey, destinationKey });
      return response;
    } catch (error) {
      console.error('❌ MSW: File copy error:', error);
      return HttpResponse.json(
        { error: 'file_copy_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // Batch delete files
  http.delete('/storage/v1/object/:bucket', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucket = params.bucket as string;
      const body = await request.json();
      const { prefixes } = body;
      
      console.log('📂 MSW: Batch deleting files:', { bucket, prefixes, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleBatchDeleteRequest({
        bucket,
        prefixes
      });

      console.log('✅ MSW: Files batch deleted:', { bucket, count: prefixes.length });
      return response;
    } catch (error) {
      console.error('❌ MSW: Batch delete error:', error);
      return HttpResponse.json(
        { error: 'batch_delete_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  http.delete('/:projectId/storage/v1/object/:bucket', withProjectResolution(async ({ params, request, projectInfo }: any) => {
    try {
      const bucket = params.bucket as string;
      const body = await request.json();
      const { prefixes } = body;
      
      console.log('📂 MSW: Batch deleting files:', { bucket, prefixes, projectId: projectInfo?.projectId });

      // Initialize VFS for the current project
      if (projectInfo?.projectId) {
        await vfsBridge.initializeForProject(projectInfo.projectId);
      }

      const response = await vfsBridge.handleBatchDeleteRequest({
        bucket,
        prefixes
      });

      console.log('✅ MSW: Files batch deleted:', { bucket, count: prefixes.length });
      return response;
    } catch (error) {
      console.error('❌ MSW: Batch delete error:', error);
      return HttpResponse.json(
        { error: 'batch_delete_failed', message: (error as Error).message },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),
  
  // Direct file access (public files)
  http.get('/files/:bucket/*', withProjectResolution(createVFSFileGetHandler())),
  http.get('/:projectId/files/:bucket/*', withProjectResolution(createVFSFileGetHandler())),
  
  // SPA (Single Page Application) hosting 
  // These only handle requests forwarded from Vite middleware via WebSocket
  http.get('/app/*', withProjectResolution(createSPAHandler())),
  http.get('/:projectId/app/*', withProjectResolution(createSPAHandler())),

  // Edge Functions handlers - Handle both GET and POST requests
  http.all('/functions/:functionName', withProjectResolution(async ({ params, request }: any) => {
    try {
      const functionName = params.functionName as string;
      
      // Extract headers for authentication (Supabase.js compatibility)
      const apikey = request.headers.get('apikey');
      const authorization = request.headers.get('authorization');
      
      logger.info('Edge function invoked via Supabase.js', { 
        functionName,
        hasApikey: !!apikey,
        hasAuth: !!authorization,
        method: request.method
      });
      
      // Try multiple possible paths for the function file
      const possiblePaths = [
        `edge-functions/${functionName}.ts`,
        `edge-functions/${functionName}/index.ts`,
        `edge-functions/${functionName}.js`,
      ];
      
      let functionFile = null;
      // let functionPath = '';
      
      for (const path of possiblePaths) {
        functionFile = await vfsManager.readFile(path);
        if (functionFile) {
          // functionPath = path;
          break;
        }
      }
      
      if (!functionFile) {
        return HttpResponse.json(
          { error: 'Function not found', message: `Function '${functionName}' not found. Tried paths: ${possiblePaths.join(', ')}` },
          { 
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Get request body
      let requestBody: unknown = null;
      try {
        const text = await request.text();
        if (text) {
          requestBody = JSON.parse(text);
        }
      } catch {
        // No body or invalid JSON, continue with null
      }

      // Simulate function execution
      const executionResult = await simulateEdgeFunctionExecution(
        functionName,
        functionFile.content || '',
        requestBody
      );

      logger.info('Edge function executed', { 
        functionName,
        status: executionResult.status,
        duration: executionResult.executionTime
      });

      return HttpResponse.json(executionResult.response as any, {
        status: executionResult.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Function-Name': functionName,
          'X-Execution-Time': executionResult.executionTime.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
          ...executionResult.headers
        }
      });
    } catch (error) {
      logger.error('Edge function execution failed', error as Error);
      return HttpResponse.json(
        { 
          error: 'Function execution failed',
          message: (error as Error).message
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // Edge Functions handlers with project ID - Handle both GET and POST requests
  http.all('/:projectId/functions/:functionName', withProjectResolution(async ({ params, request }: any) => {
    try {
      const functionName = params.functionName as string;
      
      // Extract headers for authentication (Supabase.js compatibility)
      const apikey = request.headers.get('apikey');
      const authorization = request.headers.get('authorization');
      
      logger.info('Edge function invoked via Supabase.js (with project ID)', { 
        functionName,
        hasApikey: !!apikey,
        hasAuth: !!authorization,
        method: request.method
      });
      
      // Try multiple possible paths for the function file
      const possiblePaths = [
        `edge-functions/${functionName}.ts`,
        `edge-functions/${functionName}/index.ts`,
        `edge-functions/${functionName}.js`,
      ];
      
      let functionFile = null;
      // let functionPath = '';
      
      for (const path of possiblePaths) {
        functionFile = await vfsManager.readFile(path);
        if (functionFile) {
          // functionPath = path;
          break;
        }
      }
      
      if (!functionFile) {
        return HttpResponse.json(
          { error: 'Function not found', message: `Function '${functionName}' not found. Tried paths: ${possiblePaths.join(', ')}` },
          { 
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Get request body
      let requestBody: unknown = null;
      try {
        const text = await request.text();
        if (text) {
          requestBody = JSON.parse(text);
        }
      } catch {
        // No body or invalid JSON, continue with null
      }

      // Simulate function execution
      const executionResult = await simulateEdgeFunctionExecution(
        functionName,
        functionFile.content || '',
        requestBody
      );

      logger.info('Edge function executed', { 
        functionName,
        status: executionResult.status,
        duration: executionResult.executionTime
      });

      return HttpResponse.json(executionResult.response as any, {
        status: executionResult.status,
        headers: {
          'Content-Type': 'application/json',
          'X-Function-Name': functionName,
          'X-Execution-Time': executionResult.executionTime.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
          ...executionResult.headers
        }
      });
    } catch (error) {
      logger.error('Edge function execution failed', error as Error);
      return HttpResponse.json(
        { 
          error: 'Function execution failed',
          message: (error as Error).message
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  })),

  // Edge Functions handlers with /v1/ prefix (Supabase.js compatibility)
  http.all('/functions/v1/:functionName', async ({ params, request: _request }: any) => {
    console.log('✅ EDGE FUNCTION HANDLER CALLED:', params.functionName)
    return HttpResponse.json({ message: 'Edge function handler working', function: params.functionName }, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    })
  }),

  // CORS preflight requests AND catch-all for Edge Functions
  http.all('*', ({ request }: any) => {
    const url = new URL(request.url)
    
    // Handle Edge Functions requests that weren't caught by earlier handlers
    if (url.pathname.includes('/functions/v1/')) {
      const pathParts = url.pathname.split('/')
      const functionNameIndex = pathParts.findIndex(part => part === 'v1') + 1
      const functionName = pathParts[functionNameIndex]
      
      console.log('✅ CATCH-ALL EDGE FUNCTION HANDLER:', functionName, request.method)
      
      if (request.method === 'OPTIONS') {
        return new HttpResponse(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
            'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range, content-range, x-function-name',
            'Access-Control-Expose-Headers': 'Content-Range, Content-Type, X-Function-Name, X-Execution-Time',
            'Access-Control-Max-Age': '86400'
          }
        })
      }
      
      // Handle actual Edge Functions invocation
      return HttpResponse.json({ 
        message: 'Edge function working via catch-all', 
        function: functionName,
        method: request.method,
        url: url.pathname
      }, { 
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      })
    }
    
    // Default CORS preflight for all other requests
    if (request.method === 'OPTIONS') {
      return new HttpResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, range, content-range, x-function-name',
          'Access-Control-Expose-Headers': 'Content-Range, Content-Type, X-Function-Name, X-Execution-Time',
          'Access-Control-Max-Age': '86400'
        }
      })
    }
    
    // Let other non-OPTIONS requests pass through (not handled by this catch-all)
    return
  })
]
