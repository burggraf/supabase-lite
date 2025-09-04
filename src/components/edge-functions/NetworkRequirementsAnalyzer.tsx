/**
 * Network Requirements Analyzer Component
 * 
 * Analyzes Edge Function code to detect external networking requirements
 * and provides guidance on when Tailscale is needed
 */

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  Network, 
  Globe, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  Wifi,
  Database,
  Code
} from 'lucide-react'
import { tailscaleService, type NetworkRequirement } from '@/lib/webvm/WebVMTailscaleService'

interface NetworkRequirementsAnalyzerProps {
  functionCode: string
  functionName: string
  onAnalysisComplete?: (requirements: NetworkRequirement[], needsNetworking: boolean) => void
}

export default function NetworkRequirementsAnalyzer({ 
  functionCode, 
  functionName,
  onAnalysisComplete 
}: NetworkRequirementsAnalyzerProps) {
  const [requirements, setRequirements] = useState<NetworkRequirement[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [tailscaleAvailable, setTailscaleAvailable] = useState(false)

  // Analyze function code for network requirements
  useEffect(() => {
    if (!functionCode.trim()) {
      setRequirements([])
      onAnalysisComplete?.([], false)
      return
    }

    setIsAnalyzing(true)
    
    // Small delay to simulate analysis
    const timeout = setTimeout(() => {
      const analyzed = tailscaleService.analyzeNetworkRequirements(functionCode)
      setRequirements(analyzed)
      setIsAnalyzing(false)
      onAnalysisComplete?.(analyzed, analyzed.length > 0)
    }, 300)

    return () => clearTimeout(timeout)
  }, [functionCode, onAnalysisComplete])

  // Check Tailscale availability
  useEffect(() => {
    const checkTailscale = () => {
      setTailscaleAvailable(tailscaleService.isNetworkingAvailable())
    }
    
    checkTailscale()
    
    // Check periodically for status changes
    const interval = setInterval(checkTailscale, 2000)
    return () => clearInterval(interval)
  }, [])

  const getRequirementIcon = (type: NetworkRequirement['type']) => {
    switch (type) {
      case 'external-api':
        return <Globe className="h-4 w-4" />
      case 'http-request':
        return <Network className="h-4 w-4" />
      case 'websocket':
        return <Wifi className="h-4 w-4" />
      case 'dns-lookup':
        return <ExternalLink className="h-4 w-4" />
      default:
        return <Network className="h-4 w-4" />
    }
  }

  const getRequirementColor = (type: NetworkRequirement['type']) => {
    switch (type) {
      case 'external-api':
        return 'bg-blue-500'
      case 'http-request':
        return 'bg-green-500'
      case 'websocket':
        return 'bg-purple-500'
      case 'dns-lookup':
        return 'bg-orange-500'
      default:
        return 'bg-gray-500'
    }
  }

  const needsNetworking = requirements.length > 0
  const canExecute = !needsNetworking || tailscaleAvailable

  if (isAnalyzing) {
    return (
      <Card className="w-full">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Code className="h-4 w-4 animate-pulse" />
            Analyzing function code for network requirements...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!needsNetworking) {
    return (
      <Card className="w-full">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">No external networking required</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            This function only uses local database access and will work without Tailscale.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            <CardTitle className="text-base">Network Requirements</CardTitle>
          </div>
          <Badge variant={canExecute ? "default" : "destructive"} className="text-xs">
            {canExecute ? "Ready" : "Needs Setup"}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          Function <code className="bg-gray-100 px-1 rounded text-xs">{functionName}</code> requires external networking
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">External Dependencies:</h4>
          <div className="space-y-2">
            {requirements.map((req, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Badge 
                  variant="outline" 
                  className={`${getRequirementColor(req.type)} text-white border-transparent`}
                >
                  <div className="flex items-center gap-1">
                    {getRequirementIcon(req.type)}
                    <span className="capitalize">{req.type.replace('-', ' ')}</span>
                  </div>
                </Badge>
                <div className="flex-1">
                  <p className="text-gray-700">{req.description}</p>
                  {req.url && (
                    <code className="text-xs text-gray-500 bg-gray-50 px-1 rounded">
                      {req.url}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!tailscaleAvailable && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Tailscale networking required</strong><br />
              This function cannot execute without external network access. 
              Configure Tailscale in the Networking tab to enable these features.
            </AlertDescription>
          </Alert>
        )}

        {tailscaleAvailable && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Network access available</strong><br />
              Tailscale is connected. This function can make external requests.
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Database className="h-3 w-3" />
            <span>Local database access is always available</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <Globe className="h-3 w-3" />
            <span>External API access requires Tailscale VPN</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}