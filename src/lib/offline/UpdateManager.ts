/**
 * Update Manager for Offline App Updates
 * Handles safe app updates while preserving offline functionality
 */

export interface UpdateResult {
  success: boolean;
  error?: string;
  deferred?: boolean;
  fallbackAvailable?: boolean;
}

export interface UpdateStatus {
  hasUpdate: boolean;
  isUpdating: boolean;
  lastChecked: Date | null;
  pendingUpdate: boolean;
}

export interface UpdateHistoryEntry {
  timestamp: Date;
  version: string;
  success: boolean;
  error?: string;
}

interface BackupData {
  id: string;
  timestamp: number;
  data: any;
}

export class UpdateManager {
  private static instance: UpdateManager;
  private db: IDBDatabase | null = null;
  private updateHistory: UpdateHistoryEntry[] = [];
  private pendingUpdate = false;
  private isUpdating = false;
  private lastChecked: Date | null = null;
  private scheduledUpdateTimer: number | null = null;

  private constructor() {}

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  async checkForUpdates(): Promise<boolean> {
    this.lastChecked = new Date();
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return false;

      await registration.update();
      
      return !!(registration.waiting || registration.installing);
    } catch (error) {
      return false;
    }
  }

  async applyUpdate(): Promise<UpdateResult> {
    if (this.isUpdating) {
      return { success: false, error: 'Update already in progress' };
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.waiting) {
        return { success: false, error: 'No update available' };
      }

      this.isUpdating = true;

      // Backup critical data before update
      const backupResult = await this.preserveCriticalData();
      if (!backupResult.success) {
        this.isUpdating = false;
        return { success: false, error: 'Failed to backup data before update' };
      }

      // Apply update
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      this.updateHistory.push({
        timestamp: new Date(),
        version: this.extractVersion(registration.waiting.scriptURL),
        success: true
      });

      this.pendingUpdate = false;
      this.isUpdating = false;

      return { success: true };
    } catch (error) {
      this.isUpdating = false;
      return { 
        success: false, 
        error: (error as Error).message,
        fallbackAvailable: true
      };
    }
  }

  async rollbackUpdate(): Promise<UpdateResult> {
    try {
      await this.initDB();
      const backup = await this.getBackupData('pre-update-backup');
      
      if (!backup) {
        return { success: false, error: 'No backup available for rollback' };
      }

      if (!backup.data) {
        return { success: false, error: 'Invalid backup data' };
      }

      // Restore data by storing it back
      await this.restoreFromBackup(backup);
      
      // Also store the restored data as a confirmation
      await this.storeBackup({
        id: 'rollback-confirmation',
        timestamp: Date.now(),
        data: backup.data
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  async deferUpdate(): Promise<UpdateResult> {
    this.pendingUpdate = true;
    return { success: true, deferred: true };
  }

  async applyUpdateNow(): Promise<UpdateResult> {
    const result = await this.applyUpdate();
    if (result.success) {
      this.pendingUpdate = false;
    }
    return result;
  }

  scheduleUpdate(scheduledTime: number): void {
    if (this.scheduledUpdateTimer) {
      clearTimeout(this.scheduledUpdateTimer);
    }

    const delay = scheduledTime - Date.now();
    if (delay > 0) {
      this.scheduledUpdateTimer = setTimeout(async () => {
        await this.applyUpdate();
      }, delay) as unknown as number;
    }
  }

  hasPendingUpdate(): boolean {
    return this.pendingUpdate;
  }

  async preserveCriticalData(): Promise<UpdateResult> {
    try {
      await this.initDB();

      const criticalData = {
        projects: this.getLocalStorageData('projects'),
        settings: this.getLocalStorageData('userSettings'),
        queryHistory: this.getLocalStorageData('queryHistory')
      };

      const backup: BackupData = {
        id: 'pre-update-backup',
        timestamp: Date.now(),
        data: criticalData
      };

      await this.storeBackup(backup);

      // Also store as critical data backup
      const criticalBackup: BackupData = {
        id: 'critical-data-backup',
        timestamp: Date.now(),
        data: {
          projects: criticalData.projects,
          settings: criticalData.settings
        }
      };

      await this.storeBackup(criticalBackup);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to access storage' };
    }
  }

  async restoreCriticalData(): Promise<UpdateResult> {
    try {
      await this.initDB();
      const backup = await this.getBackupData('critical-data-backup');
      
      if (!backup?.data) {
        return { success: false, error: 'No critical data backup found' };
      }

      if (backup.data.projects) {
        localStorage.setItem('projects', JSON.stringify(backup.data.projects));
      }
      if (backup.data.settings) {
        localStorage.setItem('userSettings', JSON.stringify(backup.data.settings));
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  getUpdateStatus(): UpdateStatus {
    return {
      hasUpdate: this.pendingUpdate,
      isUpdating: this.isUpdating,
      lastChecked: this.lastChecked,
      pendingUpdate: this.pendingUpdate
    };
  }

  getUpdateHistory(): UpdateHistoryEntry[] {
    return [...this.updateHistory];
  }

  private async initDB(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('UpdateManagerDB', 1);
      
      request.onerror = () => reject(new Error('Failed to open database'));
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'id' });
        }
      };
    });
  }

  private async storeBackup(backup: BackupData): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['backups'], 'readwrite');
      const store = transaction.objectStore('backups');
      const request = store.put(backup);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to store backup'));
    });
  }

  private async getBackupData(id: string): Promise<BackupData | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['backups'], 'readonly');
      const store = transaction.objectStore('backups');
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get backup'));
    });
  }

  private async restoreFromBackup(backup: BackupData): Promise<void> {
    if (backup.data.projects) {
      localStorage.setItem('projects', JSON.stringify(backup.data.projects));
    }
    if (backup.data.settings) {
      localStorage.setItem('userSettings', JSON.stringify(backup.data.settings));
    }
    if (backup.data.queryHistory) {
      localStorage.setItem('queryHistory', JSON.stringify(backup.data.queryHistory));
    }
  }

  private getLocalStorageData(key: string): unknown {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private extractVersion(scriptURL: string): string {
    const match = scriptURL.match(/v=([^&]+)/);
    return match ? match[1] : 'unknown';
  }
}