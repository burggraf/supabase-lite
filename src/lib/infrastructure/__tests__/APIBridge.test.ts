import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InfrastructureAPIBridge } from '../APIBridge';
import type { APIRequest } from '@/types/infrastructure';
import { server } from '../../../mocks/server';

// Mock fetch with proper vi.fn() functionality
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('InfrastructureAPIBridge', () => {
  let apiBridge: InfrastructureAPIBridge;

  beforeEach(() => {
    apiBridge = new InfrastructureAPIBridge();
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    // Default successful response for most tests
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([
        ['content-type', 'application/json']
      ]),
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(JSON.stringify({ success: true }))
    });
  });

  describe('Request validation', () => {
    it('should validate HTTP methods', () => {
      const invalidRequest: APIRequest = {
        method: 'INVALID' as any,
        url: 'http://example.com',
        headers: {},
      };

      expect(() => apiBridge.validateRequest(invalidRequest)).toThrow('Invalid HTTP method');
    });

    it('should validate URLs', () => {
      const invalidRequest: APIRequest = {
        method: 'GET',
        url: 'not-a-url',
        headers: {},
      };

      expect(() => apiBridge.validateRequest(invalidRequest)).toThrow('Invalid URL');
    });

    it('should validate request body serializability', () => {
      const circular: any = {};
      circular.self = circular;

      const invalidRequest: APIRequest = {
        method: 'POST',
        url: 'http://example.com',
        headers: {},
        body: circular,
      };

      expect(() => apiBridge.validateRequest(invalidRequest)).toThrow('Request body is not serializable');
    });

    it('should pass validation for valid requests', () => {
      const validRequest: APIRequest = {
        method: 'GET',
        url: 'http://example.com',
        headers: { 'Accept': 'application/json' },
      };

      expect(() => apiBridge.validateRequest(validRequest)).not.toThrow();
    });
  });

  describe('Response formatting', () => {
    it('should format successful response', () => {
      const response = apiBridge.formatResponse({ data: 'test' }, 200, { 'Content-Type': 'application/json' });

      expect(response.success).toBe(true);
      expect(response.status).toBe(200);
      expect(response.data).toEqual({ data: 'test' });
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(response.error).toBeUndefined();
    });

    it('should format error response', () => {
      const response = apiBridge.formatResponse(null, 404, {});

      expect(response.success).toBe(false);
      expect(response.status).toBe(404);
      expect(response.data).toBe(null);
      expect(response.error).toEqual({
        code: 'API_NOT_FOUND',
        message: 'HTTP 404 error',
        context: { status: 404 },
      });
    });
  });

  describe('Interceptors', () => {
    it('should add request interceptors', () => {
      const interceptor = vi.fn().mockResolvedValue({} as APIRequest);
      apiBridge.addRequestInterceptor(interceptor);

      // Interceptors are tested indirectly through request execution
      expect(interceptor).not.toHaveBeenCalled(); // Not called until request is made
    });

    it('should add response interceptors', () => {
      const interceptor = vi.fn();
      apiBridge.addResponseInterceptor(interceptor);

      // Interceptors are tested indirectly through request execution
      expect(interceptor).not.toHaveBeenCalled(); // Not called until response is received
    });
  });

  describe('Convenience methods', () => {
    beforeEach(() => {
      // Mock successful fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve(JSON.stringify({ success: true })),
      });
    });

    it('should provide GET convenience method', async () => {
      const response = await apiBridge.get('http://example.com/api');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com/api',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'Supabase-Lite/1.0',
          }),
        })
      );

      expect(response.success).toBe(true);
      expect(response.data).toEqual({ success: true });
    });

    it('should provide POST convenience method', async () => {
      const postData = { name: 'test' };
      await apiBridge.post('http://example.com/api', postData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com/api',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData),
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': 'Supabase-Lite/1.0',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should provide PUT convenience method', async () => {
      const putData = { id: 1, name: 'updated' };
      await apiBridge.put('http://example.com/api/1', putData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com/api/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(putData),
        })
      );
    });

    it('should provide PATCH convenience method', async () => {
      const patchData = { name: 'patched' };
      await apiBridge.patch('http://example.com/api/1', patchData);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com/api/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(patchData),
        })
      );
    });

    it('should provide DELETE convenience method', async () => {
      await apiBridge.delete('http://example.com/api/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://example.com/api/1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Network error'));

      await expect(apiBridge.get('http://example.com')).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      await expect(apiBridge.get('http://example.com')).rejects.toThrow('Request timeout');
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Map(),
        text: () => Promise.resolve('Internal Server Error'),
      });

      const response = await apiBridge.get('http://example.com');
      expect(response.success).toBe(false);
      expect(response.status).toBe(500);
    });
  });

  describe('Retry logic', () => {
    it('should retry on 500 errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: new Map(),
          text: () => Promise.resolve('Server Error'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          text: () => Promise.resolve(JSON.stringify({ success: true })),
        });

      const response = await apiBridge.get('http://example.com');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.success).toBe(true);
    });

    it('should retry on 429 rate limiting', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Map(),
          text: () => Promise.resolve('Too Many Requests'),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          text: () => Promise.resolve(JSON.stringify({ success: true })),
        });

      const response = await apiBridge.get('http://example.com');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.success).toBe(true);
    });

    it('should not retry on client errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Map(),
        text: () => Promise.resolve('Bad Request'),
      });

      const response = await apiBridge.get('http://example.com');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(response.success).toBe(false);
      expect(response.status).toBe(400);
    });
  });

  describe('Content type handling', () => {
    it('should parse JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve(JSON.stringify({ data: 'json' })),
      });

      const response = await apiBridge.get('http://example.com');
      expect(response.data).toEqual({ data: 'json' });
    });

    it('should handle text responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve('plain text'),
      });

      const response = await apiBridge.get('http://example.com');
      expect(response.data).toBe('plain text');
    });

    it('should handle empty responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve(''),
      });

      const response = await apiBridge.get('http://example.com');
      expect(response.data).toBe(null);
    });
  });
});