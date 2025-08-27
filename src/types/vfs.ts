// Virtual File System (VFS) Type Definitions
// Following Supabase Lite patterns for type safety and consistency

export interface VFSFile {
  /** Unique file identifier */
  id: string;
  /** Project ID for isolation */
  projectId: string;
  /** Full file path (normalized with forward slashes) */
  path: string;
  /** File name only */
  name: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** File content (for small files < 1MB) */
  content?: string;
  /** Whether file is chunked for large files */
  chunked: boolean;
  /** Chunk IDs for large files */
  chunkIds?: string[];
  /** File creation timestamp */
  createdAt: Date;
  /** File last modification timestamp */
  updatedAt: Date;
  /** Directory path (parent directory) */
  directory: string;
  /** File encoding for text files */
  encoding?: 'utf-8' | 'base64';
  /** Compression used for storage */
  compression?: 'gzip' | 'none';
  /** File hash for deduplication and integrity */
  hash?: string;
}

export interface VFSFileChunk {
  /** Unique chunk identifier */
  id: string;
  /** Parent file ID */
  fileId: string;
  /** Chunk sequence number */
  sequence: number;
  /** Chunk content */
  content: string;
  /** Chunk size in bytes */
  size: number;
  /** Chunk creation timestamp */
  createdAt: Date;
}

export interface VFSDirectory {
  /** Directory path */
  path: string;
  /** Directory name */
  name: string;
  /** Child file paths */
  children: string[];
  /** Directory creation timestamp */
  createdAt: Date;
  /** Project ID for isolation */
  projectId: string;
  /** Parent directory path */
  parent?: string;
}

export interface VFSProjectMetadata {
  /** Project ID */
  projectId: string;
  /** Total storage used in bytes */
  storageUsed: number;
  /** Number of files */
  fileCount: number;
  /** Last modification timestamp */
  lastModified: Date;
  /** VFS configuration for this project */
  config: VFSProjectConfig;
  /** Storage version for migrations */
  version: number;
}

export interface VFSProjectConfig {
  /** Maximum file size in bytes */
  maxFileSize: number;
  /** Maximum total storage per project in bytes */
  maxStorage: number;
  /** Compression enabled for text files */
  compressionEnabled: boolean;
  /** File chunking threshold in bytes */
  chunkThreshold: number;
  /** Chunk size for large files */
  chunkSize: number;
  /** Auto-cleanup orphaned chunks */
  autoCleanup: boolean;
}

export interface VFSStats {
  /** Total files in project */
  totalFiles: number;
  /** Total directories in project */
  totalDirectories: number;
  /** Total storage used in bytes */
  totalSize: number;
  /** Storage quota percentage used */
  quotaUsage: number;
  /** Largest file size */
  largestFile: number;
  /** Number of chunked files */
  chunkedFiles: number;
  /** Number of compressed files */
  compressedFiles: number;
}

export interface VFSOperationResult {
  /** Operation success status */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Operation result data */
  data?: any;
  /** Operation duration in milliseconds */
  duration?: number;
  /** Operation type for logging */
  operation: VFSOperation;
}

export type VFSOperation = 
  | 'createFile'
  | 'readFile'
  | 'updateFile'
  | 'deleteFile'
  | 'listFiles'
  | 'createDirectory'
  | 'deleteDirectory'
  | 'getStats'
  | 'switchProject'
  | 'cleanup';

export interface VFSListOptions {
  /** Directory to list (defaults to root) */
  directory?: string;
  /** Include subdirectories recursively */
  recursive?: boolean;
  /** Filter by file extension */
  extension?: string;
  /** Filter by MIME type */
  mimeType?: string;
  /** Sort order */
  sort?: 'name' | 'size' | 'created' | 'modified';
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Limit number of results */
  limit?: number;
  /** Skip number of results */
  offset?: number;
}

export interface VFSCreateFileOptions {
  /** File content */
  content: string;
  /** MIME type (auto-detected if not provided) */
  mimeType?: string;
  /** File encoding */
  encoding?: 'utf-8' | 'base64';
  /** Original file size (for base64 files, this should be the decoded size) */
  originalSize?: number;
  /** Override compression setting */
  compress?: boolean;
  /** Create parent directories if they don't exist */
  createDirectories?: boolean;
  /** Additional file metadata */
  metadata?: Record<string, any>;
}

export interface VFSUpdateFileOptions {
  /** New file content */
  content?: string;
  /** Updated MIME type */
  mimeType?: string;
  /** Override compression setting */
  compress?: boolean;
}

export interface VFSError {
  /** Error code */
  code: VFSErrorCode;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, any>;
  /** Original error if available */
  cause?: Error;
}

export type VFSErrorCode =
  | 'VFS_FILE_NOT_FOUND'
  | 'VFS_FILE_EXISTS'
  | 'VFS_DIRECTORY_NOT_FOUND'
  | 'VFS_DIRECTORY_NOT_EMPTY'
  | 'VFS_INVALID_PATH'
  | 'VFS_INVALID_NAME'
  | 'VFS_FILE_TOO_LARGE'
  | 'VFS_STORAGE_QUOTA_EXCEEDED'
  | 'VFS_STORAGE_ERROR'
  | 'VFS_PROJECT_NOT_FOUND'
  | 'VFS_PERMISSION_DENIED'
  | 'VFS_OPERATION_FAILED'
  | 'VFS_CHUNK_MISSING'
  | 'VFS_CORRUPTION_DETECTED';

export interface VFSProgressCallback {
  /** Progress callback function */
  (progress: VFSProgress): void;
}

export interface VFSProgress {
  /** Operation type */
  operation: VFSOperation;
  /** Current progress (0-100) */
  progress: number;
  /** Current step description */
  step: string;
  /** Total bytes to process */
  totalBytes?: number;
  /** Bytes processed so far */
  processedBytes?: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
  /** Operation can be cancelled */
  cancellable: boolean;
}

// IndexedDB Schema Types
export interface VFSIndexedDBSchema {
  files: VFSFile;
  chunks: VFSFileChunk;
  metadata: VFSProjectMetadata;
}

// Event Types for VFS Manager
export interface VFSEvent {
  type: VFSEventType;
  projectId: string;
  data?: any;
  timestamp: Date;
}

export type VFSEventType =
  | 'fileCreated'
  | 'fileUpdated'
  | 'fileDeleted'
  | 'directoryCreated'
  | 'directoryDeleted'
  | 'projectSwitched'
  | 'storageWarning'
  | 'storageError';

// React Hook Types
export interface UseVFSResult {
  /** Whether VFS is initialized */
  isInitialized: boolean;
  /** Whether VFS is currently performing operations */
  isLoading: boolean;
  /** Current error if any */
  error: VFSError | null;
  /** Current project ID */
  projectId: string | null;
  /** VFS statistics */
  stats: VFSStats | null;
  /** File operations */
  operations: VFSOperations;
}

export interface VFSOperations {
  /** Create a new file */
  createFile: (path: string, options: VFSCreateFileOptions) => Promise<VFSFile>;
  /** Read a file */
  readFile: (path: string) => Promise<VFSFile | null>;
  /** Update an existing file */
  updateFile: (path: string, content: string) => Promise<VFSFile>;
  /** Delete a file */
  deleteFile: (path: string) => Promise<boolean>;
  /** List files and directories */
  listFiles: (options?: VFSListOptions) => Promise<VFSFile[]>;
  /** Create a directory */
  createDirectory: (path: string) => Promise<VFSDirectory>;
  /** Delete a directory */
  deleteDirectory: (path: string, recursive?: boolean) => Promise<boolean>;
  /** Get VFS statistics */
  getStats: () => Promise<VFSStats>;
  /** Switch to different project */
  switchProject: (projectId: string) => Promise<void>;
  /** Cleanup orphaned data */
  cleanup: () => Promise<void>;
}

// Storage Bucket Types
export interface VFSBucket {
  /** Bucket identifier */
  id: string;
  /** Bucket name */
  name: string;
  /** Project ID this bucket belongs to */
  projectId: string;
  /** Whether bucket is public (allows anonymous access) */
  isPublic: boolean;
  /** Maximum file size allowed in this bucket (bytes) */
  maxFileSize?: number;
  /** Allowed MIME types (empty array = all allowed) */
  allowedMimeTypes: string[];
  /** File count in bucket */
  fileCount: number;
  /** Total size of files in bucket (bytes) */
  totalSize: number;
  /** Bucket creation timestamp */
  createdAt: Date;
  /** Bucket last modification timestamp */
  updatedAt: Date;
  /** Additional bucket metadata */
  metadata?: Record<string, any>;
}

export interface VFSBucketOptions {
  /** Whether bucket should be public */
  isPublic?: boolean;
  /** Maximum file size for this bucket */
  maxFileSize?: number;
  /** Allowed MIME types */
  allowedMimeTypes?: string[];
  /** Additional metadata */
  metadata?: Record<string, any>;
}

// Extend VFS operations to include bucket management
export interface VFSBucketOperations {
  /** Create a new bucket */
  createBucket: (name: string, options?: VFSBucketOptions) => Promise<VFSBucket>;
  /** Get bucket information */
  getBucket: (name: string) => Promise<VFSBucket | null>;
  /** List all buckets */
  listBuckets: () => Promise<VFSBucket[]>;
  /** Update bucket configuration */
  updateBucket: (name: string, options: Partial<VFSBucketOptions>) => Promise<VFSBucket>;
  /** Delete a bucket */
  deleteBucket: (name: string, force?: boolean) => Promise<boolean>;
}