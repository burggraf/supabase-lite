/**
 * Supabase Storage TypeScript Type Definitions
 * 
 * Compatible with @supabase/storage-js types for drop-in replacement
 */

export interface BucketOptions {
  public?: boolean
  fileSizeLimit?: number
  allowedMimeTypes?: string[]
  avifAutodetection?: boolean
}

export interface Bucket {
  id: string
  name: string
  owner?: string
  public: boolean
  created_at: string
  updated_at: string
  file_size_limit?: number
  allowed_mime_types?: string[]
  avif_autodetection?: boolean
}

export interface StorageObject {
  id: string
  name: string
  bucket_id: string
  owner?: string
  created_at: string
  updated_at: string
  last_accessed_at?: string
  metadata?: Record<string, any>
  size?: number
  etag?: string
  version?: string
}

export interface FileObject {
  name: string
  id?: string
  updated_at?: string
  created_at?: string
  last_accessed_at?: string
  metadata?: Record<string, any>
  size?: number
  etag?: string
  version?: string
}

export interface UploadOptions {
  cacheControl?: string
  contentType?: string
  upsert?: boolean
  metadata?: Record<string, any>
  duplex?: 'half'
}

export interface ListOptions {
  limit?: number
  offset?: number
  sortBy?: {
    column: 'name' | 'id' | 'updated_at' | 'created_at' | 'last_accessed_at'
    order: 'asc' | 'desc'
  }
  search?: string
  prefix?: string
}

export interface SignedUrlOptions {
  expiresIn: number
  transform?: ImageTransformOptions
}

export interface ImageTransformOptions {
  width?: number
  height?: number
  resize?: 'cover' | 'contain' | 'fill'
  format?: 'origin' | 'webp'
  quality?: number
}

// Response Types
export interface StorageResponse<T = any> {
  data: T | null
  error: StorageError | null
}

export interface BucketResponse extends StorageResponse<Bucket> {}

export interface UploadResponse extends StorageResponse<{
  id: string
  path: string
  fullPath: string
}> {}

export interface DownloadResponse extends StorageResponse<Blob> {}

export interface ListResponse extends StorageResponse<FileObject[]> {}

export interface SignedUrlResponse extends StorageResponse<{
  signedUrl: string
}> {}

export interface SignedUploadUrlResponse extends StorageResponse<{
  signedUrl: string
  token: string
  path: string
}> {}

export interface PublicUrlResponse {
  data: {
    publicUrl: string
  }
}

export interface MoveResponse extends StorageResponse<{
  message: string
}> {}

export interface CopyResponse extends StorageResponse<{
  path: string
}> {}

export interface RemoveResponse extends StorageResponse<FileObject[]> {}

// Error Types
export class StorageError extends Error {
  statusCode?: number
  
  constructor(message: string, statusCode?: number) {
    super(message)
    this.name = 'StorageError'
    this.statusCode = statusCode
  }
}

export interface StorageClientOptions {
  apiUrl: string
  apiKey: string
  headers?: Record<string, string>
}

// Internal Types
export interface UserContext {
  userId?: string
  role: string
  jwt?: string
}

export interface ProjectContext {
  projectId: string
}