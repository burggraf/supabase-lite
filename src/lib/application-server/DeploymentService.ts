/**
 * DeploymentService - Service for managing application deployments
 * 
 * Handles file uploads, deployment processing, and artifact management
 * for the Application Server feature. Provides browser-only implementation
 * using IndexedDB for deployment storage.
 */

import { 
  ApplicationDeployment, 
  DeploymentStatus, 
  DeploymentConfig,
  DeploymentArtifacts,
  FileDescriptor,
  DeploymentLog,
  ApplicationServerError 
} from '@/types/application-server';
import { WebVMBridge } from './WebVMBridge';
import { ApplicationManager } from './ApplicationManager';
import { RuntimeManager } from './RuntimeManager';
import { logger } from '@/lib/infrastructure/Logger';

export class DeploymentService {
  private static instance: DeploymentService;
  private dbName = 'supabase-lite-deployments';
  private storeName = 'deployments';
  private artifactsStoreName = 'artifacts';
  private db: IDBDatabase | null = null;
  private bridge = WebVMBridge.getInstance();
  private applicationManager = ApplicationManager.getInstance();
  private runtimeManager = RuntimeManager.getInstance();
  private logger = logger;

  private constructor() {}

  static getInstance(): DeploymentService {
    if (!DeploymentService.instance) {
      DeploymentService.instance = new DeploymentService();
    }
    return DeploymentService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await this.openDatabase();
      this.logger.info('DeploymentService initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DeploymentService', error);
      throw new ApplicationServerError({
        code: 'INIT_FAILED',
        message: 'Failed to initialize deployment service',
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
          store.createIndex('applicationId', 'applicationId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('deployedAt', 'deployedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.artifactsStoreName)) {
          const artifactsStore = db.createObjectStore(this.artifactsStoreName, { keyPath: 'deploymentId' });
        }
      };
    });
  }

  async createDeployment(
    applicationId: string, 
    files: File[], 
    config?: DeploymentConfig
  ): Promise<ApplicationDeployment> {
    // Validate application exists
    const application = await this.applicationManager.getApplication(applicationId);
    if (!application) {
      throw new ApplicationServerError({
        code: 'APPLICATION_NOT_FOUND',
        message: `Application with id '${applicationId}' not found`,
        timestamp: new Date()
      });
    }

    // Validate runtime exists
    const runtime = await this.runtimeManager.getRuntime(application.runtimeId);
    if (!runtime) {
      throw new ApplicationServerError({
        code: 'RUNTIME_NOT_FOUND',
        message: `Runtime '${application.runtimeId}' not found`,
        timestamp: new Date()
      });
    }

    // Validate files
    if (!files || files.length === 0) {
      throw new ApplicationServerError({
        code: 'VALIDATION_ERROR',
        message: 'At least one file is required for deployment',
        field: 'files',
        rule: 'required',
        timestamp: new Date()
      });
    }

    const deploymentId = this.generateDeploymentId();
    const artifacts = await this.processFiles(files);

    const deployment: ApplicationDeployment = {
      id: deploymentId,
      applicationId,
      status: DeploymentStatus.PENDING,
      artifacts,
      runtimeId: application.runtimeId,
      config: config || {},
      logs: []
    };

    await this.saveDeployment(deployment);
    await this.saveArtifacts(deploymentId, artifacts);

    // Start deployment process
    this.processDeployment(deployment).catch(error => {
      this.logger.error(`Deployment failed: ${deploymentId}`, error);
    });

    this.logger.info(`Created deployment: ${deploymentId} for application: ${applicationId}`);
    return deployment;
  }

  async getDeployment(deploymentId: string): Promise<ApplicationDeployment | null> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'DeploymentService not initialized',
        timestamp: new Date()
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(deploymentId);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to get deployment: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert date strings back to Date objects
          if (result.deployedAt) {
            result.deployedAt = new Date(result.deployedAt);
          }
          result.logs = result.logs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }));
        }
        resolve(result || null);
      };
    });
  }

  async listDeployments(applicationId?: string): Promise<ApplicationDeployment[]> {
    if (!this.db) {
      throw new ApplicationServerError({
        code: 'NOT_INITIALIZED',
        message: 'DeploymentService not initialized',
        timestamp: new Date()
      });
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      let request: IDBRequest;
      if (applicationId) {
        const index = store.index('applicationId');
        request = index.getAll(applicationId);
      } else {
        request = store.getAll();
      }

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to list deployments: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        const deployments = request.result.map((deployment: any) => ({
          ...deployment,
          deployedAt: deployment.deployedAt ? new Date(deployment.deployedAt) : undefined,
          logs: deployment.logs.map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }))
        }));

        // Sort by deployment time (newest first)
        deployments.sort((a, b) => {
          const aTime = a.deployedAt?.getTime() || 0;
          const bTime = b.deployedAt?.getTime() || 0;
          return bTime - aTime;
        });

        resolve(deployments);
      };
    });
  }

  async getDeploymentLogs(deploymentId: string): Promise<DeploymentLog[]> {
    const deployment = await this.getDeployment(deploymentId);
    return deployment?.logs || [];
  }

  private async processDeployment(deployment: ApplicationDeployment): Promise<void> {
    try {
      // Update status to uploading
      await this.updateDeploymentStatus(deployment.id, DeploymentStatus.UPLOADING);
      await this.addLog(deployment.id, 'info', 'Starting deployment upload');

      // Upload files to WebVM
      await this.uploadFilesToWebVM(deployment);

      // Update status to processing
      await this.updateDeploymentStatus(deployment.id, DeploymentStatus.PROCESSING);
      await this.addLog(deployment.id, 'info', 'Processing deployment');

      // Install runtime if needed
      await this.ensureRuntimeInstalled(deployment.runtimeId);

      // Build application if required
      await this.buildApplication(deployment);

      // Update status to deployed
      await this.updateDeploymentStatus(deployment.id, DeploymentStatus.DEPLOYED, new Date());
      await this.addLog(deployment.id, 'info', 'Deployment completed successfully');

      this.logger.info(`Deployment completed: ${deployment.id}`);
    } catch (error) {
      await this.updateDeploymentStatus(deployment.id, DeploymentStatus.FAILED);
      await this.addLog(deployment.id, 'error', `Deployment failed: ${error.message}`);
      
      this.logger.error(`Deployment failed: ${deployment.id}`, error);
      throw error;
    }
  }

  private async processFiles(files: File[]): Promise<DeploymentArtifacts> {
    const fileDescriptors: FileDescriptor[] = [];
    let totalSize = 0;

    for (const file of files) {
      const content = await this.readFileAsArrayBuffer(file);
      const descriptor: FileDescriptor = {
        path: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified),
        content: new Uint8Array(content)
      };
      
      fileDescriptors.push(descriptor);
      totalSize += file.size;
    }

    // Calculate checksum
    const checksum = await this.calculateChecksum(fileDescriptors);

    return {
      files: fileDescriptors,
      totalSize,
      checksum
    };
  }

  private async readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  private async calculateChecksum(files: FileDescriptor[]): Promise<string> {
    // Simple checksum based on file names and sizes
    const data = files.map(f => `${f.path}:${f.size}`).join('|');
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async uploadFilesToWebVM(deployment: ApplicationDeployment): Promise<void> {
    const artifacts = await this.getArtifacts(deployment.id);
    if (!artifacts) {
      throw new Error('Deployment artifacts not found');
    }

    const appPath = `/apps/${deployment.applicationId}`;
    
    for (const file of artifacts.files) {
      const filePath = `${appPath}/${file.path}`;
      await this.bridge.writeFile(filePath, file.content!);
      await this.addLog(deployment.id, 'info', `Uploaded: ${file.path}`);
    }
  }

  private async ensureRuntimeInstalled(runtimeId: string): Promise<void> {
    const runtime = await this.runtimeManager.getRuntime(runtimeId);
    if (!runtime) {
      throw new Error(`Runtime '${runtimeId}' not found`);
    }

    if (runtime.status !== 'installed') {
      await this.runtimeManager.installRuntime(runtimeId);
    }
  }

  private async buildApplication(deployment: ApplicationDeployment): Promise<void> {
    const runtime = await this.runtimeManager.getRuntime(deployment.runtimeId);
    if (!runtime?.config.buildRequired) {
      return;
    }

    await this.addLog(deployment.id, 'info', 'Building application');
    
    const appPath = `/apps/${deployment.applicationId}`;
    const buildCommand = deployment.config.buildArgs?.buildCommand || 'npm run build';
    
    try {
      const result = await this.bridge.executeCommand('sh', ['-c', `cd ${appPath} && ${buildCommand}`]);
      
      if (result.exitCode !== 0) {
        throw new Error(`Build failed with exit code ${result.exitCode}: ${result.stderr}`);
      }
      
      await this.addLog(deployment.id, 'info', 'Build completed successfully');
    } catch (error) {
      await this.addLog(deployment.id, 'error', `Build failed: ${error.message}`);
      throw error;
    }
  }

  private async updateDeploymentStatus(
    deploymentId: string, 
    status: DeploymentStatus, 
    deployedAt?: Date
  ): Promise<void> {
    const deployment = await this.getDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment '${deploymentId}' not found`);
    }

    const updated: ApplicationDeployment = {
      ...deployment,
      status,
      deployedAt: deployedAt || deployment.deployedAt
    };

    await this.saveDeployment(updated);
  }

  private async addLog(deploymentId: string, level: 'info' | 'warn' | 'error', message: string, details?: any): Promise<void> {
    const deployment = await this.getDeployment(deploymentId);
    if (!deployment) {
      return;
    }

    const log: DeploymentLog = {
      timestamp: new Date(),
      level,
      message,
      details
    };

    const updated: ApplicationDeployment = {
      ...deployment,
      logs: [...deployment.logs, log]
    };

    await this.saveDeployment(updated);
  }

  private generateDeploymentId(): string {
    return `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async saveDeployment(deployment: ApplicationDeployment): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(deployment);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to save deployment: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  private async saveArtifacts(deploymentId: string, artifacts: DeploymentArtifacts): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.artifactsStoreName], 'readwrite');
      const store = transaction.objectStore(this.artifactsStoreName);
      const request = store.put({ deploymentId, ...artifacts });

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to save artifacts: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  private async getArtifacts(deploymentId: string): Promise<DeploymentArtifacts | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.artifactsStoreName], 'readonly');
      const store = transaction.objectStore(this.artifactsStoreName);
      const request = store.get(deploymentId);

      request.onerror = () => {
        reject(new ApplicationServerError({
          code: 'DB_ERROR',
          message: `Failed to get artifacts: ${request.error?.message}`,
          timestamp: new Date()
        }));
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const { deploymentId, ...artifacts } = result;
          resolve(artifacts);
        } else {
          resolve(null);
        }
      };
    });
  }
}