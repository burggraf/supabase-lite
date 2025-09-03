/**
 * React hook for tracking online/offline status and connection quality
 * Provides real-time network status updates for offline-first functionality
 */

import { useState, useEffect } from 'react';

interface NetworkConnection {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface OnlineStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType?: string | null;
  effectiveType?: string | null;
  downlink?: number | null;
  rtt?: number | null;
  saveData?: boolean;
  hasServiceWorker: boolean;
  lastUpdated: Date;
  toggleOfflineMode?: () => void;
}

/**
 * Hook for tracking online/offline status and network quality
 */
export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Default to online in non-browser environments
  });

  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());

  const [connectionInfo, setConnectionInfo] = useState<NetworkConnection>(() => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: connection?.rtt,
        saveData: connection?.saveData
      };
    }
    return {};
  });

  const [hasServiceWorker, setHasServiceWorker] = useState<boolean>(() => {
    return 'serviceWorker' in navigator;
  });

  const toggleOfflineMode = () => {
    setIsOfflineMode(!isOfflineMode);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return; // Skip in non-browser environments
    }

    const handleOnline = () => {
      setIsOnline(true);
      setLastUpdated(new Date());
      updateConnectionInfo();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastUpdated(new Date());
    };

    const updateConnectionInfo = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        setConnectionInfo({
          effectiveType: connection?.effectiveType,
          downlink: connection?.downlink,
          rtt: connection?.rtt,
          saveData: connection?.saveData
        });
      }
    };

    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && 'addEventListener' in connection) {
        connection.addEventListener('change', updateConnectionInfo);
        
        // Cleanup for connection listener
        return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
          connection.removeEventListener('change', updateConnectionInfo);
        };
      }
    }

    // Standard cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Determine effective online status (real online status + offline mode override)
  const effectiveIsOnline = isOnline && !isOfflineMode;

  return {
    isOnline: effectiveIsOnline,
    isOffline: !effectiveIsOnline,
    connectionType: effectiveIsOnline ? (connectionInfo.effectiveType || 'wifi') : null,
    effectiveType: effectiveIsOnline ? connectionInfo.effectiveType : null,
    downlink: effectiveIsOnline ? connectionInfo.downlink : null,
    rtt: effectiveIsOnline ? connectionInfo.rtt : null,
    saveData: connectionInfo.saveData || false,
    hasServiceWorker,
    lastUpdated,
    toggleOfflineMode
  };
}