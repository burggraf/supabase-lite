import { DatabaseManager } from '../../database/connection'
import { JWTService } from './JWTService'
import { SessionManager } from './SessionManager'
import { PasswordService } from './PasswordService'
import { CryptoUtils } from '../utils/crypto'
import { Validators, ValidationError } from '../utils/validators'
import { AuthQueryBuilder } from '../utils/DatabaseQueryBuilder'
import type { 
  User, 
  Session, 
  SignUpCredentials, 
  SignInCredentials, 
  UpdateUserAttributes,
  AuthError,
  AuthenticatorAssuranceLevel,
  MFAFactor,
  MFAChallenge
} from '../types/auth.types'

export interface AuthManagerConfig {
  enableSignups: boolean
  enableEmailAuth: boolean
  enablePhoneAuth: boolean
  enableAnonymousAuth: boolean
  requireEmailVerification: boolean
  requirePhoneVerification: boolean
  passwordMinLength: number
  sessionTimeoutMinutes: number
  maxFailedAttempts: number
  lockoutDurationMinutes: number
}

export class AuthManager {
  private static instance: AuthManager
  private dbManager: DatabaseManager
  private authQuery: AuthQueryBuilder
  private jwtService: JWTService
  private sessionManager: SessionManager
  private passwordService: PasswordService
  private config: AuthManagerConfig
  private isInitialized: boolean = false
  private initializationPromise: Promise<void> | null = null

  constructor(config?: Partial<AuthManagerConfig>) {
    this.config = {
      enableSignups: true,
      enableEmailAuth: true,
      enablePhoneAuth: false,
      enableAnonymousAuth: false,
      requireEmailVerification: false,
      requirePhoneVerification: false,
      passwordMinLength: 6,
      sessionTimeoutMinutes: 60,
      maxFailedAttempts: 5,
      lockoutDurationMinutes: 15,
      ...config
    }

    this.dbManager = DatabaseManager.getInstance()
    this.authQuery = new AuthQueryBuilder(this.dbManager)
    this.jwtService = JWTService.getInstance()
    this.sessionManager = SessionManager.getInstance()
    this.passwordService = PasswordService.getInstance()
  }

  static getInstance(config?: Partial<AuthManagerConfig>): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager(config)
    }
    return AuthManager.instance
  }

  /**
   * Initialize auth manager
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
    console.log('AuthManager: Starting initialization...')
    
    if (!this.dbManager.isConnected()) {
      console.log('AuthManager: Database not connected, initializing...')
      await this.dbManager.initialize()
    } else {
      console.log('AuthManager: Database already connected')
    }

    await this.jwtService.initialize()
    await this.sessionManager.initialize()
    await this.ensureAuthTables()
    
    console.log('AuthManager: Initialization completed')
  }

  /**
   * Sign up new user with email/password
   */
  async signUp(credentials: SignUpCredentials): Promise<{ user: User; session: Session | null }> {
    console.log('🔐 AuthManager.signUp: Starting signup process for:', credentials.email)
    
    if (!this.config.enableSignups) {
      throw this.createAuthError('Signups are disabled', 422, 'signups_disabled')
    }

    try {
      console.log('🔐 AuthManager.signUp: Validating credentials')
      // Validate credentials
      Validators.validateSignUpCredentials(credentials)

      const { email, phone, password, data = {} } = credentials

      console.log('🔐 AuthManager.signUp: Checking if user already exists')
      // Check if user already exists
      if (email && await this.getUserByEmail(email)) {
        throw this.createAuthError('User already registered', 422, 'email_already_exists')
      }

      if (phone && await this.getUserByPhone(phone)) {
        throw this.createAuthError('Phone number already registered', 422, 'phone_already_exists')
      }

      console.log('🔐 AuthManager.signUp: Hashing password')
      // Hash password
      const hashedPassword = await this.passwordService.hashPassword(password)
      console.log('🔐 AuthManager.signUp: Password hashed successfully')

      console.log('🔐 AuthManager.signUp: Generating UUID')
      // Create user
      const userId = CryptoUtils.generateUUID()
      const now = new Date().toISOString()

      const user: User = {
        id: userId,
        email: email || undefined,
        phone: phone || undefined,
        email_verified: !this.config.requireEmailVerification,
        phone_verified: !this.config.requirePhoneVerification,
        created_at: now,
        updated_at: now,
        role: 'authenticated',
        app_metadata: {
          provider: email ? 'email' : 'phone',
          providers: [email ? 'email' : 'phone']
        },
        user_metadata: Validators.sanitizeUserMetadata(data),
        is_anonymous: false
      }

      console.log('🔐 AuthManager.signUp: Storing user in database')
      // Store user in database
      await this.createUserInDB(user, hashedPassword)

      console.log('🔐 AuthManager.signUp: Creating session')
      // Create session if email verification not required
      let session: Session | null = null
      if (!this.config.requireEmailVerification && !this.config.requirePhoneVerification) {
        session = await this.sessionManager.createSession(user)
      }

      console.log('🔐 AuthManager.signUp: Logging audit event')
      // Log audit event
      await this.logAuditEvent('user_signed_up', { user_id: userId, email, phone })

      console.log('🔐 AuthManager.signUp: Signup completed successfully')
      return { user, session }
    } catch (error: any) {
      console.error('🔐 AuthManager.signUp: Error during signup:', error)
      
      // Check for various forms of duplicate email constraint violations
      if (error?.message && (
        error.message.includes('users_email_partial_key') ||
        error.message.includes('duplicate key value violates unique constraint') ||
        (error.message.includes('duplicate') && error.message.includes('email')) ||
        error.message.includes('UNIQUE constraint failed')
      )) {
        throw this.createAuthError('User already registered', 422, 'email_already_exists')
      }
      
      throw error
    }
  }

  /**
   * Sign in user with email/password
   */
  async signIn(credentials: SignInCredentials): Promise<{ user: User; session: Session }> {
    console.log('AuthManager signIn called with:', credentials)
    
    Validators.validateSignInCredentials(credentials)

    const { email, phone, password, provider } = credentials

    if (provider) {
      return await this.signInWithProvider(provider)
    }

    if (!password) {
      throw this.createAuthError('Password is required', 400, 'password_required')
    }

    // Get user by email or phone
    console.log('AuthManager looking up user by email:', email)
    const user = email 
      ? await this.getUserByEmail(email)
      : await this.getUserByPhone(phone!)

    console.log('AuthManager found user:', user ? 'yes' : 'no')
    if (!user) {
      throw this.createAuthError('Invalid login credentials', 400, 'invalid_credentials')
    }

    // Note: Account lockout removed for Supabase compatibility

    // Get stored password hash
    const storedPassword = await this.getStoredPassword(user.id)
    if (!storedPassword) {
      throw this.createAuthError('Invalid login credentials', 400, 'invalid_credentials')
    }

    // Verify password
    const isValidPassword = await this.passwordService.verifyPassword(password, storedPassword)
    
    if (!isValidPassword) {
      throw this.createAuthError('Invalid login credentials', 400, 'invalid_credentials')
    }

    // Update last sign in
    await this.updateLastSignIn(user.id)

    // Create session
    const session = await this.sessionManager.createSession(user)

    // Log audit event
    await this.logAuditEvent('user_signed_in', { user_id: user.id, email, phone })

    return { user, session }
  }

  /**
   * Sign out user
   */
  async signOut(scope: 'local' | 'global' = 'local'): Promise<void> {
    const session = this.sessionManager.getSession()
    if (session) {
      await this.logAuditEvent('user_signed_out', { user_id: session.user_id })
    }

    await this.sessionManager.signOut(scope)
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.sessionManager.getUser()
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    return this.sessionManager.getSession()
  }

  /**
   * Update user attributes
   */
  async updateUser(attributes: UpdateUserAttributes): Promise<User> {
    const currentUser = this.getCurrentUser()
    if (!currentUser) {
      throw this.createAuthError('No authenticated user', 401, 'no_user')
    }

    Validators.validateUpdateUserAttributes(attributes)

    const { email, phone, password, data } = attributes
    const updates: Partial<User> = {
      updated_at: new Date().toISOString()
    }

    // Update email
    if (email && email !== currentUser.email) {
      if (await this.getUserByEmail(email)) {
        throw this.createAuthError('Email already in use', 422, 'email_already_exists')
      }
      updates.email = email
      updates.email_verified = !this.config.requireEmailVerification
    }

    // Update phone
    if (phone && phone !== currentUser.phone) {
      if (await this.getUserByPhone(phone)) {
        throw this.createAuthError('Phone already in use', 422, 'phone_already_exists')
      }
      updates.phone = phone
      updates.phone_verified = !this.config.requirePhoneVerification
    }

    // Update password
    if (password) {
      const hashedPassword = await this.passwordService.hashPassword(password)
      await this.updatePasswordInDB(currentUser.id, hashedPassword)
    }

    // Update user metadata
    if (data) {
      updates.user_metadata = {
        ...currentUser.user_metadata,
        ...Validators.sanitizeUserMetadata(data)
      }
    }

    // Update user in database
    await this.updateUserInDB(currentUser.id, updates)

    // Update session
    const updatedUser = await this.sessionManager.updateUser(updates)
    if (!updatedUser) {
      throw this.createAuthError('Failed to update user', 500, 'update_failed')
    }

    // Log audit event
    await this.logAuditEvent('user_updated', { 
      user_id: currentUser.id, 
      changes: Object.keys(updates) 
    })

    return updatedUser
  }

  /**
   * Refresh session token
   */
  async refreshSession(refreshToken?: string): Promise<Session> {
    const session = await this.sessionManager.refreshSession(refreshToken)
    if (!session) {
      throw this.createAuthError('Failed to refresh session', 400, 'refresh_failed')
    }

    return session
  }

  /**
   * Get authenticator assurance level
   */
  getAuthenticatorAssuranceLevel(): AuthenticatorAssuranceLevel {
    const session = this.getCurrentSession()
    if (!session) {
      return {
        currentLevel: null,
        nextLevel: 'aal1',
        currentAuthenticationMethods: []
      }
    }

    const claims = this.jwtService.extractClaims(session.access_token)
    const currentLevel = claims?.aal || 'aal1'
    const amr = claims?.amr || []

    return {
      currentLevel: currentLevel as 'aal1' | 'aal2',
      nextLevel: currentLevel === 'aal1' ? 'aal2' : 'aal2',
      currentAuthenticationMethods: amr
    }
  }

  /**
   * Request password recovery
   */
  async requestPasswordRecovery(email: string): Promise<void> {
    if (!Validators.isValidEmail(email)) {
      throw this.createAuthError('Invalid email format', 400, 'invalid_email')
    }

    const user = await this.getUserByEmail(email)
    if (!user) {
      // Don't reveal if user exists or not
      return
    }

    const token = this.passwordService.generatePasswordResetToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await this.storePasswordResetToken(user.id, token, expiresAt)

    // Log audit event
    await this.logAuditEvent('password_recovery_requested', { 
      user_id: user.id, 
      email 
    })

    // In a real implementation, send email here
    console.log(`Password reset token for ${email}: ${token}`)
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!this.passwordService.isValidPasswordResetToken(token)) {
      throw this.createAuthError('Invalid reset token', 400, 'invalid_token')
    }

    const userId = await this.validatePasswordResetToken(token)
    if (!userId) {
      throw this.createAuthError('Invalid or expired reset token', 400, 'invalid_token')
    }

    const hashedPassword = await this.passwordService.hashPassword(newPassword)
    await this.updatePasswordInDB(userId, hashedPassword)
    await this.deletePasswordResetToken(token)

    // Log audit event
    await this.logAuditEvent('password_reset', { user_id: userId })
  }

  /**
   * Sign in with OAuth provider (simulated)
   */
  private async signInWithProvider(provider: string): Promise<{ user: User; session: Session }> {
    throw this.createAuthError('OAuth authentication not implemented', 501, 'oauth_not_implemented')
  }

  /**
   * Create auth error
   */
  private createAuthError(message: string, status: number, code: string): AuthError {
    const error = new Error(message) as AuthError
    error.status = status
    error.code = code
    return error
  }

  /**
   * Database operations
   */
  private async ensureAuthTables(): Promise<void> {
    // Standard Supabase auth tables are already created by the schema
    // No custom table creation needed for compatibility
    return
  }


  private async getUserByEmail(email: string): Promise<User | null> {
    // Use direct parameterized query to bypass the AuthQueryBuilder issue
    const result = await this.dbManager.query(
      'SELECT * FROM auth.users WHERE email = $1',
      [email]
    )
    return result.rows[0] ? this.mapDBUserToUser(result.rows[0]) : null
  }

  private async getUserByPhone(phone: string): Promise<User | null> {
    const result = await this.dbManager.query(
      'SELECT * FROM auth.users WHERE phone = $1',
      [phone]
    )
    return result.rows[0] ? this.mapDBUserToUser(result.rows[0]) : null
  }


  private async createUserInDB(user: User, hashedPassword: any): Promise<void> {
    try {
      // Convert boolean verified fields to timestamp format for Supabase schema
      const emailConfirmedAt = user.email_verified ? user.created_at : null
      const phoneConfirmedAt = user.phone_verified ? user.created_at : null
      
      // Store complete HashedPassword object as JSON to preserve algorithm and salt info
      const passwordData = JSON.stringify(hashedPassword)
      
      // Create user record with password data in standard Supabase location
      await this.dbManager.query(`
        INSERT INTO auth.users (
          id, email, phone, encrypted_password, email_confirmed_at, phone_confirmed_at, 
          created_at, updated_at, role, raw_app_meta_data, raw_user_meta_data, is_anonymous
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        user.id,
        user.email,
        user.phone,
        passwordData,
        emailConfirmedAt,
        phoneConfirmedAt,
        user.created_at,
        user.updated_at,
        user.role,
        JSON.stringify(user.app_metadata),
        JSON.stringify(user.user_metadata),
        user.is_anonymous
      ])
    } catch (error: any) {
      // Transform database constraint violations into user-friendly errors
      if (error?.message && (
        error.message.includes('users_email_partial_key') ||
        error.message.includes('duplicate key value violates unique constraint') ||
        (error.message.includes('duplicate') && error.message.includes('email'))
      )) {
        throw this.createAuthError('User already registered', 422, 'email_already_exists')
      }
      throw error
    }
  }

  private async updateUserInDB(userId: string, updates: Partial<User>): Promise<void> {
    if (Object.keys(updates).length === 0) return

    // Convert User interface fields to database schema fields
    const dbUpdates: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'app_metadata') {
        dbUpdates.raw_app_meta_data = JSON.stringify(value)
      } else if (key === 'user_metadata') {
        dbUpdates.raw_user_meta_data = JSON.stringify(value)
      } else if (key === 'email_verified') {
        // Convert boolean to timestamp
        dbUpdates.email_confirmed_at = value ? new Date().toISOString() : null
      } else if (key === 'phone_verified') {
        // Convert boolean to timestamp
        dbUpdates.phone_confirmed_at = value ? new Date().toISOString() : null
      } else {
        dbUpdates[key] = value
      }
    }

    // Build dynamic UPDATE query with parameters
    const updateKeys = Object.keys(dbUpdates)
    const updateValues = Object.values(dbUpdates)
    const setClause = updateKeys.map((key, index) => `${key} = $${index + 1}`).join(', ')
    
    await this.dbManager.query(`
      UPDATE auth.users 
      SET ${setClause}
      WHERE id = $${updateKeys.length + 1}
    `, [...updateValues, userId])
  }

  private async getStoredPassword(userId: string): Promise<string | any> {
    const result = await this.dbManager.query(
      'SELECT encrypted_password FROM auth.users WHERE id = $1',
      [userId]
    )
    
    if (!result.rows[0] || !result.rows[0].encrypted_password) return null

    const storedData = result.rows[0].encrypted_password
    
    // Try to parse as HashedPassword object (new format)
    try {
      const parsed = JSON.parse(storedData)
      if (parsed && typeof parsed === 'object' && parsed.hash && parsed.algorithm) {
        return parsed // Return HashedPassword object
      }
    } catch (e) {
      // Not JSON, treat as legacy string format
    }
    
    // Return as string for backward compatibility (legacy bcrypt hashes)
    return storedData
  }

  private async updatePasswordInDB(userId: string, hashedPassword: any): Promise<void> {
    // Store complete HashedPassword object as JSON to preserve algorithm and salt info
    const passwordData = JSON.stringify(hashedPassword)
    
    await this.dbManager.query(`
      UPDATE auth.users 
      SET encrypted_password = $1, updated_at = $2
      WHERE id = $3
    `, [
      passwordData,
      new Date().toISOString(),
      userId
    ])
  }

  private async updateLastSignIn(userId: string): Promise<void> {
    await this.dbManager.query(`
      UPDATE auth.users 
      SET last_sign_in_at = $1
      WHERE id = $2
    `, [new Date().toISOString(), userId])
  }


  private async storePasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    // Store password reset token in a temp table or extend users table
    // For simplicity, we'll extend the audit log to track reset tokens
    await this.dbManager.query(`
      INSERT INTO auth.audit_log_entries (id, payload, created_at)
      VALUES ($1, $2, $3)
    `, [
      CryptoUtils.generateUUID(),
      JSON.stringify({ 
        event: 'password_reset_token_created',
        user_id: userId,
        token: token,
        expires_at: expiresAt.toISOString()
      }),
      new Date().toISOString()
    ])
  }

  private async validatePasswordResetToken(token: string): Promise<string | null> {
    try {
      const result = await this.dbManager.query(`
        SELECT payload
        FROM auth.audit_log_entries
        WHERE payload->>'event' = 'password_reset_token_created'
        AND payload->>'token' = $1
        AND (payload->>'expires_at')::timestamp > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `, [token])

      if (result.rows.length === 0) {
        return null
      }

      const payload = JSON.parse(result.rows[0].payload)
      return payload.user_id
    } catch (error) {
      console.error('Error validating password reset token:', error)
      return null
    }
  }

  private async deletePasswordResetToken(token: string): Promise<void> {
    // Mark token as used by adding a deletion event
    await this.dbManager.query(`
      INSERT INTO auth.audit_log_entries (id, payload, created_at)
      VALUES ($1, $2, $3)
    `, [
      CryptoUtils.generateUUID(),
      JSON.stringify({ 
        event: 'password_reset_token_used',
        token: token
      }),
      new Date().toISOString()
    ])
  }

  private async logAuditEvent(event: string, payload: any): Promise<void> {
    try {
      await this.dbManager.query(`
        INSERT INTO auth.audit_log_entries (id, payload, created_at)
        VALUES ($1, $2, $3)
      `, [
        CryptoUtils.generateUUID(),
        JSON.stringify({ event, ...payload }),
        new Date().toISOString()
      ])
    } catch (error) {
      console.warn('Audit logging failed:', error)
    }
  }

  private mapDBUserToUser(dbUser: any): User {
    // Parse metadata fields safely
    const parseMetadata = (value: any): any => {
      if (value === null || value === undefined) return {}
      if (typeof value === 'string') {
        try {
          return JSON.parse(value)
        } catch {
          return {}
        }
      }
      return value || {}
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      phone: dbUser.phone,
      // Convert Supabase timestamp fields to boolean
      email_verified: !!dbUser.email_confirmed_at,
      phone_verified: !!dbUser.phone_confirmed_at,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at,
      last_sign_in_at: dbUser.last_sign_in_at,
      role: dbUser.role,
      // Handle both old format (app_metadata) and new format (raw_app_meta_data)
      app_metadata: parseMetadata(dbUser.raw_app_meta_data || dbUser.app_metadata),
      user_metadata: parseMetadata(dbUser.raw_user_meta_data || dbUser.user_metadata),
      is_anonymous: dbUser.is_anonymous || false
    }
  }
}