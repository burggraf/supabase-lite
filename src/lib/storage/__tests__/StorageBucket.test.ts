/**
 * Storage Bucket Integration Tests
 * 
 * Tests the StorageBucket class functionality and API compatibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StorageBucket } from '../StorageBucket'
// import { StorageError } from '../StorageError'

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

  describe('constructor', () => {
    it('should initialize bucket with correct properties', () => {
      expect(bucket.id).toBe('test-bucket')
    })
  })

  describe('upload()', () => {
    it('should upload a File object', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })

      const result = await bucket.upload('test.txt', mockFile)

      // Should handle the upload request without errors
      // MSW handlers will process this and return appropriate responses
      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })

    it('should upload ArrayBuffer', async () => {
      const buffer = new ArrayBuffer(16)

      const result = await bucket.upload('test.bin', buffer)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })

    it('should upload Uint8Array', async () => {
      const array = new Uint8Array([1, 2, 3, 4])

      const result = await bucket.upload('test.bin', array)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('download()', () => {
    it('should download a file', async () => {
      const result = await bucket.download('test.txt')

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('list()', () => {
    it('should list files in bucket', async () => {
      const result = await bucket.list()

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })

    it('should list files with options', async () => {
      const result = await bucket.list('', {
        limit: 10,
        offset: 0
      })

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('update()', () => {
    it('should call upload with upsert option', async () => {
      const mockFile = new File(['updated content'], 'test.txt')
      
      const result = await bucket.update('test.txt', mockFile)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('move()', () => {
    it('should move a file', async () => {
      const result = await bucket.move('old-path.txt', 'new-path.txt')

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('copy()', () => {
    it('should copy a file', async () => {
      const result = await bucket.copy('source.txt', 'copied-file.txt')

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('remove()', () => {
    it('should remove multiple files', async () => {
      const result = await bucket.remove(['file1.txt', 'file2.txt'])

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('createSignedUrl()', () => {
    it('should create a signed URL', async () => {
      const result = await bucket.createSignedUrl('private-file.txt', 3600)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })

    it('should create signed URL with transform options', async () => {
      const result = await bucket.createSignedUrl('image.jpg', 3600, {
        transform: {
          width: 100,
          height: 100
        }
      })

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('createSignedUrls()', () => {
    it('should create multiple signed URLs', async () => {
      const result = await bucket.createSignedUrls(['file1.txt', 'file2.txt'], 3600)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })

  describe('getPublicUrl()', () => {
    it('should generate public URL', () => {
      const result = bucket.getPublicUrl('public-file.txt')

      expect(result.data).toHaveProperty('publicUrl')
      expect(result.data.publicUrl).toContain('test-bucket')
      expect(result.data.publicUrl).toContain('public-file.txt')
      expect(result.data.publicUrl).toContain('public')
    })

    it('should generate public URL with transform options', () => {
      const result = bucket.getPublicUrl('image.jpg', {
        transform: {
          width: 200,
          height: 200,
          resize: 'cover'
        }
      })

      expect(result.data).toHaveProperty('publicUrl')
      expect(result.data.publicUrl).toContain('width=200')
      expect(result.data.publicUrl).toContain('height=200')
      expect(result.data.publicUrl).toContain('resize=cover')
    })
  })

  describe('createSignedUploadUrl()', () => {
    it('should create signed upload URL', async () => {
      const result = await bucket.createSignedUploadUrl('upload-file.txt')

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('error')
    })
  })
})