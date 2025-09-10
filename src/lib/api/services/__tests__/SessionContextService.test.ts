import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionContextService } from '../SessionContextService'
import { apiKeyGenerator } from '../../../auth/api-keys'
import * as Logger from '../../../infrastructure/Logger'

// Mock the dependencies
vi.mock('../../../auth/api-keys', () => ({
  apiKeyGenerator: {
    extractRole: vi.fn()
  }
}))

vi.mock('../../../infrastructure/Logger', () => ({
  logger: {
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

describe('SessionContextService', () => {
  let service: SessionContextService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SessionContextService()
  })

  describe('createSessionContext', () => {
    it('should create service_role context with service_role API key', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('service_role')

      const headers = { apikey: 'service-key' }
      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'service_role',
        claims: {
          role: 'service_role',
          iss: 'supabase-lite'
        }
      })

      expect(apiKeyGenerator.extractRole).toHaveBeenCalledWith('service-key')
    })

    it('should create authenticated context with valid JWT', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      // Create a mock JWT token (base64 encoded)
      const payload = { sub: 'user-123', role: 'authenticated' }
      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const headers = {
        apikey: 'anon-key',
        authorization: `Bearer ${mockToken}`
      }

      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'authenticated',
        userId: 'user-123',
        claims: {
          sub: 'user-123',
          role: 'authenticated',
          iss: 'supabase-lite'
        }
      })
    })

    it('should create anon context with anon API key and no JWT', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const headers = { apikey: 'anon-key' }
      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      })

      expect(apiKeyGenerator.extractRole).toHaveBeenCalledWith('anon-key')
    })

    it('should create anon context when API key role extraction fails', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue(null)

      const headers = { apikey: 'invalid-key' }
      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      })
    })

    it('should handle x-api-key header', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const headers = { 'x-api-key': 'test-key' }
      const context = await service.createSessionContext(headers)

      expect(context.role).toBe('anon')
      expect(apiKeyGenerator.extractRole).toHaveBeenCalledWith('test-key')
    })

    it('should prefer apikey over x-api-key', async () => {
      vi.mocked(apiKeyGenerator.extractRole)
        .mockReturnValueOnce('service_role')
        .mockReturnValueOnce('anon')

      const headers = {
        apikey: 'service-key',
        'x-api-key': 'anon-key'
      }

      const context = await service.createSessionContext(headers)

      expect(context.role).toBe('service_role')
      expect(apiKeyGenerator.extractRole).toHaveBeenCalledWith('service-key')
      expect(apiKeyGenerator.extractRole).not.toHaveBeenCalledWith('anon-key')
    })

    it('should handle Authorization header with capital A', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const payload = { sub: 'user-456' }
      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const headers = {
        apikey: 'anon-key',
        Authorization: `Bearer ${mockToken}`
      }

      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'authenticated',
        userId: 'user-456',
        claims: {
          sub: 'user-456',
          role: 'authenticated',
          iss: 'supabase-lite'
        }
      })
    })

    it('should prefer authorization over Authorization', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const payload1 = { sub: 'user-1' }
      const payload2 = { sub: 'user-2' }
      const token1 = `header.${btoa(JSON.stringify(payload1))}.signature`
      const token2 = `header.${btoa(JSON.stringify(payload2))}.signature`

      const headers = {
        apikey: 'anon-key',
        authorization: `Bearer ${token1}`,
        Authorization: `Bearer ${token2}`
      }

      const context = await service.createSessionContext(headers)

      expect(context.userId).toBe('user-1')
    })

    it('should handle malformed JWT token gracefully', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const headers = {
        apikey: 'anon-key',
        authorization: 'Bearer invalid-token'
      }

      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      })

      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Failed to parse user JWT',
        { error: expect.any(Error) }
      )
    })

    it('should handle JWT with missing parts', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const headers = {
        apikey: 'anon-key',
        authorization: 'Bearer header.payload' // Missing signature
      }

      const context = await service.createSessionContext(headers)

      expect(context.role).toBe('anon')
      expect(Logger.logger.debug).toHaveBeenCalled()
    })

    it('should handle JWT with invalid base64 payload', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const headers = {
        apikey: 'anon-key',
        authorization: 'Bearer header.invalid-base64.signature'
      }

      const context = await service.createSessionContext(headers)

      expect(context.role).toBe('anon')
      expect(Logger.logger.debug).toHaveBeenCalled()
    })

    it('should handle JWT with invalid JSON payload', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const invalidJson = btoa('invalid json')
      const headers = {
        apikey: 'anon-key',
        authorization: `Bearer header.${invalidJson}.signature`
      }

      const context = await service.createSessionContext(headers)

      expect(context.role).toBe('anon')
      expect(Logger.logger.debug).toHaveBeenCalled()
    })

    it('should handle JWT without sub claim', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const payload = { role: 'authenticated', email: 'test@example.com' }
      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const headers = {
        apikey: 'anon-key',
        authorization: `Bearer ${mockToken}`
      }

      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      })
    })

    it('should handle authorization header without Bearer prefix', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const headers = {
        apikey: 'anon-key',
        authorization: 'token-without-bearer'
      }

      const context = await service.createSessionContext(headers)

      expect(context.role).toBe('anon')
    })

    it('should handle empty authorization header', async () => {
      vi.mocked(apiKeyGenerator.extractRole).mockReturnValue('anon')

      const headers = {
        apikey: 'anon-key',
        authorization: ''
      }

      const context = await service.createSessionContext(headers)

      expect(context.role).toBe('anon')
    })

    it('should work with no headers provided', async () => {
      const headers = {}
      const context = await service.createSessionContext(headers)

      expect(context).toEqual({
        role: 'anon',
        claims: {
          role: 'anon',
          iss: 'supabase-lite'
        }
      })
    })
  })

  describe('extractUserIdFromJWT', () => {
    it('should extract user ID from valid JWT', () => {
      const payload = { sub: 'user-123', email: 'test@example.com' }
      const encodedPayload = btoa(JSON.stringify(payload))
      const token = `header.${encodedPayload}.signature`

      // Use private method through any cast for testing
      const userId = (service as any).extractUserIdFromJWT(token)

      expect(userId).toBe('user-123')
    })

    it('should return null for invalid JWT format', () => {
      const invalidTokens = [
        'invalid',
        'header.payload',
        'header.payload.signature.extra',
        '',
        'header..signature'
      ]

      invalidTokens.forEach(token => {
        const userId = (service as any).extractUserIdFromJWT(token)
        expect(userId).toBeNull()
      })
    })

    it('should return null for invalid base64 payload', () => {
      const token = 'header.invalid-base64.signature'
      const userId = (service as any).extractUserIdFromJWT(token)

      expect(userId).toBeNull()
      expect(Logger.logger.warn).toHaveBeenCalledWith(
        'Failed to parse JWT token',
        { error: expect.any(Error) }
      )
    })

    it('should return null for invalid JSON payload', () => {
      const invalidJson = btoa('invalid json')
      const token = `header.${invalidJson}.signature`
      const userId = (service as any).extractUserIdFromJWT(token)

      expect(userId).toBeNull()
      expect(Logger.logger.warn).toHaveBeenCalledWith(
        'Failed to parse JWT token',
        { error: expect.any(Error) }
      )
    })

    it('should return null when sub claim is missing', () => {
      const payload = { email: 'test@example.com', role: 'authenticated' }
      const encodedPayload = btoa(JSON.stringify(payload))
      const token = `header.${encodedPayload}.signature`

      const userId = (service as any).extractUserIdFromJWT(token)

      expect(userId).toBeNull()
    })

    it('should return null when sub claim is empty', () => {
      const payload = { sub: '', email: 'test@example.com' }
      const encodedPayload = btoa(JSON.stringify(payload))
      const token = `header.${encodedPayload}.signature`

      const userId = (service as any).extractUserIdFromJWT(token)

      expect(userId).toBeNull()
    })
  })
})