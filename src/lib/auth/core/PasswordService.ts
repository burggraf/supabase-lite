import { CryptoUtils } from '../utils/crypto'
import { Validators, ValidationError } from '../utils/validators'

export interface HashedPassword {
  hash: string
  salt: string
  algorithm: string
  iterations: number
}

export class PasswordService {
  private static instance: PasswordService
  private readonly algorithm = 'PBKDF2'
  private readonly iterations = 100000
  private readonly hashFunction = 'SHA-256'
  private readonly keyLength = 256

  static getInstance(): PasswordService {
    if (!PasswordService.instance) {
      PasswordService.instance = new PasswordService()
    }
    return PasswordService.instance
  }

  /**
   * Hash password using PBKDF2 with Web Crypto API
   */
  async hashPassword(password: string): Promise<HashedPassword> {
    // Validate password strength
    const validation = Validators.validatePassword(password)
    if (!validation.isValid) {
      throw new ValidationError(validation.errors[0], 'password')
    }

    const { hash, salt } = await CryptoUtils.hashPassword(password)

    return {
      hash,
      salt,
      algorithm: this.algorithm,
      iterations: this.iterations
    }
  }

  /**
   * Verify password against stored hash
   */
  async verifyPassword(password: string, hashedPassword: HashedPassword): Promise<boolean> {
    try {
      return await CryptoUtils.verifyPassword(password, hashedPassword.hash, hashedPassword.salt)
    } catch (error) {
      console.warn('Password verification error:', error)
      return false
    }
  }

  /**
   * Generate secure temporary password for password reset
   */
  generateTemporaryPassword(length: number = 12): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let result = ''
    const randomArray = crypto.getRandomValues(new Uint8Array(length))
    
    for (let i = 0; i < length; i++) {
      result += chars[randomArray[i] % chars.length]
    }
    
    return result
  }

  /**
   * Check if password meets complexity requirements
   */
  checkPasswordStrength(password: string): {
    score: number
    feedback: string[]
    strength: 'very_weak' | 'weak' | 'fair' | 'good' | 'strong'
  } {
    const feedback: string[] = []
    let score = 0

    // Length check
    if (password.length >= 8) score += 1
    else feedback.push('Use at least 8 characters')

    if (password.length >= 12) score += 1

    // Character variety
    if (/[a-z]/.test(password)) score += 1
    else feedback.push('Add lowercase letters')

    if (/[A-Z]/.test(password)) score += 1
    else feedback.push('Add uppercase letters')

    if (/\d/.test(password)) score += 1
    else feedback.push('Add numbers')

    if (/[^A-Za-z0-9]/.test(password)) score += 1
    else feedback.push('Add special characters')

    // Pattern checks
    if (!/(.)\1{2,}/.test(password)) score += 1
    else feedback.push('Avoid repeated characters')

    // Dictionary check (basic)
    const commonPatterns = ['123', 'abc', 'password', 'qwerty']
    if (!commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
      score += 1
    } else {
      feedback.push('Avoid common patterns')
    }

    // Determine strength
    let strength: 'very_weak' | 'weak' | 'fair' | 'good' | 'strong'
    if (score <= 2) strength = 'very_weak'
    else if (score <= 4) strength = 'weak'
    else if (score <= 6) strength = 'fair'
    else if (score <= 7) strength = 'good'
    else strength = 'strong'

    return { score, feedback, strength }
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(): string {
    return CryptoUtils.generateSecureToken(32)
  }

  /**
   * Generate email confirmation token
   */
  generateEmailConfirmationToken(): string {
    return CryptoUtils.generateSecureToken(32)
  }

  /**
   * Generate phone confirmation token (6-digit OTP)
   */
  generatePhoneConfirmationToken(): string {
    const array = crypto.getRandomValues(new Uint8Array(3))
    let code = ''
    for (let i = 0; i < 3; i++) {
      code += (array[i] % 100).toString().padStart(2, '0')
    }
    return code.substring(0, 6)
  }

  /**
   * Validate password reset token format
   */
  isValidPasswordResetToken(token: string): boolean {
    return typeof token === 'string' && 
           token.length >= 32 && 
           /^[A-Za-z0-9_-]+$/.test(token)
  }

  /**
   * Hash sensitive data for audit logging (one-way hash)
   */
  async hashForAudit(data: string): Promise<string> {
    return await CryptoUtils.createAuditHash(data)
  }

  /**
   * Compare password hashes in constant time to prevent timing attacks
   */
  constantTimeHashCompare(hash1: string, hash2: string): boolean {
    return CryptoUtils.constantTimeEqual(hash1, hash2)
  }

  /**
   * Validate password meets minimum requirements (less strict for certain flows)
   */
  validateMinimumPassword(password: string): void {
    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long')
    }

    if (password.length > 72) {
      throw new ValidationError('Password must be less than 72 characters long')
    }
  }

  /**
   * Check if password is in common password list (simulated HaveIBeenPwned)
   */
  async isPasswordCompromised(password: string): Promise<boolean> {
    // In a real implementation, this would check against HaveIBeenPwned API
    // For simulation, we check against a basic list of common passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      '1234567890', 'dragon', 'rockyou', 'princess', 'football',
      'master', 'jordan', 'superman', 'harley', 'robert'
    ]

    return commonPasswords.includes(password.toLowerCase())
  }

  /**
   * Generate backup codes for MFA
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = []
    
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const array = crypto.getRandomValues(new Uint8Array(4))
      let code = ''
      for (let j = 0; j < 4; j++) {
        code += array[j].toString(16).padStart(2, '0')
      }
      codes.push(code.toUpperCase())
    }
    
    return codes
  }

  /**
   * Hash backup codes for secure storage
   */
  async hashBackupCodes(codes: string[]): Promise<{ code: string; hash: string }[]> {
    const hashedCodes: { code: string; hash: string }[] = []
    
    for (const code of codes) {
      const hash = await CryptoUtils.createAuditHash(code)
      hashedCodes.push({ code, hash })
    }
    
    return hashedCodes
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(code: string, hashedCodes: string[]): Promise<boolean> {
    const codeHash = await CryptoUtils.createAuditHash(code.toUpperCase())
    return hashedCodes.some(hash => CryptoUtils.constantTimeEqual(hash, codeHash))
  }

  /**
   * Rate limiting helper - check if too many password attempts
   */
  isPasswordAttemptRateLimited(attempts: number, lastAttempt: Date, windowMinutes: number = 15): boolean {
    const maxAttempts = 5
    const windowMs = windowMinutes * 60 * 1000
    const now = new Date()
    
    if (attempts >= maxAttempts && (now.getTime() - lastAttempt.getTime()) < windowMs) {
      return true
    }
    
    return false
  }

  /**
   * Calculate backoff delay for failed attempts
   */
  calculateBackoffDelay(attemptCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, etc. (max 60s)
    return Math.min(Math.pow(2, attemptCount) * 1000, 60000)
  }
}