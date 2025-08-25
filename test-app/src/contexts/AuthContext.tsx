import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import type { AuthState, AuthContextValue, User, AuthSession } from '../types/auth'
import { supabase } from '../lib/supabase'

interface AuthAction {
  type: 'SET_LOADING' | 'SET_USER' | 'SET_SESSION' | 'SET_ERROR' | 'CLEAR_ERROR' | 'SIGN_OUT'
  payload?: any
}

const initialState: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    
    case 'SET_USER':
      return { 
        ...state, 
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null
      }
    
    case 'SET_SESSION':
      return { 
        ...state, 
        session: action.payload,
        user: action.payload?.user || null,
        isAuthenticated: !!action.payload?.user,
        isLoading: false,
        error: null
      }
    
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload,
        isLoading: false
      }
    
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    
    case 'SIGN_OUT':
      return { 
        ...initialState, 
        isLoading: false 
      }
    
    default:
      return state
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth state using Supabase's session management
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get the current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          if (mounted) {
            dispatch({ type: 'SET_LOADING', payload: false })
          }
          return
        }

        if (mounted) {
          if (session?.user) {
            const authSession: AuthSession = {
              access_token: session.access_token,
              refresh_token: session.refresh_token,
              expires_in: session.expires_in,
              expires_at: session.expires_at,
              token_type: session.token_type,
              user: session.user as User
            }
            dispatch({ type: 'SET_SESSION', payload: authSession })
          } else {
            dispatch({ type: 'SET_LOADING', payload: false })
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      }
    }

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_IN' && session?.user) {
          const authSession: AuthSession = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            token_type: session.token_type,
            user: session.user as User
          }
          dispatch({ type: 'SET_SESSION', payload: authSession })
        } else if (event === 'SIGNED_OUT' || !session) {
          dispatch({ type: 'SIGN_OUT' })
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const authSession: AuthSession = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            token_type: session.token_type,
            user: session.user as User
          }
          dispatch({ type: 'SET_SESSION', payload: authSession })
        }
      }
    )

    initializeAuth()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])


  const signUp = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'CLEAR_ERROR' })

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message })
        return { success: false, error: error.message }
      }

      if (data.user && data.session) {
        // Supabase will automatically trigger onAuthStateChange
        // No need to manually dispatch or save state here
        return { success: true }
      }

      dispatch({ type: 'SET_LOADING', payload: false })
      return { success: true }
    } catch (error) {
      const errorMessage = 'Network error. Please try again.'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      return { success: false, error: errorMessage }
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'CLEAR_ERROR' })

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        dispatch({ type: 'SET_ERROR', payload: error.message })
        return { success: false, error: error.message }
      }

      if (data.session && data.user) {
        // Supabase will automatically trigger onAuthStateChange
        // No need to manually dispatch or save state here
        return { success: true }
      }

      dispatch({ type: 'SET_ERROR', payload: 'Invalid response from server' })
      return { success: false, error: 'Invalid response from server' }
    } catch (error) {
      const errorMessage = 'Network error. Please try again.'
      dispatch({ type: 'SET_ERROR', payload: errorMessage })
      return { success: false, error: errorMessage }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      // Use Supabase.js signOut method
      await supabase.auth.signOut()
      // onAuthStateChange listener will handle state update automatically
    } catch (error) {
      console.error('Error during logout:', error)
      // Fallback: manually sign out if Supabase call fails
      dispatch({ type: 'SIGN_OUT' })
    }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  const value: AuthContextValue = {
    ...state,
    signUp,
    signIn,
    signOut,
    resetPassword,
    clearError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}