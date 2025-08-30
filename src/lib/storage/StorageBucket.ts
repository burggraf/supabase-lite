/**
 * StorageBucket - File operations for a specific storage bucket
 * Compatible with @supabase/storage-js StorageBucket
 */

import { StorageError } from './StorageError'
import { vfsManager } from '../vfs/VFSManager'
import type {
  UploadOptions,
  UploadResponse,
  DownloadResponse,
  ListOptions,
  ListResponse,
  SignedUrlOptions,
  SignedUrlResponse,
  SignedUploadUrlResponse,
  PublicUrlResponse,
  MoveResponse,
  CopyResponse,
  RemoveResponse,
  FileObject,
  ImageTransformOptions
} from './types'

export class StorageBucket {
  constructor(
    private bucketId: string,
    private apiUrl: string,
    private headers: Record<string, string>
  ) {}

  /**
   * Get the bucket ID
   */
  get id(): string {
    return this.bucketId
  }

  /**
   * Uploads a file to the bucket
   */
  async upload(
    path: string,
    file: File | Blob | ArrayBuffer | Uint8Array,
    options: UploadOptions = {}
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData()
      
      // Convert different file types to appropriate format
      let fileBlob: Blob
      if (file instanceof File || file instanceof Blob) {
        fileBlob = file
      } else if (file instanceof ArrayBuffer) {
        fileBlob = new Blob([file])
      } else if (file instanceof Uint8Array) {
        fileBlob = new Blob([file])
      } else {
        throw new StorageError('Invalid file type')
      }
      
      formData.append('file', fileBlob)

      const headers = { ...this.headers }
      // Let browser set Content-Type with boundary for multipart
      delete headers['Content-Type']

      // Add optional headers
      if (options.cacheControl) {
        headers['cache-control'] = options.cacheControl
      }
      
      if (options.contentType) {
        headers['content-type'] = options.contentType
      }
      
      if (options.upsert) {
        headers['x-upsert'] = 'true'
      }
      
      if (options.metadata) {
        headers['x-metadata'] = JSON.stringify(options.metadata)
      }

      if (options.duplex) {
        headers['duplex'] = options.duplex
      }

      const response = await fetch(`${this.apiUrl}/storage/v1/object/${this.bucketId}/${path}`, {
        method: 'POST',
        headers,
        body: formData
      })

      return this.handleResponse<UploadResponse['data']>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Downloads a file from the bucket
   */
  async download(path: string): Promise<DownloadResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/object/${this.bucketId}/${path}`, {
        method: 'GET',
        headers: this.headers
      })

      if (!response.ok) {
        const error = StorageError.fromResponse(response, 'Failed to download file')
        return { data: null, error }
      }

      const responseBlob = await response.blob()
      return { data: responseBlob, error: null }
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Lists files in the bucket
   */
  async list(
    path: string = '',
    options: ListOptions = {}
  ): Promise<ListResponse> {
    try {
      const params = new URLSearchParams()

      if (path) params.append('prefix', path)
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.offset) params.append('offset', options.offset.toString())
      if (options.search) params.append('search', options.search)
      if (options.sortBy) {
        params.append('sortBy', `${options.sortBy.column}:${options.sortBy.order}`)
      }

      const response = await fetch(
        `${this.apiUrl}/storage/v1/object/list/${this.bucketId}?${params}`,
        {
          method: 'GET',
          headers: this.headers
        }
      )

      return this.handleResponse<FileObject[]>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Updates/replaces a file in the bucket
   */
  async update(
    path: string,
    file: File | Blob | ArrayBuffer | Uint8Array,
    options: UploadOptions = {}
  ): Promise<UploadResponse> {
    return this.upload(path, file, { ...options, upsert: true })
  }

  /**
   * Moves a file within the bucket
   */
  async move(fromPath: string, toPath: string): Promise<MoveResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/object/move`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          bucketId: this.bucketId,
          sourceKey: fromPath,
          destinationKey: toPath
        })
      })

      return this.handleResponse<MoveResponse['data']>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Copies a file within the bucket
   */
  async copy(fromPath: string, toPath: string): Promise<CopyResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/object/copy`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          bucketId: this.bucketId,
          sourceKey: fromPath,
          destinationKey: toPath
        })
      })

      return this.handleResponse<CopyResponse['data']>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Removes files from the bucket
   */
  async remove(paths: string[]): Promise<RemoveResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/object/${this.bucketId}`, {
        method: 'DELETE',
        headers: this.headers,
        body: JSON.stringify({ prefixes: paths })
      })

      return this.handleResponse<FileObject[]>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Creates a signed URL for private file access
   */
  async createSignedUrl(
    path: string,
    expiresIn: number,
    options?: { transform?: ImageTransformOptions }
  ): Promise<SignedUrlResponse> {
    try {
      const body: any = { expiresIn }
      
      if (options?.transform) {
        body.transform = options.transform
      }

      const response = await fetch(`${this.apiUrl}/storage/v1/object/sign/${this.bucketId}/${path}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body)
      })

      return this.handleResponse<SignedUrlResponse['data']>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Creates multiple signed URLs at once
   */
  async createSignedUrls(
    paths: string[],
    expiresIn: number
  ): Promise<{ data: SignedUrlResponse['data'][] | null; error: StorageError | null }> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/object/sign/${this.bucketId}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ paths, expiresIn })
      })

      return this.handleResponse<SignedUrlResponse['data'][]>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Gets a public URL for a file (no authentication required)
   */
  getPublicUrl(path: string, options?: { transform?: ImageTransformOptions }): PublicUrlResponse {
    let url = `${this.apiUrl}/storage/v1/object/public/${this.bucketId}/${path}`
    
    if (options?.transform) {
      const params = new URLSearchParams()
      Object.entries(options.transform).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString())
        }
      })
      if (params.toString()) {
        url += `?${params.toString()}`
      }
    }

    return {
      data: { publicUrl: url }
    }
  }


  /**
   * Creates a signed URL for uploading files directly to storage
   */
  async createSignedUploadUrl(path: string): Promise<SignedUploadUrlResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/object/upload/sign/${this.bucketId}/${path}`, {
        method: 'POST',
        headers: this.headers
      })

      return this.handleResponse<SignedUploadUrlResponse['data']>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Helper method to handle API responses
   */
  private async handleResponse<T>(response: Response): Promise<{ data: T | null; error: StorageError | null }> {
    try {
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`
        
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch {
          // If JSON parsing fails, use default error message
        }
        
        const error = new StorageError(errorMessage, response.status)
        return { data: null, error }
      }

      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }
}