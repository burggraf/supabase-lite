export interface SignUpRequest {
  email?: string
  phone?: string
  password: string
  data?: Record<string, any>
  gotrue_meta_security?: Record<string, any>
}

export interface SignUpResponse {
  user: any
  session: any
  message?: string
}

export interface SignInRequest {
  email?: string
  phone?: string
  password?: string
  provider?: string
  token?: string
  grant_type?: string
  gotrue_meta_security?: Record<string, any>
}

export interface SignInResponse {
  user: any
  session: any
  weak_password?: {
    reasons: string[]
  }
}

export interface SignOutRequest {
  scope?: 'global' | 'local'
}

export interface RecoverPasswordRequest {
  email: string
  gotrue_meta_security?: Record<string, any>
}

export interface VerifyTokenRequest {
  token: string
  type: 'signup' | 'recovery' | 'invite' | 'email_change' | 'phone_change' | 'magiclink'
  email?: string
  phone?: string
  password?: string
}

export interface UpdateUserRequest {
  email?: string
  phone?: string
  password?: string
  data?: Record<string, any>
  email_change_token?: string
  phone_change_token?: string
}

export interface UpdateUserResponse {
  user: any
  email_change_sent_at?: string
  phone_change_sent_at?: string
}

export interface GenerateLinkRequest {
  type: 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change_current' | 'email_change_new' | 'phone_change'
  email?: string
  phone?: string
  password?: string
  data?: Record<string, any>
  redirect_to?: string
}

export interface GenerateLinkResponse {
  action_link: string
  email_otp?: string
  hashed_token?: string
  redirect_to?: string
  verification_type?: string
}

export interface MFAEnrollRequest {
  factor_type: 'totp' | 'phone'
  friendly_name?: string
  issuer?: string
  phone?: string
}

export interface MFAEnrollResponse {
  id: string
  type: 'totp' | 'phone'
  totp?: {
    qr_code: string
    secret: string
    uri: string
  }
  phone?: {
    phone_number: string
  }
}

export interface MFAVerifyRequest {
  factor_id: string
  challenge_id: string
  code: string
}

export interface MFAVerifyResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  expires_at: number
  refresh_token: string
  user: any
}

export interface MFAChallengeRequest {
  factor_id: string
}

export interface MFAChallengeResponse {
  id: string
  expires_at: number
}

export interface MFAUnenrollRequest {
  factor_id: string
}

export interface ListFactorsResponse {
  totp: Array<{
    id: string
    friendly_name?: string
    factor_type: 'totp'
    status: 'verified' | 'unverified'
    created_at: string
    updated_at: string
  }>
  phone: Array<{
    id: string
    friendly_name?: string
    factor_type: 'phone'
    status: 'verified' | 'unverified'
    phone: string
    created_at: string
    updated_at: string
  }>
}

export interface AdminUserResponse {
  users: Array<{
    id: string
    email?: string
    phone?: string
    email_confirmed_at?: string
    phone_confirmed_at?: string
    created_at: string
    updated_at: string
    last_sign_in_at?: string
    role?: string
    app_metadata: Record<string, any>
    user_metadata: Record<string, any>
    is_anonymous: boolean
    identities?: any[]
    factors?: any[]
  }>
  aud: string
  next_page?: string | null
  total: number
}

export interface AuthError {
  error: string
  error_description: string
  message: string
}

export interface APIResponse<T = any> {
  data?: T
  error?: AuthError
  status: number
  statusText: string
}