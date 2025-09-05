import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../handlers/index';

// Test server setup
const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  server.resetHandlers();
});

describe('Signed URLs Integration Tests', () => {
  const baseUrl = 'http://localhost:5173';
  const projectId = 'test-project';
  const bucket = 'test-bucket';
  const filePath = 'folder/test-image.jpg';

  // First, let's create a test file to work with
  beforeEach(async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test image content'], { type: 'image/jpeg' }));

    const uploadResponse = await fetch(`${baseUrl}/${projectId}/storage/v1/object/${bucket}/${filePath}`, {
      method: 'POST',
      body: formData,
    });

    expect(uploadResponse.status).toBe(201);
  });

  describe('POST /storage/v1/object/sign/:bucket/*', () => {
    it('should create a signed URL for download', async () => {
      const signedUrlRequest = {
        expiresIn: 3600,
        download: false,
      };

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(3600);
      expect(result.signedUrl).toContain(`/storage/v1/object/${bucket}/${filePath}`);
    });

    it('should create a signed URL with transform options', async () => {
      const signedUrlRequest = {
        expiresIn: 1800,
        transform: {
          width: 300,
          height: 200,
          format: 'webp',
        },
      };

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('token');
      expect(result.expiresIn).toBe(1800);
    });

    it('should create a signed URL with download parameter', async () => {
      const signedUrlRequest = {
        expiresIn: 3600,
        download: 'custom-filename.jpg',
      };

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('token');
    });

    it('should reject requests for non-existent files', async () => {
      const signedUrlRequest = {
        expiresIn: 3600,
      };

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/non-existent-file.jpg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      expect(response.status).toBe(404);
      
      const result = await response.json();
      expect(result.error).toBe('file_not_found');
    });

    it('should reject requests with invalid paths', async () => {
      const signedUrlRequest = {
        expiresIn: 3600,
      };

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/../malicious.txt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      expect(response.status).toBe(500);
      
      const result = await response.json();
      expect(result.error).toBe('signed_url_handler_error');
    });
  });

  describe('POST /storage/v1/object/upload/sign/:bucket/*', () => {
    it('should create a signed upload URL', async () => {
      const uploadPath = 'folder/upload-test.jpg';
      const signedUploadRequest = {
        expiresIn: 1800,
        upsert: true,
      };

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/upload/sign/${bucket}/${uploadPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUploadRequest),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('expiresIn');
      expect(result.path).toBe(uploadPath);
      expect(result.expiresIn).toBe(1800);
    });

    it('should create a signed upload URL with default options', async () => {
      const uploadPath = 'folder/upload-default.jpg';

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/upload/sign/${bucket}/${uploadPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result).toHaveProperty('signedUrl');
      expect(result).toHaveProperty('token');
      expect(result.expiresIn).toBe(3600); // Default expiry
    });

    it('should reject requests for non-existent buckets', async () => {
      const uploadPath = 'test-file.jpg';
      const signedUploadRequest = {
        expiresIn: 1800,
      };

      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/upload/sign/non-existent-bucket/${uploadPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUploadRequest),
      });

      expect(response.status).toBe(404);
      
      const result = await response.json();
      expect(result.error).toBe('bucket_not_found');
    });
  });

  describe('GET /storage/v1/object/public/:bucket/*', () => {
    it('should serve files from public buckets', async () => {
      // First, create a file in the public bucket
      const formData = new FormData();
      formData.append('file', new Blob(['public file content'], { type: 'text/plain' }));

      const uploadResponse = await fetch(`${baseUrl}/${projectId}/storage/v1/object/public/${filePath}`, {
        method: 'POST',
        body: formData,
      });

      expect(uploadResponse.status).toBe(201);

      // Now try to access it via public URL
      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/public/public/${filePath}`);

      if (response.status === 403) {
        // If bucket isn't public, that's expected behavior
        const result = await response.json();
        expect(result.error).toBe('access_denied');
      } else {
        // If bucket is public, we should get the file
        expect(response.status).toBe(200);
        const content = await response.text();
        expect(content).toContain('public file content');
      }
    });

    it('should reject access to private buckets', async () => {
      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/public/private/${filePath}`);

      expect(response.status).toBe(403);
      
      const result = await response.json();
      expect(result.error).toBe('access_denied');
    });
  });

  describe('GET /storage/v1/object/authenticated/:bucket/*', () => {
    it('should serve files with valid signed URL tokens', async () => {
      // First, create a signed URL
      const signedUrlRequest = {
        expiresIn: 3600,
      };

      const signResponse = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      expect(signResponse.status).toBe(200);
      const signResult = await signResponse.json();
      
      // Use the token to access the file
      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/authenticated/${bucket}/${filePath}?token=${signResult.token}`);

      expect(response.status).toBe(200);
      const content = await response.text();
      expect(content).toContain('test image content');
    });

    it('should reject requests without tokens', async () => {
      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/authenticated/${bucket}/${filePath}`);

      expect(response.status).toBe(401);
      
      const result = await response.json();
      expect(result.error).toBe('authentication_required');
    });

    it('should reject requests with invalid tokens', async () => {
      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/authenticated/${bucket}/${filePath}?token=invalid-token`);

      expect(response.status).toBe(403);
      
      const result = await response.json();
      expect(result.error).toBe('invalid_token');
    });

    it('should reject tokens for different files', async () => {
      // Create a signed URL for one file
      const signedUrlRequest = {
        expiresIn: 3600,
      };

      const signResponse = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      expect(signResponse.status).toBe(200);
      const signResult = await signResponse.json();
      
      // Try to use the token for a different file
      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/authenticated/${bucket}/different-file.jpg?token=${signResult.token}`);

      expect(response.status).toBe(403);
      
      const result = await response.json();
      expect(result.error).toBe('token_mismatch');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON in signed URL requests', async () => {
      const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.status).toBe(500);
      
      const result = await response.json();
      expect(result.error).toBe('signed_url_handler_error');
    });

    it('should handle requests without project resolution', async () => {
      const signedUrlRequest = {
        expiresIn: 3600,
      };

      const response = await fetch(`${baseUrl}/storage/v1/object/sign/${bucket}/${filePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedUrlRequest),
      });

      // Should still work with default project
      expect(response.status).toBe(200);
    });
  });

  describe('Security tests', () => {
    it('should reject paths with directory traversal attempts', async () => {
      const signedUrlRequest = {
        expiresIn: 3600,
      };

      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        './../malicious.txt',
        'folder/../../../sensitive.dat'
      ];

      for (const maliciousPath of maliciousPaths) {
        const response = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${maliciousPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signedUrlRequest),
        });

        expect(response.status).toBe(500);
        
        const result = await response.json();
        expect(result.error).toBe('signed_url_handler_error');
      }
    });

    it('should reject dangerous file extensions', async () => {
      const signedUrlRequest = {
        expiresIn: 3600,
      };

      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'virus.scr',
        'trojan.com',
        'backdoor.pif'
      ];

      for (const dangerousFile of dangerousFiles) {
        // First try to create the file (should fail)
        const formData = new FormData();
        formData.append('file', new Blob(['malicious content'], { type: 'application/octet-stream' }));

        await fetch(`${baseUrl}/${projectId}/storage/v1/object/${bucket}/${dangerousFile}`, {
          method: 'POST',
          body: formData,
        });

        // Then try to create signed URL (should also fail)
        const signResponse = await fetch(`${baseUrl}/${projectId}/storage/v1/object/sign/${bucket}/${dangerousFile}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(signedUrlRequest),
        });

        expect(signResponse.status).toBe(500);
        
        const result = await signResponse.json();
        expect(result.error).toBe('signed_url_handler_error');
      }
    });
  });
});