/**
 * PBKDF2 Password Hashing utility
 * Uses Web Crypto API for secure password hashing and verification
 */

import { generateSalt, arrayBufferToBase64, base64ToArrayBuffer } from '../utils/crypto.js'

/**
 * PBKDF2 configuration
 */
const PBKDF2_CONFIG = {
  iterations: 100000,  // OWASP recommended minimum
  keyLength: 32,       // 256 bits
  algorithm: 'SHA-256'
}

/**
 * Hash a password using PBKDF2
 * @param {string} password - Plain text password
 * @param {Uint8Array} [salt] - Optional salt (will generate if not provided)
 * @returns {Promise<{hash: string, salt: string}>} Hashed password and salt (base64 encoded)
 */
export async function hashPassword(password, salt = null) {
  try {
    // Generate salt if not provided
    if (!salt) {
      salt = generateSalt(16)
    }
    
    // Convert password to ArrayBuffer
    const encoder = new TextEncoder()
    const passwordBuffer = encoder.encode(password)
    
    // Import password as crypto key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    )
    
    // Derive key using PBKDF2
    const derivedKey = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_CONFIG.iterations,
        hash: PBKDF2_CONFIG.algorithm
      },
      keyMaterial,
      PBKDF2_CONFIG.keyLength * 8 // bits
    )
    
    // Convert to base64 for storage
    const hashBase64 = arrayBufferToBase64(derivedKey)
    const saltBase64 = arrayBufferToBase64(salt)
    
    return {
      hash: hashBase64,
      salt: saltBase64,
      iterations: PBKDF2_CONFIG.iterations,
      algorithm: PBKDF2_CONFIG.algorithm
    }
  } catch (error) {
    console.error('Password hashing error:', error)
    throw new Error('Failed to hash password')
  }
}

/**
 * Verify a password against a stored hash
 * @param {string} password - Plain text password to verify
 * @param {string} storedHash - Base64 encoded stored hash
 * @param {string} storedSalt - Base64 encoded stored salt
 * @param {number} [iterations] - Number of iterations used (default: current config)
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, storedHash, storedSalt, iterations = PBKDF2_CONFIG.iterations) {
  try {
    // Convert stored salt back to Uint8Array
    const salt = base64ToArrayBuffer(storedSalt)
    
    // Hash the provided password with the same salt
    const { hash: newHash } = await hashPassword(password, salt)
    
    // Compare hashes using timing-safe comparison
    return constantTimeCompare(newHash, storedHash)
  } catch (error) {
    console.error('Password verification error:', error)
    return false
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings match
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Create a password hash record for database storage
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} Password record with all necessary fields
 */
export async function createPasswordRecord(password) {
  const { hash, salt, iterations, algorithm } = await hashPassword(password)
  
  return {
    password_hash: hash,
    password_salt: salt,
    hash_iterations: iterations,
    hash_algorithm: algorithm,
    created_at: new Date().toISOString()
  }
}

/**
 * Verify password against a database password record
 * @param {string} password - Plain text password to verify
 * @param {Object} passwordRecord - Database password record
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPasswordRecord(password, passwordRecord) {
  const {
    password_hash,
    password_salt,
    hash_iterations = PBKDF2_CONFIG.iterations
  } = passwordRecord
  
  if (!password_hash || !password_salt) {
    console.error('Invalid password record: missing hash or salt')
    return false
  }
  
  return await verifyPassword(password, password_hash, password_salt, hash_iterations)
}

/**
 * Check if password meets minimum security requirements
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export function validatePasswordStrength(password) {
  const errors = []
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required')
    return { isValid: false, errors }
  }
  
  if (password.length < 6) {
    errors.push('Password must be at least 6 characters long')
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long')
  }
  
  // Optional: Add more strength requirements
  // if (!/[a-z]/.test(password)) {
  //   errors.push('Password must contain at least one lowercase letter')
  // }
  
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Password must contain at least one uppercase letter')
  // }
  
  // if (!/\d/.test(password)) {
  //   errors.push('Password must contain at least one number')
  // }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 16)
 * @returns {string} Generated password
 */
export function generateSecurePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  
  return Array.from(array, byte => charset[byte % charset.length]).join('')
}

export default {
  hashPassword,
  verifyPassword,
  createPasswordRecord,
  verifyPasswordRecord,
  validatePasswordStrength,
  generateSecurePassword
}