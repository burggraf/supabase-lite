export interface JWTHeader {
  alg: 'ES256' | 'RS256' | 'HS256'
  typ: 'JWT'
  kid?: string
}

export interface JWTPayload {
  iss: string
  sub: string
  aud: string | string[]
  exp: number
  iat: number
  nbf?: number
  jti?: string
  
  // Supabase-specific claims
  role: 'anon' | 'authenticated' | 'service_role'
  aal: 'aal1' | 'aal2'
  session_id?: string
  email?: string
  phone?: string
  is_anonymous: boolean
  app_metadata: Record<string, any>
  user_metadata: Record<string, any>
  amr?: AuthenticationMethodReference[]
  
  // For anon/service role tokens
  ref?: string
  
  // Index signature to make it compatible with jose library
  [key: string]: any
}

export interface AuthenticationMethodReference {
  method: 'otp' | 'password' | 'oauth' | 'totp' | 'recovery' | 'invite' | 'magiclink' | 'email/signup' | 'email_change' | 'sso/saml' | 'anonymous'
  timestamp: number
}

export interface JWTSigningKey {
  kty: 'EC' | 'RSA' | 'oct'
  kid: string
  use: 'sig'
  alg: 'ES256' | 'RS256' | 'HS256'
  crv?: 'P-256'
  x?: string
  y?: string
  n?: string
  e?: string
  d?: string
  k?: string
}

export interface JWKS {
  keys: JWTSigningKey[]
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  expires_at: number
  user: any
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  expires_at?: number
  refresh_token?: string
  user?: any
}