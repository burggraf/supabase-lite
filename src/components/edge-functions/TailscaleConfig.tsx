/**
 * Tailscale Configuration Component
 * 
 * UI for configuring optional Tailscale networking for WebVM Edge Functions
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { 
  Wifi, 
  WifiOff, 
  Settings, 
  ExternalLink, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Loader2,
  Network,
  HelpCircle,
  Key,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { tailscaleService, type TailscaleConfig, type TailscaleStatus } from '@/lib/webvm/WebVMTailscaleService'

interface TailscaleConfigProps {
  onNetworkingChange?: (enabled: boolean) => void
}

export default function TailscaleConfig({ onNetworkingChange }: TailscaleConfigProps) {
  const [config, setConfig] = useState<TailscaleConfig | null>(null)
  const [status, setStatus] = useState<TailscaleStatus | null>(null)
  const [authKey, setAuthKey] = useState('')
  const [exitNode, setExitNode] = useState('')
  const [hostname, setHostname] = useState('webvm-edge-functions')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; latency?: number } | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [showAuthKeyHelp, setShowAuthKeyHelp] = useState(false)

  // Load initial state
  useEffect(() => {
    const loadedConfig = tailscaleService.loadConfig()
    const currentStatus = tailscaleService.getStatus()
    
    setConfig(loadedConfig)
    setStatus(currentStatus)
    
    if (loadedConfig) {
      setAuthKey(loadedConfig.authKey)
      setExitNode(loadedConfig.exitNode || '')
      setHostname(loadedConfig.hostname || 'webvm-edge-functions')
    }
  }, [])

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const currentStatus = tailscaleService.getStatus()
      setStatus(currentStatus)
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleSaveConfig = () => {
    const newConfig: TailscaleConfig = {
      authKey: authKey.trim(),
      exitNode: exitNode.trim() || undefined,
      hostname: hostname.trim() || undefined
    }

    tailscaleService.configure(newConfig)
    setConfig(newConfig)
    onNetworkingChange?.(true)
  }

  const handleClearConfig = () => {
    tailscaleService.clearConfig()
    setConfig(null)
    setAuthKey('')
    setExitNode('')
    setHostname('webvm-edge-functions')
    setTestResult(null)
    onNetworkingChange?.(false)
  }

  const handleConnect = async () => {
    if (!config) return

    setIsConnecting(true)
    try {
      const success = await tailscaleService.connect()
      if (success) {
        setStatus(tailscaleService.getStatus())
      }
    } catch (error) {
      console.error('Failed to connect to Tailscale:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    await tailscaleService.disconnect()
    setStatus(tailscaleService.getStatus())
  }

  const handleTestConnectivity = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    try {
      const result = await tailscaleService.testConnectivity()
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        error: (error as Error).message
      })
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusIcon = () => {
    if (!status) return <WifiOff className="h-4 w-4 text-gray-400" />
    
    switch (status.status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'connecting':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <WifiOff className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = () => {
    if (!status) return <Badge variant="secondary">Not Configured</Badge>
    
    switch (status.status) {
      case 'connected':
        return <Badge variant="default" className="bg-green-500">Connected</Badge>
      case 'connecting':
        return <Badge variant="default" className="bg-blue-500">Connecting</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">Disconnected</Badge>
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            <CardTitle>Tailscale Networking</CardTitle>
            {getStatusIcon()}
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Optional VPN networking for Edge Functions that need to access external APIs or services.
          Functions work without Tailscale but cannot make external HTTP requests.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue={config ? 'status' : 'setup'} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auth-key" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Tailscale Auth Key
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAuthKeyHelp(!showAuthKeyHelp)}
                    className="flex items-center gap-1 text-xs"
                  >
                    <HelpCircle className="h-3 w-3" />
                    How to generate
                    {showAuthKeyHelp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
                <Input
                  id="auth-key"
                  type="password"
                  placeholder="Enter your Tailscale auth key..."
                  value={authKey}
                  onChange={(e) => setAuthKey(e.target.value)}
                  className="font-mono text-sm"
                />
                
                {showAuthKeyHelp && (
                  <div className="mt-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" />
                      How to Generate a Tailscale Auth Key
                    </h4>
                    <div className="space-y-3">
                      {tailscaleService.getAuthKeyInstructions().map((instruction, index) => (
                        <div key={index} className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 flex items-center justify-center text-xs font-medium">
                            {instruction.step}
                          </div>
                          <div className="flex-grow">
                            <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                              {instruction.title}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {instruction.description}
                            </div>
                            {instruction.important && (
                              <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-200">
                                <strong>Important:</strong> {instruction.important}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="flex items-center gap-2"
                        >
                          <a
                            href="https://login.tailscale.com/admin/settings/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open Tailscale Admin Console
                          </a>
                        </Button>
                        <span className="text-xs text-gray-500">
                          Opens in a new tab
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-500">
                  Need help? Click "How to generate" above for detailed step-by-step instructions
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hostname">Hostname (Optional)</Label>
                <Input
                  id="hostname"
                  placeholder="webvm-edge-functions"
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exit-node">Exit Node (Optional)</Label>
                <Input
                  id="exit-node"
                  placeholder="e.g., 100.64.0.1 or hostname"
                  value={exitNode}
                  onChange={(e) => setExitNode(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Route internet traffic through a specific Tailscale exit node
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveConfig}
                  disabled={!authKey.trim()}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Save Configuration
                </Button>
                
                {config && (
                  <Button 
                    variant="outline"
                    onClick={handleClearConfig}
                  >
                    Clear Config
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            {!config ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Tailscale networking is not configured. Configure it in the Setup tab to enable external networking for your Edge Functions.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon()}
                      <span className="capitalize">{status?.status || 'Unknown'}</span>
                    </div>
                  </div>

                  {status?.ipAddress && (
                    <div>
                      <Label className="text-xs text-gray-500">IP Address</Label>
                      <div className="mt-1 font-mono">{status.ipAddress}</div>
                    </div>
                  )}

                  {status?.hostname && (
                    <div>
                      <Label className="text-xs text-gray-500">Hostname</Label>
                      <div className="mt-1 font-mono">{status.hostname}</div>
                    </div>
                  )}

                  {status?.exitNode && (
                    <div>
                      <Label className="text-xs text-gray-500">Exit Node</Label>
                      <div className="mt-1 font-mono">{status.exitNode}</div>
                    </div>
                  )}

                  {status?.lastConnected && (
                    <div>
                      <Label className="text-xs text-gray-500">Last Connected</Label>
                      <div className="mt-1">{status.lastConnected.toLocaleTimeString()}</div>
                    </div>
                  )}
                </div>

                {status?.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{status.error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  {!status?.connected ? (
                    <Button 
                      onClick={handleConnect}
                      disabled={isConnecting}
                      className="flex items-center gap-2"
                    >
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wifi className="h-4 w-4" />
                      )}
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      onClick={handleDisconnect}
                      className="flex items-center gap-2"
                    >
                      <WifiOff className="h-4 w-4" />
                      Disconnect
                    </Button>
                  )}

                  <Button 
                    variant="outline"
                    onClick={handleTestConnectivity}
                    disabled={!status?.connected || isTesting}
                    className="flex items-center gap-2"
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Network className="h-4 w-4" />
                    )}
                    Test Connectivity
                  </Button>
                </div>

                {testResult && (
                  <Alert variant={testResult.success ? 'default' : 'destructive'}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {testResult.success 
                        ? `Connection test successful ${testResult.latency ? `(${testResult.latency}ms)` : ''}`
                        : `Connection test failed: ${testResult.error}`
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="help" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>When do you need Tailscale?</strong><br />
                  Edge Functions that make external HTTP requests, connect to third-party APIs, 
                  or need internet access require Tailscale networking. Functions that only use 
                  the local database work without it.
                </AlertDescription>
              </Alert>

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Quick Setup Guide
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  {tailscaleService.getSetupInstructions().map((instruction, index) => (
                    <li key={index} className="leading-relaxed">{instruction}</li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Auth Key Generation
                </h4>
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    To generate an auth key for WebVM networking:
                  </p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="font-medium min-w-[20px]">1.</span>
                      <span>Visit the <a href="https://login.tailscale.com/admin/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">Tailscale admin console</a></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium min-w-[20px]">2.</span>
                      <span>Click "Generate auth key"</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium min-w-[20px]">3.</span>
                      <span><strong>Enable "Reusable"</strong> - this allows WebVM to reconnect</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium min-w-[20px]">4.</span>
                      <span>Set expiration to 90 days (recommended for development)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-medium min-w-[20px]">5.</span>
                      <span>Copy the generated key and paste it in the Setup tab</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                >
                  <a 
                    href="https://login.tailscale.com/admin/settings/keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    Generate Auth Key
                  </a>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                >
                  <a 
                    href="https://tailscale.com/kb/1085/auth-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Documentation
                  </a>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                >
                  <a 
                    href="https://tailscale.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Network className="h-4 w-4" />
                    Sign Up Free
                  </a>
                </Button>
              </div>

              <div className="border-t pt-4">
                <div className="grid gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">Security:</strong> Auth keys are encrypted and stored locally in your browser. They are never sent to external servers except Tailscale.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Network className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">Privacy:</strong> Tailscale creates a secure private network. Your WebVM instance will appear as a device on your Tailscale network.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">Free Tier:</strong> Tailscale is free for personal use with up to 20 devices and 3 users.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}