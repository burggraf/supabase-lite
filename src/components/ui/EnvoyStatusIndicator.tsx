/**
 * Envoy Status Indicator Component
 * 
 * Displays Envoy Proxy status in the sidebar with auto-updating status
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { WebVMManager } from '@/lib/webvm/WebVMManager';
import { WebVMStatus } from '@/lib/webvm/types';

interface EnvoyStatusIndicatorProps {
  iconOnly?: boolean;
  compact?: boolean;
}

export function EnvoyStatusIndicator({ iconOnly = false, compact = false }: EnvoyStatusIndicatorProps) {
  const [status, setStatus] = useState<WebVMStatus | null>(null);
  const [webvmManager] = useState(() => WebVMManager.getInstance());

  // Update status from WebVM manager
  const updateStatus = () => {
    const currentStatus = webvmManager.getStatus();
    setStatus(currentStatus);
  };

  useEffect(() => {
    // Initial status update
    updateStatus();

    // Set up event listeners for Envoy state changes
    const handleEnvoyReady = () => updateStatus();
    const handleEnvoyInstalled = () => updateStatus();
    const handleStarted = () => updateStatus();
    const handleStopped = () => updateStatus();

    webvmManager.on('envoy-ready', handleEnvoyReady);
    webvmManager.on('envoy-installed', handleEnvoyInstalled);
    webvmManager.on('started', handleStarted);
    webvmManager.on('stopped', handleStopped);

    // Also poll status periodically to catch any missed events
    const interval = setInterval(updateStatus, 2000);

    return () => {
      webvmManager.off('envoy-ready', handleEnvoyReady);
      webvmManager.off('envoy-installed', handleEnvoyInstalled);
      webvmManager.off('started', handleStarted);
      webvmManager.off('stopped', handleStopped);
      clearInterval(interval);
    };
  }, [webvmManager]);

  if (!status) {
    return null;
  }

  // Determine status color and text based on Envoy state
  const getStatusInfo = () => {
    if (status.state === 'running' && status.envoy.running && status.envoy.routingActive) {
      return {
        color: 'bg-green-500',
        text: 'Envoy Routing Active',
        detailed: `Envoy Proxy ${status.envoy.version} routing API calls on port ${status.envoy.port} (admin: ${status.envoy.adminPort})`
      };
    } else if (status.state === 'running' && status.envoy.running && !status.envoy.routingActive) {
      return {
        color: 'bg-yellow-500',
        text: 'Envoy Starting Routes',
        detailed: 'Envoy running, configuring routing rules'
      };
    } else if (status.state === 'running' && status.envoy.installed && !status.envoy.running) {
      return {
        color: 'bg-yellow-500',
        text: 'Envoy Starting',
        detailed: 'Envoy installed, starting proxy'
      };
    } else if (status.state === 'running' && status.edgeRuntime.running && !status.envoy.installed) {
      return {
        color: 'bg-blue-500',
        text: 'Envoy Installing',
        detailed: 'Installing Envoy Proxy'
      };
    } else if (status.state === 'running') {
      return {
        color: 'bg-gray-400',
        text: 'Envoy Waiting',
        detailed: 'Waiting for prerequisites (PostgREST + Edge Runtime)'
      };
    } else if (status.state === 'starting') {
      return {
        color: 'bg-gray-400',
        text: 'Envoy Waiting',
        detailed: 'WebVM initializing'
      };
    } else if (status.state === 'error') {
      return {
        color: 'bg-red-500',
        text: 'Envoy Error',
        detailed: 'WebVM error affecting Envoy Proxy'
      };
    } else {
      return {
        color: 'bg-gray-500',
        text: 'Envoy Stopped',
        detailed: 'WebVM stopped'
      };
    }
  };

  const statusInfo = getStatusInfo();

  if (iconOnly) {
    return (
      <div className="flex justify-center">
        <div 
          className={cn("h-2 w-2 rounded-full flex-shrink-0", statusInfo.color)}
          title={statusInfo.detailed}
        />
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center text-xs text-muted-foreground",
      compact ? "space-x-2" : "justify-center"
    )}>
      <div className={cn("h-2 w-2 rounded-full flex-shrink-0", statusInfo.color)} />
      <span className="truncate" title={statusInfo.detailed}>
        {statusInfo.text}
      </span>
    </div>
  );
}