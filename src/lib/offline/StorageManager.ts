/**
 * Storage Manager
 * Monitor storage quota usage and implement cleanup strategies
 */

export interface QuotaInfo {
  totalQuota: number;
  usedSpace: number;
  availableSpace: number;
  usagePercentage: number;
  usageDetails: {
    indexedDB?: number;
    caches?: number;
    serviceWorker?: number;
    other?: number;
  };
  isApproachingLimit: boolean;
  isExceeded: boolean;
}

export interface StorageStats {
  totalUsage: number;
  databases: {
    count: number;
    names: string[];
  };
  caches: {
    count: number;
    names: string[];
  };
  breakdown: {
    indexedDB: number;
    caches: number;
    serviceWorker: number;
    other: number;
  };
}

export interface CleanupOptions {
  clearOldCaches: boolean;
  maxCacheAge?: number;
  clearOldDatabases?: boolean;
  maxDatabaseAge?: number;
}

export interface CleanupResult {
  success: boolean;
  spaceReclaimed: number;
  actions: string[];
  errors: string[];
  clearedCount?: number;
}

export interface AutoCleanupOptions {
  intervalMinutes: number;
  quotaThreshold?: number; // Percentage at which to trigger cleanup
  enabled?: boolean;
}

/**
 * Singleton Storage Manager for quota monitoring and cleanup
 */
export class StorageManager {
  private static instance: StorageManager | null = null;
  private warningCallbacks: Array<(quota: QuotaInfo) => void> = [];
  private autoCleanupTimer: number | null = null;
  private readonly WARNING_THRESHOLD = 80; // 80%
  private readonly CRITICAL_THRESHOLD = 90; // 90%

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Get current storage quota information
   */
  public async getQuotaInfo(): Promise<QuotaInfo> {
    try {
      if (!('storage' in navigator) || !navigator.storage.estimate) {
        return this.getEmptyQuotaInfo();
      }

      const estimate = await navigator.storage.estimate();
      const totalQuota = estimate.quota || 0;
      const usedSpace = estimate.usage || 0;
      const availableSpace = Math.max(0, totalQuota - usedSpace);
      const usagePercentage = totalQuota > 0 ? Math.round((usedSpace / totalQuota) * 100) : 0;

      return {
        totalQuota,
        usedSpace,
        availableSpace,
        usagePercentage,
        usageDetails: {
          indexedDB: estimate.usageDetails?.indexedDB || 0,
          caches: estimate.usageDetails?.caches || 0,
          serviceWorker: estimate.usageDetails?.serviceWorker || 0,
          other: (estimate.usageDetails?.other || 0)
        },
        isApproachingLimit: usagePercentage >= this.WARNING_THRESHOLD,
        isExceeded: usagePercentage >= this.CRITICAL_THRESHOLD
      };
    } catch (error) {
      console.warn('Failed to get storage quota info:', error);
      return this.getEmptyQuotaInfo();
    }
  }

  /**
   * Get detailed storage statistics
   */
  public async getStorageStats(): Promise<StorageStats> {
    const stats: StorageStats = {
      totalUsage: 0,
      databases: { count: 0, names: [] },
      caches: { count: 0, names: [] },
      breakdown: {
        indexedDB: 0,
        caches: 0,
        serviceWorker: 0,
        other: 0
      }
    };

    try {
      // Get IndexedDB databases
      if ('indexedDB' in window && indexedDB.databases) {
        const databases = await indexedDB.databases();
        stats.databases.count = databases.length;
        stats.databases.names = databases.map(db => db.name || 'unknown');
      }
    } catch (error) {
      console.warn('Failed to get database info:', error);
    }

    try {
      // Get cache information
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        stats.caches.count = cacheNames.length;
        stats.caches.names = cacheNames;
      }
    } catch (error) {
      console.warn('Failed to get cache info:', error);
    }

    try {
      // Get storage usage breakdown
      if ('storage' in navigator && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        stats.totalUsage = estimate.usage || 0;
        stats.breakdown.indexedDB = estimate.usageDetails?.indexedDB || 0;
        stats.breakdown.caches = estimate.usageDetails?.caches || 0;
        stats.breakdown.serviceWorker = estimate.usageDetails?.serviceWorker || 0;
        stats.breakdown.other = estimate.usageDetails?.other || 0;
      }
    } catch (error) {
      console.warn('Failed to get storage estimate:', error);
    }

    return stats;
  }

  /**
   * Clear old caches
   */
  public async clearOldCaches(cacheNamesToDelete: string[]): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      spaceReclaimed: 0,
      actions: [],
      errors: [],
      clearedCount: 0
    };

    if (!('caches' in window)) {
      result.errors.push('Cache API not supported');
      result.success = false;
      return result;
    }

    let clearedCount = 0;
    
    for (const cacheName of cacheNamesToDelete) {
      try {
        const deleted = await caches.delete(cacheName);
        if (deleted) {
          clearedCount++;
          result.actions.push(`Cleared cache: ${cacheName}`);
        }
      } catch (error) {
        result.errors.push(`Failed to clear cache ${cacheName}: ${error}`);
        result.success = false;
      }
    }

    result.clearedCount = clearedCount;
    return result;
  }

  /**
   * Perform comprehensive cleanup
   */
  public async performCleanup(options: CleanupOptions): Promise<CleanupResult> {
    const beforeUsage = await this.getCurrentUsage();
    
    const result: CleanupResult = {
      success: true,
      spaceReclaimed: 0,
      actions: [],
      errors: []
    };

    if (options.clearOldCaches) {
      try {
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.includes('old-') || name.includes('cache-v') // Simple heuristic
        );
        
        const cacheResult = await this.clearOldCaches(oldCaches);
        result.actions.push(...cacheResult.actions);
        result.errors.push(...cacheResult.errors);
        
        if (oldCaches.length > 0) {
          result.actions.push('Cleared old caches');
        }
      } catch (error) {
        result.errors.push(`Failed to clear old caches: ${error}`);
        result.success = false;
      }
    }

    const afterUsage = await this.getCurrentUsage();
    result.spaceReclaimed = Math.max(0, beforeUsage - afterUsage);

    return result;
  }

  /**
   * Request persistent storage
   */
  public async requestPersistentStorage(): Promise<boolean> {
    try {
      if ('storage' in navigator && navigator.storage.persist) {
        return await navigator.storage.persist();
      }
      return false;
    } catch (error) {
      console.warn('Failed to request persistent storage:', error);
      return false;
    }
  }

  /**
   * Add storage warning callback
   */
  public onStorageWarning(callback: (quota: QuotaInfo) => void): void {
    this.warningCallbacks.push(callback);
  }

  /**
   * Check storage status and trigger warnings if needed
   */
  public async checkStorageStatus(): Promise<void> {
    const quotaInfo = await this.getQuotaInfo();
    
    if (quotaInfo.isApproachingLimit || quotaInfo.isExceeded) {
      this.warningCallbacks.forEach(callback => {
        try {
          callback(quotaInfo);
        } catch (error) {
          console.warn('Storage warning callback error:', error);
        }
      });
    }
  }

  /**
   * Start automatic cleanup monitoring
   */
  public async startAutoCleanup(options: AutoCleanupOptions): Promise<void> {
    this.stopAutoCleanup(); // Clear any existing timer
    
    const intervalMs = options.intervalMinutes * 60 * 1000;
    
    this.autoCleanupTimer = window.setInterval(async () => {
      await this.checkStorageStatus();
    }, intervalMs);
    
    // Run initial check
    await this.checkStorageStatus();
  }

  /**
   * Stop automatic cleanup monitoring
   */
  public stopAutoCleanup(): void {
    if (this.autoCleanupTimer !== null) {
      clearInterval(this.autoCleanupTimer);
      this.autoCleanupTimer = null;
    }
  }

  /**
   * Get current storage usage
   */
  private async getCurrentUsage(): Promise<number> {
    try {
      if ('storage' in navigator && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get empty quota info for error cases
   */
  private getEmptyQuotaInfo(): QuotaInfo {
    return {
      totalQuota: 0,
      usedSpace: 0,
      availableSpace: 0,
      usagePercentage: 0,
      usageDetails: {},
      isApproachingLimit: false,
      isExceeded: false
    };
  }
}