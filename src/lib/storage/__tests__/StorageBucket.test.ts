/**
 * Storage Bucket Integration Tests
 * 
 * Tests the StorageBucket class functionality and API compatibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageBucket } from '../StorageBucket'
import { StorageError } from '../StorageError'

// Mock the global fetch for testing
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('StorageBucket', () => {
  let bucket: StorageBucket
  const mockApiUrl = 'http://localhost:5173'
  const mockHeaders = {
    'apikey': 'test-key',
    'Authorization': 'Bearer test-key',
    'Content-Type': 'application/json'
  }

  beforeEach(() => {
    bucket = new StorageBucket('test-bucket', mockApiUrl, mockHeaders)
    vi.clearAllMocks()
  })

  describe('upload()', () => {
    it('should upload a File object', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({
          id: 'file-id',
          path: 'test.txt',
          fullPath: 'test-bucket/test.txt'
        }),
        clone: vi.fn().mockReturnValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            id: 'file-id',
            path: 'test.txt',
            fullPath: 'test-bucket/test.txt'
          })
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.upload('test.txt', mockFile)

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/test-bucket/test.txt`,
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      )

      expect(result.data).toEqual({
        id: 'file-id',
        path: 'test.txt',
        fullPath: 'test-bucket/test.txt'
      })
      expect(result.error).toBeNull()
    })

    it('should upload with options', async () => {
      const mockFile = new File(['test'], 'test.txt')
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      }

      mockFetch.mockResolvedValue(mockResponse)

      await bucket.upload('test.txt', mockFile, {
        cacheControl: 'max-age=3600',
        upsert: true,
        metadata: { category: 'test' }
      })

      const call = mockFetch.mock.calls[0]
      const headers = call[1].headers

      expect(headers['cache-control']).toBe('max-age=3600')
      expect(headers['x-upsert']).toBe('true')
      expect(headers['x-metadata']).toBe(JSON.stringify({ category: 'test' }))
    })

    it('should handle upload errors', async () => {
      const mockFile = new File(['test'], 'test.txt')
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: 'upload_failed',
          message: 'File too large'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.upload('test.txt', mockFile)

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(StorageError)
      expect(result.error?.statusCode).toBe(400)
    })

    it('should upload ArrayBuffer', async () => {
      const buffer = new ArrayBuffer(8)
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.upload('test.bin', buffer)

      expect(result.error).toBeNull()
    })

    it('should upload Uint8Array', async () => {
      const array = new Uint8Array([1, 2, 3, 4])
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.upload('test.bin', array)

      expect(result.error).toBeNull()
    })
  })

  describe('download()', () => {
    it('should download a file', async () => {
      const mockBlob = new Blob(['file content'], { type: 'text/plain' })
      const mockResponse = {
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob)
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.download('test.txt')

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/test-bucket/test.txt`,
        expect.objectContaining({
          method: 'GET'
        })
      )

      expect(result.data).toBe(mockBlob)
      expect(result.error).toBeNull()
    })

    it('should handle download errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.download('nonexistent.txt')

      expect(result.data).toBeNull()
      expect(result.error).toBeInstanceOf(StorageError)
    })
  })

  describe('list()', () => {
    it('should list files in bucket', async () => {
      const mockFiles = [
        {
          name: 'file1.txt',
          id: 'id1',
          updated_at: '2024-01-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
          size: 100
        },
        {
          name: 'file2.txt',
          id: 'id2',
          updated_at: '2024-01-01T01:00:00Z',
          created_at: '2024-01-01T01:00:00Z',
          size: 200
        }
      ]

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockFiles)
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.list()

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/list/test-bucket?`,
        expect.objectContaining({
          method: 'GET'
        })
      )

      expect(result.data).toEqual(mockFiles)
      expect(result.error).toBeNull()
    })

    it('should list files with options', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([])
      }

      mockFetch.mockResolvedValue(mockResponse)

      await bucket.list('folder/', {
        limit: 10,
        offset: 5,
        search: 'test',
        sortBy: { column: 'name', order: 'asc' }
      })

      const call = mockFetch.mock.calls[0]
      const url = new URL(call[0])
      const params = url.searchParams

      expect(params.get('prefix')).toBe('folder/')
      expect(params.get('limit')).toBe('10')
      expect(params.get('offset')).toBe('5')
      expect(params.get('search')).toBe('test')
      expect(params.get('sortBy')).toBe('name:asc')
    })
  })

  describe('update()', () => {
    it('should call upload with upsert option', async () => {
      const mockFile = new File(['updated content'], 'test.txt')
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({})
      }

      mockFetch.mockResolvedValue(mockResponse)

      await bucket.update('test.txt', mockFile)

      const call = mockFetch.mock.calls[0]
      expect(call[1].headers['x-upsert']).toBe('true')
    })
  })

  describe('move()', () => {
    it('should move a file', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          message: 'File moved successfully'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.move('old-path.txt', 'new-path.txt')

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/move`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            bucketId: 'test-bucket',
            sourceKey: 'old-path.txt',
            destinationKey: 'new-path.txt'
          })
        })
      )

      expect(result.error).toBeNull()
    })
  })

  describe('copy()', () => {
    it('should copy a file', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          path: 'copied-file.txt'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.copy('source.txt', 'copied-file.txt')

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/copy`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            bucketId: 'test-bucket',
            sourceKey: 'source.txt',
            destinationKey: 'copied-file.txt'
          })
        })
      )

      expect(result.data?.path).toBe('copied-file.txt')
      expect(result.error).toBeNull()
    })
  })

  describe('remove()', () => {
    it('should remove multiple files', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          { name: 'file1.txt', deleted: true },
          { name: 'file2.txt', deleted: true }
        ])
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.remove(['file1.txt', 'file2.txt'])

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/test-bucket`,
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({
            prefixes: ['file1.txt', 'file2.txt']
          })
        })
      )

      expect(result.error).toBeNull()
    })
  })

  describe('createSignedUrl()', () => {
    it('should create a signed URL', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          signedUrl: 'https://example.com/signed-url?token=abc123'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.createSignedUrl('private-file.txt', 3600)

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/sign/test-bucket/private-file.txt`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ expiresIn: 3600 })
        })
      )

      expect(result.data?.signedUrl).toBe('https://example.com/signed-url?token=abc123')
      expect(result.error).toBeNull()
    })

    it('should create signed URL with transform options', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          signedUrl: 'https://example.com/signed-url'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      await bucket.createSignedUrl('image.jpg', 3600, {
        transform: { width: 100, height: 100, quality: 80 }
      })

      const call = mockFetch.mock.calls[0]
      const body = JSON.parse(call[1].body)
      expect(body.transform).toEqual({
        width: 100,
        height: 100,
        quality: 80
      })
    })
  })

  describe('createSignedUrls()', () => {
    it('should create multiple signed URLs', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          { signedUrl: 'url1' },
          { signedUrl: 'url2' }
        ])
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.createSignedUrls(['file1.txt', 'file2.txt'], 3600)

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/sign/test-bucket`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            paths: ['file1.txt', 'file2.txt'],
            expiresIn: 3600
          })
        })
      )

      expect(result.data).toHaveLength(2)
      expect(result.error).toBeNull()
    })
  })

  describe('getPublicUrl()', () => {
    it('should generate public URL', () => {
      const result = bucket.getPublicUrl('public-file.txt')

      expect(result.data.publicUrl).toBe(
        `${mockApiUrl}/storage/v1/object/public/test-bucket/public-file.txt`
      )
    })

    it('should generate public URL with transform options', () => {
      const result = bucket.getPublicUrl('image.jpg', {
        transform: { width: 200, height: 200, format: 'webp' }
      })

      const url = new URL(result.data.publicUrl)
      expect(url.searchParams.get('width')).toBe('200')
      expect(url.searchParams.get('height')).toBe('200')
      expect(url.searchParams.get('format')).toBe('webp')
    })
  })

  describe('createSignedUploadUrl()', () => {
    it('should create signed upload URL', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          signedUrl: 'https://example.com/upload',
          token: 'upload-token',
          path: 'upload-file.txt'
        })
      }

      mockFetch.mockResolvedValue(mockResponse)

      const result = await bucket.createSignedUploadUrl('upload-file.txt')

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockApiUrl}/storage/v1/object/upload/sign/test-bucket/upload-file.txt`,
        expect.objectContaining({
          method: 'POST'
        })
      )

      expect(result.data?.signedUrl).toBe('https://example.com/upload')
      expect(result.data?.token).toBe('upload-token')
      expect(result.data?.path).toBe('upload-file.txt')
      expect(result.error).toBeNull()
    })
  })
})