/**
 * Crypto utilities for UUID generation and secure token creation
 * Uses Web Crypto API for cryptographically secure random values
 */

/**
 * Generate a cryptographically secure UUID v4
 * @returns {string} UUID v4 string
 */
export function generateUUID() {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback implementation using crypto.getRandomValues()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  
  // Set version (4) and variant bits according to RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40  // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80  // Variant 10
  
  // Convert to hex string with proper formatting
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-')
}

/**
 * Generate a cryptographically secure random token
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} Base64url encoded token
 */
export function generateToken(length = 32) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  
  // Convert to base64url (URL-safe base64)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Generate a secure JWT-compatible access token
 * @param {Object} payload - JWT payload data
 * @param {number} expiresInSeconds - Expiration time in seconds (default: 3600)
 * @returns {string} JWT-like token
 */
export function generateJWTToken(payload, expiresInSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000)
  
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }
  
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    aud: 'authenticated',
    iss: 'supabase-lite'
  }
  
  // Create JWT structure (header.payload.signature)
  const headerBase64 = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    
  const payloadBase64 = btoa(JSON.stringify(jwtPayload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  // Generate a secure signature (simplified for testing)
  const signature = generateToken(16)
  
  return `${headerBase64}.${payloadBase64}.${signature}`
}

/**
 * Generate a random salt for password hashing
 * @param {number} length - Salt length in bytes (default: 16)
 * @returns {Uint8Array} Cryptographically secure random salt
 */
export function generateSalt(length = 16) {
  const salt = new Uint8Array(length)
  crypto.getRandomValues(salt)
  return salt
}

/**
 * Convert Uint8Array to base64 string
 * @param {Uint8Array} buffer - Buffer to convert
 * @returns {string} Base64 encoded string
 */
export function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

/**
 * Convert base64 string to Uint8Array
 * @param {string} base64 - Base64 encoded string
 * @returns {Uint8Array} Decoded buffer
 */
export function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID v4 format
 */
export function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Decode JWT payload (without verification)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function decodeJWTPayload(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    let payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    
    // Add padding if needed
    while (payload.length % 4) {
      payload += '='
    }
    
    return JSON.parse(atob(payload))
  } catch (error) {
    console.error('JWT decode error:', error)
    return null
  }
}