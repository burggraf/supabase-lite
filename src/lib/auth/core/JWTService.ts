import { SignJWT, jwtVerify, importJWK, exportJWK } from 'jose'
import type { JWTPayload, JWTHeader, JWTSigningKey, JWKS, TokenPair } from '../types/jwt.types'
import type { User, Session } from '../types/auth.types'
import { CryptoUtils } from '../utils/crypto'

export interface JWTConfig {
  issuer: string
  projectRef: string
  accessTokenExpirySeconds: number
  refreshTokenExpirySeconds: number
}

export class JWTService {
  private static instance: JWTService
  private keyPair: CryptoKeyPair | null = null
  private publicKeyJWK: JWTSigningKey | null = null
  private kid: string
  private config: JWTConfig

  constructor(config?: Partial<JWTConfig>) {
    this.config = {
      issuer: 'https://supabase-lite.local/auth/v1',
      projectRef: 'supabase-lite-local',
      accessTokenExpirySeconds: 3600, // 1 hour
      refreshTokenExpirySeconds: 604800, // 7 days
      ...config
    }
    this.kid = CryptoUtils.generateUUID()
  }

  static getInstance(config?: Partial<JWTConfig>): JWTService {
    if (!JWTService.instance) {
      JWTService.instance = new JWTService(config)
    }
    return JWTService.instance
  }

  /**
   * Initialize the JWT service with ES256 key pair
   */
  async initialize(): Promise<void> {
    if (!this.keyPair) {
      this.keyPair = await CryptoUtils.generateES256KeyPair()
      this.publicKeyJWK = await this.createPublicKeyJWK()
    }
  }

  /**
   * Create public key in JWK format
   */
  private async createPublicKeyJWK(): Promise<JWTSigningKey> {
    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    const jwk = await CryptoUtils.exportPublicKeyToJWK(this.keyPair.publicKey, this.kid)
    
    return {
      kty: jwk.kty,
      kid: this.kid,
      use: 'sig',
      alg: 'ES256',
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y
    }
  }

  /**
   * Get JWKS (JSON Web Key Set) for public key discovery
   */
  async getJWKS(): Promise<JWKS> {
    await this.initialize()
    
    if (!this.publicKeyJWK) {
      throw new Error('Public key not available')
    }

    return {
      keys: [this.publicKeyJWK]
    }
  }

  /**
   * Create access token for user
   */
  async createAccessToken(user: User, session: Session, aal: 'aal1' | 'aal2' = 'aal1'): Promise<string> {
    await this.initialize()

    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    const now = Math.floor(Date.now() / 1000)
    
    const payload: JWTPayload = {
      iss: this.config.issuer,
      sub: user.id,
      aud: 'authenticated',
      exp: now + this.config.accessTokenExpirySeconds,
      iat: now,
      jti: CryptoUtils.generateUUID(),
      role: user.role === 'service_role' ? 'service_role' : 'authenticated',
      aal,
      session_id: session.id,
      email: user.email || '',
      phone: user.phone || '',
      is_anonymous: user.is_anonymous,
      app_metadata: user.app_metadata || {},
      user_metadata: user.user_metadata || {},
      amr: [
        {
          method: 'password',
          timestamp: now
        }
      ]
    }

    const jwt = new SignJWT(payload as Record<string, any>)
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: this.kid
      })

    return await jwt.sign(this.keyPair.privateKey)
  }

  /**
   * Create anonymous access token
   */
  async createAnonymousToken(): Promise<string> {
    await this.initialize()

    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    const now = Math.floor(Date.now() / 1000)
    
    const payload: Partial<JWTPayload> = {
      iss: 'supabase-lite',
      ref: this.config.projectRef,
      role: 'anon',
      iat: now,
      exp: now + (10 * 365 * 24 * 60 * 60) // 10 years
    }

    const jwt = new SignJWT(payload as Record<string, any>)
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: this.kid
      })

    return await jwt.sign(this.keyPair.privateKey)
  }

  /**
   * Create service role token
   */
  async createServiceRoleToken(): Promise<string> {
    await this.initialize()

    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    const now = Math.floor(Date.now() / 1000)
    
    const payload: Partial<JWTPayload> = {
      iss: 'supabase-lite',
      ref: this.config.projectRef,
      role: 'service_role',
      iat: now,
      exp: now + (10 * 365 * 24 * 60 * 60) // 10 years
    }

    const jwt = new SignJWT(payload as Record<string, any>)
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: this.kid
      })

    return await jwt.sign(this.keyPair.privateKey)
  }

  /**
   * Create refresh token
   */
  createRefreshToken(): string {
    return CryptoUtils.generateSecureToken(64)
  }

  /**
   * Create complete token pair
   */
  async createTokenPair(user: User, session: Session, aal: 'aal1' | 'aal2' = 'aal1'): Promise<TokenPair> {
    const accessToken = await this.createAccessToken(user, session, aal)
    const refreshToken = this.createRefreshToken()

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: this.config.accessTokenExpirySeconds,
      expires_at: Math.floor(Date.now() / 1000) + this.config.accessTokenExpirySeconds,
      user: this.serializeUser(user)
    }
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    await this.initialize()

    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    try {
      const { payload } = await jwtVerify(token, this.keyPair.publicKey, {
        issuer: this.config.issuer,
        algorithms: ['ES256']
      })

      return payload as JWTPayload
    } catch (error) {
      throw new Error(`Invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract claims from token without verification (for client use)
   */
  extractClaims(token: string): JWTPayload | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return null
      }

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload
    } catch {
      return null
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const claims = this.extractClaims(token)
    if (!claims || !claims.exp) {
      return true
    }

    return Date.now() >= claims.exp * 1000
  }

  /**
   * Get token expiry time
   */
  getTokenExpiry(token: string): number | null {
    const claims = this.extractClaims(token)
    return claims?.exp ? claims.exp * 1000 : null
  }

  /**
   * Update user claims in existing token (create new token with updated claims)
   */
  async updateUserClaims(token: string, updates: Partial<User>): Promise<string> {
    const claims = this.extractClaims(token)
    if (!claims) {
      throw new Error('Invalid token')
    }

    // Create updated payload
    const updatedPayload: JWTPayload = {
      ...claims,
      email: updates.email ?? claims.email,
      phone: updates.phone ?? claims.phone,
      user_metadata: updates.user_metadata ?? claims.user_metadata,
      app_metadata: updates.app_metadata ?? claims.app_metadata,
      iat: Math.floor(Date.now() / 1000) // Update issued at time
    }

    await this.initialize()
    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    const jwt = new SignJWT(updatedPayload)
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: this.kid
      })

    return await jwt.sign(this.keyPair.privateKey)
  }

  /**
   * Create MFA challenge token (short-lived, single use)
   */
  async createMFAChallengeToken(factorId: string, userId: string): Promise<string> {
    await this.initialize()

    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    const now = Math.floor(Date.now() / 1000)
    
    const payload = {
      iss: this.config.issuer,
      sub: userId,
      aud: 'mfa_challenge',
      exp: now + 300, // 5 minutes
      iat: now,
      jti: CryptoUtils.generateUUID(),
      factor_id: factorId,
      challenge_type: 'mfa'
    }

    const jwt = new SignJWT(payload as Record<string, any>)
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: this.kid
      })

    return await jwt.sign(this.keyPair.privateKey)
  }

  /**
   * Serialize user for token payload
   */
  private serializeUser(user: User): any {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      email_verified: user.email_verified,
      phone_verified: user.phone_verified,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_sign_in_at: user.last_sign_in_at,
      role: user.role,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      is_anonymous: user.is_anonymous
    }
  }

  /**
   * Get signing algorithm
   */
  getSigningAlgorithm(): string {
    return 'ES256'
  }

  /**
   * Get key ID
   */
  getKeyId(): string {
    return this.kid
  }

  /**
   * Generate custom JWT token with provided payload
   */
  async generateCustomToken(payload: Record<string, any>): Promise<string> {
    await this.initialize()

    if (!this.keyPair) {
      throw new Error('Key pair not initialized')
    }

    const jwt = new SignJWT(payload)
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: this.kid
      })

    return await jwt.sign(this.keyPair.privateKey)
  }

  /**
   * Rotate signing key (for security purposes)
   */
  async rotateSigningKey(): Promise<void> {
    this.keyPair = await CryptoUtils.generateES256KeyPair()
    this.kid = CryptoUtils.generateUUID()
    this.publicKeyJWK = await this.createPublicKeyJWK()
  }
}