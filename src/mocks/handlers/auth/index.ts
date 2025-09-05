import { sessionHandlers } from './session'
import { userHandlers } from './user'
import { recoveryHandlers } from './recovery'
import { mfaHandlers } from './mfa'
import { adminHandlers } from './admin'

/**
 * All Authentication API handlers
 * Combines session management, user operations, recovery, MFA, and admin functions
 */
export const authHandlers = [
  ...sessionHandlers,
  ...userHandlers,
  ...recoveryHandlers,
  ...mfaHandlers,
  ...adminHandlers
]

// Re-export individual modules for direct access
export { sessionHandlers } from './session'
export { userHandlers } from './user'
export { recoveryHandlers } from './recovery'
export { mfaHandlers } from './mfa'
export { adminHandlers } from './admin'