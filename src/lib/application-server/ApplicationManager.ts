/**
 * ApplicationManager - Core service for managing application lifecycle
 * 
 * Handles CRUD operations, state management, and coordination with other services
 * for the Application Server feature. Provides browser-only implementation
 * using IndexedDB for persistence.
 */

import { 
  Application, 
  ApplicationStatus, 
  CreateApplicationRequest, 
  UpdateApplicationRequest,
  ApplicationServerError 
} from '@/types/application-server';
import { logger as appLogger } from '@/lib/infrastructure/Logger';

export class ApplicationManager {
  private static instance: ApplicationManager;
  private dbName = 'supabase-lite-applications';
  private storeName = 'applications';
  private db: IDBDatabase | null = null;
  private logger = appLogger;

  private constructor() {}

  static getInstance(): ApplicationManager {
    if (!ApplicationManager.instance) {
      ApplicationManager.instance = new ApplicationManager();
    }
    return ApplicationManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      this.logger.info('ApplicationManager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ApplicationManager', error);
      throw new ApplicationServerError({
        code: 'INIT_FAILED',
        message: 'Failed to initialize application storage',
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
          store.createIndex('runtimeId', 'runtimeId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async createApplication(request: CreateApplicationRequest): Promise<Application> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'ApplicationManager not initialized',
        timestamp: new Date()
      });
    }

    // Validate required fields
    this.validateCreateRequest(request);

    // Check for duplicate ID
    const existing = await this.getApplication(request.id);
    if (existing) {
      throw new ApplicationServerError({
        code: 'DUPLICATE_ID',
        message: `Application with id '${request.id}' already exists`,
        timestamp: new Date()
      });
    }

    const now = new Date();
    const application: Application = {
      id: request.id,
      name: request.name,
      description: request.description,
      runtimeId: request.runtimeId,
      status: ApplicationStatus.STOPPED,
      createdAt: now,
      updatedAt: now,
      metadata: request.metadata || {}
    };

    await this.saveApplication(application);
    
    this.logger.info(`Created application: ${application.id}`);
    return application;
  }

  async getApplication(id: string): Promise<Application | null> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'ApplicationManager not initialized',
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
          message: `Failed to get application: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert date strings back to Date objects
          result.createdAt = new Date(result.createdAt);
          result.updatedAt = new Date(result.updatedAt);
        }
        resolve(result || null);
      };
    });
  }

  async updateApplication(id: string, request: UpdateApplicationRequest): Promise<Application> {
    const existing = await this.getApplication(id);
    if (!existing) {
      throw new ApplicationServerError({
        code: 'NOT_FOUND',
        message: `Application with id '${id}' not found`,
        timestamp: new Date()
      });
    }

    // Validate update request
    this.validateUpdateRequest(request);

    const updated: Application = {
      ...existing,
      ...request,
      id: existing.id, // Ensure ID cannot be changed
      runtimeId: existing.runtimeId, // Runtime changes require separate endpoint
      status: existing.status, // Status changes require separate endpoints
      createdAt: existing.createdAt, // Cannot change creation date
      updatedAt: new Date()
    };

    await this.saveApplication(updated);
    
    this.logger.info(`Updated application: ${updated.id}`);
    return updated;
  }

  async deleteApplication(id: string, force = false): Promise<void> {
    const existing = await this.getApplication(id);
    if (!existing) {
      throw new ApplicationServerError({
        code: 'NOT_FOUND',
        message: `Application with id '${id}' not found`,
        timestamp: new Date()
      });
    }

    // Check if application is running
    if (!force && existing.status === ApplicationStatus.RUNNING) {
      throw new ApplicationServerError({
        code: 'CONFLICT',
        message: `Cannot delete running application '${id}'. Stop the application first or use force=true.`,
        timestamp: new Date()
      });
    }

    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'ApplicationManager not initialized',
        timestamp: new Date()
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to delete application: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        this.logger.info(`Deleted application: ${id}`);
        resolve();
      };
    });
  }

  async listApplications(filters?: {
    status?: ApplicationStatus;
    runtimeType?: string;
  }): Promise<{ applications: Application[]; total: number }> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'ApplicationManager not initialized',
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
          message: `Failed to list applications: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        let applications: Application[] = request.result.map((app: any) => ({
          ...app,
          createdAt: new Date(app.createdAt),
          updatedAt: new Date(app.updatedAt)
        }));

        // Apply filters
        if (filters?.status) {
          applications = applications.filter(app => app.status === filters.status);
        }

        if (filters?.runtimeType) {
          // Note: This would need RuntimeManager integration to filter by type
          // For now, assume runtimeId contains type information
          applications = applications.filter(app => 
            app.runtimeId.includes(filters.runtimeType!)
          );
        }

        // Sort by creation date (newest first)
        applications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        resolve({
          applications,
          total: applications.length
        });
      };
    });
  }

  async updateApplicationStatus(id: string, status: ApplicationStatus): Promise<Application> {
    const existing = await this.getApplication(id);
    if (!existing) {
      throw new ApplicationServerError({
        code: 'NOT_FOUND',
        message: `Application with id '${id}' not found`,
        timestamp: new Date()
      });
    }

    const updated: Application = {
      ...existing,
      status,
      updatedAt: new Date()
    };

    await this.saveApplication(updated);
    
    this.logger.info(`Updated application status: ${id} -> ${status}`);
    return updated;
  }

  private async saveApplication(application: Application): Promise<void> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'ApplicationManager not initialized',
        timestamp: new Date()
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(application);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to save application: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  private validateCreateRequest(request: CreateApplicationRequest): void {
    if (!request.id || typeof request.id !== 'string' || request.id.trim() === '') {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Application id is required and must be a non-empty string',
        field: 'id',
        rule: 'required',
        timestamp: new Date()
      });
    }

    // Validate ID pattern (alphanumeric with hyphens and underscores)
    if (!/^[a-zA-Z0-9_-]+$/.test(request.id)) {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Application id must contain only alphanumeric characters, hyphens, and underscores',
        field: 'id',
        rule: 'pattern',
        timestamp: new Date()
      });
    }

    if (!request.name || typeof request.name !== 'string' || request.name.trim() === '') {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Application name is required and must be a non-empty string',
        field: 'name',
        rule: 'required',
        timestamp: new Date()
      });
    }

    if (request.name.length > 100) {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Application name must be 100 characters or less',
        field: 'name',
        rule: 'maxLength',
        timestamp: new Date()
      });
    }

    if (!request.runtimeId || typeof request.runtimeId !== 'string' || request.runtimeId.trim() === '') {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Runtime ID is required and must be a non-empty string',
        field: 'runtimeId',
        rule: 'required',
        timestamp: new Date()
      });
    }

    if (request.description && request.description.length > 500) {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Application description must be 500 characters or less',
        field: 'description',
        rule: 'maxLength',
        timestamp: new Date()
      });
    }
  }

  private validateUpdateRequest(request: UpdateApplicationRequest): void {
    if (request.name !== undefined) {
      if (typeof request.name !== 'string' || request.name.trim() === '') {
        throw new ApplicationServerError({
          code: 'VALIDATION_ERROR',
          message: 'Application name must be a non-empty string',
          field: 'name',
          rule: 'required',
          timestamp: new Date()
        });
      }

      if (request.name.length > 100) {
        throw new ApplicationServerError({
          code: 'VALIDATION_ERROR',
          message: 'Application name must be 100 characters or less',
          field: 'name',
          rule: 'maxLength',
          timestamp: new Date()
        });
      }
    }

    if (request.description !== undefined && request.description.length > 500) {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'Application description must be 500 characters or less',
        field: 'description',
        rule: 'maxLength',
        timestamp: new Date()
      });
    }
  }
}