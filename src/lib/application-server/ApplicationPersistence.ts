/**
 * Application Persistence Layer - Real IndexedDB storage for applications
 * Replaces the broken localStorage implementation with proper persistence
 */

import { logger as Logger } from '../infrastructure/Logger';
import { Application, ApplicationDeployment, RuntimeEnvironment } from '@/types/application-server';

interface ApplicationStorageSchema {
  applications: {
    key: string; // application ID
    value: Application;
  };
  deployments: {
    key: string; // deployment ID
    value: ApplicationDeployment;
  };
  runtimes: {
    key: string; // runtime ID
    value: RuntimeEnvironment;
  };
  webvm_state: {
    key: string; // state key
    value: any; // WebVM state data
  };
}

class ApplicationPersistenceManager {
  private static instance: ApplicationPersistenceManager | null = null;
  private db: IDBDatabase | null = null;
  private dbName = 'supabase-lite-application-server';
  private dbVersion = 1;
  private initialized = false;

  static getInstance(): ApplicationPersistenceManager {
    if (!ApplicationPersistenceManager.instance) {
      ApplicationPersistenceManager.instance = new ApplicationPersistenceManager();
    }
    return ApplicationPersistenceManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        Logger.warn('IndexedDB not available, falling back to localStorage');
        this.initialized = true;
        resolve();
        return;
      }

      try {
        let request: IDBOpenDBRequest;
        
        try {
          request = indexedDB.open(this.dbName, this.dbVersion);
        } catch (openError) {
          const errorMessage = openError.message || 'Unknown IndexedDB open error';
          
          if (errorMessage.includes('access to the Indexed Database API is denied') || 
              errorMessage.includes('SecurityError') ||
              openError.name === 'SecurityError') {
            Logger.warn('⚠️ IndexedDB.open() blocked by browser security, using localStorage fallback', { 
              error: errorMessage 
            });
            this.initialized = true;
            resolve();
            return;
          }
          
          Logger.error('Failed to open IndexedDB during open call', openError);
          reject(new Error('Failed to initialize application persistence'));
          return;
        }

        request.onerror = () => {
          const errorMessage = request.error?.message || 'Unknown IndexedDB error';
          
          if (errorMessage.includes('access to the Indexed Database API is denied') || 
              errorMessage.includes('SecurityError')) {
            Logger.warn('⚠️ IndexedDB access denied due to browser security restrictions, falling back to localStorage', { 
              error: errorMessage 
            });
            this.initialized = true;
            resolve();
            return;
          }
          
          Logger.error('Failed to open IndexedDB', request.error);
          reject(new Error('Failed to initialize application persistence'));
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.initialized = true;
          Logger.info('Application persistence initialized with IndexedDB');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          try {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('applications')) {
              const applicationsStore = db.createObjectStore('applications', { keyPath: 'id' });
              applicationsStore.createIndex('status', 'status', { unique: false });
              applicationsStore.createIndex('runtimeId', 'runtimeId', { unique: false });
            }

            if (!db.objectStoreNames.contains('deployments')) {
              const deploymentsStore = db.createObjectStore('deployments', { keyPath: 'id' });
              deploymentsStore.createIndex('applicationId', 'applicationId', { unique: false });
              deploymentsStore.createIndex('status', 'status', { unique: false });
            }

            if (!db.objectStoreNames.contains('runtimes')) {
              const runtimesStore = db.createObjectStore('runtimes', { keyPath: 'id' });
              runtimesStore.createIndex('type', 'type', { unique: false });
              runtimesStore.createIndex('status', 'status', { unique: false });
            }

            if (!db.objectStoreNames.contains('webvm_state')) {
              db.createObjectStore('webvm_state', { keyPath: 'key' });
            }

            Logger.info('IndexedDB schema updated');
          } catch (schemaError) {
            Logger.warn('⚠️ IndexedDB schema creation failed, will fallback to localStorage', { 
              error: schemaError.message 
            });
          }
        };
      } catch (initError) {
        const errorMessage = initError.message || 'Unknown initialization error';
        
        if (errorMessage.includes('access to the Indexed Database API is denied') || 
            errorMessage.includes('SecurityError')) {
          Logger.warn('⚠️ IndexedDB initialization blocked by browser security, using localStorage fallback', { 
            error: errorMessage 
          });
          this.initialized = true;
          resolve();
          return;
        }
        
        Logger.error('Failed to initialize IndexedDB', initError);
        reject(new Error('Failed to initialize application persistence'));
      }
    });
  }

  // Application CRUD operations
  async saveApplication(application: Application): Promise<void> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('supabase-lite-applications') || '{}');
      stored[application.id] = application;
      localStorage.setItem('supabase-lite-applications', JSON.stringify(stored));
      Logger.debug('Application saved to localStorage fallback', { id: application.id });
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['applications'], 'readwrite');
      const store = transaction.objectStore('applications');
      
      const request = store.put(application);
      
      request.onsuccess = () => {
        Logger.debug('Application saved to IndexedDB', { id: application.id });
        resolve();
      };
      
      request.onerror = () => {
        Logger.error('Failed to save application', request.error);
        reject(new Error('Failed to save application'));
      };
    });
  }

  async getApplication(id: string): Promise<Application | null> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('supabase-lite-applications') || '{}');
      return stored[id] || null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['applications'], 'readonly');
      const store = transaction.objectStore('applications');
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        Logger.error('Failed to get application', request.error);
        reject(new Error('Failed to get application'));
      };
    });
  }

  async getAllApplications(): Promise<Application[]> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('supabase-lite-applications') || '{}');
      return Object.values(stored);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['applications'], 'readonly');
      const store = transaction.objectStore('applications');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        Logger.error('Failed to get all applications', request.error);
        reject(new Error('Failed to get applications'));
      };
    });
  }

  async deleteApplication(id: string): Promise<void> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('supabase-lite-applications') || '{}');
      delete stored[id];
      localStorage.setItem('supabase-lite-applications', JSON.stringify(stored));
      Logger.debug('Application deleted from localStorage fallback', { id });
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['applications'], 'readwrite');
      const store = transaction.objectStore('applications');
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        Logger.debug('Application deleted from IndexedDB', { id });
        resolve();
      };
      
      request.onerror = () => {
        Logger.error('Failed to delete application', request.error);
        reject(new Error('Failed to delete application'));
      };
    });
  }

  // WebVM state operations
  async saveWebVMState(key: string, state: any): Promise<void> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      localStorage.setItem(`webvm-state-${key}`, JSON.stringify(state));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['webvm_state'], 'readwrite');
      const store = transaction.objectStore('webvm_state');
      
      const request = store.put({ key, value: state, timestamp: Date.now() });
      
      request.onsuccess = () => {
        Logger.debug('WebVM state saved', { key });
        resolve();
      };
      
      request.onerror = () => {
        Logger.error('Failed to save WebVM state', request.error);
        reject(new Error('Failed to save WebVM state'));
      };
    });
  }

  async getWebVMState(key: string): Promise<any | null> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      const stored = localStorage.getItem(`webvm-state-${key}`);
      return stored ? JSON.parse(stored) : null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['webvm_state'], 'readonly');
      const store = transaction.objectStore('webvm_state');
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      
      request.onerror = () => {
        Logger.error('Failed to get WebVM state', request.error);
        reject(new Error('Failed to get WebVM state'));
      };
    });
  }

  // Deployment operations
  async saveDeployment(deployment: ApplicationDeployment): Promise<void> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('supabase-lite-deployments') || '{}');
      stored[deployment.id] = deployment;
      localStorage.setItem('supabase-lite-deployments', JSON.stringify(stored));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['deployments'], 'readwrite');
      const store = transaction.objectStore('deployments');
      
      const request = store.put(deployment);
      
      request.onsuccess = () => {
        Logger.debug('Deployment saved', { id: deployment.id });
        resolve();
      };
      
      request.onerror = () => {
        Logger.error('Failed to save deployment', request.error);
        reject(new Error('Failed to save deployment'));
      };
    });
  }

  async getDeploymentsForApplication(applicationId: string): Promise<ApplicationDeployment[]> {
    await this.initialize();

    if (!this.db) {
      // Fallback to localStorage
      const stored = JSON.parse(localStorage.getItem('supabase-lite-deployments') || '{}');
      return Object.values(stored).filter((d: any) => d.applicationId === applicationId);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['deployments'], 'readonly');
      const store = transaction.objectStore('deployments');
      const index = store.index('applicationId');
      
      const request = index.getAll(applicationId);
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      
      request.onerror = () => {
        Logger.error('Failed to get deployments', request.error);
        reject(new Error('Failed to get deployments'));
      };
    });
  }

  // Debug operations
  async getDatabaseStats(): Promise<{
    applications: number;
    deployments: number;
    webvmStates: number;
    totalSize: number;
  }> {
    await this.initialize();

    if (!this.db) {
      // Fallback stats from localStorage
      const apps = JSON.parse(localStorage.getItem('supabase-lite-applications') || '{}');
      const deployments = JSON.parse(localStorage.getItem('supabase-lite-deployments') || '{}');
      
      return {
        applications: Object.keys(apps).length,
        deployments: Object.keys(deployments).length,
        webvmStates: 0,
        totalSize: JSON.stringify(apps).length + JSON.stringify(deployments).length
      };
    }

    return new Promise((resolve, reject) => {
      const promises: Promise<number>[] = [];
      
      ['applications', 'deployments', 'webvm_state'].forEach(storeName => {
        promises.push(new Promise((resolveCount) => {
          const transaction = this.db!.transaction([storeName], 'readonly');
          const store = transaction.objectStore(storeName);
          const request = store.count();
          
          request.onsuccess = () => {
            resolveCount(request.result);
          };
          
          request.onerror = () => {
            resolveCount(0);
          };
        }));
      });

      Promise.all(promises).then(([applications, deployments, webvmStates]) => {
        resolve({
          applications,
          deployments,
          webvmStates,
          totalSize: 0 // Would need more complex calculation for actual size
        });
      }).catch(reject);
    });
  }

  async clearAllData(): Promise<void> {
    await this.initialize();

    if (!this.db) {
      // Clear localStorage fallback
      localStorage.removeItem('supabase-lite-applications');
      localStorage.removeItem('supabase-lite-deployments');
      // Clear all webvm state keys
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('webvm-state-')) {
          localStorage.removeItem(key);
        }
      });
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['applications', 'deployments', 'webvm_state'], 'readwrite');
      
      const promises = [
        transaction.objectStore('applications').clear(),
        transaction.objectStore('deployments').clear(),
        transaction.objectStore('webvm_state').clear()
      ];

      transaction.oncomplete = () => {
        Logger.info('All application data cleared');
        resolve();
      };

      transaction.onerror = () => {
        Logger.error('Failed to clear data', transaction.error);
        reject(new Error('Failed to clear data'));
      };
    });
  }
}

export const applicationPersistence = ApplicationPersistenceManager.getInstance();