// Core authentication components
export { AuthManager } from './core/AuthManager'
export { JWTService } from './core/JWTService'
export { SessionManager } from './core/SessionManager'
export { PasswordService } from './core/PasswordService'

// Types - Import directly from source files to avoid caching issues
export type * from './types/auth.types'
export type * from './types/jwt.types'
export type { 
  AuthAPIResponse, 
  SignUpRequest, 
  SignInRequest, 
  RecoverPasswordRequest,
  AuthError as APIAuthError
} from './types/api-responses'

// Utils
export { CryptoUtils } from './utils/crypto'
export { AuthStorage, CrossTabSync } from './utils/storage'
export { Validators, ValidationError } from './utils/validators'

// Services
export { MFAService } from './services/MFAService'

// Service types (to be implemented)
// export type { EmailAuthService } from './services/EmailAuthService'
// export type { PhoneAuthService } from './services/PhoneAuthService'
// export type { OAuthService } from './services/OAuthService'
// export type { AdminService } from './services/AdminService'