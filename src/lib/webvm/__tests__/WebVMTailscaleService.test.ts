/**
 * Tests for WebVMTailscaleService
 * 
 * Tests optional Tailscale networking service for WebVM Edge Functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebVMTailscaleService } from '../WebVMTailscaleService'

describe('WebVMTailscaleService', () => {
  let service: WebVMTailscaleService

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    service = new WebVMTailscaleService()
  })

  describe('Configuration Management', () => {
    it('should start with no configuration', () => {
      expect(service.getConfig()).toBeNull()
      expect(service.isNetworkingAvailable()).toBe(false)
    })

    it('should configure Tailscale settings', () => {
      const config = {
        authKey: 'test-auth-key-12345',
        hostname: 'my-webvm-instance',
        exitNode: '100.64.0.10'
      }

      service.configure(config)
      
      const savedConfig = service.getConfig()
      expect(savedConfig).toEqual(config)
    })

    it('should persist configuration in localStorage', () => {
      const config = {
        authKey: 'persistent-key-67890',
        hostname: 'persistent-host'
      }

      service.configure(config)
      
      // Verify it's stored in localStorage
      const storedValue = localStorage.getItem('webvm-tailscale-config')
      expect(storedValue).not.toBeNull()
      expect(JSON.parse(storedValue!)).toEqual(config)
      
      // Test loading from existing localStorage state
      const loadedConfig = service.loadConfig()
      expect(loadedConfig).toEqual(config)
    })

    it('should clear configuration', () => {
      const config = { authKey: 'temp-key' }
      service.configure(config)
      
      expect(service.getConfig()).not.toBeNull()
      
      service.clearConfig()
      
      expect(service.getConfig()).toBeNull()
      expect(localStorage.getItem('webvm-tailscale-config')).toBeFalsy()
    })
  })

  describe('Connection Management', () => {
    beforeEach(() => {
      service.configure({
        authKey: 'valid-test-key-1234567890'
      })
    })

    it('should connect to Tailscale network', async () => {
      // Mock successful connection (overrides the random failure in simulate)
      vi.spyOn(Math, 'random').mockReturnValue(0.5) // Ensures no failure
      
      const result = await service.connect()
      
      expect(result).toBe(true)
      expect(service.isNetworkingAvailable()).toBe(true)
      
      const status = service.getStatus()
      expect(status.connected).toBe(true)
      expect(status.status).toBe('connected')
      expect(status.ipAddress).toBe('100.64.0.1')
    })

    it('should handle connection failures', async () => {
      // Mock connection failure
      vi.spyOn(Math, 'random').mockReturnValue(0.05) // Forces failure
      
      const result = await service.connect()
      
      expect(result).toBe(false)
      expect(service.isNetworkingAvailable()).toBe(false)
      
      const status = service.getStatus()
      expect(status.connected).toBe(false)
      expect(status.status).toBe('error')
      expect(status.error).toBe('Failed to connect to Tailscale network')
    })

    it('should disconnect from Tailscale', async () => {
      // Connect first
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      await service.connect()
      
      expect(service.isNetworkingAvailable()).toBe(true)
      
      await service.disconnect()
      
      expect(service.isNetworkingAvailable()).toBe(false)
      const status = service.getStatus()
      expect(status.connected).toBe(false)
      expect(status.status).toBe('disconnected')
    })

    it('should fail to connect without configuration', async () => {
      const unconfiguredService = new WebVMTailscaleService()
      
      await expect(unconfiguredService.connect()).rejects.toThrow(
        'Tailscale not configured. Please provide auth key.'
      )
    })

    it('should fail to connect with invalid auth key', async () => {
      const invalidService = new WebVMTailscaleService()
      invalidService.configure({ authKey: 'short' }) // Too short
      
      const result = await invalidService.connect()
      
      expect(result).toBe(false)
      const status = invalidService.getStatus()
      expect(status.status).toBe('error')
      expect(status.error).toBe('Invalid Tailscale auth key')
    })
  })

  describe('Network Requirements Analysis', () => {
    it('should detect external API calls', () => {
      const code = `
        const response = await fetch('https://api.github.com/users/octocat')
        return new Response(JSON.stringify(await response.json()))
      `

      const requirements = service.analyzeNetworkRequirements(code)
      
      expect(requirements).toHaveLength(1)
      expect(requirements[0]).toMatchObject({
        type: 'external-api',
        url: 'https://api.github.com/users/octocat',
        description: 'External external api to api.github.com'
      })
    })

    it('should detect WebSocket connections', () => {
      const code = `
        const ws = new WebSocket('wss://echo.websocket.org')
        ws.onmessage = (event) => console.log(event.data)
      `

      const requirements = service.analyzeNetworkRequirements(code)
      
      expect(requirements).toHaveLength(1)
      expect(requirements[0]).toMatchObject({
        type: 'websocket',
        url: 'wss://echo.websocket.org',
        description: 'External websocket to echo.websocket.org'
      })
    })

    it('should detect external imports', () => {
      const code = `
        import { serve } from 'https://deno.land/std/http/server.ts'
        import { z } from 'https://esm.sh/zod'
      `

      const requirements = service.analyzeNetworkRequirements(code)
      
      expect(requirements).toHaveLength(2)
      expect(requirements[0].url).toBe('https://deno.land/std/http/server.ts')
      expect(requirements[1].url).toBe('https://esm.sh/zod')
    })

    it('should ignore localhost URLs', () => {
      const code = `
        await fetch('http://localhost:3000/api/data')
        await fetch('https://127.0.0.1:8080/test')
      `

      const requirements = service.analyzeNetworkRequirements(code)
      
      expect(requirements).toHaveLength(0)
    })

    it('should remove duplicate requirements', () => {
      const code = `
        await fetch('https://api.example.com/data')
        await fetch('https://api.example.com/data')
      `

      const requirements = service.analyzeNetworkRequirements(code)
      
      expect(requirements).toHaveLength(1)
      expect(requirements[0].url).toBe('https://api.example.com/data')
    })

    it('should return empty array for local-only functions', () => {
      const code = `
        import { createClient } from '@supabase/supabase-js'
        
        const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'))
        const { data } = await supabase.from('products').select('*')
        
        return new Response(JSON.stringify(data))
      `

      const requirements = service.analyzeNetworkRequirements(code)
      
      expect(requirements).toHaveLength(0)
    })
  })

  describe('Connectivity Testing', () => {
    it('should test connectivity when connected', async () => {
      service.configure({ authKey: 'test-key-1234567890' })
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      await service.connect()
      
      const result = await service.testConnectivity()
      
      expect(result.success).toBe(true)
      expect(result.latency).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()
    })

    it('should fail connectivity test when disconnected', async () => {
      const result = await service.testConnectivity()
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Tailscale not connected')
      expect(result.latency).toBeUndefined()
    })
  })

  describe('Setup Instructions', () => {
    it('should provide setup instructions', () => {
      const instructions = service.getSetupInstructions()
      
      expect(instructions).toHaveLength(5)
      expect(instructions[0]).toContain('Sign up for Tailscale')
      expect(instructions[1]).toContain('Generate an auth key')
      expect(instructions[4]).toContain('full internet access via Tailscale VPN')
    })
  })
})