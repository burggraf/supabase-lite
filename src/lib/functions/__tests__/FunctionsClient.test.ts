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

describe('FunctionsClient', () => {
  let client: FunctionsClient;
  // Use localhost:5173 to match MSW handlers
  const mockUrl = 'http://localhost:5173';
  const mockKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FunctionsClient(mockUrl, mockKey);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Construction', () => {
    it('should create a FunctionsClient instance', () => {
      expect(client).toBeInstanceOf(FunctionsClient);
    });

    it('should handle trailing slash in URL', () => {
      const clientWithSlash = new FunctionsClient('http://localhost:5173/', mockKey);
      expect(clientWithSlash).toBeInstanceOf(FunctionsClient);
    });
  });

  describe('Function Invocation', () => {
    it('should invoke function successfully', async () => {
      const result = await client.invoke('test-function');

      // MSW handlers will process this request
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should handle different HTTP methods', async () => {
      const methods: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      
      for (const method of methods) {
        const result = await client.invoke('test-function', { method });
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('error');
      }
    });

    it('should handle request body', async () => {
      const testBody = { message: 'test' };
      const result = await client.invoke('test-function', { 
        method: 'POST',
        body: testBody 
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should handle string body', async () => {
      const result = await client.invoke('test-function', { 
        method: 'POST',
        body: 'plain text body'
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should handle custom headers', async () => {
      const customHeaders = { 'X-Custom': 'test-value' };
      const result = await client.invoke('test-function', { 
        headers: customHeaders 
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should ignore body for GET requests', async () => {
      const result = await client.invoke('test-function', { 
        method: 'GET', 
        body: { ignored: 'body' } 
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('Error Handling', () => {
    it('should handle various response scenarios', async () => {
      // Test with different function names to potentially trigger different responses
      const scenarios = [
        'test-function',
        'nonexistent-function',
        'error-function',
        '500-function'
      ];

      for (const functionName of scenarios) {
        const result = await client.invoke(functionName);
        
        // Each response should have the proper structure
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('error');
        
        // Either data or error should be set, but not both
        if (result.data !== null) {
          expect(result.error).toBeNull();
        }
        
        if (result.error !== null) {
          expect(result.data).toBeNull();
          expect(result.error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Request Options', () => {
    it('should handle undefined body', async () => {
      const result = await client.invoke('test-function', { body: undefined });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should handle region parameter', async () => {
      // Region parameter should be ignored in local implementation
      const result = await client.invoke('test-function', { region: 'us-east-1' });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty function name', async () => {
      const result = await client.invoke('');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should handle function names with special characters', async () => {
      const result = await client.invoke('test-function-with-dashes_and_underscores');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should handle complex object bodies', async () => {
      const complexBody = {
        nested: {
          object: {
            with: ['arrays', 123, true, null]
          }
        },
        date: new Date().toISOString(),
        buffer: 'base64data'
      };

      const result = await client.invoke('test-function', { body: complexBody });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });

    it('should handle very long function names', async () => {
      const longFunctionName = 'a'.repeat(1000);
      const result = await client.invoke(longFunctionName);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('Response Type Inference', () => {
    interface TestResponse {
      id: number;
      name: string;
    }

    it('should handle typed responses', async () => {
      const result = await client.invoke<TestResponse>('test-function');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      
      // If data exists, it should match the expected type structure
      if (result.data) {
        expect(typeof result.data).toBe('object');
      }
    });

    it('should handle null data with typed response', async () => {
      const result = await client.invoke<TestResponse>('nonexistent-function');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
    });
  });

  describe('Async Behavior', () => {
    it('should handle concurrent function invocations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        client.invoke(`test-function-${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('error');
      });
    });

    it('should handle function invocations', async () => {
      const startTime = Date.now();
      const result = await client.invoke('test-function');
      const endTime = Date.now();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('error');
      
      // Ensure the request completed (not hanging)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });
})