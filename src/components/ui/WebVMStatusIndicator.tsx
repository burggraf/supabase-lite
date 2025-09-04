/**
 * WebVM Status Indicator Component
 * 
 * Displays WebVM connection status in the sidebar with auto-updating status
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { WebVMManager } from '@/lib/webvm/WebVMManager';
import { WebVMStatus } from '@/lib/webvm/types';

interface WebVMStatusIndicatorProps {
  iconOnly?: boolean;
  compact?: boolean;
}

export function WebVMStatusIndicator({ iconOnly = false, compact = false }: WebVMStatusIndicatorProps) {
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

    // Set up event listeners for WebVM state changes
    const handleWebVMReady = () => updateStatus();
    const handlePostgRESTReady = () => updateStatus();
    const handleStarted = () => updateStatus();
    const handleStopped = () => updateStatus();

    webvmManager.on('webvm-ready', handleWebVMReady);
    webvmManager.on('postgrest-ready', handlePostgRESTReady);
    webvmManager.on('started', handleStarted);
    webvmManager.on('stopped', handleStopped);

    // Also poll status periodically to catch any missed events
    const interval = setInterval(updateStatus, 2000);

    return () => {
      webvmManager.off('webvm-ready', handleWebVMReady);
      webvmManager.off('postgrest-ready', handlePostgRESTReady);
      webvmManager.off('started', handleStarted);
      webvmManager.off('stopped', handleStopped);
      clearInterval(interval);
    };
  }, [webvmManager]);

  if (!status) {
    return null;
  }

  // Determine status color and text based on WebVM and PostgREST state
  const getStatusInfo = () => {
    if (status.state === 'running' && status.postgrest.running && status.postgrest.bridgeConnected) {
      return {
        color: 'bg-green-500',
        text: 'PostgREST Ready',
        detailed: 'WebVM running, PostgREST connected'
      };
    } else if (status.state === 'running' && status.postgrest.installed && !status.postgrest.running) {
      return {
        color: 'bg-yellow-500',
        text: 'PostgREST Starting',
        detailed: 'WebVM running, PostgREST initializing'
      };
    } else if (status.state === 'running') {
      return {
        color: 'bg-blue-500',
        text: 'WebVM Running',
        detailed: 'WebVM active, PostgREST installing'
      };
    } else if (status.state === 'starting') {
      return {
        color: 'bg-yellow-500',
        text: 'WebVM Starting',
        detailed: 'WebVM initializing'
      };
    } else if (status.state === 'error') {
      return {
        color: 'bg-red-500',
        text: 'WebVM Error',
        detailed: status.error || 'WebVM failed to start'
      };
    } else {
      return {
        color: 'bg-gray-500',
        text: 'WebVM Stopped',
        detailed: 'WebVM not running'
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