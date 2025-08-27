// VFS Constants and Configuration
// Following Supabase Lite patterns for configuration management

import type { VFSProjectConfig, VFSErrorCode } from '../../types/vfs.js';

// Storage Configuration
export const VFS_CONFIG = {
  // Database and Storage
  STORAGE_PREFIX: 'vfs_project_',
  DB_VERSION: 1,
  
  // File Size Limits (in bytes)
  MAX_FILE_SIZE: 10 * 1024 * 1024,        // 10MB per file
  MAX_PROJECT_STORAGE: 100 * 1024 * 1024, // 100MB per project
  CHUNK_THRESHOLD: 1 * 1024 * 1024,       // 1MB - files larger than this get chunked
  CHUNK_SIZE: 64 * 1024,                  // 64KB chunk size
  
  // Performance and Storage
  STORAGE_WARNING_THRESHOLD: 0.8,         // Warn at 80% storage usage
  STORAGE_CRITICAL_THRESHOLD: 0.95,       // Block new files at 95% storage
  MAX_FILES_PER_PROJECT: 10000,           // Maximum files per project
  
  // Operation Timeouts (in milliseconds)
  OPERATION_TIMEOUT: 30000,               // 30 seconds
  LARGE_FILE_TIMEOUT: 120000,             // 2 minutes for large files
  
  // Caching
  CACHE_MAX_SIZE: 50 * 1024 * 1024,       // 50MB cache
  CACHE_MAX_ENTRIES: 1000,                // Max cached files
  CACHE_TTL: 5 * 60 * 1000,               // 5 minutes TTL
  
  // Performance Benchmarks
  TARGET_OPERATION_TIME: 100,             // Target < 100ms for small files
  TARGET_LARGE_OPERATION_TIME: 5000,      // Target < 5s for large files
} as const;

// Default VFS Project Configuration
export const DEFAULT_VFS_CONFIG: VFSProjectConfig = {
  maxFileSize: VFS_CONFIG.MAX_FILE_SIZE,
  maxStorage: VFS_CONFIG.MAX_PROJECT_STORAGE,
  compressionEnabled: true,
  chunkThreshold: VFS_CONFIG.CHUNK_THRESHOLD,
  chunkSize: VFS_CONFIG.CHUNK_SIZE,
  autoCleanup: true,
} as const;

// VFS Error Codes with Messages
export const VFS_ERROR_CODES: Record<VFSErrorCode, string> = {
  VFS_FILE_NOT_FOUND: 'File not found',
  VFS_FILE_EXISTS: 'File already exists',
  VFS_DIRECTORY_NOT_FOUND: 'Directory not found',
  VFS_DIRECTORY_NOT_EMPTY: 'Directory is not empty',
  VFS_INVALID_PATH: 'Invalid file path',
  VFS_INVALID_NAME: 'Invalid file name',
  VFS_FILE_TOO_LARGE: 'File size exceeds maximum limit',
  VFS_STORAGE_QUOTA_EXCEEDED: 'Project storage quota exceeded',
  VFS_STORAGE_ERROR: 'Storage operation failed',
  VFS_PROJECT_NOT_FOUND: 'Project not found',
  VFS_PERMISSION_DENIED: 'Operation not permitted',
  VFS_OPERATION_FAILED: 'Operation failed',
  VFS_CHUNK_MISSING: 'File chunk missing or corrupted',
  VFS_CORRUPTION_DETECTED: 'Data corruption detected',
} as const;

// MIME Type Detection Map
export const MIME_TYPE_MAP: Record<string, string> = {
  // Text Files
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.toml': 'text/plain',
  '.ini': 'text/plain',
  '.cfg': 'text/plain',
  '.conf': 'text/plain',
  '.log': 'text/plain',
  
  // Web Files
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.jsx': 'text/javascript',
  '.vue': 'text/html',
  '.svelte': 'text/html',
  
  // Programming Languages
  '.py': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.php': 'text/x-php',
  '.java': 'text/x-java-source',
  '.c': 'text/x-c',
  '.cpp': 'text/x-c++',
  '.h': 'text/x-c',
  '.cs': 'text/x-csharp',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
  '.swift': 'text/x-swift',
  '.kt': 'text/x-kotlin',
  '.scala': 'text/x-scala',
  '.clj': 'text/x-clojure',
  '.sql': 'text/x-sql',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.zsh': 'text/x-shellscript',
  '.fish': 'text/x-shellscript',
  
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Archives
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  
  // Audio/Video
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  
  // Fonts
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.eot': 'application/vnd.ms-fontobject',
  
  // Data
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.rss': 'application/rss+xml',
  '.atom': 'application/atom+xml',
  
} as const;

// Compressible MIME Types (text-based files that benefit from compression)
export const COMPRESSIBLE_MIME_TYPES = new Set([
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/typescript',
  'text/markdown',
  'text/yaml',
  'application/json',
  'application/xml',
  'text/csv',
  'text/x-python',
  'text/x-java-source',
  'text/x-c',
  'text/x-c++',
  'text/x-csharp',
  'text/x-go',
  'text/x-rust',
  'text/x-swift',
  'text/x-kotlin',
  'text/x-scala',
  'text/x-clojure',
  'text/x-sql',
  'text/x-shellscript',
  'image/svg+xml',
]);

// Binary file extensions (files that should not be compressed)
export const BINARY_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico',
  '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.avi', '.mov',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.exe', '.dll', '.so', '.dylib',
  '.bin', '.dat', '.db', '.sqlite',
]);

// Path Validation Patterns
export const PATH_PATTERNS = {
  // Valid file/directory name (no special chars except . - _)
  VALID_NAME: /^[a-zA-Z0-9._-]+$/,
  
  // Valid file path (forward slashes, no double slashes, no leading/trailing slashes)
  VALID_PATH: /^[a-zA-Z0-9._/-]+$/,
  
  // Reserved names that cannot be used
  RESERVED_NAMES: new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
    '.', '..', '',
  ]),
  
  // Maximum path length
  MAX_PATH_LENGTH: 260,
  MAX_NAME_LENGTH: 255,
} as const;

// IndexedDB Object Store Names
export const OBJECT_STORES = {
  FILES: 'files',
  CHUNKS: 'chunks', 
  METADATA: 'metadata',
} as const;

// IndexedDB Indexes
export const INDEXES = {
  FILES: {
    BY_DIRECTORY: 'directory',
    BY_CREATED_AT: 'createdAt',
    BY_UPDATED_AT: 'updatedAt',
    BY_SIZE: 'size',
    BY_MIME_TYPE: 'mimeType',
  },
  CHUNKS: {
    BY_FILE_ID: 'fileId',
    BY_SEQUENCE: 'sequence',
  },
} as const;

// VFS Manager Events
export const VFS_EVENTS = {
  FILE_CREATED: 'fileCreated',
  FILE_UPDATED: 'fileUpdated', 
  FILE_DELETED: 'fileDeleted',
  DIRECTORY_CREATED: 'directoryCreated',
  DIRECTORY_DELETED: 'directoryDeleted',
  PROJECT_SWITCHED: 'projectSwitched',
  STORAGE_WARNING: 'storageWarning',
  STORAGE_ERROR: 'storageError',
} as const;

// Utility Functions
export const UTILS = {
  /**
   * Get MIME type from file extension
   */
  getMimeType: (filename: string): string => {
    const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
    return MIME_TYPE_MAP[ext] || 'application/octet-stream';
  },
  
  /**
   * Check if file should be compressed
   */
  shouldCompress: (mimeType: string): boolean => {
    return COMPRESSIBLE_MIME_TYPES.has(mimeType);
  },
  
  /**
   * Check if file is binary
   */
  isBinary: (filename: string): boolean => {
    const ext = filename.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
    return BINARY_EXTENSIONS.has(ext);
  },
  
  /**
   * Normalize file path
   */
  normalizePath: (path: string): string => {
    return path
      .replace(/\\/g, '/') // Convert backslashes to forward slashes
      .replace(/\/+/g, '/') // Remove duplicate slashes
      .replace(/^\/+|\/+$/g, '') // Remove leading and trailing slashes
      .trim();
  },
  
  /**
   * Validate file name
   */
  isValidName: (name: string): boolean => {
    if (!name || name.length > PATH_PATTERNS.MAX_NAME_LENGTH) return false;
    if (PATH_PATTERNS.RESERVED_NAMES.has(name.toUpperCase())) return false;
    return PATH_PATTERNS.VALID_NAME.test(name);
  },
  
  /**
   * Validate file path
   */
  isValidPath: (path: string): boolean => {
    const normalized = UTILS.normalizePath(path);
    if (normalized.length > PATH_PATTERNS.MAX_PATH_LENGTH) return false;
    
    const parts = normalized.split('/');
    return parts.every(part => UTILS.isValidName(part));
  },
  
  /**
   * Get directory from file path
   */
  getDirectory: (path: string): string => {
    const normalized = UTILS.normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(0, lastSlash) : '';
  },
  
  /**
   * Get filename from path
   */
  getFilename: (path: string): string => {
    const normalized = UTILS.normalizePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
  },
  
  /**
   * Format file size for display
   */
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  },
} as const;