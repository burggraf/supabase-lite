export interface User {
  id: string
  email?: string
  phone?: string
  email_verified?: boolean
  phone_verified?: boolean
  created_at: string
  updated_at: string
  last_sign_in_at?: string
  role?: string
  app_metadata: Record<string, any>
  user_metadata: Record<string, any>
  is_anonymous: boolean
}

export interface Session {
  id: string
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: number
  created_at: string
  updated_at: string
}

export interface RefreshToken {
  id: string
  user_id: string
  token: string
  expires_at: number
  created_at: string
}

export interface MFAFactor {
  id: string
  user_id: string
  factor_type: 'totp' | 'phone'
  status: 'unverified' | 'verified'
  friendly_name?: string
  secret?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface MFAChallenge {
  id: string
  factor_id: string
  created_at: string
  verified_at?: string
  ip_address?: string
}

export interface AuditLogEntry {
  id: string
  payload: Record<string, any>
  created_at: string
  ip_address?: string
}

export interface AuthEventPayload {
  event: 'signed_in' | 'signed_up' | 'signed_out' | 'password_recovery' | 'token_refreshed' | 'user_updated' | 'user_deleted'
  session: Session | null
}

export interface SignUpCredentials {
  email?: string
  phone?: string
  password: string
  data?: Record<string, any>
}

export interface SignInCredentials {
  email?: string
  phone?: string
  password?: string
  provider?: string
}

export interface UpdateUserAttributes {
  email?: string
  phone?: string
  password?: string
  data?: Record<string, any>
}

export interface AuthError extends Error {
  status: number
  code: string
}

export interface AuthenticatorAssuranceLevel {
  currentLevel: 'aal1' | 'aal2' | null
  nextLevel: 'aal1' | 'aal2' | null
  currentAuthenticationMethods: AuthenticationMethod[]
}

export interface AuthenticationMethod {
  method: 'otp' | 'password' | 'oauth' | 'totp' | 'recovery' | 'invite' | 'magiclink' | 'email/signup' | 'email_change' | 'sso/saml' | 'anonymous'
  timestamp: number
}

export interface Provider {
  name: string
  displayName: string
  iconUrl?: string
}

export interface AuthConfig {
  url: string
  anonKey: string
  serviceRoleKey?: string
  autoRefreshToken: boolean
  persistSession: boolean
  detectSessionInUrl: boolean
  headers?: Record<string, string>
}

export interface AuthChangeEvent {
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY'
  session: Session | null
}

export type AuthEventListener = (event: AuthChangeEvent) => void