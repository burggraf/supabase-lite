/**
 * StorageClient - Main storage client interface
 * Compatible with @supabase/storage-js StorageClient
 */

import { StorageBucket } from './StorageBucket'
import { StorageError } from './StorageError'
import type {
  BucketOptions,
  BucketResponse,
  Bucket,
  StorageClientOptions
} from './types'

export class StorageClient {
  private apiUrl: string
  private headers: Record<string, string>

  constructor(options: StorageClientOptions) {
    this.apiUrl = options.apiUrl
    this.headers = {
      'apikey': options.apiKey,
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  }

  /**
   * Get a reference to a storage bucket for file operations
   */
  from(bucketId: string): StorageBucket {
    return new StorageBucket(bucketId, this.apiUrl, this.headers)
  }

  /**
   * Creates a new storage bucket
   */
  async createBucket(id: string, options: BucketOptions = {}): Promise<BucketResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ id, name: id, ...options })
      })

      return this.handleResponse<Bucket>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Retrieves information about a specific bucket
   */
  async getBucket(id: string): Promise<BucketResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/bucket/${id}`, {
        method: 'GET',
        headers: this.headers
      })

      return this.handleResponse<Bucket>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Lists all storage buckets
   */
  async listBuckets(): Promise<{ data: Bucket[] | null; error: StorageError | null }> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/bucket`, {
        method: 'GET',
        headers: this.headers
      })

      return this.handleResponse<Bucket[]>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Updates bucket configuration
   */
  async updateBucket(id: string, options: BucketOptions): Promise<BucketResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/bucket/${id}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(options)
      })

      return this.handleResponse<Bucket>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Deletes a storage bucket
   */
  async deleteBucket(id: string): Promise<BucketResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/bucket/${id}`, {
        method: 'DELETE',
        headers: this.headers
      })

      return this.handleResponse<Bucket>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Empties a storage bucket (removes all files)
   */
  async emptyBucket(id: string): Promise<BucketResponse> {
    try {
      const response = await fetch(`${this.apiUrl}/storage/v1/bucket/${id}/empty`, {
        method: 'POST',
        headers: this.headers
      })

      return this.handleResponse<Bucket>(response)
    } catch (error) {
      return { 
        data: null, 
        error: StorageError.fromError(error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * Updates the Authorization header for authenticated requests
   */
  setAuth(token: string): void {
    this.headers['Authorization'] = `Bearer ${token}`
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