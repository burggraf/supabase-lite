import { DatabaseManager } from '../../database/connection'
import { JWTService } from '../core/JWTService'
import { SessionManager } from '../core/SessionManager'
import { CryptoUtils } from '../utils/crypto'
import { Validators, ValidationError } from '../utils/validators'
import type { MFAFactor, MFAChallenge, User, Session, AuthError } from '../types'

export interface TOTPEnrollment {
  id: string
  qr_code: string
  secret: string
  uri: string
}

export interface MFAEnrollmentResult {
  id: string
  type: 'totp' | 'phone'
  totp?: TOTPEnrollment
  phone?: {
    phone_number: string
  }
}

export interface MFAChallengeResult {
  id: string
  expires_at: number
}

export interface MFAVerificationResult {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  expires_at: number
  refresh_token: string
  user: User
}

export class MFAService {
  private static instance: MFAService
  private dbManager: DatabaseManager
  private jwtService: JWTService
  private sessionManager: SessionManager

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
    this.jwtService = JWTService.getInstance()
    this.sessionManager = SessionManager.getInstance()
  }

  static getInstance(): MFAService {
    if (!MFAService.instance) {
      MFAService.instance = new MFAService()
    }
    return MFAService.instance
  }

  /**
   * Enroll a new MFA factor
   */
  async enrollFactor(
    factorType: 'totp' | 'phone',
    friendlyName?: string,
    phone?: string
  ): Promise<MFAEnrollmentResult> {
    const currentUser = this.sessionManager.getUser()
    if (!currentUser) {
      throw this.createMFAError('No authenticated user', 401, 'no_user')
    }

    if (!Validators.isValidMFAFactorType(factorType)) {
      throw this.createMFAError('Invalid factor type', 400, 'invalid_factor_type')
    }

    const factorId = CryptoUtils.generateUUID()
    const now = new Date().toISOString()

    if (factorType === 'totp') {
      return await this.enrollTOTPFactor(factorId, currentUser.id, now, friendlyName)
    } else if (factorType === 'phone') {
      if (!phone || !Validators.isValidPhone(phone)) {
        throw this.createMFAError('Valid phone number required', 400, 'invalid_phone')
      }
      return await this.enrollPhoneFactor(factorId, currentUser.id, phone, now, friendlyName)
    }

    throw this.createMFAError('Unsupported factor type', 400, 'unsupported_factor_type')
  }

  /**
   * Enroll TOTP factor
   */
  private async enrollTOTPFactor(
    factorId: string,
    userId: string,
    createdAt: string,
    friendlyName?: string
  ): Promise<MFAEnrollmentResult> {
    const secret = CryptoUtils.generateTOTPSecret()
    const issuer = 'Supabase Lite'
    const accountName = `${issuer}:${userId}`
    
    // Generate TOTP URI for QR code
    const uri = `otpauth://totp/${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
    
    // Generate QR code URL (using a free QR code service)
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`

    // Store factor in database
    await this.dbManager.query(`
      INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [factorId, userId, friendlyName, 'totp', 'unverified', createdAt, createdAt, secret])

    return {
      id: factorId,
      type: 'totp',
      totp: {
        id: factorId,
        qr_code: qrCode,
        secret,
        uri
      }
    }
  }

  /**
   * Enroll phone factor
   */
  private async enrollPhoneFactor(
    factorId: string,
    userId: string,
    phone: string,
    createdAt: string,
    friendlyName?: string
  ): Promise<MFAEnrollmentResult> {
    // Store factor in database
    await this.dbManager.query(`
      INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [factorId, userId, friendlyName, 'phone', 'unverified', createdAt, createdAt, phone])

    return {
      id: factorId,
      type: 'phone',
      phone: {
        phone_number: phone
      }
    }
  }

  /**
   * Create MFA challenge
   */
  async createChallenge(factorId: string): Promise<MFAChallengeResult> {
    const currentUser = this.sessionManager.getUser()
    if (!currentUser) {
      throw this.createMFAError('No authenticated user', 401, 'no_user')
    }

    if (!Validators.isValidFactorId(factorId)) {
      throw this.createMFAError('Invalid factor ID', 400, 'invalid_factor_id')
    }

    // Get the factor
    const factor = await this.getFactor(factorId, currentUser.id)
    if (!factor) {
      throw this.createMFAError('Factor not found', 404, 'factor_not_found')
    }

    const challengeId = CryptoUtils.generateUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes

    // Store challenge
    await this.dbManager.query(`
      INSERT INTO auth.mfa_challenges (id, factor_id, created_at, ip_address)
      VALUES ($1, $2, $3, $4)
    `, [challengeId, factorId, now.toISOString(), '127.0.0.1']) // In a real app, get actual IP

    // For phone factors, generate and send OTP
    if (factor.factor_type === 'phone') {
      const otp = CryptoUtils.generateRandomString(6).toUpperCase()
      await this.dbManager.query(`
        UPDATE auth.mfa_challenges 
        SET otp_code = $1 
        WHERE id = $2
      `, [otp, challengeId])

      // In a real implementation, send SMS here
      console.log(`SMS OTP for ${factor.phone}: ${otp}`)
    }

    return {
      id: challengeId,
      expires_at: Math.floor(expiresAt.getTime() / 1000)
    }
  }

  /**
   * Verify MFA challenge
   */
  async verifyChallenge(
    factorId: string,
    challengeId: string,
    code: string
  ): Promise<MFAVerificationResult> {
    const currentUser = this.sessionManager.getUser()
    const currentSession = this.sessionManager.getSession()
    
    if (!currentUser || !currentSession) {
      throw this.createMFAError('No authenticated user', 401, 'no_user')
    }

    if (!Validators.isValidFactorId(factorId) || !Validators.isValidFactorId(challengeId)) {
      throw this.createMFAError('Invalid IDs provided', 400, 'invalid_ids')
    }

    // Get factor and challenge
    const factor = await this.getFactor(factorId, currentUser.id)
    if (!factor) {
      throw this.createMFAError('Factor not found', 404, 'factor_not_found')
    }

    const challenge = await this.getChallenge(challengeId, factorId)
    if (!challenge) {
      throw this.createMFAError('Challenge not found or expired', 404, 'challenge_not_found')
    }

    // Verify the code
    const isValidCode = await this.verifyCode(factor, code, challenge)
    if (!isValidCode) {
      throw this.createMFAError('Invalid verification code', 400, 'invalid_code')
    }

    // Mark challenge as verified
    await this.dbManager.query(`
      UPDATE auth.mfa_challenges 
      SET verified_at = NOW()
      WHERE id = $1
    `, [challengeId])

    // Mark factor as verified if it was unverified
    if (factor.status === 'unverified') {
      await this.dbManager.query(`
        UPDATE auth.mfa_factors 
        SET status = 'verified', updated_at = NOW()
        WHERE id = $1
      `, [factorId])
    }

    // Update last challenged timestamp
    await this.dbManager.query(`
      UPDATE auth.mfa_factors 
      SET last_challenged_at = NOW()
      WHERE id = $1
    `, [factorId])

    // Create new session with AAL2
    const newSession = await this.sessionManager.createSession(currentUser, 'aal2')

    // Add AMR claim for MFA authentication
    await this.dbManager.query(`
      INSERT INTO auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method)
      VALUES ($1, NOW(), NOW(), $2)
    `, [newSession.id, factor.factor_type])

    return {
      access_token: newSession.access_token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: newSession.expires_at,
      refresh_token: newSession.refresh_token,
      user: currentUser
    }
  }

  /**
   * List user's MFA factors
   */
  async listFactors(userId?: string): Promise<{ totp: MFAFactor[]; phone: MFAFactor[] }> {
    const currentUser = this.sessionManager.getUser()
    const targetUserId = userId || currentUser?.id

    if (!targetUserId) {
      throw this.createMFAError('No user specified', 400, 'no_user')
    }

    // Only allow users to list their own factors (unless admin)
    if (currentUser && targetUserId !== currentUser.id) {
      throw this.createMFAError('Access denied', 403, 'access_denied')
    }

    const result = await this.dbManager.query(`
      SELECT id, friendly_name, factor_type, status, created_at, updated_at, phone
      FROM auth.mfa_factors 
      WHERE user_id = $1
      ORDER BY created_at ASC
    `, [targetUserId])

    const totp: MFAFactor[] = []
    const phone: MFAFactor[] = []

    for (const row of result.rows) {
      const factor: MFAFactor = {
        id: row.id,
        user_id: targetUserId,
        factor_type: row.factor_type,
        status: row.status,
        friendly_name: row.friendly_name,
        phone: row.phone,
        created_at: row.created_at,
        updated_at: row.updated_at
      }

      if (row.factor_type === 'totp') {
        totp.push(factor)
      } else if (row.factor_type === 'phone') {
        phone.push(factor)
      }
    }

    return { totp, phone }
  }

  /**
   * Unenroll MFA factor
   */
  async unenrollFactor(factorId: string): Promise<void> {
    const currentUser = this.sessionManager.getUser()
    if (!currentUser) {
      throw this.createMFAError('No authenticated user', 401, 'no_user')
    }

    if (!Validators.isValidFactorId(factorId)) {
      throw this.createMFAError('Invalid factor ID', 400, 'invalid_factor_id')
    }

    const factor = await this.getFactor(factorId, currentUser.id)
    if (!factor) {
      throw this.createMFAError('Factor not found', 404, 'factor_not_found')
    }

    // Delete the factor (cascading delete will handle challenges)
    await this.dbManager.query(`
      DELETE FROM auth.mfa_factors WHERE id = $1
    `, [factorId])
  }

  /**
   * Get authenticator assurance level for current session
   */
  getAuthenticatorAssuranceLevel(): { currentLevel: 'aal1' | 'aal2' | null; nextLevel: 'aal2' | null } {
    const session = this.sessionManager.getSession()
    if (!session) {
      return { currentLevel: null, nextLevel: 'aal2' }
    }

    const claims = this.jwtService.extractClaims(session.access_token)
    const aal = claims?.aal || 'aal1'

    return {
      currentLevel: aal as 'aal1' | 'aal2',
      nextLevel: aal === 'aal1' ? 'aal2' : null
    }
  }

  /**
   * Helper methods
   */
  private async getFactor(factorId: string, userId: string): Promise<any> {
    const result = await this.dbManager.query(`
      SELECT * FROM auth.mfa_factors WHERE id = $1 AND user_id = $2
    `, [factorId, userId])

    return result.rows[0] || null
  }

  private async getChallenge(challengeId: string, factorId: string): Promise<any> {
    const result = await this.dbManager.query(`
      SELECT * FROM auth.mfa_challenges 
      WHERE id = $1 AND factor_id = $2 
      AND created_at > NOW() - INTERVAL '5 minutes'
      AND verified_at IS NULL
    `, [challengeId, factorId])

    return result.rows[0] || null
  }

  private async verifyCode(factor: any, code: string, challenge: any): Promise<boolean> {
    if (factor.factor_type === 'totp') {
      if (!Validators.isValidTOTPCode(code)) {
        return false
      }
      return await CryptoUtils.verifyTOTP(factor.secret, code)
    } else if (factor.factor_type === 'phone') {
      if (!challenge.otp_code) {
        return false
      }
      return CryptoUtils.constantTimeEqual(code.toUpperCase(), challenge.otp_code)
    }

    return false
  }

  private createMFAError(message: string, status: number, code: string): AuthError {
    const error = new Error(message) as AuthError
    error.status = status
    error.code = code
    return error
  }
}