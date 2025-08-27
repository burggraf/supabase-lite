/**
 * Storage Client Integration Tests
 * 
 * Tests the complete Storage SDK integration with MSW and VFS
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageClient } from '../StorageClient'
import { StorageBucket } from '../StorageBucket'
import { StorageError } from '../StorageError'

// Mock the global fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('StorageClient', () => {
  let client: StorageClient
  const mockApiUrl = 'http://localhost:5173'
  const mockApiKey = 'test-api-key'

  beforeEach(() => {
    client = new StorageClient({
      apiUrl: mockApiUrl,
      apiKey: mockApiKey
    })
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should create a StorageClient instance with correct configuration', () => {
      expect(client).toBeInstanceOf(StorageClient)
    })

    it('should set correct headers', () => {
      // Access private property for testing
      const headers = (client as any).headers
      expect(headers['apikey']).toBe(mockApiKey)
      expect(headers['Authorization']).toBe(`Bearer ${mockApiKey}`)
      expect(headers['Content-Type']).toBe('application/json')
    })
  })

  describe('from()', () => {
    it('should return a StorageBucket instance', () => {
      const bucket = client.from('test-bucket')
      expect(bucket).toBeInstanceOf(StorageBucket)
    })

    it('should create different instances for different bucket names', () => {
      const bucket1 = client.from('bucket1')
      const bucket2 = client.from('bucket2')
      expect(bucket1).not.toBe(bucket2)
    })
  })

  describe('createBucket()', () => {
    it('should make correct API call for bucket creation', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'test-bucket',
          name: 'test-bucket',
          public: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.createBucket('test-bucket', { public: true })

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/bucket`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'apikey': mockApiKey,
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            id: 'test-bucket',
            name: 'test-bucket',
            public: true
          })
        })
      )

      expect(result.data).toEqual({
        id: 'test-bucket',
        name: 'test-bucket',
        public: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      })
      expect(result.error).toBeNull()
    })

    it('should handle bucket creation errors', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: 'bucket_exists',
          message: 'Bucket already exists'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.createBucket('existing-bucket')

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(StorageError)
      expect(result.error?.statusCode).toBe(400)
    })
  })

  describe('listBuckets()', () => {
    it('should make correct API call for listing buckets', async () => {
      const mockBuckets = [
        {
          id: 'bucket1',
          name: 'bucket1',
          public: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'bucket2',
          name: 'bucket2',
          public: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockBuckets)
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.listBuckets()

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/bucket`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'apikey': mockApiKey,
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          })
        })
      )

      expect(result.data).toEqual(mockBuckets)
      expect(result.error).toBeNull()
    })
  })

  describe('getBucket()', () => {
    it('should make correct API call for getting bucket details', async () => {
      const mockBucket = {
        id: 'test-bucket',
        name: 'test-bucket',
        public: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockBucket)
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.getBucket('test-bucket')

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/bucket/test-bucket`,
        expect.objectContaining({
          method: 'GET'
        })
      )

      expect(result.data).toEqual(mockBucket)
      expect(result.error).toBeNull()
    })
  })

  describe('updateBucket()', () => {
    it('should make correct API call for updating bucket', async () => {
      const mockBucket = {
        id: 'test-bucket',
        name: 'test-bucket',
        public: true, // Updated
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z'
      }

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockBucket)
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.updateBucket('test-bucket', { public: true })

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/bucket/test-bucket`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ public: true })
        })
      )

      expect(result.data).toEqual(mockBucket)
      expect(result.error).toBeNull()
    })
  })

  describe('deleteBucket()', () => {
    it('should make correct API call for deleting bucket', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: 'Bucket deleted successfully'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.deleteBucket('test-bucket')

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/bucket/test-bucket`,
        expect.objectContaining({
          method: 'DELETE'
        })
      )

      expect(result.error).toBeNull()
    })
  })

  describe('emptyBucket()', () => {
    it('should make correct API call for emptying bucket', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: 'Bucket emptied successfully'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.emptyBucket('test-bucket')

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/bucket/test-bucket/empty`,
        expect.objectContaining({
          method: 'POST'
        })
      )

      expect(result.error).toBeNull()
    })
  })

  describe('setAuth()', () => {
    it('should update authorization header', () => {
      const newToken = 'new-auth-token'
      client.setAuth(newToken)

      // Access private property for testing
      const headers = (client as any).headers
      expect(headers['Authorization']).toBe(`Bearer ${newToken}`)
    })
  })
})

describe('StorageError', () => {
  it('should create error with message and status code', () => {
    const error = new StorageError('Test error', 400)
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(400)
    expect(error.name).toBe('StorageError')
  })

  it('should create error from Response', () => {
    const mockResponse = { status: 404 } as Response
    const error = StorageError.fromResponse(mockResponse, 'Not found')
    expect(error.statusCode).toBe(404)
    expect(error.message).toBe('Not found')
  })

  it('should create error from Error', () => {
    const originalError = new Error('Original error')
    const error = StorageError.fromError(originalError, 500)
    expect(error.statusCode).toBe(500)
    expect(error.originalError).toBe(originalError)
  })

  it('should return existing StorageError unchanged', () => {
    const originalError = new StorageError('Original', 400)
    const error = StorageError.fromError(originalError)
    expect(error).toBe(originalError)
  })
})