import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WebVMEmbed } from '../WebVMEmbed'

// Mock console methods to avoid test noise
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('WebVMEmbed', () => {
  describe('rendering', () => {
    it('should render iframe with correct src for debian variant', () => {
      render(<WebVMEmbed variant="debian" />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', 'https://webvm.io/')
    })

    it('should render iframe with correct src for alpine variant', () => {
      render(<WebVMEmbed variant="alpine" />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      expect(iframe).toBeInTheDocument()
      expect(iframe).toHaveAttribute('src', 'https://webvm.io/alpine.html')
    })

    it('should default to debian variant when no variant specified', () => {
      render(<WebVMEmbed />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      expect(iframe).toHaveAttribute('src', 'https://webvm.io/')
    })

    it('should apply custom dimensions', () => {
      render(<WebVMEmbed width="800px" height="400px" />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      expect(iframe).toHaveAttribute('width', '800px')
      expect(iframe).toHaveAttribute('height', '400px')
    })

    it('should apply default dimensions when not specified', () => {
      render(<WebVMEmbed />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      expect(iframe).toHaveAttribute('width', '100%')
      expect(iframe).toHaveAttribute('height', '600px')
    })

    it('should apply custom className', () => {
      render(<WebVMEmbed className="custom-webvm" />)
      
      const container = screen.getByRole('group')
      expect(container).toHaveClass('webvm-container', 'custom-webvm')
    })
  })

  describe('iframe attributes', () => {
    it('should set correct iframe security attributes', () => {
      render(<WebVMEmbed />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      expect(iframe).toHaveAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; camera; microphone')
      expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads')
      expect(iframe).toHaveAttribute('allowfullscreen')
    })

    it('should have proper styling attributes', () => {
      render(<WebVMEmbed />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      // Check that style attribute is set (jsdom doesn't parse React style objects perfectly)
      expect(iframe).toHaveAttribute('style')
      const styleAttr = iframe.getAttribute('style')
      expect(styleAttr).toContain('border')
      expect(styleAttr).toContain('border-radius')
    })
  })

  describe('loading state', () => {
    it('should show loading indicator initially', () => {
      render(<WebVMEmbed />)
      
      expect(screen.getByText('Loading WebVM Linux Environment...')).toBeInTheDocument()
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })

    it('should hide loading indicator after iframe loads', async () => {
      render(<WebVMEmbed />)
      
      const iframe = screen.getByTitle('WebVM Linux Environment')
      
      // Simulate iframe load event
      iframe.dispatchEvent(new Event('load'))
      
      await waitFor(() => {
        expect(screen.queryByText('Loading WebVM Linux Environment...')).not.toBeInTheDocument()
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })
    })
  })

  describe('message handling', () => {
    it('should set up message event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      
      render(<WebVMEmbed />)
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should clean up message event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = render(<WebVMEmbed />)
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should handle messages from WebVM origin', async () => {
      const onMessage = vi.fn()
      render(<WebVMEmbed onMessage={onMessage} />)
      
      // Simulate message from WebVM
      const messageEvent = new MessageEvent('message', {
        origin: 'https://webvm.io',
        data: { type: 'status', status: 'ready' }
      })
      
      window.dispatchEvent(messageEvent)
      
      await waitFor(() => {
        expect(onMessage).toHaveBeenCalledWith({ type: 'status', status: 'ready' })
      })
    })

    it('should ignore messages from other origins', async () => {
      const onMessage = vi.fn()
      render(<WebVMEmbed onMessage={onMessage} />)
      
      // Simulate message from different origin
      const messageEvent = new MessageEvent('message', {
        origin: 'https://evil.com',
        data: { type: 'malicious' }
      })
      
      window.dispatchEvent(messageEvent)
      
      await waitFor(() => {
        expect(onMessage).not.toHaveBeenCalled()
      })
    })
  })

  describe('iframe reference', () => {
    it('should provide WebVMEmbedRef interface through ref', () => {
      let webvmRef: any = null
      
      render(<WebVMEmbed ref={(ref) => { webvmRef = ref }} />)
      
      expect(webvmRef).toBeDefined()
      expect(typeof webvmRef?.sendMessage).toBe('function')
      expect(typeof webvmRef?.getIframe).toBe('function')
    })

    it('should return iframe element through getIframe method', () => {
      let webvmRef: any = null
      
      render(<WebVMEmbed ref={(ref) => { webvmRef = ref }} />)
      
      const iframe = webvmRef?.getIframe()
      expect(iframe).toBeInstanceOf(HTMLIFrameElement)
      expect(iframe?.src).toBe('https://webvm.io/')
    })

    it('should expose sendMessage method for sending messages to WebVM', () => {
      let webvmRef: any = null
      
      render(<WebVMEmbed ref={(ref) => { webvmRef = ref }} />)
      
      expect(typeof webvmRef?.sendMessage).toBe('function')
      
      // Test sending message doesn't throw
      expect(() => {
        webvmRef?.sendMessage({ type: 'test', data: 'hello' })
      }).not.toThrow()
    })
  })
})