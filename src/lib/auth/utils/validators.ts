export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class Validators {
  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Validate phone number (basic E.164 format)
   */
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+[1-9]\d{1,14}$/
    return phoneRegex.test(phone)
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long')
    }

    if (password.length > 72) {
      errors.push('Password must be less than 72 characters long')
    }

    // Check for basic character requirements
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter')
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter')
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number')
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ]

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate signup credentials
   */
  static validateSignUpCredentials(credentials: {
    email?: string
    phone?: string
    password: string
  }): void {
    const { email, phone, password } = credentials

    if (!email && !phone) {
      throw new ValidationError('Either email or phone is required')
    }

    if (email && !this.isValidEmail(email)) {
      throw new ValidationError('Invalid email format', 'email')
    }

    if (phone && !this.isValidPhone(phone)) {
      throw new ValidationError('Invalid phone format', 'phone')
    }

    const passwordValidation = this.validatePassword(password)
    if (!passwordValidation.isValid) {
      throw new ValidationError(passwordValidation.errors[0], 'password')
    }
  }

  /**
   * Validate signin credentials
   */
  static validateSignInCredentials(credentials: {
    email?: string
    phone?: string
    password?: string
    provider?: string
  }): void {
    const { email, phone, password, provider } = credentials

    if (provider) {
      // OAuth signin
      return
    }

    if (!email && !phone) {
      throw new ValidationError('Either email or phone is required')
    }

    if (!password) {
      throw new ValidationError('Password is required')
    }

    if (email && !this.isValidEmail(email)) {
      throw new ValidationError('Invalid email format', 'email')
    }

    if (phone && !this.isValidPhone(phone)) {
      throw new ValidationError('Invalid phone format', 'phone')
    }
  }

  /**
   * Validate update user attributes
   */
  static validateUpdateUserAttributes(attributes: {
    email?: string
    phone?: string
    password?: string
  }): void {
    const { email, phone, password } = attributes

    if (email && !this.isValidEmail(email)) {
      throw new ValidationError('Invalid email format', 'email')
    }

    if (phone && !this.isValidPhone(phone)) {
      throw new ValidationError('Invalid phone format', 'phone')
    }

    if (password) {
      const passwordValidation = this.validatePassword(password)
      if (!passwordValidation.isValid) {
        throw new ValidationError(passwordValidation.errors[0], 'password')
      }
    }
  }

  /**
   * Validate TOTP code format
   */
  static isValidTOTPCode(code: string): boolean {
    return /^\d{6}$/.test(code)
  }

  /**
   * Validate MFA factor type
   */
  static isValidMFAFactorType(factorType: string): boolean {
    return ['totp', 'phone'].includes(factorType)
  }

  /**
   * Validate JWT format (basic check)
   */
  static isValidJWTFormat(token: string): boolean {
    const parts = token.split('.')
    return parts.length === 3 && parts.every(part => part.length > 0)
  }

  /**
   * Validate refresh token format
   */
  static isValidRefreshTokenFormat(token: string): boolean {
    // Basic length and format check
    return typeof token === 'string' && token.length >= 32 && /^[A-Za-z0-9_-]+$/.test(token)
  }

  /**
   * Sanitize user metadata
   */
  static sanitizeUserMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(metadata)) {
      // Remove potentially dangerous keys
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        continue
      }

      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, 1000) // Limit string length
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value
      } else if (value === null) {
        sanitized[key] = null
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 100) // Limit array length
      } else if (typeof value === 'object') {
        // Recursively sanitize nested objects (limit depth)
        sanitized[key] = this.sanitizeUserMetadata(value)
      }
    }

    return sanitized
  }

  /**
   * Validate redirect URL for security
   */
  static isValidRedirectURL(url: string, allowedDomains: string[] = []): boolean {
    try {
      const parsed = new URL(url)
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false
      }

      // Check against allowed domains if provided
      if (allowedDomains.length > 0) {
        return allowedDomains.some(domain => 
          parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
        )
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Validate session expiry
   */
  static isSessionExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt * 1000
  }

  /**
   * Validate factor ID format (UUID)
   */
  static isValidFactorId(factorId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(factorId)
  }
}