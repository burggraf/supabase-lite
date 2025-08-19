/**
 * AuthManager - Core authentication system for Supabase Lite
 * Manages user registration, authentication, sessions, and password security
 */

import { generateUUID, generateToken, generateJWTToken, decodeJWTPayload } from '../utils/crypto.js'
import { 
  createPasswordRecord, 
  verifyPasswordRecord, 
  validatePasswordStrength 
} from './PasswordHasher.js'

/**
 * AuthManager class - Singleton pattern for managing authentication
 */
class AuthManager {
  constructor() {
    this.users = new Map() // In-memory user storage (in production, would use database)
    this.sessions = new Map() // Active sessions storage
    this.refreshTokens = new Map() // Refresh token to user mapping
  }

  /**
   * Sign up a new user with email and password
   * @param {Object} params - Signup parameters
   * @param {string} params.email - User email
   * @param {string} params.password - User password
   * @param {Object} [params.options] - Additional options
   * @returns {Promise<Object>} Signup result with user and session
   */
  async signUp({ email, password, options = {} }) {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password)
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.errors.join(', '))
      }

      // Check if user already exists
      if (this.findUserByEmail(email)) {
        throw new Error('User already registered')
      }

      // Generate unique user ID
      const userId = generateUUID()
      
      // Hash password securely
      const passwordRecord = await createPasswordRecord(password)
      
      // Create user record
      const user = {
        id: userId,
        email: email.toLowerCase(),
        email_confirmed_at: new Date().toISOString(), // Auto-confirm for testing
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_metadata: options.data || {},
        app_metadata: {
          provider: 'email',
          providers: ['email']
        },
        ...passwordRecord // Include password hash, salt, etc.
      }

      // Store user
      this.users.set(userId, user)

      // Create session
      const session = await this.createSession(user)

      // Return Supabase-compatible response
      return {
        user: this.sanitizeUser(user),
        session
      }
    } catch (error) {
      console.error('SignUp error:', error)
      throw error
    }
  }

  /**
   * Sign in user with email and password
   * @param {Object} params - Signin parameters
   * @param {string} params.email - User email
   * @param {string} params.password - User password
   * @returns {Promise<Object>} Signin result with user and session
   */
  async signIn({ email, password }) {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required')
      }

      // Find user by email
      const user = this.findUserByEmail(email)
      if (!user) {
        throw new Error('Invalid login credentials')
      }

      // Verify password
      const isPasswordValid = await verifyPasswordRecord(password, user)
      if (!isPasswordValid) {
        throw new Error('Invalid login credentials')
      }

      // Create new session
      const session = await this.createSession(user)

      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: 'bearer',
        expires_in: 3600,
        user: this.sanitizeUser(user)
      }
    } catch (error) {
      console.error('SignIn error:', error)
      throw error
    }
  }

  /**
   * Refresh an access token using a refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New session data
   */
  async refreshToken(refreshToken) {
    try {
      // Find user by refresh token
      const userId = this.refreshTokens.get(refreshToken)
      if (!userId) {
        throw new Error('Invalid refresh token')
      }

      const user = this.users.get(userId)
      if (!user) {
        throw new Error('User not found')
      }

      // Create new session (this will invalidate the old one)
      const session = await this.createSession(user)

      return {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: 'bearer',
        expires_in: 3600,
        user: this.sanitizeUser(user)
      }
    } catch (error) {
      console.error('RefreshToken error:', error)
      throw error
    }
  }

  /**
   * Sign out user by invalidating their session
   * @param {string} accessToken - Access token to invalidate
   * @returns {Promise<Object>} Empty response
   */
  async signOut(accessToken) {
    try {
      const session = this.sessions.get(accessToken)
      if (session) {
        // Remove session and refresh token
        this.sessions.delete(accessToken)
        this.refreshTokens.delete(session.refresh_token)
      }
      return {}
    } catch (error) {
      console.error('SignOut error:', error)
      throw error
    }
  }

  /**
   * Get user from access token
   * @param {string} accessToken - Access token
   * @returns {Object|null} User object or null if not found/expired
   */
  getUserFromToken(accessToken) {
    try {
      const session = this.sessions.get(accessToken)
      if (!session) {
        return null
      }

      // Check if session is expired
      if (Date.now() / 1000 > session.expires_at) {
        this.sessions.delete(accessToken)
        this.refreshTokens.delete(session.refresh_token)
        return null
      }

      return this.sanitizeUser(session.user)
    } catch (error) {
      console.error('GetUserFromToken error:', error)
      return null
    }
  }

  /**
   * Update user profile
   * @param {string} accessToken - Access token
   * @param {Object} updates - User updates
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(accessToken, updates) {
    try {
      const session = this.sessions.get(accessToken)
      if (!session) {
        throw new Error('Auth session missing!')
      }

      const user = this.users.get(session.user.id)
      if (!user) {
        throw new Error('User not found')
      }

      // Update user record
      const updatedUser = {
        ...user,
        ...updates,
        updated_at: new Date().toISOString()
      }

      // Store updated user
      this.users.set(user.id, updatedUser)

      // Update session user
      session.user = updatedUser

      return this.sanitizeUser(updatedUser)
    } catch (error) {
      console.error('UpdateUser error:', error)
      throw error
    }
  }

  /**
   * Send password reset email (mock implementation)
   * @param {string} email - User email
   * @returns {Promise<Object>} Success response
   */
  async resetPasswordForEmail(email) {
    try {
      const user = this.findUserByEmail(email)
      if (!user) {
        // Don't reveal if user exists or not for security
        console.log('Password reset attempted for non-existent email:', email)
      } else {
        console.log('Password reset email would be sent to:', email)
      }

      return {
        message: 'Recovery email sent (mock)'
      }
    } catch (error) {
      console.error('ResetPassword error:', error)
      throw error
    }
  }

  /**
   * Create a new session for a user
   * @param {Object} user - User object
   * @returns {Promise<Object>} Session object
   */
  async createSession(user) {
    const now = Math.floor(Date.now() / 1000)
    const expiresIn = 3600 // 1 hour
    const expiresAt = now + expiresIn

    // Generate JWT access token
    const accessToken = generateJWTToken({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aal: 'aal1',
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    }, expiresIn)

    // Generate refresh token
    const refreshToken = generateToken(32)

    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: expiresIn,
      expires_at: expiresAt,
      user: user
    }

    // Store session and refresh token mapping
    this.sessions.set(accessToken, session)
    this.refreshTokens.set(refreshToken, user.id)

    return session
  }

  /**
   * Find user by email address
   * @param {string} email - Email to search for
   * @returns {Object|null} User object or null
   */
  findUserByEmail(email) {
    const normalizedEmail = email.toLowerCase()
    for (const user of this.users.values()) {
      if (user.email === normalizedEmail) {
        return user
      }
    }
    return null
  }

  /**
   * Remove sensitive fields from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user) {
    const sanitized = { ...user }
    // Remove password-related fields
    delete sanitized.password_hash
    delete sanitized.password_salt
    delete sanitized.hash_iterations
    delete sanitized.hash_algorithm
    return sanitized
  }

  /**
   * Get all users (for debugging/testing)
   * @returns {Array} Array of sanitized users
   */
  getAllUsers() {
    return Array.from(this.users.values()).map(user => this.sanitizeUser(user))
  }

  /**
   * Get all active sessions (for debugging/testing)
   * @returns {Array} Array of active sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      ...session,
      user: this.sanitizeUser(session.user)
    }))
  }

  /**
   * Clear all data (for testing)
   */
  clearAll() {
    this.users.clear()
    this.sessions.clear()
    this.refreshTokens.clear()
  }

}

// Create singleton instance
const authManager = new AuthManager()

export default authManager
export { AuthManager }