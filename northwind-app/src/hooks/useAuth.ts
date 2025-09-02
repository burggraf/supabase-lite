import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session, SignInCredentials, SignUpCredentials } from '@/types/auth'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (credentials: SignInCredentials) => Promise<void>
  signUp: (credentials: SignUpCredentials) => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const signIn = useCallback(async (credentials: SignInCredentials) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (error) throw error

      if (data.user && data.session) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          role: data.user.role || 'authenticated',
          email_confirmed_at: data.user.email_confirmed_at,
          last_sign_in_at: data.user.last_sign_in_at,
          created_at: data.user.created_at || '',
          updated_at: data.user.updated_at || '',
          user_metadata: data.user.user_metadata || {},
          app_metadata: data.user.app_metadata || {},
        }

        const session: Session = {
          access_token: data.session.access_token,
          token_type: data.session.token_type,
          expires_in: data.session.expires_in || 3600,
          expires_at: data.session.expires_at || 0,
          refresh_token: data.session.refresh_token,
          user,
        }

        setUser(user)
        setSession(session)
      }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: credentials.data || {},
        },
      })

      if (error) throw error

      // For email confirmation flow, user might be null initially
      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          role: data.user.role || 'authenticated',
          email_confirmed_at: data.user.email_confirmed_at,
          last_sign_in_at: data.user.last_sign_in_at,
          created_at: data.user.created_at || '',
          updated_at: data.user.updated_at || '',
          user_metadata: data.user.user_metadata || {},
          app_metadata: data.user.app_metadata || {},
        }

        // Only set session if email is confirmed and we have a session
        if (data.session) {
          const session: Session = {
            access_token: data.session.access_token,
            token_type: data.session.token_type,
            expires_in: data.session.expires_in || 3600,
            expires_at: data.session.expires_at || 0,
            refresh_token: data.session.refresh_token,
            user,
          }

          setUser(user)
          setSession(session)
        } else {
          // User registered but needs email confirmation
          setUser(null)
          setSession(null)
        }
      }
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      setSession(null)
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error

      if (data.session && data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email || '',
          role: data.user.role || 'authenticated',
          email_confirmed_at: data.user.email_confirmed_at,
          last_sign_in_at: data.user.last_sign_in_at,
          created_at: data.user.created_at || '',
          updated_at: data.user.updated_at || '',
          user_metadata: data.user.user_metadata || {},
          app_metadata: data.user.app_metadata || {},
        }

        const session: Session = {
          access_token: data.session.access_token,
          token_type: data.session.token_type,
          expires_in: data.session.expires_in || 3600,
          expires_at: data.session.expires_at || 0,
          refresh_token: data.session.refresh_token,
          user,
        }

        setUser(user)
        setSession(session)
      }
    } catch (error) {
      console.error('Refresh session error:', error)
      // On refresh error, clear the session
      setUser(null)
      setSession(null)
    }
  }, [])

  // Initialize auth state and listen for changes
  useEffect(() => {
    let mounted = true

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (mounted) {
          if (session && session.user) {
            const user: User = {
              id: session.user.id,
              email: session.user.email || '',
              role: session.user.role || 'authenticated',
              email_confirmed_at: session.user.email_confirmed_at,
              last_sign_in_at: session.user.last_sign_in_at,
              created_at: session.user.created_at || '',
              updated_at: session.user.updated_at || '',
              user_metadata: session.user.user_metadata || {},
              app_metadata: session.user.app_metadata || {},
            }

            const sessionData: Session = {
              access_token: session.access_token,
              token_type: session.token_type,
              expires_in: session.expires_in || 3600,
              expires_at: session.expires_at || 0,
              refresh_token: session.refresh_token,
              user,
            }

            setUser(user)
            setSession(sessionData)
          }
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return

        if (session && session.user) {
          const user: User = {
            id: session.user.id,
            email: session.user.email || '',
            role: session.user.role || 'authenticated',
            email_confirmed_at: session.user.email_confirmed_at,
            last_sign_in_at: session.user.last_sign_in_at,
            created_at: session.user.created_at || '',
            updated_at: session.user.updated_at || '',
            user_metadata: session.user.user_metadata || {},
            app_metadata: session.user.app_metadata || {},
          }

          const sessionData: Session = {
            access_token: session.access_token,
            token_type: session.token_type,
            expires_in: session.expires_in || 3600,
            expires_at: session.expires_at || 0,
            refresh_token: session.refresh_token,
            user,
          }

          setUser(user)
          setSession(sessionData)
        } else {
          setUser(null)
          setSession(null)
        }
        
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshSession,
  }
}

export { AuthContext }