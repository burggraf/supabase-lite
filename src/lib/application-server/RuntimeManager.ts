/**
 * RuntimeManager - Service for managing runtime environments
 * 
 * Handles runtime installation, configuration, and lifecycle management
 * for the Application Server feature. Provides browser-only implementation
 * with predefined runtime configurations.
 */

import { 
  RuntimeEnvironment, 
  RuntimeType, 
  RuntimeStatus,
  RuntimeConfig,
  ApplicationServerError 
} from '@/types/application-server';
import { logger } from '@/lib/infrastructure/Logger';

export class RuntimeManager {
  private static instance: RuntimeManager;
  private dbName = 'supabase-lite-runtimes';
  private storeName = 'runtimes';
  private db: IDBDatabase | null = null;
  private logger = logger;

  private constructor() {}

  static getInstance(): RuntimeManager {
    if (!RuntimeManager.instance) {
      RuntimeManager.instance = new RuntimeManager();
    }
    return RuntimeManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      await this.initializeBuiltInRuntimes();
      this.logger.info('RuntimeManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize RuntimeManager', error);
      throw new ApplicationServerError({
        code: 'INIT_FAILED',
        message: 'Failed to initialize runtime storage',
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
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('installedAt', 'installedAt', { unique: false });
        }
      };
    });
  }

  private async initializeBuiltInRuntimes(): Promise<void> {
    const builtInRuntimes = this.getBuiltInRuntimeConfigs();
    
    for (const runtimeConfig of builtInRuntimes) {
      const existing = await this.getRuntime(runtimeConfig.id);
      if (!existing) {
        await this.saveRuntime(runtimeConfig);
      }
    }
  }

  private getBuiltInRuntimeConfigs(): RuntimeEnvironment[] {
    return [
      {
        id: 'static',
        name: 'Static Files',
        type: RuntimeType.STATIC,
        version: '1.0.0',
        status: RuntimeStatus.AVAILABLE,
        config: {
          defaultPort: 3000,
          supportedExtensions: ['.html', '.css', '.js', '.json', '.svg', '.png', '.jpg', '.ico'],
          buildRequired: false,
          startupTimeout: 1000,
          resourceLimits: {
            memory: 128,
            cpu: 0.1
          }
        }
      },
      {
        id: 'nodejs-18',
        name: 'Node.js 18.x',
        type: RuntimeType.NODEJS,
        version: '18.19.1',
        status: RuntimeStatus.AVAILABLE,
        dockerImage: 'node:18-alpine',
        config: {
          defaultPort: 3000,
          supportedExtensions: ['.js', '.mjs', '.json', '.ts'],
          buildRequired: false,
          startupTimeout: 10000,
          resourceLimits: {
            memory: 512,
            cpu: 1.0
          }
        }
      },
      {
        id: 'nodejs-20',
        name: 'Node.js 20.x',
        type: RuntimeType.NODEJS,
        version: '20.11.1',
        status: RuntimeStatus.AVAILABLE,
        dockerImage: 'node:20-alpine',
        config: {
          defaultPort: 3000,
          supportedExtensions: ['.js', '.mjs', '.json', '.ts'],
          buildRequired: false,
          startupTimeout: 10000,
          resourceLimits: {
            memory: 512,
            cpu: 1.0
          }
        }
      },
      {
        id: 'nextjs-14',
        name: 'Next.js 14.x',
        type: RuntimeType.NEXTJS,
        version: '14.1.0',
        status: RuntimeStatus.AVAILABLE,
        dockerImage: 'node:20-alpine',
        config: {
          defaultPort: 3000,
          supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
          buildRequired: true,
          startupTimeout: 30000,
          resourceLimits: {
            memory: 1024,
            cpu: 2.0
          }
        }
      },
      {
        id: 'nextjs-15',
        name: 'Next.js 15.x',
        type: RuntimeType.NEXTJS,
        version: '15.0.0',
        status: RuntimeStatus.AVAILABLE,
        dockerImage: 'node:20-alpine',
        config: {
          defaultPort: 3000,
          supportedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
          buildRequired: true,
          startupTimeout: 30000,
          resourceLimits: {
            memory: 1024,
            cpu: 2.0
          }
        }
      },
      {
        id: 'python-3.11',
        name: 'Python 3.11',
        type: RuntimeType.PYTHON,
        version: '3.11.8',
        status: RuntimeStatus.AVAILABLE,
        dockerImage: 'python:3.11-alpine',
        config: {
          defaultPort: 8000,
          supportedExtensions: ['.py', '.pyw'],
          buildRequired: false,
          startupTimeout: 15000,
          resourceLimits: {
            memory: 512,
            cpu: 1.0
          }
        }
      },
      {
        id: 'edge-functions',
        name: 'Supabase Edge Functions',
        type: RuntimeType.EDGE_FUNCTIONS,
        version: '1.0.0',
        status: RuntimeStatus.AVAILABLE,
        config: {
          defaultPort: 54321,
          supportedExtensions: ['.js', '.ts'],
          buildRequired: false,
          startupTimeout: 5000,
          resourceLimits: {
            memory: 256,
            cpu: 0.5
          }
        }
      }
    ];
  }

  async getRuntime(id: string): Promise<RuntimeEnvironment | null> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'RuntimeManager not initialized',
        timestamp: new Date()
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to get runtime: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert date strings back to Date objects
          if (result.installedAt) {
            result.installedAt = new Date(result.installedAt);
          }
          if (result.lastUsed) {
            result.lastUsed = new Date(result.lastUsed);
          }
        }
        resolve(result || null);
      };
    });
  }

  async listRuntimes(filters?: {
    type?: RuntimeType;
    status?: RuntimeStatus;
  }): Promise<{ runtimes: RuntimeEnvironment[]; total: number }> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'RuntimeManager not initialized',
        timestamp: new Date()
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to list runtimes: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        let runtimes: RuntimeEnvironment[] = request.result.map((runtime: any) => ({
          ...runtime,
          installedAt: runtime.installedAt ? new Date(runtime.installedAt) : undefined,
          lastUsed: runtime.lastUsed ? new Date(runtime.lastUsed) : undefined
        }));

        // Apply filters
        if (filters?.type) {
          runtimes = runtimes.filter(runtime => runtime.type === filters.type);
        }

        if (filters?.status) {
          runtimes = runtimes.filter(runtime => runtime.status === filters.status);
        }

        // Sort by usage and availability (available first, then by last used)
        runtimes.sort((a, b) => {
          // Available runtimes first
          if (a.status === RuntimeStatus.AVAILABLE && b.status !== RuntimeStatus.AVAILABLE) {
            return -1;
          }
          if (b.status === RuntimeStatus.AVAILABLE && a.status !== RuntimeStatus.AVAILABLE) {
            return 1;
          }

          // Then by last used (most recent first)
          if (a.lastUsed && b.lastUsed) {
            return b.lastUsed.getTime() - a.lastUsed.getTime();
          }
          if (a.lastUsed && !b.lastUsed) {
            return -1;
          }
          if (!a.lastUsed && b.lastUsed) {
            return 1;
          }

          // Finally by name
          return a.name.localeCompare(b.name);
        });

        resolve({
          runtimes,
          total: runtimes.length
        });
      };
    });
  }

  async installRuntime(
    id: string, 
    config?: { version?: string; features?: string[]; environmentVariables?: Record<string, string> }
  ): Promise<RuntimeEnvironment> {
    const existing = await this.getRuntime(id);
    if (!existing) {
      throw new ApplicationServerError({
        code: 'NOT_FOUND',
        message: `Runtime with id '${id}' not found`,
        timestamp: new Date()
      });
    }

    if (existing.status === RuntimeStatus.INSTALLED) {
      // Return existing if already installed (idempotent)
      return existing;
    }

    // Simulate installation process
    const installing: RuntimeEnvironment = {
      ...existing,
      status: RuntimeStatus.INSTALLING
    };

    await this.saveRuntime(installing);

    // Simulate async installation
    await new Promise(resolve => setTimeout(resolve, 100));

    const installed: RuntimeEnvironment = {
      ...existing,
      status: RuntimeStatus.INSTALLED,
      installedAt: new Date(),
      version: config?.version || existing.version
    };

    await this.saveRuntime(installed);
    
    this.logger.info(`Installed runtime: ${installed.id} v${installed.version}`);
    return installed;
  }

  async uninstallRuntime(id: string, force = false): Promise<RuntimeEnvironment> {
    const existing = await this.getRuntime(id);
    if (!existing) {
      throw new ApplicationServerError({
        code: 'NOT_FOUND',
        message: `Runtime with id '${id}' not found`,
        timestamp: new Date()
      });
    }

    if (existing.status !== RuntimeStatus.INSTALLED) {
      throw new ApplicationServerError({
        code: 'CONFLICT',
        message: `Runtime '${id}' is not installed`,
        timestamp: new Date()
      });
    }

    // Check if runtime is in use (would require ApplicationManager integration)
    if (!force) {
      // TODO: Check if any applications are using this runtime
      // For now, allow uninstallation
    }

    const uninstalled: RuntimeEnvironment = {
      ...existing,
      status: RuntimeStatus.AVAILABLE,
      installedAt: undefined,
      lastUsed: undefined
    };

    await this.saveRuntime(uninstalled);
    
    this.logger.info(`Uninstalled runtime: ${uninstalled.id}`);
    return uninstalled;
  }

  async markRuntimeUsed(id: string): Promise<void> {
    const existing = await this.getRuntime(id);
    if (existing) {
      const updated: RuntimeEnvironment = {
        ...existing,
        lastUsed: new Date()
      };
      await this.saveRuntime(updated);
    }
  }

  async validateRuntimeCompatibility(id: string): Promise<boolean> {
    const runtime = await this.getRuntime(id);
    if (!runtime) {
      return false;
    }

    // All predefined runtimes are compatible with WebVM
    // Custom runtimes would need additional validation
    return true;
  }

  private async saveRuntime(runtime: RuntimeEnvironment): Promise<void> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'RuntimeManager not initialized',
        timestamp: new Date()
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(runtime);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to save runtime: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }
}