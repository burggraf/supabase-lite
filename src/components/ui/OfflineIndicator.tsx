/**
 * Offline status indicator component
 * Shows network status, connection quality, and offline capability
 */

import { WifiOff, Wifi, Shield, ShieldAlert } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { cn } from '../../lib/utils';

interface OfflineIndicatorProps {
  /** Whether to show the indicator when online (default: false) */
  showWhenOnline?: boolean;
  /** Whether to show detailed connection information */
  showDetails?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function OfflineIndicator({ 
  showWhenOnline = false, 
  showDetails = false,
  className 
}: OfflineIndicatorProps) {
  const status = useOnlineStatus();

  // Don't render when online unless explicitly requested
  if (status.isOnline && !showWhenOnline) {
    return null;
  }

  const isSlowConnection = status.connectionType === 'slow-2g' || 
                          status.connectionType === '2g' || 
                          (status.downlink && status.downlink < 1);

  const getStatusColor = () => {
    if (status.isOffline) return 'bg-red-500';
    if (isSlowConnection) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (status.isOffline) return 'Offline';
    if (isSlowConnection) return 'Slow Connection';
    return 'Online';
  };

  const getStatusMessage = () => {
    if (status.isOffline) return 'Working in offline mode';
    if (isSlowConnection) return 'Connection may be slow';
    if (status.saveData) return 'Data saver mode active';
    return `Connected via ${status.connectionType?.toUpperCase() || 'network'}`;
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const StatusIcon = status.isOffline ? WifiOff : Wifi;
  const ServiceWorkerIcon = status.hasServiceWorker ? Shield : ShieldAlert;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${getStatusText().toLowerCase()}`}
      className={cn(
        'inline-flex items-center gap-2 rounded-md text-white text-xs font-medium transition-all',
        getStatusColor(),
        showDetails ? 'px-4 py-2' : 'px-3 py-1',
        className
      )}
    >
      <StatusIcon 
        size={14} 
        data-testid={status.isOffline ? 'wifi-off-icon' : 'wifi-icon'}
      />
      
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span>{getStatusText()}</span>
          {status.connectionType && status.isOnline && (
            <span className="opacity-75">
              {status.connectionType.toUpperCase()}
            </span>
          )}
          {status.saveData && (
            <span className="opacity-75 text-xs">
              Data Saver
            </span>
          )}
        </div>
        
        {showDetails && (
          <div className="text-xs opacity-90 space-y-0.5">
            <div>{getStatusMessage()}</div>
            
            {status.isOnline && status.downlink && (
              <div>
                Speed: {status.downlink.toFixed(1)} Mbps
                {status.rtt && ` • Latency: ${status.rtt}ms`}
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <ServiceWorkerIcon size={12} />
              <span>
                Offline support {status.hasServiceWorker ? 'enabled' : 'disabled'}
              </span>
            </div>
            
            <div className="opacity-75">
              Last updated: {formatTimestamp(status.lastUpdated)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}