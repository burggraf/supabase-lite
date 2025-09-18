/**
 * WebVMManager - Service for managing WebVM instances
 * 
 * Handles WebVM lifecycle, state management, and coordination with other services.
 * Provides browser-only implementation with IndexedDB persistence for snapshots.
 */

import { 
  WebVMInstance, 
  WebVMStatus, 
  WebVMConfig,
  SnapshotResponse,
  ApplicationServerError 
} from '@/types/application-server';
import { WebVMBridge } from './WebVMBridge';
import { logger } from '@/lib/infrastructure/Logger';

export class WebVMManager {
  private static instance: WebVMManager;
  private dbName = 'supabase-lite-webvm';
  private storeName = 'instances';
  private snapshotsStoreName = 'snapshots';
  private db: IDBDatabase | null = null;
  private currentInstance: WebVMInstance | null = null;
  private bridge = WebVMBridge.getInstance();
  private logger = logger;

  private constructor() {}

  static getInstance(): WebVMManager {
    if (!WebVMManager.instance) {
      WebVMManager.instance = new WebVMManager();
    }
    return WebVMManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      await this.loadCurrentInstance();
      this.logger.info('WebVMManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize WebVMManager', error);
      throw new ApplicationServerError({
        code: 'INIT_FAILED',
        message: 'Failed to initialize WebVM manager',
        details: error,
        timestamp: new Date()
      });
    }
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.snapshotsStoreName)) {
          const snapshotStore = db.createObjectStore(this.snapshotsStoreName, { keyPath: 'id' });
          snapshotStore.createIndex('instanceId', 'instanceId', { unique: false });
          snapshotStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  private async loadCurrentInstance(): Promise<void> {
    if (!this.db) return;

    try {
      const instances = await this.getAllInstances();
      // For now, we support only one instance
      this.currentInstance = instances.length > 0 ? instances[0] : null;
    } catch (error) {
      this.logger.warn('Failed to load current instance', error);
    }
  }

  async initializeWebVM(config?: WebVMConfig): Promise<WebVMInstance> {
    if (this.currentInstance && this.currentInstance.status !== WebVMStatus.ERROR) {
      // Return existing instance if already initialized
      return this.currentInstance;
    }

    const defaultConfig: WebVMConfig = {
      memoryLimit: 1024, // 1GB
      diskLimit: 5120,   // 5GB
      networkEnabled: true,
      snapshotEnabled: true
    };

    const finalConfig = { ...defaultConfig, ...config };
    this.validateConfig(finalConfig);

    const instance: WebVMInstance = {
      id: this.generateInstanceId(),
      status: WebVMStatus.INITIALIZING,
      runtimeIds: [],
      createdAt: new Date(),
      config: finalConfig
    };

    await this.saveInstance(instance);
    this.currentInstance = instance;

    try {
      // Initialize the WebVM bridge
      // In a real implementation, this would start the WebVM container
      const webvmUrl = this.getWebVMUrl();
      await this.bridge.initialize(webvmUrl);

      // Update status to ready
      const readyInstance: WebVMInstance = {
        ...instance,
        status: WebVMStatus.READY
      };

      await this.saveInstance(readyInstance);
      this.currentInstance = readyInstance;

      this.logger.info(`WebVM instance initialized: ${instance.id}`);
      return readyInstance;
    } catch (error) {
      // Update status to error
      const errorInstance: WebVMInstance = {
        ...instance,
        status: WebVMStatus.ERROR
      };

      await this.saveInstance(errorInstance);
      this.currentInstance = errorInstance;

      throw new ApplicationServerError({
        code: 'WEBVM_INIT_FAILED',
        message: 'Failed to initialize WebVM instance',
        details: error,
        timestamp: new Date()
      });
    }
  }

  async getStatus(): Promise<WebVMInstance | null> {
    if (!this.currentInstance) {
      return null;
    }

    try {
      if (this.bridge.isReady()) {
        // Get real-time status from WebVM
        const status = await this.bridge.getStatus();
        
        const updatedInstance: WebVMInstance = {
          ...this.currentInstance,
          status: WebVMStatus.RUNNING,
          runtimeIds: status.runtimeIds,
          activeApplicationId: status.activeApplicationId,
          memoryUsage: status.memoryUsage
        };

        await this.saveInstance(updatedInstance);
        this.currentInstance = updatedInstance;
        
        return updatedInstance;
      }
    } catch (error) {
      this.logger.warn('Failed to get real-time WebVM status', error);
    }

    return this.currentInstance;
  }

  async createSnapshot(): Promise<SnapshotResponse> {
    if (!this.currentInstance || !this.bridge.isReady()) {
      throw new ApplicationServerError({
        code: 'WEBVM_NOT_READY',
        message: 'WebVM instance is not ready for snapshot creation',
        timestamp: new Date()
      });
    }

    const snapshotId = this.generateSnapshotId();
    
    try {
      const snapshotData = await this.bridge.createSnapshot();
      
      const snapshot = {
        id: snapshotId,
        instanceId: this.currentInstance.id,
        status: 'completed' as const,
        createdAt: new Date(),
        size: snapshotData.size,
        data: snapshotData
      };

      await this.saveSnapshot(snapshot);

      // Update instance with latest snapshot
      const updatedInstance: WebVMInstance = {
        ...this.currentInstance,
        lastSnapshot: new Date()
      };

      await this.saveInstance(updatedInstance);
      this.currentInstance = updatedInstance;

      this.logger.info(`Created WebVM snapshot: ${snapshotId}`);
      
      return {
        snapshotId,
        status: 'completed',
        createdAt: new Date(),
        size: snapshotData.size
      };
    } catch (error) {
      this.logger.error('Failed to create WebVM snapshot', error);
      
      return {
        snapshotId,
        status: 'failed',
        createdAt: new Date()
      };
    }
  }

  async restoreSnapshot(snapshotId: string): Promise<WebVMInstance> {
    if (!this.currentInstance) {
      throw new ApplicationServerError({
        code: 'WEBVM_NOT_INITIALIZED',
        message: 'WebVM instance is not initialized',
        timestamp: new Date()
      });
    }

    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) {
      throw new ApplicationServerError({
        code: 'SNAPSHOT_NOT_FOUND',
        message: `Snapshot with id '${snapshotId}' not found`,
        timestamp: new Date()
      });
    }

    try {
      await this.bridge.restoreSnapshot(snapshotId);

      const restoredInstance: WebVMInstance = {
        ...this.currentInstance,
        status: WebVMStatus.READY,
        lastSnapshot: snapshot.createdAt
      };

      await this.saveInstance(restoredInstance);
      this.currentInstance = restoredInstance;

      this.logger.info(`Restored WebVM from snapshot: ${snapshotId}`);
      return restoredInstance;
    } catch (error) {
      throw new ApplicationServerError({
        code: 'SNAPSHOT_RESTORE_FAILED',
        message: 'Failed to restore WebVM from snapshot',
        details: error,
        timestamp: new Date()
      });
    }
  }

  async resetWebVM(options: {
    force?: boolean;
    clearSnapshots?: boolean;
    clearRuntimes?: boolean;
  } = {}): Promise<WebVMInstance> {
    if (!this.currentInstance) {
      throw new ApplicationServerError({
        code: 'WEBVM_NOT_INITIALIZED',
        message: 'WebVM instance is not initialized',
        timestamp: new Date()
      });
    }

    try {
      await this.bridge.reset({
        clearRuntimes: options.clearRuntimes,
        clearSnapshots: options.clearSnapshots
      });

      const resetInstance: WebVMInstance = {
        ...this.currentInstance,
        status: WebVMStatus.READY,
        runtimeIds: options.clearRuntimes ? [] : this.currentInstance.runtimeIds,
        activeApplicationId: undefined,
        memoryUsage: undefined,
        lastSnapshot: options.clearSnapshots ? undefined : this.currentInstance.lastSnapshot,
        createdAt: new Date() // Reset creation time
      };

      await this.saveInstance(resetInstance);
      this.currentInstance = resetInstance;

      if (options.clearSnapshots) {
        await this.clearSnapshots(resetInstance.id);
      }

      this.logger.info(`Reset WebVM instance: ${resetInstance.id}`);
      return resetInstance;
    } catch (error) {
      throw new ApplicationServerError({
        code: 'WEBVM_RESET_FAILED',
        message: 'Failed to reset WebVM instance',
        details: error,
        timestamp: new Date()
      });
    }
  }

  private validateConfig(config: WebVMConfig): void {
    if (config.memoryLimit < 512 || config.memoryLimit > 4096) {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Memory limit must be between 512 and 4096 MB',
        field: 'memoryLimit',
        rule: 'range',
        timestamp: new Date()
      });
    }

    if (config.diskLimit < 1024 || config.diskLimit > 10240) {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Disk limit must be between 1024 and 10240 MB',
        field: 'diskLimit',
        rule: 'range',
        timestamp: new Date()
      });
    }
  }

  private generateInstanceId(): string {
    return `webvm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSnapshotId(): string {
    return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getWebVMUrl(): string {
    // In a real implementation, this would return the URL to the WebVM interface
    // For now, return a placeholder URL that would be handled by our mock
    return '/webvm';
  }

  private async saveInstance(instance: WebVMInstance): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(instance);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to save WebVM instance: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  private async getAllInstances(): Promise<WebVMInstance[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to get WebVM instances: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        const instances = request.result.map((instance: any) => ({
          ...instance,
          createdAt: new Date(instance.createdAt),
          lastSnapshot: instance.lastSnapshot ? new Date(instance.lastSnapshot) : undefined
        }));
        resolve(instances);
      };
    });
  }

  private async saveSnapshot(snapshot: any): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.snapshotsStoreName], 'readwrite');
      const store = transaction.objectStore(this.snapshotsStoreName);
      const request = store.put(snapshot);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to save snapshot: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  private async getSnapshot(snapshotId: string): Promise<any | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.snapshotsStoreName], 'readonly');
      const store = transaction.objectStore(this.snapshotsStoreName);
      const request = store.get(snapshotId);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to get snapshot: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          result.createdAt = new Date(result.createdAt);
        }
        resolve(result || null);
      };
    });
  }

  private async clearSnapshots(instanceId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.snapshotsStoreName], 'readwrite');
      const store = transaction.objectStore(this.snapshotsStoreName);
      const index = store.index('instanceId');
      const request = index.openCursor(IDBKeyRange.only(instanceId));

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to clear snapshots: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}