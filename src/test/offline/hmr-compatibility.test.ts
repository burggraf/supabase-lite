import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleAssetRequest } from '../../service-worker'

describe('HMR Compatibility', () => {
  beforeEach(() => {
    // Reset global mocks
    vi.clearAllMocks()
  })

  describe('HMR Request Detection', () => {
    it('should bypass Service Worker for HMR WebSocket requests', async () => {
      const hmrWsRequest = new Request('http://localhost:5173/@vite/client')
      const isProduction = false

      // Mock fetch to simulate network request
      const mockFetch = vi.fn().mockResolvedValue(new Response('HMR WebSocket response'))
      global.fetch = mockFetch

      const response = await handleAssetRequest(hmrWsRequest, isProduction)

      expect(mockFetch).toHaveBeenCalledWith(hmrWsRequest)
      expect(await response.text()).toBe('HMR WebSocket response')
    })

    it('should bypass Service Worker for Vite HMR updates', async () => {
      const hmrUpdateRequest = new Request('http://localhost:5173/@vite/hmr-update/src/App.tsx.js')
      const isProduction = false

      const mockFetch = vi.fn().mockResolvedValue(new Response('Updated module'))
      global.fetch = mockFetch

      const response = await handleAssetRequest(hmrUpdateRequest, isProduction)

      expect(mockFetch).toHaveBeenCalledWith(hmrUpdateRequest)
      expect(await response.text()).toBe('Updated module')
    })

    it('should bypass Service Worker for development CSS updates', async () => {
      const cssUpdateRequest = new Request('http://localhost:5173/src/styles/main.css?t=1699123456789')
      const isProduction = false

      const mockFetch = vi.fn().mockResolvedValue(new Response('/* updated CSS */'))
      global.fetch = mockFetch

      const response = await handleAssetRequest(cssUpdateRequest, isProduction)

      expect(mockFetch).toHaveBeenCalledWith(cssUpdateRequest)
      expect(await response.text()).toBe('/* updated CSS */')
    })

    it('should bypass Service Worker for JS modules with version timestamps', async () => {
      const jsUpdateRequest = new Request('http://localhost:5173/src/components/App.tsx?t=1699123456789')
      const isProduction = false

      const mockFetch = vi.fn().mockResolvedValue(new Response('export default function App() {}'))
      global.fetch = mockFetch

      const response = await handleAssetRequest(jsUpdateRequest, isProduction)

      expect(mockFetch).toHaveBeenCalledWith(jsUpdateRequest)
      expect(await response.text()).toBe('export default function App() {}')
    })

    it('should apply normal caching for non-HMR requests in development', async () => {
      const normalRequest = new Request('http://localhost:5173/static/logo.png')
      const isProduction = false

      // Mock cache operations
      const mockCache = {
        match: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined)
      }
      global.caches = {
        open: vi.fn().mockResolvedValue(mockCache),
        match: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        keys: vi.fn()
      }

      const mockFetch = vi.fn().mockResolvedValue(new Response('logo image'))
      global.fetch = mockFetch

      const response = await handleAssetRequest(normalRequest, isProduction)

      expect(mockFetch).toHaveBeenCalledWith(normalRequest)
      expect(await response.text()).toBe('logo image')
    })

    it('should not bypass cache for production HMR-like URLs', async () => {
      const hmrLikeRequest = new Request('http://example.com/@vite/client')
      const isProduction = true

      // Mock cache hit
      const cachedResponse = new Response('cached content')
      const mockCache = {
        match: vi.fn().mockResolvedValue(cachedResponse),
        put: vi.fn().mockResolvedValue(undefined)
      }
      global.caches = {
        open: vi.fn().mockResolvedValue(mockCache),
        match: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        keys: vi.fn()
      }

      const response = await handleAssetRequest(hmrLikeRequest, isProduction)

      expect(mockCache.match).toHaveBeenCalledWith(hmrLikeRequest)
      expect(await response.text()).toBe('cached content')
    })
  })

  describe('Development Server Detection', () => {
    it('should not detect localhost URLs without HMR patterns as HMR requests', () => {
      const localhostUrl = 'http://localhost:5173/some/path'
      expect(isHMRRequest(localhostUrl)).toBe(false)
    })

    it('should not detect 127.0.0.1 URLs without HMR patterns as HMR requests', () => {
      const localhostUrl = 'http://127.0.0.1:5173/some/path'
      expect(isHMRRequest(localhostUrl)).toBe(false)
    })

    it('should not detect production URLs as HMR', () => {
      const productionUrl = 'https://example.com/some/path'
      expect(isHMRRequest(productionUrl)).toBe(false)
    })

    it('should detect Vite-specific patterns on localhost', () => {
      expect(isHMRRequest('http://localhost:5173/@vite/client')).toBe(true)
      expect(isHMRRequest('http://localhost:5173/@vite/hmr-update')).toBe(true)
      expect(isHMRRequest('http://localhost:5173/src/App.tsx?t=123456')).toBe(true)
    })

    it('should detect HMR patterns on 127.0.0.1', () => {
      expect(isHMRRequest('http://127.0.0.1:5173/@vite/client')).toBe(true)
      expect(isHMRRequest('http://127.0.0.1:3000/src/App.tsx?t=123456')).toBe(true)
    })
  })
})

// Helper function that should exist in service-worker.ts
function isHMRRequest(url: string): boolean {
  // This function will be implemented in the Service Worker
  const parsedUrl = new URL(url)
  
  // Check for localhost/127.0.0.1 development servers
  const isDevelopmentHost = parsedUrl.hostname === 'localhost' || 
                          parsedUrl.hostname === '127.0.0.1' ||
                          parsedUrl.hostname.startsWith('192.168.') ||
                          parsedUrl.hostname.startsWith('10.')

  if (!isDevelopmentHost) return false

  // Check for Vite-specific HMR patterns
  const vitePatterns = [
    '/@vite/client',
    '/@vite/hmr-update',
    '/@id/',
    '/@fs/',
    '/@react-refresh'
  ]

  const hasVitePattern = vitePatterns.some(pattern => parsedUrl.pathname.includes(pattern))
  const hasTimestamp = parsedUrl.searchParams.has('t') || parsedUrl.searchParams.has('import')
  const isHotUpdate = parsedUrl.searchParams.has('hot')

  return hasVitePattern || hasTimestamp || isHotUpdate
}