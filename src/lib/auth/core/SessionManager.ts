import type { Session, RefreshToken, User, AuthChangeEvent, AuthEventListener } from '../types/auth.types'
import type { TokenPair } from '../types/jwt.types'
import { AuthStorage, CrossTabSync } from '../utils/storage'
import { CryptoUtils } from '../utils/crypto'
import { JWTService } from './JWTService'

export interface SessionConfig {
  autoRefreshToken: boolean
  persistSession: boolean
  refreshThresholdSeconds: number
  maxRetryAttempts: number
}

export class SessionManager {
  private static instance: SessionManager
  private storage: AuthStorage
  private crossTabSync: CrossTabSync
  private jwtService: JWTService
  private currentSession: Session | null = null
  private currentUser: User | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  private listeners: Set<AuthEventListener> = new Set()
  private config: SessionConfig

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      autoRefreshToken: true,
      persistSession: true,
      refreshThresholdSeconds: 300, // Refresh 5 minutes before expiry
      maxRetryAttempts: 3,
      ...config
    }
    
    this.storage = AuthStorage.getInstance()
    this.crossTabSync = CrossTabSync.getInstance()
    this.jwtService = JWTService.getInstance()

    this.setupCrossTabSync()
  }

  static getInstance(config?: Partial<SessionConfig>): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager(config)
    }
    return SessionManager.instance
  }

  /**
   * Initialize session manager and restore previous session
   */
  async initialize(): Promise<void> {
    if (!this.config.persistSession) {
      return
    }

    try {
      const currentUserId = await this.storage.getCurrentUser()
      if (currentUserId) {
        const session = await this.storage.getSession(currentUserId)
        if (session && !this.isSessionExpired(session)) {
          await this.setSession(session)
        } else {
          // Clean up expired session
          await this.clearSession()
        }
      }
    } catch (error) {
      console.warn('Failed to restore session:', error)
    }
  }

  /**
   * Create new session for user
   */
  async createSession(user: User, aal: 'aal1' | 'aal2' = 'aal1'): Promise<Session> {
    const sessionId = CryptoUtils.generateUUID()
    const now = new Date().toISOString()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour

    const session: Session = {
      id: sessionId,
      user_id: user.id,
      access_token: '', // Will be set by token pair
      refresh_token: '', // Will be set by token pair
      expires_at: expiresAt,
      created_at: now,
      updated_at: now
    }

    const tokenPair = await this.jwtService.createTokenPair(user, session, aal)
    
    session.access_token = tokenPair.access_token
    session.refresh_token = tokenPair.refresh_token

    await this.setSession(session, user)
    
    this.notifyListeners({
      event: 'SIGNED_IN',
      session
    })

    return session
  }

  /**
   * Set current session and user
   */
  async setSession(session: Session, user?: User): Promise<void> {
    this.currentSession = session

    if (user) {
      this.currentUser = user
    } else if (session.access_token) {
      // Extract user info from JWT
      const claims = this.jwtService.extractClaims(session.access_token)
      if (claims) {
        this.currentUser = this.userFromJWTClaims(claims)
      }
    }

    if (this.config.persistSession) {
      await this.storage.storeSession(session)
      await this.storage.storeCurrentUser(session.user_id)
    }

    // Set up auto-refresh
    if (this.config.autoRefreshToken) {
      this.setupAutoRefresh()
    }

    // Broadcast session change to other tabs
    this.crossTabSync.broadcast('session_changed', {
      session,
      user: this.currentUser
    })
  }

  /**
   * Get current session
   */
  getSession(): Session | null {
    return this.currentSession
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.currentUser
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.currentSession !== null && !this.isSessionExpired(this.currentSession)
  }

  /**
   * Refresh session tokens
   */
  async refreshSession(refreshToken?: string): Promise<Session | null> {
    const token = refreshToken || this.currentSession?.refresh_token

    if (!token) {
      throw new Error('No refresh token available')
    }

    if (!this.currentUser) {
      throw new Error('No current user available')
    }

    try {
      // Create new session with fresh tokens
      const newSession = await this.createSession(this.currentUser)

      this.notifyListeners({
        event: 'TOKEN_REFRESHED',
        session: newSession
      })

      return newSession
    } catch (error) {
      console.error('Token refresh failed:', error)
      await this.clearSession()
      throw error
    }
  }

  /**
   * Sign out user
   */
  async signOut(scope: 'local' | 'global' = 'local'): Promise<void> {
    const session = this.currentSession

    // Clear local session
    await this.clearSession()

    // Broadcast sign out to other tabs
    if (scope === 'global') {
      this.crossTabSync.broadcast('sign_out', { scope })
    }

    this.notifyListeners({
      event: 'SIGNED_OUT',
      session: null
    })
  }

  /**
   * Clear current session
   */
  async clearSession(): Promise<void> {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    const userId = this.currentSession?.user_id

    this.currentSession = null
    this.currentUser = null

    if (userId && this.config.persistSession) {
      await this.storage.removeSession(userId)
      await this.storage.removeRefreshToken(userId)
      await this.storage.removeCurrentUser()
    }
  }

  /**
   * Update current user
   */
  async updateUser(updates: Partial<User>): Promise<User | null> {
    if (!this.currentUser || !this.currentSession) {
      return null
    }

    const updatedUser: User = {
      ...this.currentUser,
      ...updates,
      updated_at: new Date().toISOString()
    }

    // Update JWT with new user info
    const updatedToken = await this.jwtService.updateUserClaims(
      this.currentSession.access_token,
      updatedUser
    )

    const updatedSession: Session = {
      ...this.currentSession,
      access_token: updatedToken,
      updated_at: new Date().toISOString()
    }

    this.currentUser = updatedUser
    await this.setSession(updatedSession, updatedUser)

    this.notifyListeners({
      event: 'USER_UPDATED',
      session: updatedSession
    })

    return updatedUser
  }

  /**
   * Add auth state change listener
   */
  onAuthStateChange(listener: AuthEventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Get session validity info
   */
  getSessionInfo(): {
    isValid: boolean
    expiresAt: number | null
    timeUntilExpiry: number | null
    needsRefresh: boolean
  } {
    if (!this.currentSession) {
      return {
        isValid: false,
        expiresAt: null,
        timeUntilExpiry: null,
        needsRefresh: false
      }
    }

    const now = Math.floor(Date.now() / 1000)
    const expiresAt = this.currentSession.expires_at
    const timeUntilExpiry = expiresAt - now
    const needsRefresh = timeUntilExpiry <= this.config.refreshThresholdSeconds

    return {
      isValid: !this.isSessionExpired(this.currentSession),
      expiresAt,
      timeUntilExpiry,
      needsRefresh
    }
  }

  /**
   * Force refresh session if needed
   */
  async ensureValidSession(): Promise<Session | null> {
    if (!this.currentSession) {
      return null
    }

    const info = this.getSessionInfo()
    
    if (!info.isValid) {
      await this.clearSession()
      return null
    }

    if (info.needsRefresh) {
      return await this.refreshSession()
    }

    return this.currentSession
  }

  /**
   * Set up automatic token refresh
   */
  private setupAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }

    if (!this.currentSession) {
      return
    }

    const info = this.getSessionInfo()
    if (!info.timeUntilExpiry || info.timeUntilExpiry <= 0) {
      return
    }

    // Schedule refresh 5 minutes before expiry
    const refreshIn = Math.max(
      (info.timeUntilExpiry - this.config.refreshThresholdSeconds) * 1000,
      60000 // Minimum 1 minute
    )

    this.refreshTimer = setTimeout(async () => {
      try {
        await this.refreshSession()
      } catch (error) {
        console.error('Auto refresh failed:', error)
        await this.clearSession()
      }
    }, refreshIn)
  }

  /**
   * Set up cross-tab synchronization
   */
  private setupCrossTabSync(): void {
    this.crossTabSync.subscribe(async (event) => {
      switch (event.type) {
        case 'session_changed':
          if (event.payload.session.user_id !== this.currentSession?.user_id) {
            await this.setSession(event.payload.session, event.payload.user)
          }
          break

        case 'sign_out':
          if (event.payload.scope === 'global') {
            await this.clearSession()
            this.notifyListeners({
              event: 'SIGNED_OUT',
              session: null
            })
          }
          break

        case 'user_updated':
          if (event.payload.user.id === this.currentUser?.id) {
            this.currentUser = event.payload.user
            this.notifyListeners({
              event: 'USER_UPDATED',
              session: this.currentSession
            })
          }
          break
      }
    })
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: Session): boolean {
    return Date.now() >= session.expires_at * 1000
  }

  /**
   * Extract user info from JWT claims
   */
  private userFromJWTClaims(claims: any): User {
    return {
      id: claims.sub,
      email: claims.email,
      phone: claims.phone,
      email_verified: !!claims.email,
      phone_verified: !!claims.phone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      role: claims.role,
      app_metadata: claims.app_metadata || {},
      user_metadata: claims.user_metadata || {},
      is_anonymous: claims.is_anonymous || false
    }
  }

  /**
   * Notify all listeners of auth state changes
   */
  private notifyListeners(event: AuthChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Auth listener error:', error)
      }
    })
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }
    this.listeners.clear()
    this.crossTabSync.close()
  }
}