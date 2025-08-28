import { vfsManager } from './VFSManager';
import { projectManager } from '../projects/ProjectManager';
import type { VFSCreateFileOptions } from '@/types/vfs';
import { logger } from '../infrastructure/Logger';

export interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

export interface UploadOptions {
  ignorePatterns?: string[]; // .gitignore style patterns
  maxFileSize?: number; // in bytes
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Service for uploading folders to VFS
 * Supports both File System Access API and file input methods
 */
export class FolderUploadService {
  private defaultIgnorePatterns = [
    'node_modules/**',
    '.git/**',
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '.env*',
    '.vscode/**',
    '.idea/**',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    '.cache/**',
    'coverage/**'
  ];

  /**
   * Upload files from File System Access API directory handle
   */
  async uploadFromDirectoryHandle(
    dirHandle: FileSystemDirectoryHandle,
    targetPath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    // Get current project
    const activeProject = projectManager.getActiveProject();
    if (!activeProject) {
      throw new Error('No active project found');
    }
    
    // Ensure VFS is initialized
    await vfsManager.initialize(activeProject.id);
    
    // First pass: collect all files
    const files: { handle: FileSystemFileHandle; path: string }[] = [];
    
    await this.collectFilesFromDirectory(dirHandle, '', files);
    
    // Filter files based on ignore patterns
    const filteredFiles = this.filterFiles(files.map(f => f.path));
    const filesToUpload = files.filter(f => filteredFiles.includes(f.path));

    logger.info('Starting folder upload', { 
      totalFiles: filesToUpload.length,
      targetPath,
      folderName: dirHandle.name 
    });

    // Find the common root directory to strip
    const commonRoot = this.findCommonRootDirectory(filesToUpload.map(f => f.path));
    
    // Upload files with progress tracking
    const progress: UploadProgress = { uploaded: 0, total: filesToUpload.length };
    
    for (let i = 0; i < filesToUpload.length; i++) {
      const { handle, path: relativePath } = filesToUpload[i];
      
      // Strip only the common root directory, preserve subdirectories
      let finalPath = relativePath;
      if (commonRoot && relativePath.startsWith(commonRoot + '/')) {
        finalPath = relativePath.substring(commonRoot.length + 1);
      } else if (commonRoot === relativePath) {
        // If the file is exactly the common root, keep just the filename
        const pathParts = relativePath.split('/');
        finalPath = pathParts[pathParts.length - 1];
      }
      
      const fullPath = `${targetPath}/${finalPath}`;
      
      console.log('📁 Upload path debug:', {
        originalPath: relativePath,
        commonRoot,
        finalPath,
        fullPath,
        targetPath
      });
      
      progress.currentFile = relativePath;
      onProgress?.(progress);
      
      try {
        await this.uploadSingleFile(handle, fullPath);
        progress.uploaded = i + 1;
        onProgress?.(progress);
      } catch (error) {
        logger.error('Failed to upload file', error as Error, { 
          path: fullPath,
          relativePath 
        });
        throw new Error(`Failed to upload ${relativePath}: ${(error as Error).message}`);
      }
    }

    logger.info('Folder upload completed', { 
      uploadedFiles: progress.uploaded,
      targetPath 
    });
  }

  /**
   * Upload files from FileList (drag and drop or file input)
   */
  async uploadFromFileList(
    files: FileList,
    targetPath: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    // Get current project
    const activeProject = projectManager.getActiveProject();
    if (!activeProject) {
      throw new Error('No active project found');
    }
    
    // Ensure VFS is initialized
    await vfsManager.initialize(activeProject.id);
    
    const fileArray = Array.from(files);
    
    // Extract relative paths and filter
    const filePaths = fileArray.map(file => 
      file.webkitRelativePath || file.name
    );
    const filteredPaths = this.filterFiles(filePaths);
    const filesToUpload = fileArray.filter((_file, index) => 
      filteredPaths.includes(filePaths[index])
    );

    logger.info('Starting file list upload', { 
      totalFiles: filesToUpload.length,
      targetPath 
    });

    const progress: UploadProgress = { uploaded: 0, total: filesToUpload.length };
    
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const relativePath = file.webkitRelativePath || file.name;
      
      // Handle path structure properly for file list uploads
      const pathParts = relativePath.split('/');
      let finalPath: string;
      
      if (pathParts.length > 1) {
        // Multi-level path like "dist/index.html" -> "index.html"
        finalPath = pathParts.slice(1).join('/');
      } else {
        // Single file at root like "index.html" -> "index.html"
        finalPath = relativePath;
      }
      
      const fullPath = `${targetPath}/${finalPath}`;
      
      console.log('📁 FileList upload path debug:', {
        originalPath: relativePath,
        pathParts,
        finalPath,
        fullPath,
        targetPath
      });
      
      progress.currentFile = relativePath;
      onProgress?.(progress);
      
      try {
        await this.uploadFileFromBlob(file, fullPath);
        progress.uploaded = i + 1;
        onProgress?.(progress);
      } catch (error) {
        logger.error('Failed to upload file', error as Error, { 
          path: fullPath,
          fileName: file.name 
        });
        throw new Error(`Failed to upload ${relativePath}: ${(error as Error).message}`);
      }
    }

    logger.info('File list upload completed', { 
      uploadedFiles: progress.uploaded,
      targetPath 
    });
  }

  /**
   * Recursively collect files from a directory handle
   */
  private async collectFilesFromDirectory(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string,
    files: { handle: FileSystemFileHandle; path: string }[]
  ): Promise<void> {
    // @ts-ignore - File System Access API not fully typed
    for await (const [name, entry] of dirHandle.entries()) {
      const fullPath = currentPath ? `${currentPath}/${name}` : name;
      
      if (entry.kind === 'file') {
        files.push({ 
          handle: entry as FileSystemFileHandle, 
          path: fullPath 
        });
      } else if (entry.kind === 'directory') {
        await this.collectFilesFromDirectory(
          entry as FileSystemDirectoryHandle,
          fullPath,
          files
        );
      }
    }
  }

  /**
   * Upload a single file from File System Access API
   */
  private async uploadSingleFile(
    fileHandle: FileSystemFileHandle,
    targetPath: string
  ): Promise<void> {
    const file = await fileHandle.getFile();
    await this.uploadFileFromBlob(file, targetPath);
  }

  /**
   * Upload a file from a Blob (File or other Blob object)
   */
  private async uploadFileFromBlob(
    file: Blob,
    targetPath: string
  ): Promise<void> {
    const fileName = (file as File).name || targetPath.split('/').pop() || 'unknown';
    const mimeType = file.type || this.getMimeTypeFromExtension(fileName);
    
    let content: string;
    let encoding: 'utf-8' | 'base64' = 'utf-8';
    
    // Determine if this is a text or binary file
    if (this.isTextFile(mimeType)) {
      // Text files - store as UTF-8
      content = await file.text();
      encoding = 'utf-8';
    } else {
      // Binary files - store as base64
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('');
      content = btoa(binaryString);
      encoding = 'base64';
    }

    const options: VFSCreateFileOptions = {
      content,
      mimeType,
      encoding,
      originalSize: file.size, // Store the actual file size for proper display
    };

    // Check if file already exists and delete it first
    const existingFile = await vfsManager.readFile(targetPath);
    if (existingFile) {
      await vfsManager.deleteFile(targetPath);
    }

    await vfsManager.createFile(targetPath, options);
  }

  /**
   * Filter files based on ignore patterns
   */
  private filterFiles(filePaths: string[]): string[] {
    return filePaths.filter(path => {
      // Check against ignore patterns
      for (const pattern of this.defaultIgnorePatterns) {
        if (this.matchesPattern(path, pattern)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Find the common root directory from a list of file paths
   */
  private findCommonRootDirectory(paths: string[]): string | null {
    if (paths.length === 0) return null;
    if (paths.length === 1) {
      const pathParts = paths[0].split('/');
      return pathParts.length > 1 ? pathParts[0] : null;
    }
    
    // Find the longest common prefix
    const firstPath = paths[0].split('/');
    let commonPrefixLength = 0;
    
    for (let i = 0; i < firstPath.length; i++) {
      const segment = firstPath[i];
      const allMatch = paths.every(path => {
        const pathParts = path.split('/');
        return pathParts.length > i && pathParts[i] === segment;
      });
      
      if (allMatch) {
        commonPrefixLength = i + 1;
      } else {
        break;
      }
    }
    
    if (commonPrefixLength > 0 && commonPrefixLength < firstPath.length) {
      // Only return a common root if it's not the entire path for all files
      return firstPath.slice(0, commonPrefixLength).join('/');
    }
    
    return null;
  }

  /**
   * Check if a path matches a glob-like pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any filename chars
      .replace(/\./g, '\\.')   // Escape dots
      .replace(/\?/g, '.');    // ? matches single char
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Determine if a MIME type represents a text file
   */
  private isTextFile(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/typescript' ||
      mimeType === 'application/x-javascript' ||
      mimeType.includes('xml') ||
      mimeType.includes('json')
    );
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(fileName: string): string {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    
    const mimeTypes: Record<string, string> = {
      // Text files
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'mjs': 'application/javascript',
      'ts': 'application/typescript',
      'jsx': 'application/javascript',
      'tsx': 'application/typescript',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'svg': 'image/svg+xml',
      
      // Images
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'ico': 'image/x-icon',
      'bmp': 'image/bmp',
      
      // Fonts
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
      'otf': 'font/otf',
      
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'oga': 'audio/ogg',
      
      // Video
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'ogv': 'video/ogg',
      
      // Archives
      'zip': 'application/zip',
      'tar': 'application/x-tar',
      'gz': 'application/gzip',
      
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }
}