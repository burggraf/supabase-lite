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
    await this.authManager.initialize()
  }

  /**
   * Handle auth API requests
   */
  async handleAuthRequest(request: AuthAPIRequest): Promise<AuthAPIResponse> {
    try {
      await this.initialize()
      
      const { endpoint, method, body, headers } = request
      
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
      return this.handleError(error)
    }
  }

  /**
   * Auth endpoint handlers
   */
  private async handleSignUp(request: SignUpRequest): Promise<AuthAPIResponse> {
    const result = await this.authManager.signUp({
      email: request.email,
      phone: request.phone,
      password: request.password,
      data: request.data
    })

    const response: SignUpResponse = {
      user: this.serializeUser(result.user),
      session: result.session ? this.serializeSession(result.session) : null
    }

    if (!result.session) {
      response.message = 'Confirmation email sent'
    }

    return this.createSuccessResponse(response, 201)
  }

  private async handleSignIn(request: SignInRequest): Promise<AuthAPIResponse> {
    const result = await this.authManager.signIn({
      email: request.email,
      phone: request.phone,
      password: request.password,
      provider: request.provider
    })

    const response: SignInResponse = {
      user: this.serializeUser(result.user),
      session: this.serializeSession(result.session)
    }

    return this.createSuccessResponse(response, 200)
  }

  private async handleTokenRefresh(request: any): Promise<AuthAPIResponse> {
    if (request.grant_type !== 'refresh_token') {
      return this.createErrorResponse(
        'Invalid grant type',
        400,
        'invalid_grant'
      )
    }

    const session = await this.authManager.refreshSession(request.refresh_token)
    
    return this.createSuccessResponse({
      access_token: session.access_token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: session.expires_at,
      refresh_token: session.refresh_token,
      user: this.serializeUser(this.sessionManager.getUser()!)
    }, 200)
  }

  private async handleSignOut(request: any): Promise<AuthAPIResponse> {
    await this.authManager.signOut(request.scope || 'local')
    return this.createSuccessResponse(null, 204)
  }

  private async handleGetUser(headers: Record<string, string>): Promise<AuthAPIResponse> {
    this.validateAuthToken(headers)
    
    const user = this.authManager.getCurrentUser()
    if (!user) {
      return this.createErrorResponse(
        'User not found',
        404,
        'user_not_found'
      )
    }

    return this.createSuccessResponse(this.serializeUser(user), 200)
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

  private async handleRecoverPassword(request: RecoverPasswordRequest): Promise<AuthAPIResponse> {
    await this.authManager.requestPasswordRecovery(request.email)
    
    return this.createSuccessResponse({
      message: 'Recovery email sent'
    }, 200)
  }

  private async handleVerifyToken(request: VerifyTokenRequest): Promise<AuthAPIResponse> {
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        ...headers
      }
    }
  }

  private createErrorResponse(message: string, status: number, code: string): AuthAPIResponse {
    const error: AuthError = {
      error: code,
      error_description: message,
      message
    }

    return {
      error,
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  }

  private handleError(error: any): AuthAPIResponse {
    console.error('Auth API error:', error)
    
    if (error.status && error.code) {
      return this.createErrorResponse(error.message, error.status, error.code)
    }

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