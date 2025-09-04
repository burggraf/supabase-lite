/**
 * WebVM Tailscale Service
 * 
 * Manages optional Tailscale networking integration for WebVM Edge Functions
 * Provides graceful fallback when Tailscale is not configured
 */

export interface TailscaleConfig {
  authKey: string
  exitNode?: string
  hostname?: string
  advertiseRoutes?: string[]
}

export interface TailscaleStatus {
  connected: boolean
  status: 'connected' | 'disconnected' | 'connecting' | 'authenticating' | 'error'
  ipAddress?: string
  hostname?: string
  exitNode?: string
  error?: string
  lastConnected?: Date
}

export interface NetworkRequirement {
  type: 'external-api' | 'dns-lookup' | 'http-request' | 'websocket'
  url?: string
  description: string
}

export class WebVMTailscaleService {
  private config: TailscaleConfig | null = null
  private status: TailscaleStatus = {
    connected: false,
    status: 'disconnected'
  }
  private connectionCheckInterval: number | null = null

  /**
   * Configure Tailscale networking
   */
  configure(config: TailscaleConfig): void {
    this.config = { ...config }
    
    // Store config in localStorage for persistence
    localStorage.setItem('webvm-tailscale-config', JSON.stringify(this.config))
  }

  /**
   * Load configuration from localStorage
   */
  loadConfig(): TailscaleConfig | null {
    try {
      const stored = localStorage.getItem('webvm-tailscale-config')
      if (stored) {
        this.config = JSON.parse(stored)
        return this.config
      }
    } catch (error) {
      console.warn('Failed to load Tailscale config:', error)
    }
    return null
  }

  /**
   * Clear Tailscale configuration
   */
  clearConfig(): void {
    this.config = null
    this.status = {
      connected: false,
      status: 'disconnected'
    }
    localStorage.removeItem('webvm-tailscale-config')
    this.stopConnectionMonitoring()
  }

  /**
   * Get current Tailscale configuration
   */
  getConfig(): TailscaleConfig | null {
    return this.config ? { ...this.config } : null
  }

  /**
   * Get current Tailscale status
   */
  getStatus(): TailscaleStatus {
    return { ...this.status }
  }

  /**
   * Check if Tailscale is configured and connected
   */
  isNetworkingAvailable(): boolean {
    return this.config !== null && this.status.connected
  }

  /**
   * Check if function code requires external networking
   */
  analyzeNetworkRequirements(functionCode: string): NetworkRequirement[] {
    const requirements: NetworkRequirement[] = []
    
    // Check for common patterns that require external networking
    const patterns = [
      {
        regex: /fetch\s*\(\s*['"`]https?:\/\/(?!localhost)(?!127\.0\.0\.1)([^'"`]+)['"`]/gi,
        type: 'external-api' as const,
        getUrl: (match: RegExpMatchArray) => match[0].match(/['"`](https?:\/\/[^'"`]+)['"`]/)?.[1]
      },
      {
        regex: /new\s+URL\s*\(\s*['"`]https?:\/\/(?!localhost)(?!127\.0\.0\.1)([^'"`]+)['"`]/gi,
        type: 'http-request' as const,
        getUrl: (match: RegExpMatchArray) => match[0].match(/['"`](https?:\/\/[^'"`]+)['"`]/)?.[1]
      },
      {
        regex: /WebSocket\s*\(\s*['"`]wss?:\/\/(?!localhost)(?!127\.0\.0\.1)([^'"`]+)['"`]/gi,
        type: 'websocket' as const,
        getUrl: (match: RegExpMatchArray) => match[0].match(/['"`](wss?:\/\/[^'"`]+)['"`]/)?.[1]
      },
      {
        regex: /import\s+.*from\s+['"`]https?:\/\/(?!localhost)(?!127\.0\.0\.1)([^'"`]+)['"`]/gi,
        type: 'external-api' as const,
        getUrl: (match: RegExpMatchArray) => match[0].match(/['"`](https?:\/\/[^'"`]+)['"`]/)?.[1]
      }
    ]

    patterns.forEach(pattern => {
      let match
      while ((match = pattern.regex.exec(functionCode)) !== null) {
        const url = pattern.getUrl(match)
        if (url) {
          const hostname = new URL(url).hostname
          requirements.push({
            type: pattern.type,
            url,
            description: `External ${pattern.type.replace('-', ' ')} to ${hostname}`
          })
        }
      }
    })

    // Remove duplicates
    const seen = new Set<string>()
    return requirements.filter(req => {
      const key = `${req.type}:${req.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Start Tailscale connection
   */
  async connect(): Promise<boolean> {
    if (!this.config) {
      throw new Error('Tailscale not configured. Please provide auth key.')
    }

    this.status.status = 'connecting'
    
    try {
      // Simulate Tailscale connection process
      // In a real implementation, this would send commands to WebVM
      await this.simulateConnection()
      
      this.status = {
        connected: true,
        status: 'connected',
        ipAddress: '100.64.0.1', // Typical Tailscale IP range
        hostname: this.config.hostname || 'webvm-edge-functions',
        exitNode: this.config.exitNode,
        lastConnected: new Date()
      }
      
      // Start monitoring connection
      this.startConnectionMonitoring()
      
      return true
      
    } catch (error) {
      this.status = {
        connected: false,
        status: 'error',
        error: (error as Error).message
      }
      return false
    }
  }

  /**
   * Disconnect from Tailscale
   */
  async disconnect(): Promise<void> {
    this.status.status = 'disconnected'
    this.status.connected = false
    this.status.ipAddress = undefined
    this.status.hostname = undefined
    this.status.exitNode = undefined
    this.status.error = undefined
    
    this.stopConnectionMonitoring()
  }

  /**
   * Test network connectivity
   */
  async testConnectivity(): Promise<{ success: boolean; error?: string; latency?: number }> {
    if (!this.isNetworkingAvailable()) {
      return { 
        success: false, 
        error: 'Tailscale not connected' 
      }
    }

    const startTime = Date.now()
    
    try {
      // In a real implementation, this would test actual connectivity
      // For now, simulate a successful test
      await new Promise(resolve => setTimeout(resolve, 100))
      
      return {
        success: true,
        latency: Date.now() - startTime
      }
      
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * Get setup instructions for users
   */
  getSetupInstructions(): string[] {
    return [
      '1. Sign up for Tailscale at https://tailscale.com (free for personal use)',
      '2. Go to the Tailscale admin console at https://login.tailscale.com/admin',
      '3. Navigate to Settings → Keys in the left sidebar',
      '4. Click "Generate auth key" button',
      '5. Configure key settings: Enable "Reusable", set expiration (90 days recommended)',
      '6. Optionally add tags like "webvm" or "edge-functions" for organization',
      '7. Click "Generate key" and copy the generated auth key',
      '8. Paste the auth key into the setup form above',
      '9. Click "Save Configuration" to store your settings',
      '10. Click "Connect" to establish VPN connection for Edge Functions'
    ]
  }

  /**
   * Get detailed auth key generation instructions
   */
  getAuthKeyInstructions(): { step: number; title: string; description: string; important?: string }[] {
    return [
      {
        step: 1,
        title: "Access Tailscale Admin Console",
        description: "Go to https://login.tailscale.com/admin and sign in to your Tailscale account"
      },
      {
        step: 2,
        title: "Navigate to Keys Section",
        description: "In the admin console, click on 'Settings' in the left sidebar, then select 'Keys'"
      },
      {
        step: 3,
        title: "Generate New Auth Key",
        description: "Click the 'Generate auth key' button to create a new authentication key"
      },
      {
        step: 4,
        title: "Configure Key Settings",
        description: "Enable 'Reusable' option to allow the key to be used multiple times. Set an appropriate expiration time (90 days is recommended for development).",
        important: "Make sure 'Reusable' is checked - this allows WebVM to reconnect using the same key"
      },
      {
        step: 5,
        title: "Add Tags (Optional)",
        description: "Add descriptive tags like 'webvm', 'edge-functions', or 'development' to help organize your devices in the Tailscale network"
      },
      {
        step: 6,
        title: "Generate and Copy Key",
        description: "Click 'Generate key' and immediately copy the generated auth key. This key will only be shown once.",
        important: "Save this key securely - it cannot be viewed again after closing the dialog"
      },
      {
        step: 7,
        title: "Enter Key in Configuration",
        description: "Paste the auth key into the 'Tailscale Auth Key' field in the Setup tab above"
      }
    ]
  }

  /**
   * Simulate Tailscale connection (for development/testing)
   */
  private async simulateConnection(): Promise<void> {
    // Validate auth key format
    if (!this.config?.authKey || this.config.authKey.length < 10) {
      throw new Error('Invalid Tailscale auth key')
    }
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Random chance of connection failure for testing
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Failed to connect to Tailscale network')
    }
  }

  /**
   * Start monitoring connection status
   */
  private startConnectionMonitoring(): void {
    this.stopConnectionMonitoring()
    
    this.connectionCheckInterval = window.setInterval(async () => {
      // In a real implementation, this would check actual Tailscale status
      // For now, occasionally simulate disconnection
      if (Math.random() < 0.01) { // 1% chance of disconnection per check
        this.status.connected = false
        this.status.status = 'disconnected'
        this.status.error = 'Connection lost'
        this.stopConnectionMonitoring()
      }
    }, 5000) // Check every 5 seconds
  }

  /**
   * Stop monitoring connection status
   */
  private stopConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      window.clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = null
    }
  }
}

// Export singleton instance
export const tailscaleService = new WebVMTailscaleService()