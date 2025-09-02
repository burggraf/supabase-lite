export interface User {
  id: string
  email: string
  role: string
  email_confirmed_at?: string
  last_sign_in_at?: string
  created_at: string
  updated_at: string
  user_metadata: Record<string, any>
  app_metadata: Record<string, any>
}

export interface Session {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
  refresh_token?: string
  user: User
}

export interface AuthError {
  error: string
  error_description: string
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials {
  email: string
  password: string
  data?: Record<string, any>
}