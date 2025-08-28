import { logger } from '../infrastructure/Logger';
import { createDatabaseError, createValidationError } from '../infrastructure/ErrorHandler';
import { vfsManager } from './VFSManager';
import { projectManager } from '../projects/ProjectManager';
import type { VFSFile } from '../../types/vfs';

export interface SyncStatus {
  isActive: boolean;
  lastSync: Date | null;
  filesTracked: number;
  filesIgnored: number;
  pendingChanges: number;
  folderPath: string;
  direction: 'upload' | 'download' | 'bidirectional';
  conflicts: ConflictFile[];
}

export interface ConflictFile {
  path: string;
  localModified: Date;
  remoteModified: Date;
  localContent?: string;
  remoteContent?: string;
}

export interface SyncResult {
  filesUploaded: number;
  filesDownloaded: number;
  filesIgnored: number;
  conflicts: ConflictFile[];
  errors: string[];
}

export interface SyncConfig {
  direction: 'upload' | 'download' | 'bidirectional';
  ignorePatterns: string[];
  autoSync: boolean;
  conflictStrategy: 'local' | 'remote' | 'prompt';
}

export class SyncManager {
  private static instance: SyncManager;
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private fileSnapshots = new Map<string, number>(); // path -> lastModified timestamp
  private isActive = false;
  private lastSync: Date | null = null;
  private syncConfig: SyncConfig = {
    direction: 'bidirectional',
    ignorePatterns: [
      'node_modules/**',
      '.git/**',
      '.DS_Store',
      '*.log',
      'dist/**',
      'build/**'
    ],
    autoSync: true,
    conflictStrategy: 'prompt'
  };
  private conflicts: ConflictFile[] = [];
  private stats = {
    filesTracked: 0,
    filesIgnored: 0,
    pendingChanges: 0
  };

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public async requestFolderAccess(): Promise<boolean> {
    try {
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API not supported in this browser');
      }

      this.dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });

      logger.info('Folder access granted', { folderName: this.dirHandle.name });
      return true;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        logger.info('Folder selection cancelled by user');
        return false;
      }
      logger.error('Failed to request folder access', error as Error);
      throw error;
    }
  }

  public async syncFolder(): Promise<SyncResult> {
    if (!this.dirHandle) {
      throw createValidationError('No folder selected for sync');
    }

    const activeProject = projectManager.getActiveProject();
    if (!activeProject) {
      throw createValidationError('No active project found');
    }

    await vfsManager.initialize(activeProject.id);

    const result: SyncResult = {
      filesUploaded: 0,
      filesDownloaded: 0,
      filesIgnored: 0,
      conflicts: [],
      errors: []
    };

    try {
      logger.info('Starting folder sync', { 
        direction: this.syncConfig.direction,
        folderName: this.dirHandle.name 
      });

      // Get all files from local directory
      const localFiles = await this.scanLocalDirectory();
      
      // Get all files from VFS edge-functions directory
      const remoteFiles = await vfsManager.listFiles({ 
        directory: 'edge-functions', 
        recursive: true 
      });

      // Create maps for easier lookup
      const localFileMap = new Map<string, File>();
      const remoteFileMap = new Map<string, VFSFile>();

      localFiles.forEach(({ file, relativePath }) => {
        localFileMap.set(relativePath, file);
      });

      remoteFiles.forEach(file => {
        // Remove 'edge-functions/' prefix to match local paths
        const relativePath = file.path.replace('edge-functions/', '');
        remoteFileMap.set(relativePath, file);
      });

      // Find all unique paths
      const allPaths = new Set([...localFileMap.keys(), ...remoteFileMap.keys()]);

      for (const path of allPaths) {
        try {
          const localFile = localFileMap.get(path);
          const remoteFile = remoteFileMap.get(path);

          if (localFile && remoteFile) {
            // File exists in both - check for conflicts
            const localModified = new Date(localFile.lastModified);
            const remoteModified = remoteFile.updatedAt;

            if (Math.abs(localModified.getTime() - remoteModified.getTime()) > 1000) {
              // Potential conflict (more than 1 second difference)
              const localContent = await localFile.text();
              const remoteContent = remoteFile.content;

              if (localContent !== remoteContent) {
                const conflict: ConflictFile = {
                  path,
                  localModified,
                  remoteModified,
                  localContent,
                  remoteContent
                };
                result.conflicts.push(conflict);
                this.conflicts.push(conflict);
                continue;
              }
            }

            // No conflict - sync based on direction and modification time
            if (this.syncConfig.direction === 'upload' || 
                (this.syncConfig.direction === 'bidirectional' && localModified > remoteModified)) {
              await this.uploadFile(path, localFile);
              result.filesUploaded++;
            } else if (this.syncConfig.direction === 'download' || 
                      (this.syncConfig.direction === 'bidirectional' && remoteModified > localModified)) {
              await this.downloadFile(path, remoteFile);
              result.filesDownloaded++;
            }
          } else if (localFile && !remoteFile) {
            // Local file doesn't exist remotely
            if (this.syncConfig.direction === 'upload' || this.syncConfig.direction === 'bidirectional') {
              await this.uploadFile(path, localFile);
              result.filesUploaded++;
            }
          } else if (!localFile && remoteFile) {
            // Remote file doesn't exist locally
            if (this.syncConfig.direction === 'download' || this.syncConfig.direction === 'bidirectional') {
              await this.downloadFile(path, remoteFile);
              result.filesDownloaded++;
            }
          }
        } catch (error) {
          const errorMsg = `Failed to sync ${path}: ${(error as Error).message}`;
          result.errors.push(errorMsg);
          logger.error('Sync error for file', error as Error, { path });
        }
      }

      this.lastSync = new Date();
      this.updateStats();
      
      logger.info('Folder sync completed', result);
      return result;
    } catch (error) {
      logger.error('Folder sync failed', error as Error);
      throw error;
    }
  }

  private async scanLocalDirectory(): Promise<Array<{ file: File, relativePath: string }>> {
    const files: Array<{ file: File, relativePath: string }> = [];
    
    const scanDirectory = async (dirHandle: FileSystemDirectoryHandle, basePath = ''): Promise<void> => {
      for await (const [name, handle] of dirHandle.entries()) {
        const currentPath = basePath ? `${basePath}/${name}` : name;
        
        if (this.shouldIgnoreFile(currentPath)) {
          this.stats.filesIgnored++;
          continue;
        }

        if (handle.kind === 'file') {
          const file = await handle.getFile();
          files.push({ file, relativePath: currentPath });
        } else if (handle.kind === 'directory') {
          await scanDirectory(handle, currentPath);
        }
      }
    };

    await scanDirectory(this.dirHandle!);
    return files;
  }

  private async uploadFile(relativePath: string, file: File): Promise<void> {
    const fullPath = `edge-functions/${relativePath}`;
    const content = await file.text();
    const mimeType = file.type || 'text/plain';

    await vfsManager.createFile(fullPath, content, { mimeType });
    logger.debug('File uploaded', { path: fullPath });
  }

  private async downloadFile(relativePath: string, vfsFile: VFSFile): Promise<void> {
    if (!this.dirHandle) return;

    try {
      const pathParts = relativePath.split('/');
      let currentHandle = this.dirHandle;

      // Create nested directories if they don't exist
      for (let i = 0; i < pathParts.length - 1; i++) {
        try {
          currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: true });
        } catch (error) {
          logger.error('Failed to create directory', error as Error, { dir: pathParts[i] });
          throw error;
        }
      }

      // Create/update the file
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(vfsFile.content);
      await writable.close();

      logger.debug('File downloaded', { path: relativePath });
    } catch (error) {
      logger.error('Failed to download file', error as Error, { path: relativePath });
      throw error;
    }
  }

  private shouldIgnoreFile(path: string): boolean {
    return this.syncConfig.ignorePatterns.some(pattern => {
      // Simple glob pattern matching
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*') // ** matches any path
          .replace(/\*/g, '[^/]*') // * matches any file/folder name
          .replace(/\./g, '\\.')   // Escape dots
      );
      return regex.test(path);
    });
  }

  public async startWatching(): Promise<void> {
    if (!this.dirHandle) {
      throw createValidationError('No folder selected for sync');
    }

    if (this.isActive) {
      return;
    }

    this.isActive = true;
    logger.info('Starting folder sync watching', { 
      interval: '2 seconds',
      autoSync: this.syncConfig.autoSync 
    });

    // Initial sync
    if (this.syncConfig.autoSync) {
      try {
        await this.syncFolder();
      } catch (error) {
        logger.error('Initial sync failed', error as Error);
      }
    }

    // Start periodic sync
    this.syncInterval = setInterval(async () => {
      if (this.syncConfig.autoSync) {
        try {
          await this.detectAndSyncChanges();
        } catch (error) {
          logger.error('Auto sync failed', error as Error);
        }
      }
    }, 2000);
  }

  private async detectAndSyncChanges(): Promise<void> {
    if (!this.dirHandle) return;

    try {
      const localFiles = await this.scanLocalDirectory();
      let hasChanges = false;

      // Check for changes in local files
      for (const { file, relativePath } of localFiles) {
        const lastModified = file.lastModified;
        const previousModified = this.fileSnapshots.get(relativePath);

        if (!previousModified || lastModified > previousModified) {
          hasChanges = true;
          this.fileSnapshots.set(relativePath, lastModified);
        }
      }

      // Check for deleted files
      for (const [path, _] of this.fileSnapshots) {
        const exists = localFiles.some(({ relativePath }) => relativePath === path);
        if (!exists) {
          hasChanges = true;
          this.fileSnapshots.delete(path);
        }
      }

      if (hasChanges) {
        this.stats.pendingChanges++;
        await this.syncFolder();
        this.stats.pendingChanges = Math.max(0, this.stats.pendingChanges - 1);
      }
    } catch (error) {
      logger.error('Change detection failed', error as Error);
    }
  }

  public stopWatching(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isActive = false;
    logger.info('Stopped folder sync watching');
  }

  public async resolveConflict(filePath: string, resolution: 'local' | 'remote' | 'merge', mergedContent?: string): Promise<void> {
    const conflict = this.conflicts.find(c => c.path === filePath);
    if (!conflict) {
      throw createValidationError('Conflict not found');
    }

    try {
      let finalContent: string;

      switch (resolution) {
        case 'local':
          finalContent = conflict.localContent || '';
          break;
        case 'remote':
          finalContent = conflict.remoteContent || '';
          // Also update local file
          if (this.dirHandle) {
            await this.createLocalFile(filePath, finalContent);
          }
          break;
        case 'merge':
          if (!mergedContent) {
            throw createValidationError('Merged content required for merge resolution');
          }
          finalContent = mergedContent;
          // Update both local and remote
          if (this.dirHandle) {
            await this.createLocalFile(filePath, finalContent);
          }
          break;
        default:
          throw createValidationError('Invalid resolution strategy');
      }

      // Update VFS
      const fullPath = `edge-functions/${filePath}`;
      await vfsManager.updateFile(fullPath, finalContent);

      // Remove conflict from list
      this.conflicts = this.conflicts.filter(c => c.path !== filePath);
      
      logger.info('Conflict resolved', { path: filePath, resolution });
    } catch (error) {
      logger.error('Failed to resolve conflict', error as Error, { path: filePath });
      throw error;
    }
  }

  private async createLocalFile(relativePath: string, content: string): Promise<void> {
    if (!this.dirHandle) return;

    const pathParts = relativePath.split('/');
    let currentHandle = this.dirHandle;

    // Create directories
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(pathParts[i], { create: true });
    }

    // Create file
    const fileName = pathParts[pathParts.length - 1];
    const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private updateStats(): void {
    this.stats.filesTracked = this.fileSnapshots.size;
    this.stats.pendingChanges = 0; // Reset after sync
  }

  public getSyncStatus(): SyncStatus {
    return {
      isActive: this.isActive,
      lastSync: this.lastSync,
      filesTracked: this.stats.filesTracked,
      filesIgnored: this.stats.filesIgnored,
      pendingChanges: this.stats.pendingChanges,
      folderPath: this.dirHandle?.name || '',
      direction: this.syncConfig.direction,
      conflicts: [...this.conflicts]
    };
  }

  public setSyncConfig(config: Partial<SyncConfig>): void {
    this.syncConfig = { ...this.syncConfig, ...config };
    logger.info('Sync config updated', this.syncConfig);
  }

  public getSyncConfig(): SyncConfig {
    return { ...this.syncConfig };
  }

  public hasFileSystemSupport(): boolean {
    return 'showDirectoryPicker' in window;
  }
}

// Export singleton instance
export const syncManager = SyncManager.getInstance();