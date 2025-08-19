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
} from '../types'

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
    if (!this.dbManager.isConnected()) {
      await this.dbManager.initialize()
    }

    await this.jwtService.initialize()
    await this.sessionManager.initialize()
    await this.ensureAuthTables()
  }

  /**
   * Sign up new user with email/password
   */
  async signUp(credentials: SignUpCredentials): Promise<{ user: User; session: Session | null }> {
    if (!this.config.enableSignups) {
      throw this.createAuthError('Signups are disabled', 422, 'signups_disabled')
    }

    // Validate credentials
    Validators.validateSignUpCredentials(credentials)

    const { email, phone, password, data = {} } = credentials

    // Check if user already exists
    if (email && await this.getUserByEmail(email)) {
      throw this.createAuthError('User already registered', 422, 'email_already_exists')
    }

    if (phone && await this.getUserByPhone(phone)) {
      throw this.createAuthError('Phone number already registered', 422, 'phone_already_exists')
    }

    // Hash password
    const hashedPassword = await this.passwordService.hashPassword(password)

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

    // Store user in database
    await this.createUserInDB(user, hashedPassword)

    // Create session if email verification not required
    let session: Session | null = null
    if (!this.config.requireEmailVerification && !this.config.requirePhoneVerification) {
      session = await this.sessionManager.createSession(user)
    }

    // Log audit event
    await this.logAuditEvent('user_signed_up', { user_id: userId, email, phone })

    return { user, session }
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

    // Check for account lockout
    await this.checkAccountLockout(user.id)

    // Get stored password hash
    const storedPassword = await this.getStoredPassword(user.id)
    if (!storedPassword) {
      throw this.createAuthError('Invalid login credentials', 400, 'invalid_credentials')
    }

    // Verify password
    const isValidPassword = await this.passwordService.verifyPassword(password, storedPassword)
    
    if (!isValidPassword) {
      await this.recordFailedAttempt(user.id)
      throw this.createAuthError('Invalid login credentials', 400, 'invalid_credentials')
    }

    // Clear failed attempts on successful login
    await this.clearFailedAttempts(user.id)

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
    try {
      // Check if our custom tables exist
      const checkResult = await this.dbManager.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'auth' 
          AND table_name = 'user_passwords'
        ) as exists;
      `)
      
      const tablesExist = (checkResult.rows[0] as any)?.exists

      if (!tablesExist) {
        // Load and execute migration
        const migrationSql = await this.loadMigrationSql()
        await this.dbManager.exec(migrationSql)
        console.log('Auth tables migration completed successfully')
      }
    } catch (error) {
      console.error('Failed to ensure auth tables:', error)
      throw error
    }
  }

  private async loadMigrationSql(): Promise<string> {
    try {
      const response = await fetch('/src/lib/auth/migrations/001_add_user_passwords_table.sql')
      if (!response.ok) {
        throw new Error('Failed to load migration file')
      }
      return await response.text()
    } catch (error) {
      // Fallback inline migration
      return `
        CREATE TABLE IF NOT EXISTS auth.user_passwords (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          user_id uuid NOT NULL,
          password_hash text NOT NULL,
          password_salt text NOT NULL,
          algorithm text DEFAULT 'PBKDF2' NOT NULL,
          iterations integer DEFAULT 100000 NOT NULL,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          updated_at timestamp with time zone DEFAULT now() NOT NULL,
          
          CONSTRAINT user_passwords_pkey PRIMARY KEY (id),
          CONSTRAINT user_passwords_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
          CONSTRAINT user_passwords_user_id_unique UNIQUE (user_id)
        );

        CREATE INDEX IF NOT EXISTS user_passwords_user_id_idx ON auth.user_passwords(user_id);

        CREATE TABLE IF NOT EXISTS auth.password_reset_tokens (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          user_id uuid NOT NULL,
          token_hash text NOT NULL,
          created_at timestamp with time zone DEFAULT now() NOT NULL,
          expires_at timestamp with time zone NOT NULL,
          used_at timestamp with time zone,
          
          CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
          CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS password_reset_tokens_token_hash_idx ON auth.password_reset_tokens(token_hash);

        CREATE TABLE IF NOT EXISTS auth.failed_login_attempts (
          id uuid DEFAULT gen_random_uuid() NOT NULL,
          user_id uuid NOT NULL,
          ip_address inet,
          attempted_at timestamp with time zone DEFAULT now() NOT NULL,
          
          CONSTRAINT failed_login_attempts_pkey PRIMARY KEY (id),
          CONSTRAINT failed_login_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS failed_login_attempts_user_id_idx ON auth.failed_login_attempts(user_id, attempted_at);
      `
    }
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
    // Convert boolean verified fields to timestamp format for Supabase schema
    const emailConfirmedAt = user.email_verified ? user.created_at : null
    const phoneConfirmedAt = user.phone_verified ? user.created_at : null
    
    // Create user record using direct parameterized query
    await this.dbManager.query(`
      INSERT INTO auth.users (
        id, email, phone, email_confirmed_at, phone_confirmed_at, 
        created_at, updated_at, role, raw_app_meta_data, raw_user_meta_data, is_anonymous
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      user.id,
      user.email,
      user.phone,
      emailConfirmedAt,
      phoneConfirmedAt,
      user.created_at,
      user.updated_at,
      user.role,
      JSON.stringify(user.app_metadata),
      JSON.stringify(user.user_metadata),
      user.is_anonymous
    ])

    // Store password hash separately using direct parameterized query
    await this.dbManager.query(`
      INSERT INTO auth.user_passwords (
        user_id, password_hash, password_salt, algorithm, created_at
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      user.id,
      hashedPassword.hash,
      hashedPassword.salt,
      hashedPassword.algorithm,
      new Date().toISOString()
    ])
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

  private async getStoredPassword(userId: string): Promise<any> {
    const result = await this.dbManager.query(
      'SELECT password_hash, password_salt, algorithm FROM auth.user_passwords WHERE user_id = $1',
      [userId]
    )
    
    if (!result.rows[0]) return null

    const row = result.rows[0]
    return {
      hash: row.password_hash,
      salt: row.password_salt,
      algorithm: row.algorithm,
      iterations: 100000
    }
  }

  private async updatePasswordInDB(userId: string, hashedPassword: any): Promise<void> {
    await this.dbManager.query(`
      UPDATE auth.user_passwords 
      SET password_hash = $1, password_salt = $2, updated_at = $3
      WHERE user_id = $4
    `, [
      hashedPassword.hash,
      hashedPassword.salt,
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

  private async checkAccountLockout(userId: string): Promise<void> {
    const result = await this.dbManager.query(`
      SELECT COUNT(*) as count
      FROM auth.failed_login_attempts 
      WHERE user_id = $1 AND attempted_at > NOW() - INTERVAL '${this.config.lockoutDurationMinutes} minutes'
    `, [userId])
    
    const attemptCount = result.rows[0]?.count || 0

    if (attemptCount >= this.config.maxFailedAttempts) {
      throw this.createAuthError(
        `Account temporarily locked due to too many failed attempts. Try again in ${this.config.lockoutDurationMinutes} minutes.`,
        423,
        'account_locked'
      )
    }
  }

  private async recordFailedAttempt(userId: string): Promise<void> {
    await this.dbManager.query(`
      INSERT INTO auth.failed_login_attempts (user_id, attempted_at)
      VALUES ($1, $2)
    `, [userId, new Date().toISOString()])
  }

  private async clearFailedAttempts(userId: string): Promise<void> {
    await this.dbManager.query(`
      DELETE FROM auth.failed_login_attempts WHERE user_id = $1
    `, [userId])
  }

  private async storePasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const tokenHash = await this.passwordService.hashForAudit(token)
    
    await this.dbManager.query(`
      INSERT INTO auth.password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `, [userId, tokenHash, expiresAt.toISOString()])
  }

  private async validatePasswordResetToken(token: string): Promise<string | null> {
    const tokenHash = await this.passwordService.hashForAudit(token)
    
    const result = await this.dbManager.query(`
      SELECT user_id FROM auth.password_reset_tokens 
      WHERE token_hash = $1 AND expires_at > NOW() AND used_at IS NULL
    `, [tokenHash])

    if (result.rows.length === 0) {
      return null
    }

    // Mark token as used
    await this.dbManager.query(`
      UPDATE auth.password_reset_tokens 
      SET used_at = NOW() 
      WHERE token_hash = $1
    `, [tokenHash])

    return result.rows[0].user_id
  }

  private async deletePasswordResetToken(token: string): Promise<void> {
    const tokenHash = await this.passwordService.hashForAudit(token)
    
    await this.dbManager.query(`
      DELETE FROM auth.password_reset_tokens WHERE token_hash = $1
    `, [tokenHash])
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