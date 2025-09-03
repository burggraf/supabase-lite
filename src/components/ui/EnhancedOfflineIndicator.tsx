/**
 * Enhanced Offline Indicator Component
 * Provides visual feedback for connection status and quality with interactive features
 */

import { useState } from 'react';
import { Wifi, WifiOff, Signal, AlertTriangle, Info, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface EnhancedOfflineIndicatorProps {
  compact?: boolean;
  iconOnly?: boolean;
  showDetails?: boolean;
  showOfflineToggle?: boolean;
  className?: string;
}

interface ConnectionQuality {
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
  label: string;
  color: string;
  description: string;
}

export function EnhancedOfflineIndicator({
  compact = true,
  iconOnly = false,
  showDetails = false,
  showOfflineToggle = false,
  className
}: EnhancedOfflineIndicatorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const {
    isOnline,
    connectionType,
    effectiveType,
    downlink,
    rtt,
    saveData,
    toggleOfflineMode
  } = useOnlineStatus();

  // Assess connection quality based on network metrics
  const getConnectionQuality = (): ConnectionQuality => {
    if (!isOnline) {
      return {
        level: 'offline',
        label: 'Offline',
        color: 'bg-red-500',
        description: 'No internet connection'
      };
    }

    // High-quality connection
    if (downlink && downlink >= 10 && rtt && rtt <= 100) {
      return {
        level: 'excellent',
        label: 'Excellent Connection',
        color: 'bg-green-500',
        description: 'Fast, reliable connection'
      };
    }

    // Good connection
    if (downlink && downlink >= 2 && rtt && rtt <= 500) {
      return {
        level: 'good',
        label: 'Good Connection',
        color: 'bg-green-400',
        description: 'Reliable connection'
      };
    }

    // Fair connection
    if (downlink && downlink >= 0.5 && rtt && rtt <= 1500) {
      return {
        level: 'fair',
        label: 'Fair Connection',
        color: 'bg-yellow-400',
        description: 'Acceptable connection'
      };
    }

    // Poor connection
    if (saveData || (rtt && rtt > 1500) || (downlink && downlink < 0.5)) {
      return {
        level: 'poor',
        label: 'Slow Connection',
        color: 'bg-yellow-500',
        description: 'Limited bandwidth or high latency'
      };
    }

    // Default to good if no specific metrics available but online
    return {
      level: 'good',
      label: 'Good Connection',
      color: 'bg-green-400',
      description: 'Connection status unknown'
    };
  };

  const quality = getConnectionQuality();

  // Status text mapping
  const getStatusText = () => {
    return isOnline ? 'Online' : 'Offline';
  };

  // Quality label mapping for tests
  const getQualityLabel = () => {
    if (!isOnline) return '';
    
    if (quality.level === 'excellent') return 'Excellent Connection';
    if (quality.level === 'good') return 'Good Connection'; 
    if (quality.level === 'fair') return 'Fair Connection';
    if (quality.level === 'poor') return 'Slow Connection';
    return 'Poor Connection';
  };

  // Icon selection based on status
  const getIcon = () => {
    if (!isOnline) return <WifiOff className="w-4 h-4" />;
    if (quality.level === 'excellent') return <Wifi className="w-4 h-4" />;
    if (quality.level === 'good') return <Signal className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  // Icon only view (for collapsed sidebar)
  if (iconOnly) {
    return (
      <div
        data-testid="enhanced-offline-indicator"
        className={cn("flex justify-center", className)}
      >
        <div
          data-testid="connection-indicator"
          role="status"
          aria-label={`Connection status: ${getStatusText()}${quality.level !== 'offline' ? `, ${getQualityLabel()}` : ''}`}
          className={cn("w-3 h-3 rounded-full", quality.color)}
          title={`${getStatusText()}${quality.level !== 'offline' ? ` - ${getQualityLabel()}` : ''}`}
        />
      </div>
    );
  }

  // Compact view
  if (compact) {
    return (
      <div
        data-testid="enhanced-offline-indicator"
        className={cn("flex items-center gap-2 compact", className)}
      >
        <div
          data-testid="connection-indicator"
          role="status"
          aria-label={`Connection status: ${getStatusText()}${quality.level !== 'offline' ? `, ${getQualityLabel()}` : ''}`}
          className={cn("w-3 h-3 rounded-full", quality.color)}
          onClick={showDetails ? () => setDetailsOpen(!detailsOpen) : undefined}
          style={{ cursor: showDetails ? 'pointer' : 'default' }}
        />
        <span className="text-sm font-medium">{getStatusText()}</span>
        {!isOnline ? null : (
          <span className="text-xs text-muted-foreground">
            {getQualityLabel()}
          </span>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div
      data-testid="enhanced-offline-indicator"
      className={cn("space-y-4", className)}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {getIcon()}
            Connection Status
            <Badge variant={isOnline ? 'default' : 'destructive'}>
              {getStatusText()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              data-testid="connection-indicator"
              role="status"
              aria-label={`Connection status: ${getStatusText()}${quality.level !== 'offline' ? `, ${getQualityLabel()}` : ''}`}
              className={cn("w-4 h-4 rounded-full", quality.color)}
              onClick={showDetails ? () => setDetailsOpen(!detailsOpen) : undefined}
              style={{ cursor: showDetails ? 'pointer' : 'default' }}
            />
            <div className="flex-1">
              <div className="font-medium">{getQualityLabel()}</div>
              <div className="text-sm text-muted-foreground">
                {quality.description}
              </div>
            </div>
          </div>

          {showOfflineToggle && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleOfflineMode}
                aria-label="Toggle offline mode"
                className="flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                Simulate Offline
              </Button>
            </div>
          )}

          {showDetails && detailsOpen && (
            <div className="border-t pt-3 space-y-2">
              <div className="font-medium flex items-center gap-2">
                <Info className="w-4 h-4" />
                Connection Details
              </div>
              {connectionType && (
                <div className="text-sm">
                  <strong>Type:</strong> {connectionType}
                </div>
              )}
              {effectiveType && (
                <div className="text-sm">
                  <strong>Speed:</strong> {effectiveType}
                </div>
              )}
              {downlink && (
                <div className="text-sm">
                  <strong>Bandwidth:</strong> {downlink} Mbps
                </div>
              )}
              {rtt && (
                <div className="text-sm">
                  <strong>Latency:</strong> {rtt}ms
                </div>
              )}
              {saveData && (
                <div className="text-sm">
                  <Badge variant="secondary">Data Saver Enabled</Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}