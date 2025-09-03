// FileStorage - IndexedDB backend for VFS file operations
// Following Supabase Lite patterns for storage and error handling

import { openDB, type IDBPDatabase } from 'idb';
import type {
  VFSFile,
  VFSFileChunk,
  VFSProjectMetadata,
  VFSListOptions,
  VFSError,
  VFSErrorCode,
} from '../../types/vfs.js';
import {
  VFS_CONFIG,
  DEFAULT_VFS_CONFIG,
  VFS_ERROR_CODES,
  OBJECT_STORES,
  INDEXES,
  UTILS,
} from './constants.js';
import { logger } from '../infrastructure/Logger.js';
import { createDatabaseError } from '../infrastructure/ErrorHandler.js';

export class FileStorage {
  private db: IDBPDatabase | null = null;
  private projectId: string = '';
  private isInitialized = false;

  /**
   * Initialize FileStorage for a specific project
   */
  async initialize(projectId: string): Promise<void> {
    if (!projectId) {
      throw this.createError('VFS_PROJECT_NOT_FOUND', 'Project ID is required');
    }

    this.projectId = projectId;
    const dbName = `${VFS_CONFIG.STORAGE_PREFIX}${projectId}`;
    
    logger.info('Initializing VFS FileStorage', { projectId, dbName });

    try {
      this.db = await openDB(dbName, VFS_CONFIG.DB_VERSION, {
        upgrade(db: any, oldVersion: number) {
          logger.info('Upgrading VFS database schema', { oldVersion, newVersion: VFS_CONFIG.DB_VERSION });
          
          // Files store
          if (!db.objectStoreNames.contains(OBJECT_STORES.FILES)) {
            const filesStore = db.createObjectStore(OBJECT_STORES.FILES, {
              keyPath: 'path',
            });
            
            // Create indexes for efficient querying
            filesStore.createIndex(INDEXES.FILES.BY_DIRECTORY, 'directory');
            filesStore.createIndex(INDEXES.FILES.BY_CREATED_AT, 'createdAt');
            filesStore.createIndex(INDEXES.FILES.BY_UPDATED_AT, 'updatedAt');
            filesStore.createIndex(INDEXES.FILES.BY_SIZE, 'size');
            filesStore.createIndex(INDEXES.FILES.BY_MIME_TYPE, 'mimeType');
          }
          
          // Chunks store for large files
          if (!db.objectStoreNames.contains(OBJECT_STORES.CHUNKS)) {
            const chunksStore = db.createObjectStore(OBJECT_STORES.CHUNKS, {
              keyPath: 'id',
            });
            
            chunksStore.createIndex(INDEXES.CHUNKS.BY_FILE_ID, 'fileId');
            chunksStore.createIndex(INDEXES.CHUNKS.BY_SEQUENCE, 'sequence');
          }
          
          // Metadata store
          if (!db.objectStoreNames.contains(OBJECT_STORES.METADATA)) {
            db.createObjectStore(OBJECT_STORES.METADATA, {
              keyPath: 'projectId',
            });
          }
          
          // Buckets store
          if (!db.objectStoreNames.contains(OBJECT_STORES.BUCKETS)) {
            const bucketsStore = db.createObjectStore(OBJECT_STORES.BUCKETS, {
              keyPath: 'name',
            });
            
            bucketsStore.createIndex(INDEXES.BUCKETS.BY_PROJECT_ID, 'projectId');
            bucketsStore.createIndex(INDEXES.BUCKETS.BY_CREATED_AT, 'createdAt');
          }
        },
      });

      // Initialize project metadata if it doesn't exist
      await this.initializeProjectMetadata();
      
      this.isInitialized = true;
      logger.info('VFS FileStorage initialized successfully', { projectId });
      
    } catch (error) {
      logger.error('Failed to initialize VFS FileStorage', error as Error);
      throw createDatabaseError('Failed to initialize VFS storage', error as Error, `projectId: ${projectId}`);
    }
  }

  /**
   * Get current project ID
   */
  getProjectId(): string {
    return this.projectId;
  }

  /**
   * Get the database instance
   */
  async getDatabase(): Promise<IDBPDatabase> {
    if (!this.db) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }
    return this.db;
  }

  /**
   * Save a file to storage
   */
  async saveFile(file: VFSFile, chunks?: VFSFileChunk[]): Promise<void> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    // Validate file
    await this.validateFile(file);

    const db = await this.getDatabase();
    const tx = db.transaction([OBJECT_STORES.FILES, OBJECT_STORES.CHUNKS, OBJECT_STORES.METADATA], 'readwrite');

    try {
      // Get existing file for storage tracking
      const existingFile = await tx.objectStore(OBJECT_STORES.FILES).get(file.path);
      
      // Save file metadata
      await tx.objectStore(OBJECT_STORES.FILES).put(file);
      
      // Handle chunked files
      if (file.chunked && chunks) {
        // Delete old chunks if updating
        if (existingFile?.chunked && existingFile.chunkIds) {
          for (const chunkId of existingFile.chunkIds) {
            await tx.objectStore(OBJECT_STORES.CHUNKS).delete(chunkId);
          }
        }
        
        // Save new chunks
        for (const chunk of chunks) {
          await tx.objectStore(OBJECT_STORES.CHUNKS).put(chunk);
        }
      }
      
      await tx.done;
      
      // Update project metadata
      await this.updateStorageUsage(file, existingFile);
      
      logger.info('File saved successfully', {
        projectId: this.projectId,
        path: file.path,
        size: file.size,
        chunked: file.chunked,
      });
      
    } catch (error) {
      logger.error('Failed to save file', error as Error, { path: file.path });
      throw createDatabaseError('Failed to save file', error as Error, `path: ${file.path}`);
    }
  }

  /**
   * Load a file from storage
   */
  async loadFile(path: string): Promise<VFSFile | null> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    const normalizedPath = UTILS.normalizePath(path);
    
    try {
      const db = await this.getDatabase();
      const file = await db.get(OBJECT_STORES.FILES, normalizedPath);
      
      return file || null;
      
    } catch (error) {
      logger.error('Failed to load file', error as Error, { path: normalizedPath });
      throw createDatabaseError('Failed to load file', error as Error, `path: ${normalizedPath}`);
    }
  }

  /**
   * Load file content (assembles chunks for large files)
   */
  async loadFileContent(path: string): Promise<string> {
    const file = await this.loadFile(path);
    
    if (!file) {
      throw this.createError('VFS_FILE_NOT_FOUND', `File not found: ${path}`);
    }
    
    // Small files have content directly
    if (!file.chunked) {
      return file.content || '';
    }
    
    // Large files need chunk assembly
    if (!file.chunkIds || file.chunkIds.length === 0) {
      throw this.createError('VFS_CHUNK_MISSING', 'File has no chunks');
    }
    
    try {
      const db = await this.getDatabase();
      const chunks: VFSFileChunk[] = [];
      
      for (const chunkId of file.chunkIds) {
        const chunk = await db.get(OBJECT_STORES.CHUNKS, chunkId);
        if (!chunk) {
          throw this.createError('VFS_CHUNK_MISSING', `Missing chunk: ${chunkId}`);
        }
        chunks.push(chunk);
      }
      
      // Sort chunks by sequence and assemble content
      chunks.sort((a, b) => a.sequence - b.sequence);
      return chunks.map(chunk => chunk.content).join('');
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('VFS_CHUNK_MISSING')) {
        throw error;
      }
      logger.error('Failed to load file content', error as Error, { path });
      throw createDatabaseError('Failed to load file content', error as Error, `path: ${path}`);
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    const normalizedPath = UTILS.normalizePath(path);
    
    try {
      const db = await this.getDatabase();
      const tx = db.transaction([OBJECT_STORES.FILES, OBJECT_STORES.CHUNKS], 'readwrite');
      
      // Get file to check for chunks
      const file = await tx.objectStore(OBJECT_STORES.FILES).get(normalizedPath);
      
      if (!file) {
        return; // File doesn't exist, nothing to delete
      }
      
      // Delete file metadata
      await tx.objectStore(OBJECT_STORES.FILES).delete(normalizedPath);
      
      // Delete chunks if it's a chunked file
      if (file.chunked && file.chunkIds) {
        for (const chunkId of file.chunkIds) {
          await tx.objectStore(OBJECT_STORES.CHUNKS).delete(chunkId);
        }
      }
      
      await tx.done;
      
      // Update storage usage
      await this.updateStorageUsage(null, file);
      
      logger.info('File deleted successfully', {
        projectId: this.projectId,
        path: normalizedPath,
        size: file.size,
      });
      
    } catch (error) {
      logger.error('Failed to delete file', error as Error, { path: normalizedPath });
      throw createDatabaseError('Failed to delete file', error as Error, `path: ${normalizedPath}`);
    }
  }

  /**
   * List files with optional filtering and sorting
   */
  async listFiles(options: VFSListOptions = {}): Promise<VFSFile[]> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    try {
      const db = await this.getDatabase();
      const store = db.transaction(OBJECT_STORES.FILES).objectStore(OBJECT_STORES.FILES);
      
      let files: VFSFile[];
      
      // Filter by directory if specified
      if (options.directory !== undefined) {
        const directory = UTILS.normalizePath(options.directory);
        const index = store.index(INDEXES.FILES.BY_DIRECTORY);
        
        if (options.recursive) {
          // Get all files and filter by directory prefix
          const allFiles = await store.getAll();
          files = allFiles.filter((file: VFSFile) => 
            file.directory === directory || file.directory.startsWith(directory + '/')
          );
        } else {
          // Get exact directory match
          files = await index.getAll(directory);
        }
      } else {
        files = await store.getAll();
      }
      
      // Apply filters
      if (options.extension) {
        const ext = options.extension.toLowerCase();
        files = files.filter(file => file.name.toLowerCase().endsWith(ext));
      }
      
      if (options.mimeType) {
        files = files.filter(file => file.mimeType === options.mimeType);
      }
      
      // Sort files
      if (options.sort) {
        files.sort((a, b) => {
          let aVal: any, bVal: any;
          
          switch (options.sort) {
            case 'name':
              aVal = a.name.toLowerCase();
              bVal = b.name.toLowerCase();
              break;
            case 'size':
              aVal = a.size;
              bVal = b.size;
              break;
            case 'created':
              aVal = a.createdAt.getTime();
              bVal = b.createdAt.getTime();
              break;
            case 'modified':
              aVal = a.updatedAt.getTime();
              bVal = b.updatedAt.getTime();
              break;
            default:
              return 0;
          }
          
          const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return options.sortDirection === 'desc' ? -result : result;
        });
      }
      
      // Apply pagination
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;
      
      return files.slice(start, end);
      
    } catch (error) {
      logger.error('Failed to list files', error as Error, options);
      throw createDatabaseError('Failed to list files', error as Error, JSON.stringify(options));
    }
  }

  /**
   * Create chunks for large files
   */
  createChunks(content: string, chunkSize: number, fileId?: string): VFSFileChunk[] {
    const chunks: VFSFileChunk[] = [];
    const chunkFileId = fileId || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunkContent = content.slice(i, i + chunkSize);
      const chunk: VFSFileChunk = {
        id: `${chunkFileId}_chunk_${chunks.length}`,
        fileId: chunkFileId,
        sequence: chunks.length,
        content: chunkContent,
        size: chunkContent.length,
        createdAt: new Date(),
      };
      chunks.push(chunk);
    }
    
    return chunks;
  }

  /**
   * Save a chunk directly
   */
  async saveChunk(chunk: VFSFileChunk): Promise<void> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    try {
      const db = await this.getDatabase();
      await db.put(OBJECT_STORES.CHUNKS, chunk);
    } catch (error) {
      logger.error('Failed to save chunk', error as Error, { chunkId: chunk.id });
      throw createDatabaseError('Failed to save chunk', error as Error, 'chunk save operation');
    }
  }

  /**
   * Get count of chunks for a file
   */
  async getChunkCount(fileId: string): Promise<number> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    try {
      const db = await this.getDatabase();
      const index = db.transaction(OBJECT_STORES.CHUNKS).objectStore(OBJECT_STORES.CHUNKS).index(INDEXES.CHUNKS.BY_FILE_ID);
      return await index.count(fileId);
    } catch (error) {
      logger.error('Failed to get chunk count', error as Error, { fileId });
      throw createDatabaseError('Failed to get chunk count', error as Error, 'chunk count query');
    }
  }

  /**
   * Get total chunk count across all files
   */
  async getTotalChunkCount(): Promise<number> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    try {
      const db = await this.getDatabase();
      return await db.count(OBJECT_STORES.CHUNKS);
    } catch (error) {
      logger.error('Failed to get total chunk count', error as Error);
      throw createDatabaseError('Failed to get total chunk count', error as Error, 'total chunk count query');
    }
  }

  /**
   * Get project metadata
   */
  async getProjectMetadata(): Promise<VFSProjectMetadata> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    try {
      const db = await this.getDatabase();
      const metadata = await db.get(OBJECT_STORES.METADATA, this.projectId);
      
      if (!metadata) {
        throw this.createError('VFS_PROJECT_NOT_FOUND', 'Project metadata not found');
      }
      
      return metadata;
    } catch (error) {
      if (error instanceof Error && error.message.includes('VFS_PROJECT_NOT_FOUND')) {
        throw error;
      }
      logger.error('Failed to get project metadata', error as Error);
      throw createDatabaseError('Failed to get project metadata', error as Error, 'metadata query');
    }
  }

  /**
   * Update project metadata
   */
  async updateProjectMetadata(metadata: VFSProjectMetadata): Promise<void> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    try {
      const db = await this.getDatabase();
      await db.put(OBJECT_STORES.METADATA, { ...metadata, lastModified: new Date() });
    } catch (error) {
      logger.error('Failed to update project metadata', error as Error);
      throw createDatabaseError('Failed to update project metadata', error as Error, 'metadata update');
    }
  }

  /**
   * Get storage usage information
   */
  getStorageUsage(storageUsed: number, maxStorage: number) {
    const percentage = storageUsed / maxStorage;
    return {
      used: storageUsed,
      total: maxStorage,
      percentage,
      warning: percentage > VFS_CONFIG.STORAGE_WARNING_THRESHOLD,
      critical: percentage > VFS_CONFIG.STORAGE_CRITICAL_THRESHOLD,
    };
  }

  /**
   * Cleanup orphaned chunks
   */
  async cleanupOrphanedChunks(): Promise<void> {
    if (!this.isInitialized) {
      throw this.createError('VFS_STORAGE_ERROR', 'FileStorage not initialized');
    }

    try {
      const db = await this.getDatabase();
      const tx = db.transaction([OBJECT_STORES.FILES, OBJECT_STORES.CHUNKS], 'readwrite');
      
      // Get all file IDs that have chunks
      const files = await tx.objectStore(OBJECT_STORES.FILES).getAll();
      const validChunkIds = new Set<string>();
      
      files.forEach((file: VFSFile) => {
        if (file.chunked && file.chunkIds) {
          file.chunkIds.forEach((chunkId: string) => validChunkIds.add(chunkId));
        }
      });
      
      // Get all chunks and delete orphaned ones
      const chunks = await tx.objectStore(OBJECT_STORES.CHUNKS).getAll();
      let orphanedCount = 0;
      
      for (const chunk of chunks) {
        if (!validChunkIds.has(chunk.id)) {
          await tx.objectStore(OBJECT_STORES.CHUNKS).delete(chunk.id);
          orphanedCount++;
        }
      }
      
      await tx.done;
      
      logger.info('Cleaned up orphaned chunks', {
        projectId: this.projectId,
        orphanedCount,
      });
      
    } catch (error) {
      logger.error('Failed to cleanup orphaned chunks', error as Error);
      throw createDatabaseError('Failed to cleanup orphaned chunks', error as Error, 'orphaned chunks cleanup');
    }
  }

  /**
   * Cleanup all project data
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      const db = await this.getDatabase();
      const tx = db.transaction([OBJECT_STORES.FILES, OBJECT_STORES.CHUNKS, OBJECT_STORES.METADATA], 'readwrite');
      
      await tx.objectStore(OBJECT_STORES.FILES).clear();
      await tx.objectStore(OBJECT_STORES.CHUNKS).clear();
      await tx.objectStore(OBJECT_STORES.METADATA).clear();
      
      await tx.done;
      
      logger.info('VFS storage cleaned up', { projectId: this.projectId });
      
    } catch (error) {
      logger.error('Failed to cleanup VFS storage', error as Error);
      throw createDatabaseError('Failed to cleanup VFS storage', error as Error, 'storage cleanup');
    }
  }

  // Private helper methods

  private async initializeProjectMetadata(): Promise<void> {
    const db = await this.getDatabase();
    const existing = await db.get(OBJECT_STORES.METADATA, this.projectId);
    
    if (!existing) {
      const metadata: VFSProjectMetadata = {
        projectId: this.projectId,
        storageUsed: 0,
        fileCount: 0,
        lastModified: new Date(),
        config: { ...DEFAULT_VFS_CONFIG },
        version: VFS_CONFIG.DB_VERSION,
      };
      
      await db.put(OBJECT_STORES.METADATA, metadata);
      logger.info('Initialized project metadata', { projectId: this.projectId });
    }
  }

  private async validateFile(file: VFSFile): Promise<void> {
    // Validate file size
    if (file.size > VFS_CONFIG.MAX_FILE_SIZE) {
      throw this.createError('VFS_FILE_TOO_LARGE', 'File size exceeds maximum limit');
    }
    
    // Validate path - relaxed to allow spaces in filenames
    // Basic check for null/empty paths only
    if (!file.path || file.path.trim() === '') {
      throw this.createError('VFS_INVALID_PATH', `File path cannot be empty`);
    }
    
    // Check storage quota
    const metadata = await this.getProjectMetadata();
    const existingFile = await this.loadFile(file.path);
    const sizeDelta = file.size - (existingFile?.size || 0);
    
    if (sizeDelta > 0 && metadata.storageUsed + sizeDelta > metadata.config.maxStorage) {
      throw this.createError('VFS_STORAGE_QUOTA_EXCEEDED', 'Project storage quota exceeded');
    }
  }

  private async updateStorageUsage(newFile: VFSFile | null, oldFile: VFSFile | null): Promise<void> {
    const metadata = await this.getProjectMetadata();
    
    const oldSize = oldFile?.size || 0;
    const newSize = newFile?.size || 0;
    const sizeDelta = newSize - oldSize;
    
    let fileCountDelta = 0;
    if (newFile && !oldFile) fileCountDelta = 1; // New file
    if (!newFile && oldFile) fileCountDelta = -1; // Deleted file
    
    metadata.storageUsed = Math.max(0, metadata.storageUsed + sizeDelta);
    metadata.fileCount = Math.max(0, metadata.fileCount + fileCountDelta);
    metadata.lastModified = new Date();
    
    await this.updateProjectMetadata(metadata);
  }

  private createError(code: VFSErrorCode, message: string): VFSError {
    return {
      code,
      message: message || VFS_ERROR_CODES[code],
      details: { projectId: this.projectId },
    };
  }
}