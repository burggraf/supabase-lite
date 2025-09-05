/**
 * Edge Runtime Status Indicator Component
 * 
 * Displays Edge Functions Runtime status in the sidebar with auto-updating status
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { WebVMManager } from '@/lib/webvm/WebVMManager';
import { WebVMStatus } from '@/lib/webvm/types';

interface EdgeRuntimeStatusIndicatorProps {
  iconOnly?: boolean;
  compact?: boolean;
}

export function EdgeRuntimeStatusIndicator({ iconOnly = false, compact = false }: EdgeRuntimeStatusIndicatorProps) {
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

    // Set up event listeners for Edge Runtime state changes
    const handleEdgeRuntimeReady = () => updateStatus();
    const handleEdgeRuntimeInstalled = () => updateStatus();
    const handleStarted = () => updateStatus();
    const handleStopped = () => updateStatus();

    webvmManager.on('edge-runtime-ready', handleEdgeRuntimeReady);
    webvmManager.on('edge-runtime-installed', handleEdgeRuntimeInstalled);
    webvmManager.on('started', handleStarted);
    webvmManager.on('stopped', handleStopped);

    // Also poll status periodically to catch any missed events
    const interval = setInterval(updateStatus, 2000);

    return () => {
      webvmManager.off('edge-runtime-ready', handleEdgeRuntimeReady);
      webvmManager.off('edge-runtime-installed', handleEdgeRuntimeInstalled);
      webvmManager.off('started', handleStarted);
      webvmManager.off('stopped', handleStopped);
      clearInterval(interval);
    };
  }, [webvmManager]);

  if (!status) {
    return null;
  }

  // Determine status color and text based on Edge Runtime state
  const getStatusInfo = () => {
    if (status.state === 'running' && status.edgeRuntime.running) {
      return {
        color: 'bg-green-500',
        text: 'Edge Runtime Ready',
        detailed: `Edge Runtime ${status.edgeRuntime.runtimeVersion} with Deno ${status.edgeRuntime.denoVersion} running on port ${status.edgeRuntime.port}`
      };
    } else if (status.state === 'running' && status.edgeRuntime.installed && !status.edgeRuntime.running) {
      return {
        color: 'bg-yellow-500',
        text: 'Edge Runtime Starting',
        detailed: 'Edge Runtime installed, starting up'
      };
    } else if (status.state === 'running' && status.postgrest.running && !status.edgeRuntime.installed) {
      return {
        color: 'bg-blue-500',
        text: 'Edge Runtime Installing',
        detailed: 'Installing Edge Runtime'
      };
    } else if (status.state === 'running') {
      return {
        color: 'bg-gray-400',
        text: 'Edge Runtime Waiting',
        detailed: 'Waiting for prerequisites (WebVM + PostgREST)'
      };
    } else if (status.state === 'starting') {
      return {
        color: 'bg-gray-400',
        text: 'Edge Runtime Waiting',
        detailed: 'WebVM initializing'
      };
    } else if (status.state === 'error') {
      return {
        color: 'bg-red-500',
        text: 'Edge Runtime Error',
        detailed: 'WebVM error affecting Edge Runtime'
      };
    } else {
      return {
        color: 'bg-gray-500',
        text: 'Edge Runtime Stopped',
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