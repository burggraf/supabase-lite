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

  // Storage keys that match the main app
  const AUTH_TOKEN_KEY = 'supabase-auth-token'
  const REFRESH_TOKEN_KEY = 'supabase-refresh-token'
  const AUTH_SESSION_KEY = 'supabase-auth-session'
  const AUTH_USER_KEY = 'supabase-auth-user'

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedSession = localStorage.getItem(AUTH_SESSION_KEY)
        const storedUser = localStorage.getItem(AUTH_USER_KEY)
        const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)

        if (storedSession && storedUser && storedToken) {
          const session: AuthSession = JSON.parse(storedSession)
          const user: User = JSON.parse(storedUser)
          
          // Check if token is expired
          if (session.expires_at && session.expires_at > Date.now() / 1000) {
            dispatch({ type: 'SET_SESSION', payload: { ...session, user } })
          } else {
            // Token expired, clear auth state
            clearAuthState()
            dispatch({ type: 'SET_LOADING', payload: false })
          }
        } else {
          dispatch({ type: 'SET_LOADING', payload: false })
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        clearAuthState()
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    initializeAuth()
  }, [])

  const clearAuthState = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(AUTH_SESSION_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
  }

  const saveAuthState = (session: AuthSession) => {
    localStorage.setItem(AUTH_TOKEN_KEY, session.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token)
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user))
  }

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
        const session: AuthSession = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
          user: data.user as User
        }
        saveAuthState(session)
        dispatch({ type: 'SET_SESSION', payload: session })
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
        const session: AuthSession = {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
          user: data.user as User
        }
        
        saveAuthState(session)
        dispatch({ type: 'SET_SESSION', payload: session })
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
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      clearAuthState()
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