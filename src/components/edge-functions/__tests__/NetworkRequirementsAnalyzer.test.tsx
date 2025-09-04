/**
 * Tests for NetworkRequirementsAnalyzer Component
 * 
 * Tests the component that analyzes Edge Function code for external networking requirements
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import NetworkRequirementsAnalyzer from '../NetworkRequirementsAnalyzer'
import { tailscaleService } from '@/lib/webvm/WebVMTailscaleService'

// Mock the Tailscale service
vi.mock('@/lib/webvm/WebVMTailscaleService', () => ({
  tailscaleService: {
    analyzeNetworkRequirements: vi.fn(),
    isNetworkingAvailable: vi.fn()
  }
}))

describe('NetworkRequirementsAnalyzer', () => {
  const mockAnalyzeNetworkRequirements = vi.mocked(tailscaleService.analyzeNetworkRequirements)
  const mockIsNetworkingAvailable = vi.mocked(tailscaleService.isNetworkingAvailable)

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsNetworkingAvailable.mockReturnValue(false)
  })

  describe('Analysis States', () => {
    it('should show analyzing state for empty code', async () => {
      mockAnalyzeNetworkRequirements.mockReturnValue([])
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode="" 
          functionName="test-function" 
        />
      )
      
      expect(screen.getByText(/Analyzing function code/)).toBeInTheDocument()
    })

    it('should show no requirements for local-only functions', async () => {
      const localCode = `
        import { createClient } from '@supabase/supabase-js'
        const { data } = await supabase.from('users').select('*')
        return new Response(JSON.stringify(data))
      `
      
      mockAnalyzeNetworkRequirements.mockReturnValue([])
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode={localCode} 
          functionName="local-function" 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText(/No external networking required/)).toBeInTheDocument()
      })
      
      expect(screen.getByText(/only uses local database access/)).toBeInTheDocument()
    })

    it('should display network requirements when detected', async () => {
      const externalCode = `
        const response = await fetch('https://api.github.com/users/octocat')
        return new Response(JSON.stringify(await response.json()))
      `
      
      mockAnalyzeNetworkRequirements.mockReturnValue([
        {
          type: 'external-api',
          url: 'https://api.github.com/users/octocat',
          description: 'External API call to api.github.com'
        }
      ])
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode={externalCode} 
          functionName="github-function" 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText(/Network Requirements/)).toBeInTheDocument()
      })
      
      expect(screen.getByText(/External Dependencies/)).toBeInTheDocument()
      expect(screen.getByText(/External API call to api.github.com/)).toBeInTheDocument()
      expect(screen.getByText(/https:\/\/api\.github\.com\/users\/octocat/)).toBeInTheDocument()
    })
  })

  describe('Tailscale Status Integration', () => {
    it('should show "Needs Setup" when networking required but unavailable', async () => {
      mockAnalyzeNetworkRequirements.mockReturnValue([
        {
          type: 'external-api',
          url: 'https://api.example.com',
          description: 'API call to example.com'
        }
      ])
      mockIsNetworkingAvailable.mockReturnValue(false)
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode="await fetch('https://api.example.com')" 
          functionName="external-function" 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText(/Needs Setup/)).toBeInTheDocument()
      })
      
      expect(screen.getByText(/Tailscale networking required/)).toBeInTheDocument()
      expect(screen.getByText(/Configure Tailscale in the Networking tab/)).toBeInTheDocument()
    })

    it('should show "Ready" when networking required and available', async () => {
      mockAnalyzeNetworkRequirements.mockReturnValue([
        {
          type: 'websocket',
          url: 'wss://echo.websocket.org',
          description: 'WebSocket connection to echo.websocket.org'
        }
      ])
      mockIsNetworkingAvailable.mockReturnValue(true)
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode="new WebSocket('wss://echo.websocket.org')" 
          functionName="websocket-function" 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText(/Ready/)).toBeInTheDocument()
      })
      
      expect(screen.getByText(/Network access available/)).toBeInTheDocument()
      expect(screen.getByText(/Tailscale is connected/)).toBeInTheDocument()
    })
  })

  describe('Requirement Types Display', () => {
    it('should display multiple requirement types with correct icons', async () => {
      mockAnalyzeNetworkRequirements.mockReturnValue([
        {
          type: 'external-api',
          url: 'https://api.github.com',
          description: 'External API call to api.github.com'
        },
        {
          type: 'websocket',
          url: 'wss://echo.websocket.org',
          description: 'WebSocket connection to echo.websocket.org'
        },
        {
          type: 'http-request',
          url: 'https://httpbin.org/get',
          description: 'HTTP request to httpbin.org'
        }
      ])
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode="complex networking code" 
          functionName="complex-function" 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText(/External Dependencies/)).toBeInTheDocument()
      })
      
      // Check for different requirement types
      expect(screen.getByText(/External api/)).toBeInTheDocument()
      expect(screen.getByText(/Websocket/)).toBeInTheDocument()
      expect(screen.getByText(/Http request/)).toBeInTheDocument()
      
      // Check URLs are displayed
      expect(screen.getByText(/api\.github\.com/)).toBeInTheDocument()
      expect(screen.getByText(/echo\.websocket\.org/)).toBeInTheDocument()
      expect(screen.getByText(/httpbin\.org/)).toBeInTheDocument()
    })
  })

  describe('Callback Integration', () => {
    it('should call onAnalysisComplete with correct parameters', async () => {
      const onAnalysisComplete = vi.fn()
      const requirements = [
        {
          type: 'external-api' as const,
          url: 'https://api.test.com',
          description: 'Test API call'
        }
      ]
      
      mockAnalyzeNetworkRequirements.mockReturnValue(requirements)
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode="await fetch('https://api.test.com')" 
          functionName="callback-test"
          onAnalysisComplete={onAnalysisComplete}
        />
      )
      
      await waitFor(() => {
        expect(onAnalysisComplete).toHaveBeenCalledWith(requirements, true)
      })
    })

    it('should call onAnalysisComplete with needsNetworking=false for local functions', async () => {
      const onAnalysisComplete = vi.fn()
      
      mockAnalyzeNetworkRequirements.mockReturnValue([])
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode="const { data } = await supabase.from('users').select('*')" 
          functionName="local-test"
          onAnalysisComplete={onAnalysisComplete}
        />
      )
      
      await waitFor(() => {
        expect(onAnalysisComplete).toHaveBeenCalledWith([], false)
      })
    })
  })

  describe('Footer Information', () => {
    it('should always display database and external access information', async () => {
      mockAnalyzeNetworkRequirements.mockReturnValue([])
      
      render(
        <NetworkRequirementsAnalyzer 
          functionCode="local code" 
          functionName="info-test" 
        />
      )
      
      await waitFor(() => {
        expect(screen.getByText(/Local database access is always available/)).toBeInTheDocument()
        expect(screen.getByText(/External API access requires Tailscale VPN/)).toBeInTheDocument()
      })
    })
  })
})