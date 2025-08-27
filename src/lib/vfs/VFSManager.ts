import { FileStorage } from './FileStorage';
import { VFS_CONFIG, UTILS } from './constants';
import { logger } from '../infrastructure/Logger';
import { createDatabaseError, createValidationError } from '../infrastructure/ErrorHandler';
import type {
  VFSFile,
  VFSCreateFileOptions,
  VFSUpdateFileOptions,
  VFSListOptions,
  VFSStats,
  VFSDirectory,
} from '../../types/vfs';

export class VFSManager {
  private static instance: VFSManager;
  private fileStorage: FileStorage;
  private currentProjectId: string | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private isTransitioning = false;

  private constructor() {
    this.fileStorage = new FileStorage();
  }

  public static getInstance(): VFSManager {
    if (!VFSManager.instance) {
      VFSManager.instance = new VFSManager();
    }
    return VFSManager.instance;
  }

  public async initialize(projectId: string): Promise<void> {
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
      throw createValidationError('Project ID must be a non-empty string');
    }

    const targetProjectId = projectId.trim();

    // If already initialized with correct project, return
    if (this.initialized && this.currentProjectId === targetProjectId) {
      logger.debug('VFS already initialized with target project', { projectId: targetProjectId });
      return;
    }

    // If already initialized with different project, switch
    if (this.initialized && this.currentProjectId !== targetProjectId) {
      logger.info('VFS initialized with different project, switching', {
        current: this.currentProjectId,
        target: targetProjectId,
      });
      await this.switchToProject(targetProjectId);
      return;
    }

    // If initialization in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationPromise = this.doInitialization(targetProjectId);

    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  public async switchToProject(projectId: string): Promise<void> {
    if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
      throw createValidationError('Project ID must be a non-empty string');
    }

    if (this.isTransitioning) {
      throw createDatabaseError('Project switch already in progress');
    }

    const targetProjectId = projectId.trim();

    if (this.currentProjectId === targetProjectId) {
      return;
    }

    const startTime = performance.now();
    this.isTransitioning = true;

    try {
      logger.info('Switching VFS to project', {
        from: this.currentProjectId,
        to: targetProjectId,
      });

      // Initialize FileStorage for new project
      await this.fileStorage.initialize(targetProjectId);
      this.currentProjectId = targetProjectId;
      this.initialized = true;

      const duration = performance.now() - startTime;
      logger.info('VFS project switch completed', { projectId: targetProjectId, duration });
    } catch (error) {
      logger.error('VFS project switch failed', error as Error, { projectId: targetProjectId });
      throw error;
    } finally {
      this.isTransitioning = false;
    }
  }

  public getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async createFile(path: string, options: VFSCreateFileOptions = {}): Promise<VFSFile> {
    await this.ensureInitialized();

    // Validate file path
    if (!path || typeof path !== 'string' || path.trim() === '') {
      throw createValidationError('File path must be a non-empty string');
    }

    const normalizedPath = this.normalizePath(path);
    const { content = '', mimeType: providedMimeType, compress } = options;

    // Validate file size
    if (content.length > VFS_CONFIG.MAX_FILE_SIZE) {
      throw createValidationError('File size exceeds maximum limit');
    }

    // Check storage quota
    const stats = await this.getStats();
    const projectedSize = stats.totalSize + content.length;
    if (projectedSize > VFS_CONFIG.MAX_PROJECT_STORAGE) {
      throw createValidationError('Project storage quota exceeded');
    }

    // Check if file already exists
    const existingFile = await this.fileStorage.loadFile(normalizedPath);
    if (existingFile) {
      throw createValidationError('File already exists');
    }

    // Auto-detect MIME type if not provided
    const mimeType = providedMimeType || UTILS.getMimeType(normalizedPath);

    // Extract directory and name
    const lastSlash = normalizedPath.lastIndexOf('/');
    const directory = lastSlash >= 0 ? normalizedPath.substring(0, lastSlash) : '';
    const name = lastSlash >= 0 ? normalizedPath.substring(lastSlash + 1) : normalizedPath;

    // Create VFS file object
    const vfsFile: VFSFile = {
      id: this.generateFileId(),
      projectId: this.currentProjectId!,
      path: normalizedPath,
      name,
      directory,
      mimeType,
      size: content.length,
      content,
      chunked: content.length > VFS_CONFIG.CHUNK_THRESHOLD,
      compression: compress && this.isTextFile(mimeType) ? 'gzip' : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      hash: this.calculateChecksum(content),
    };

    // Handle chunking for large files
    let chunks;
    if (vfsFile.chunked) {
      chunks = this.fileStorage.createChunks(content, VFS_CONFIG.CHUNK_SIZE, vfsFile.id);
      vfsFile.chunkIds = chunks.map(chunk => chunk.id);
      // Don't store content directly for chunked files
      delete vfsFile.content;
    }

    // Save to storage
    await this.fileStorage.saveFile(vfsFile, chunks);

    logger.debug('File created', {
      path: normalizedPath,
      size: vfsFile.size,
      chunked: vfsFile.chunked,
      mimeType: vfsFile.mimeType,
    });

    return vfsFile;
  }

  public async readFile(path: string): Promise<VFSFile | null> {
    await this.ensureInitialized();

    if (!path || typeof path !== 'string') {
      return null;
    }

    const normalizedPath = this.normalizePath(path);
    const file = await this.fileStorage.loadFile(normalizedPath);

    if (file) {
      // Update accessed time - but this would need a different field
      // For now, just return the file without updating access time
    }

    return file;
  }

  public async updateFile(path: string, contentOrOptions: string | VFSUpdateFileOptions): Promise<VFSFile> {
    await this.ensureInitialized();

    const normalizedPath = this.normalizePath(path);
    const existingFile = await this.fileStorage.loadFile(normalizedPath);

    if (!existingFile) {
      throw createValidationError('File not found');
    }

    // Handle both string and options parameter
    const options = typeof contentOrOptions === 'string' 
      ? { content: contentOrOptions } 
      : contentOrOptions;
    
    const { content } = options;
    if (content !== undefined) {
      // Validate new size
      if (content.length > VFS_CONFIG.MAX_FILE_SIZE) {
        throw createValidationError('File size exceeds maximum limit');
      }

      // Update file properties
      existingFile.content = content;
      existingFile.size = content.length;
      existingFile.updatedAt = new Date();
      existingFile.hash = this.calculateChecksum(content);

      // Handle chunking changes
      const shouldBeChunked = content.length > VFS_CONFIG.CHUNK_THRESHOLD;
      if (shouldBeChunked !== existingFile.chunked) {
        existingFile.chunked = shouldBeChunked;
        if (shouldBeChunked) {
          const chunks = this.fileStorage.createChunks(content, VFS_CONFIG.CHUNK_SIZE, existingFile.id);
          existingFile.chunkIds = chunks.map(chunk => chunk.id);
          delete existingFile.content;
          await this.fileStorage.saveFile(existingFile, chunks);
        } else {
          existingFile.chunkIds = undefined;
          await this.fileStorage.saveFile(existingFile);
        }
      } else {
        if (existingFile.chunked) {
          const chunks = this.fileStorage.createChunks(content, VFS_CONFIG.CHUNK_SIZE, existingFile.id);
          existingFile.chunkIds = chunks.map(chunk => chunk.id);
          delete existingFile.content;
          await this.fileStorage.saveFile(existingFile, chunks);
        } else {
          await this.fileStorage.saveFile(existingFile);
        }
      }
    }

    return existingFile;
  }

  public async deleteFile(path: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!path || typeof path !== 'string') {
      return false;
    }

    const normalizedPath = this.normalizePath(path);
    const existingFile = await this.fileStorage.loadFile(normalizedPath);

    if (!existingFile) {
      return false;
    }

    await this.fileStorage.deleteFile(normalizedPath);
    
    logger.debug('File deleted', { path: normalizedPath });
    return true;
  }

  public async listFiles(options: VFSListOptions = {}): Promise<VFSFile[]> {
    await this.ensureInitialized();

    return await this.fileStorage.listFiles(options);
  }

  public async createDirectory(path: string): Promise<VFSDirectory> {
    await this.ensureInitialized();

    const normalizedPath = this.normalizePath(path);
    
    // For this implementation, we'll track directories as metadata
    // In a more complete implementation, you might store directory entries
    const directory: VFSDirectory = {
      path: normalizedPath,
      name: normalizedPath.split('/').pop() || normalizedPath,
      children: [],
      createdAt: new Date(),
      projectId: this.currentProjectId!,
    };

    logger.debug('Directory created', { path: normalizedPath });
    return directory;
  }

  public async deleteDirectory(path: string, recursive = false): Promise<boolean> {
    await this.ensureInitialized();

    const normalizedPath = this.normalizePath(path);
    
    // List files in directory
    const filesInDir = await this.fileStorage.listFiles({
      directory: normalizedPath,
      recursive: true,
    });

    if (filesInDir.length > 0 && !recursive) {
      throw createValidationError('Directory is not empty');
    }

    // Delete all files in directory
    for (const file of filesInDir) {
      await this.fileStorage.deleteFile(file.path);
    }

    logger.debug('Directory deleted', { path: normalizedPath, fileCount: filesInDir.length });
    return true;
  }

  public async getStats(): Promise<VFSStats> {
    await this.ensureInitialized();

    const files = await this.fileStorage.listFiles();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const largestFile = files.reduce((largest, file) => 
      file.size > largest.size ? file : largest, 
      files[0] || { size: 0 }
    );

    // Calculate directories by finding unique directory paths
    const directories = new Set<string>();
    files.forEach(file => {
      if (file.directory) {
        const parts = file.directory.split('/');
        for (let i = 1; i <= parts.length; i++) {
          directories.add(parts.slice(0, i).join('/'));
        }
      }
    });

    return {
      totalFiles: files.length,
      totalDirectories: directories.size,
      totalSize,
      quotaUsage: totalSize / VFS_CONFIG.MAX_PROJECT_STORAGE,
      largestFile: largestFile.size,
      chunkedFiles: files.filter(f => f.chunked).length,
      compressedFiles: files.filter(f => f.compression === 'gzip').length,
    };
  }

  public async cleanup(): Promise<void> {
    if (this.currentProjectId) {
      await this.fileStorage.cleanup();
      logger.debug('VFS cleanup completed', { projectId: this.currentProjectId });
    }
    
    this.currentProjectId = null;
    this.initialized = false;
  }

  private async doInitialization(projectId: string): Promise<void> {
    try {
      logger.info('Initializing VFS', { projectId });
      
      await this.fileStorage.initialize(projectId);
      this.currentProjectId = projectId;
      this.initialized = true;

      logger.info('VFS initialized successfully', { projectId });
    } catch (error) {
      logger.error('VFS initialization failed', error as Error, { projectId });
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      throw createDatabaseError('VFS not initialized');
    }
  }

  private normalizePath(path: string): string {
    return UTILS.normalizePath(path);
  }

  private generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private calculateChecksum(content: string): string {
    // Simple checksum implementation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private isTextFile(mimeType: string): boolean {
    return mimeType.startsWith('text/') || 
           mimeType.includes('json') || 
           mimeType.includes('xml') || 
           mimeType.includes('javascript') || 
           mimeType.includes('typescript');
  }
}

// Export singleton instance
export const vfsManager = VFSManager.getInstance();