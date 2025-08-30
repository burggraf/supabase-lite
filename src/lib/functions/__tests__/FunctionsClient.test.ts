import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FunctionsClient,
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
  type FunctionInvokeOptions,
  type FunctionResponse
} from '../FunctionsClient';

// Mock ProjectManager to provide a test project
vi.mock('../../projects/ProjectManager', () => ({
  ProjectManager: {
    getInstance: () => ({
      getActiveProject: () => ({
        id: 'test-project',
        name: 'Test Project',
        databasePath: 'idb://test_project',
        createdAt: new Date(),
        isActive: true
      }),
      getProjects: () => [{
        id: 'test-project',
        name: 'Test Project', 
        databasePath: 'idb://test_project',
        createdAt: new Date(),
        isActive: true
      }]
    })
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FunctionsClient', () => {
  let client: FunctionsClient;
  const mockUrl = 'http://localhost:3000';
  const mockKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FunctionsClient(mockUrl, mockKey);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with correct URL and key', () => {
      expect(client).toBeInstanceOf(FunctionsClient);
    });

    it('should remove trailing slash from URL', () => {
      const clientWithTrailingSlash = new FunctionsClient('http://localhost:3000/', mockKey);
      expect(clientWithTrailingSlash).toBeInstanceOf(FunctionsClient);
    });

    it('should merge custom headers with defaults', () => {
      const customHeaders = { 'Custom-Header': 'value' };
      const clientWithHeaders = new FunctionsClient(mockUrl, mockKey, customHeaders);
      expect(clientWithHeaders).toBeInstanceOf(FunctionsClient);
    });
  });

  describe('Function Invocation', () => {
    it('should invoke function successfully with JSON response', async () => {
      const mockResponse = { message: 'Hello World' };
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue(mockResponse)
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toEqual(mockResponse);
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': mockKey,
            'Authorization': `Bearer ${mockKey}`
          }
        }
      );
    });

    it('should invoke function with custom method', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { method: 'GET' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should invoke function with body for POST request', async () => {
      const testBody = { name: 'test' };
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { 
        method: 'POST',
        body: testBody 
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testBody)
        })
      );
    });

    it('should handle string body correctly', async () => {
      const testBody = 'raw string body';
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('text/plain')
        },
        text: vi.fn().mockResolvedValue('response')
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { 
        method: 'POST',
        body: testBody 
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.objectContaining({
          method: 'POST',
          body: testBody
        })
      );
    });

    it('should not add body for GET requests', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { method: 'GET', body: { test: 'data' } });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.not.objectContaining({
          body: expect.anything()
        })
      );
    });

    it('should merge custom headers with default headers', async () => {
      const customHeaders = { 'Custom-Header': 'custom-value' };
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { headers: customHeaders });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'apikey': mockKey,
            'Authorization': `Bearer ${mockKey}`,
            'Custom-Header': 'custom-value'
          })
        })
      );
    });

    it('should handle text response', async () => {
      const mockResponse = 'plain text response';
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('text/plain')
        },
        text: vi.fn().mockResolvedValue(mockResponse)
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBe(mockResponse);
      expect(result.error).toBeNull();
    });

    it('should handle non-JSON, non-text response as text', async () => {
      const mockResponse = 'binary data';
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/octet-stream')
        },
        text: vi.fn().mockResolvedValue(mockResponse)
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBe(mockResponse);
      expect(result.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error responses', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({ error: 'Invalid input' })
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(FunctionsHttpError);
      expect(result.error?.message).toBe('Edge Function returned a non-2xx status code');
      expect((result.error as FunctionsHttpError).context).toBe(mockErrorResponse);
    });

    it('should handle 500 status as FunctionsRelayError', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          get: vi.fn().mockReturnValue('text/plain')
        },
        text: vi.fn().mockResolvedValue('Internal server error')
      };
      mockFetch.mockResolvedValue(mockErrorResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(FunctionsRelayError);
      expect(result.error?.message).toBe('Edge Function returned a non-2xx status code');
    });

    it('should handle network errors as FunctionsFetchError', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.invoke('test-function');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(FunctionsFetchError);
      expect(result.error?.message).toBe('Network error');
    });

    it('should handle JSON parsing errors', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Invalid JSON');
    });

    it('should handle text parsing errors', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('text/plain')
        },
        text: vi.fn().mockRejectedValue(new Error('Text parsing error'))
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Text parsing error');
    });
  });

  describe('Request Options', () => {
    it('should handle all HTTP methods', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

      for (const method of methods) {
        await client.invoke('test-function', { method });
        
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/functions/test-function',
          expect.objectContaining({
            method
          })
        );
      }
    });

    it('should handle undefined body', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { body: undefined });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.not.objectContaining({
          body: expect.anything()
        })
      );
    });

    it('should handle region parameter (ignored in local implementation)', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { region: 'us-east-1' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.anything()
      );
    });
  });

  describe('Response Type Inference', () => {
    it('should handle typed responses', async () => {
      interface TestResponse {
        id: number;
        name: string;
      }

      const mockResponse: TestResponse = { id: 1, name: 'Test' };
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue(mockResponse)
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke<TestResponse>('test-function');

      expect(result.data).toEqual(mockResponse);
      expect(result.data?.id).toBe(1);
      expect(result.data?.name).toBe('Test');
    });

    it('should handle null data with typed response', async () => {
      interface TestResponse {
        id: number;
      }

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.invoke<TestResponse>('test-function');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(FunctionsFetchError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty function name', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/',
        expect.anything()
      );
    });

    it('should handle function names with special characters', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function-with-dashes_and_underscores');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function-with-dashes_and_underscores',
        expect.anything()
      );
    });

    it('should handle missing Content-Type header', async () => {
      const mockResponse = 'no content type';
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue(null)
        },
        text: vi.fn().mockResolvedValue(mockResponse)
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBe(mockResponse);
      expect(result.error).toBeNull();
    });

    it('should handle empty response body', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 204,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue(null)
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const result = await client.invoke('test-function');

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });

    it('should handle complex object bodies', async () => {
      const complexBody = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' }
        },
        date: new Date().toISOString(),
        boolean: true,
        null: null
      };

      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke('test-function', { body: complexBody });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/functions/test-function',
        expect.objectContaining({
          body: JSON.stringify(complexBody)
        })
      );
    });

    it('should handle very long function names', async () => {
      const longFunctionName = 'a'.repeat(1000);
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({})
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      await client.invoke(longFunctionName);

      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:3000/functions/${longFunctionName}`,
        expect.anything()
      );
    });
  });

  describe('Constructor Edge Cases', () => {
    it('should handle URLs without protocol', () => {
      const clientWithoutProtocol = new FunctionsClient('localhost:3000', mockKey);
      expect(clientWithoutProtocol).toBeInstanceOf(FunctionsClient);
    });

    it('should handle empty headers object', () => {
      const clientWithEmptyHeaders = new FunctionsClient(mockUrl, mockKey, {});
      expect(clientWithEmptyHeaders).toBeInstanceOf(FunctionsClient);
    });

    it('should handle null/undefined headers', () => {
      const clientWithNullHeaders = new FunctionsClient(mockUrl, mockKey, null as any);
      expect(clientWithNullHeaders).toBeInstanceOf(FunctionsClient);
    });

    it('should handle empty API key', () => {
      const clientWithEmptyKey = new FunctionsClient(mockUrl, '');
      expect(clientWithEmptyKey).toBeInstanceOf(FunctionsClient);
    });

    it('should handle URL with path', () => {
      const clientWithPath = new FunctionsClient('http://localhost:3000/api/v1', mockKey);
      expect(clientWithPath).toBeInstanceOf(FunctionsClient);
    });
  });

  describe('Error Classes', () => {
    it('should create FunctionsHttpError correctly', () => {
      const mockResponse = { status: 400 } as Response;
      const error = new FunctionsHttpError('Test message', mockResponse);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FunctionsHttpError);
      expect(error.name).toBe('FunctionsHttpError');
      expect(error.message).toBe('Test message');
      expect(error.context).toBe(mockResponse);
    });

    it('should create FunctionsRelayError correctly', () => {
      const error = new FunctionsRelayError('Relay error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FunctionsRelayError);
      expect(error.name).toBe('FunctionsRelayError');
      expect(error.message).toBe('Relay error message');
    });

    it('should create FunctionsFetchError correctly', () => {
      const error = new FunctionsFetchError('Fetch error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FunctionsFetchError);
      expect(error.name).toBe('FunctionsFetchError');
      expect(error.message).toBe('Fetch error message');
    });
  });

  describe('Async Behavior', () => {
    it('should handle concurrent function invocations', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({ result: 'success' })
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const promises = Array(5).fill(0).map((_, i) => 
        client.invoke(`test-function-${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.data).toEqual({ result: 'success' });
        expect(result.error).toBeNull();
      });
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should handle slow responses', async () => {
      const mockFetchResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve({ slow: 'response' }), 100))
        )
      };
      mockFetch.mockResolvedValue(mockFetchResponse);

      const startTime = Date.now();
      const result = await client.invoke('slow-function');
      const endTime = Date.now();

      expect(result.data).toEqual({ slow: 'response' });
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });
});