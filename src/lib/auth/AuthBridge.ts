import { AuthManager } from './core/AuthManager'
import { JWTService } from './core/JWTService'
import { SessionManager } from './core/SessionManager'
import { MFAService } from './services/MFAService'
import type { 
  SignUpRequest, 
  SignUpResponse, 
  SignInRequest, 
  SignInResponse,
  UpdateUserRequest,
  UpdateUserResponse,
  RecoverPasswordRequest,
  VerifyTokenRequest,
  MFAEnrollRequest,
  MFAVerifyRequest,
  MFAChallengeRequest,
  AuthError
} from './types'
import type { AuthError as AuthErrorType } from './types'

export interface AuthAPIRequest {
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: any
  headers: Record<string, string>
  url: URL
}

export interface AuthAPIResponse {
  data?: any
  error?: AuthError
  status: number
  headers: Record<string, string>
}

export class AuthBridge {
  private static instance: AuthBridge
  private authManager: AuthManager
  private jwtService: JWTService  
  private sessionManager: SessionManager
  private mfaService: MFAService
  private isInitialized: boolean = false
  private initializationPromise: Promise<void> | null = null

  constructor() {
    this.authManager = AuthManager.getInstance()
    this.jwtService = JWTService.getInstance()
    this.sessionManager = SessionManager.getInstance()
    this.mfaService = MFAService.getInstance()
  }

  static getInstance(): AuthBridge {
    if (!AuthBridge.instance) {
      AuthBridge.instance = new AuthBridge()
    }
    return AuthBridge.instance
  }

  /**
   * Initialize auth bridge
   */
  async initialize(): Promise<void> {
    // Return immediately if already initialized
    if (this.isInitialized) {
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this._doInitialize();
    
    try {
      await this.initializationPromise;
      this.isInitialized = true;
    } catch (error) {
      // Reset on failure so we can retry
      this.initializationPromise = null;
      throw error;
    }
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('AuthBridge: Starting initialization...')
      await this.authManager.initialize()
      console.log('AuthBridge: Initialization completed successfully')
    } catch (error) {
      console.error('AuthBridge: Database initialization failed with details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      })
      throw error  // Don't mask the real error
    }
  }


  /**
   * Handle auth API requests
   */
  async handleAuthRequest(request: AuthAPIRequest): Promise<AuthAPIResponse> {
    const requestId = Math.random().toString(36).substring(7);
    
    try {
      console.log(`🔐 AuthBridge[${requestId}]: Handling ${request.method} ${request.endpoint}`)
      console.log(`🔐 AuthBridge[${requestId}]: Request body:`, request.body)
      
      console.log(`🔐 AuthBridge[${requestId}]: About to initialize`)
      await this.initialize()
      console.log(`🔐 AuthBridge[${requestId}]: Initialization complete`)
      
      const { endpoint, method, body, headers } = request
      
      console.log(`🔐 AuthBridge[${requestId}]: About to handle endpoint: ${method} ${endpoint}`)
      
      switch (`${method} ${endpoint}`) {
        // Authentication endpoints
        case 'POST signup':
          return await this.handleSignUp(body as SignUpRequest)
          
        case 'POST signin':
          return await this.handleSignIn(body as SignInRequest)
          
        case 'POST token':
          return await this.handleTokenRefresh(body)
          
        case 'POST logout':
          return await this.handleSignOut(body)
          
        // User management
        case 'GET user':
          return await this.handleGetUser(headers)
          
        case 'PUT user':
          return await this.handleUpdateUser(body as UpdateUserRequest, headers)
          
        // Session management
        case 'GET session':
          return await this.handleGetSession(headers)
          
        // Password recovery
        case 'POST recover':
          return await this.handleRecoverPassword(body as RecoverPasswordRequest)
          
        case 'POST verify':
          return await this.handleVerifyToken(body as VerifyTokenRequest)
          
        // MFA endpoints
        case 'GET factors':
          return await this.handleListFactors(headers)
          
        case 'POST factors':
          return await this.handleEnrollFactor(body as MFAEnrollRequest, headers)
          
        case 'POST factors/verify':
          return await this.handleVerifyFactor(body as MFAVerifyRequest, headers)
          
        case 'POST factors/challenge':
          return await this.handleCreateChallenge(body as MFAChallengeRequest, headers)
          
        case 'DELETE factors':
          return await this.handleUnenrollFactor(body, headers)
          
        // Discovery endpoints
        case 'GET .well-known/jwks.json':
          return await this.handleJWKS()
          
        default:
          return this.createErrorResponse(
            'Endpoint not found', 
            404, 
            'endpoint_not_found'
          )
      }
      
    } catch (error) {
      console.error(`❌ AuthBridge[${requestId}]: Request failed:`, {
        endpoint: request.endpoint,
        method: request.method,
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
          code: error?.code,
          status: error?.status
        }
      })
      return this.handleError(error)
    }
  }


  /**
   * Auth endpoint handlers
   */
  private async handleSignUp(request: SignUpRequest): Promise<AuthAPIResponse> {
    console.log('AuthBridge handleSignUp received:', { email: request.email })
    
    try {
      const result = await this.authManager.signUp({
        email: request.email,
        phone: request.phone,
        password: request.password,
        data: request.data
      })

      console.log('SignUp successful with real database authentication')

      const response: SignUpResponse = {
        user: this.serializeUser(result.user),
        session: result.session ? this.serializeSession(result.session) : null
      }

      if (!result.session) {
        response.message = 'Confirmation email sent'
      }

      return this.createSuccessResponse(response, 201)
    } catch (error) {
      console.log('SignUp failed:', error)
      throw error
    }
  }

  private async handleSignIn(request: SignInRequest): Promise<AuthAPIResponse> {
    console.log('AuthBridge handleSignIn received:', request)
    
    try {
      const result = await this.authManager.signIn({
        email: request.email,
        phone: request.phone,
        password: request.password,
        provider: request.provider
      })

      console.log('SignIn successful with real database authentication')

      const response: SignInResponse = {
        user: this.serializeUser(result.user),
        session: this.serializeSession(result.session)
      }

      return this.createSuccessResponse(response, 200)
    } catch (error) {
      console.log('SignIn failed:', error)
      throw error
    }
  }

  private async handleTokenRefresh(request: any): Promise<AuthAPIResponse> {
    // Debug logging
    console.log('AuthBridge handleTokenRefresh received:', request)
    console.log('Grant type from body:', request.grant_type)
    
    // Handle both password authentication and token refresh
    if (request.grant_type === 'password') {
      // This is a sign-in request using password
      console.log('AuthBridge calling authManager.signIn with:', {
        email: request.username || request.email,
        password: request.password ? '[REDACTED]' : undefined
      })
      
      let result
      try {
        result = await this.authManager.signIn({
          email: request.username || request.email,
          password: request.password
        })
        
        console.log('AuthBridge signIn success with real database authentication')
      } catch (error) {
        console.error('AuthBridge signIn failed:', error)
        throw error
      }

      return this.createSuccessResponse({
        access_token: result.session.access_token,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: result.session.expires_at,
        refresh_token: result.session.refresh_token,
        user: this.serializeUser(result.user)
      }, 200)
    } else if (request.grant_type === 'refresh_token') {
      // This is a token refresh request
      try {
        const session = await this.authManager.refreshSession(request.refresh_token)
        
        // Get the current user from the session manager
        const currentUser = this.sessionManager.getUser()
        if (!currentUser) {
          throw new Error('No user found for session refresh')
        }
        
        return this.createSuccessResponse({
          access_token: session.access_token,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: session.expires_at,
          refresh_token: session.refresh_token,
          user: this.serializeUser(currentUser)
        }, 200)
      } catch (error) {
        console.error('Refresh token error:', error)
        return this.createErrorResponse(
          'Invalid refresh token',
          400,
          'invalid_grant'
        )
      }
    } else {
      return this.createErrorResponse(
        'Invalid grant type. Supported grant types: password, refresh_token',
        400,
        'invalid_grant'
      )
    }
  }

  private async handleSignOut(request: any): Promise<AuthAPIResponse> {
    await this.authManager.signOut(request.scope || 'local')
    return this.createSuccessResponse(null, 204)
  }

  private async handleGetUser(headers: Record<string, string>): Promise<AuthAPIResponse> {
    console.log('AuthBridge handleGetUser called')
    
    try {
      this.validateAuthToken(headers)
      
      const user = this.authManager.getCurrentUser()
      if (!user) {
        return this.createErrorResponse(
          'User not found',
          404,
          'user_not_found'
        )
      }

      console.log('User found in auth system:', user.email)
      return this.createSuccessResponse(this.serializeUser(user), 200)
    } catch (error) {
      console.error('Error in handleGetUser:', error)
      if (error.status && error.code) {
        return this.createErrorResponse(error.message, error.status, error.code)
      }
      return this.createErrorResponse(
        'Authentication failed',
        401,
        'auth_failed'
      )
    }
  }

  private async handleUpdateUser(request: UpdateUserRequest, headers: Record<string, string>): Promise<AuthAPIResponse> {
    this.validateAuthToken(headers)
    
    const user = await this.authManager.updateUser({
      email: request.email,
      phone: request.phone,
      password: request.password,
      data: request.data
    })

    const response: UpdateUserResponse = {
      user: this.serializeUser(user)
    }

    return this.createSuccessResponse(response, 200)
  }

  private async handleGetSession(headers: Record<string, string>): Promise<AuthAPIResponse> {
    console.log('AuthBridge handleGetSession called')
    
    try {
      // Note: Session endpoint does NOT require authentication
      // It's used to check current session status
      const session = this.sessionManager.getSession()
      
      if (!session) {
        // Return null for no session (this is expected behavior)
        return this.createSuccessResponse(null, 200)
      }

      // Check if session is still valid
      const sessionInfo = this.sessionManager.getSessionInfo()
      if (!sessionInfo.isValid) {
        console.log('Session found but expired, returning null')
        return this.createSuccessResponse(null, 200)
      }

      console.log('Valid session found for user:', session.user?.email)
      return this.createSuccessResponse(this.serializeSession(session), 200)
      
    } catch (error) {
      console.error('Error in handleGetSession:', error)
      // For session endpoint, return null on error rather than 401
      // This allows clients to handle "no session" gracefully
      return this.createSuccessResponse(null, 200)
    }
  }

  private async handleRecoverPassword(request: RecoverPasswordRequest): Promise<AuthAPIResponse> {
    await this.authManager.requestPasswordRecovery(request.email)
    
    return this.createSuccessResponse({
      message: 'Recovery email sent'
    }, 200)
  }

  private async handleVerifyToken(_request: VerifyTokenRequest): Promise<AuthAPIResponse> {
    // Implementation depends on token type
    // For now, return success
    return this.createSuccessResponse({
      access_token: 'verified',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: null
    }, 200)
  }

  /**
   * MFA endpoint handlers
   */
  private async handleListFactors(headers: Record<string, string>): Promise<AuthAPIResponse> {
    this.validateAuthToken(headers)
    
    const factors = await this.mfaService.listFactors()
    return this.createSuccessResponse(factors, 200)
  }

  private async handleEnrollFactor(request: MFAEnrollRequest, headers: Record<string, string>): Promise<AuthAPIResponse> {
    this.validateAuthToken(headers)
    
    const result = await this.mfaService.enrollFactor(
      request.factor_type,
      request.friendly_name,
      request.phone
    )

    return this.createSuccessResponse(result, 201)
  }

  private async handleCreateChallenge(request: MFAChallengeRequest, headers: Record<string, string>): Promise<AuthAPIResponse> {
    this.validateAuthToken(headers)
    
    const result = await this.mfaService.createChallenge(request.factor_id)
    return this.createSuccessResponse(result, 200)
  }

  private async handleVerifyFactor(request: MFAVerifyRequest, headers: Record<string, string>): Promise<AuthAPIResponse> {
    this.validateAuthToken(headers)
    
    const result = await this.mfaService.verifyChallenge(
      request.factor_id,
      request.challenge_id,
      request.code
    )

    return this.createSuccessResponse(result, 200)
  }

  private async handleUnenrollFactor(request: any, headers: Record<string, string>): Promise<AuthAPIResponse> {
    this.validateAuthToken(headers)
    
    await this.mfaService.unenrollFactor(request.factor_id)
    return this.createSuccessResponse(null, 204)
  }

  /**
   * Discovery endpoints
   */
  private async handleJWKS(): Promise<AuthAPIResponse> {
    const jwks = await this.jwtService.getJWKS()
    return this.createSuccessResponse(jwks, 200, {
      'Cache-Control': 'public, max-age=600', // 10 minutes
      'Content-Type': 'application/json'
    })
  }

  /**
   * Helper methods
   */
  private validateAuthToken(headers: Record<string, string>): void {
    const authHeader = headers.authorization || headers.Authorization
    
    if (!authHeader) {
      throw this.createAuthError('Missing authorization header', 401, 'missing_authorization')
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw this.createAuthError('Invalid authorization header format', 401, 'invalid_authorization')
    }

    const token = authHeader.substring(7)
    
    if (this.jwtService.isTokenExpired(token)) {
      throw this.createAuthError('Token expired', 401, 'token_expired')
    }
  }

  private serializeUser(user: any): any {
    return {
      id: user.id,
      aud: 'authenticated',
      role: user.role || 'authenticated',
      email: user.email,
      phone: user.phone,
      email_confirmed_at: user.email_verified ? user.created_at : null,
      phone_confirmed_at: user.phone_verified ? user.created_at : null,
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: user.app_metadata || {},
      user_metadata: user.user_metadata || {},
      identities: [],
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_anonymous: user.is_anonymous || false
    }
  }

  private serializeSession(session: any): any {
    return {
      access_token: session.access_token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: session.expires_at,
      refresh_token: session.refresh_token,
      user: this.serializeUser(this.sessionManager.getUser()!)
    }
  }

  private createSuccessResponse(data: any, status: number = 200, headers: Record<string, string> = {}): AuthAPIResponse {
    return {
      data,
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        ...headers
      }
    }
  }

  private createErrorResponse(message: string, status: number, code: string): AuthAPIResponse {
    const error: AuthError = {
      error: code,
      error_description: message
    } as any

    return {
      error,
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }

  private handleError(error: any): AuthAPIResponse {
    console.error('Auth API error:', error)
    
    // Handle ValidationError specifically
    if (error.name === 'ValidationError') {
      return this.createErrorResponse(
        error.message,
        400,
        'invalid_request'
      )
    }
    
    // Handle errors with explicit status and code
    if (error.status && error.code) {
      return this.createErrorResponse(error.message, error.status, error.code)
    }

    // Default fallback for unknown errors
    return this.createErrorResponse(
      'Internal server error',
      500,
      'internal_error'
    )
  }

  private createAuthError(message: string, status: number, code: string): AuthErrorType {
    const error = new Error(message) as AuthErrorType
    error.status = status
    error.code = code
    return error
  }
}