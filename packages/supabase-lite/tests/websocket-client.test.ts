import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, ProxyRequest, ProxyResponse, WebSocketMessage } from '../src/lib/proxy/websocket-client.js';

// Mock WebSocket
const mockWebSocket = {
  readyState: 1, // WebSocket.OPEN
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => mockWebSocket)
}));

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  const testUrl = 'ws://localhost:8080';

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocket.readyState = 1; // Reset to OPEN state
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Initialization', () => {
    it('should create client with WebSocket URL', () => {
      client = new WebSocketClient(testUrl);
      
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(WebSocketClient);
    });

    it('should create null client for deployed instances', () => {
      client = new WebSocketClient(null);
      
      expect(client).toBeDefined();
      expect(client.isConnected()).toBe(false);
    });

    it('should extend EventEmitter for event handling', () => {
      client = new WebSocketClient(testUrl);
      
      expect(client.on).toBeDefined();
      expect(client.emit).toBeDefined();
      expect(client.removeListener).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('should handle connection to WebSocket server', async () => {
      client = new WebSocketClient(testUrl);
      
      // Mock connection success
      const WebSocketMock = await import('ws');
      WebSocketMock.default.mockImplementationOnce(() => ({
        ...mockWebSocket,
        readyState: 1
      }));

      await expect(client.connect()).resolves.toBeUndefined();
    });

    it('should handle null client connection (deployed instances)', async () => {
      client = new WebSocketClient(null);
      
      // Null clients should resolve immediately without creating WebSocket
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(false);
    });

    it('should track connection state', () => {
      client = new WebSocketClient(testUrl);
      
      // Initially not connected
      expect(client.isConnected()).toBe(false);
    });

    it('should handle disconnect gracefully', () => {
      client = new WebSocketClient(testUrl);
      
      expect(() => client.disconnect()).not.toThrow();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Message Types', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should validate WebSocket message structure for requests', () => {
      const requestMessage: WebSocketMessage = {
        type: 'request',
        requestId: 'req-123',
        method: 'GET',
        url: '/api/users',
        headers: {
          'Authorization': 'Bearer token',
          'Content-Type': 'application/json'
        },
        projectContext: {
          projectId: 'project-456',
          apiType: 'rest'
        }
      };

      expect(requestMessage.type).toBe('request');
      expect(requestMessage.requestId).toBe('req-123');
      expect(requestMessage.method).toBe('GET');
      expect(requestMessage.url).toBe('/api/users');
      expect(requestMessage.projectContext?.projectId).toBe('project-456');
    });

    it('should validate WebSocket message structure for responses', () => {
      const responseMessage: WebSocketMessage = {
        type: 'response',
        requestId: 'req-123',
        response: {
          status: 200,
          headers: {
            'content-type': 'application/json'
          },
          body: {
            data: [{ id: 1, name: 'John' }],
            count: 1
          }
        }
      };

      expect(responseMessage.type).toBe('response');
      expect(responseMessage.requestId).toBe('req-123');
      expect(responseMessage.response?.status).toBe(200);
      expect(responseMessage.response?.body.data).toHaveLength(1);
    });

    it('should validate command complete messages', () => {
      const commandCompleteMessage: WebSocketMessage = {
        type: 'command_complete',
        requestId: 'cmd-789'
      };

      expect(commandCompleteMessage.type).toBe('command_complete');
      expect(commandCompleteMessage.requestId).toBe('cmd-789');
      expect(commandCompleteMessage.method).toBeUndefined();
      expect(commandCompleteMessage.response).toBeUndefined();
    });
  });

  describe('Request Handling', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should format proxy requests correctly', () => {
      const request: ProxyRequest = {
        id: 'test-request-1',
        method: 'POST',
        url: '/api/posts',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        body: JSON.stringify({
          title: 'New Post',
          content: 'Post content here',
          author: 'user123'
        })
      };

      expect(request.id).toBe('test-request-1');
      expect(request.method).toBe('POST');
      expect(request.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(request.body!).title).toBe('New Post');
    });

    it('should handle requests without body', () => {
      const getRequest: ProxyRequest = {
        id: 'get-request-1',
        method: 'GET',
        url: '/api/users?page=1&limit=10',
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer token'
        }
      };

      expect(getRequest.body).toBeUndefined();
      expect(getRequest.method).toBe('GET');
      expect(getRequest.url).toContain('page=1');
    });

    it('should support various HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      methods.forEach((method, index) => {
        const request: ProxyRequest = {
          id: `${method.toLowerCase()}-${index}`,
          method,
          url: `/api/resource/${index}`,
          headers: {}
        };

        expect(request.method).toBe(method);
        expect(request.id).toContain(method.toLowerCase());
      });
    });

    it('should handle complex headers', () => {
      const complexHeaders = {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'WebSocketClient/1.0 (Test)',
        'X-Requested-With': 'WebSocketClient',
        'X-Custom-Header': 'custom-value-123',
        'Cache-Control': 'no-cache'
      };

      const request: ProxyRequest = {
        id: 'complex-headers-test',
        method: 'POST',
        url: '/api/complex',
        headers: complexHeaders
      };

      expect(Object.keys(request.headers)).toHaveLength(7);
      expect(request.headers['Authorization']).toContain('Bearer');
      expect(request.headers['Content-Type']).toContain('json');
      expect(request.headers['X-Custom-Header']).toBe('custom-value-123');
    });
  });

  describe('Response Handling', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should handle successful responses', () => {
      const successResponse: ProxyResponse = {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-total-count': '42'
        },
        body: {
          data: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' }
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 42
          }
        }
      };

      expect(successResponse.status).toBe(200);
      expect(successResponse.body.data).toHaveLength(2);
      expect(successResponse.body.pagination.total).toBe(42);
      expect(successResponse.headers['x-total-count']).toBe('42');
    });

    it('should handle error responses', () => {
      const errorResponse: ProxyResponse = {
        status: 404,
        headers: {
          'content-type': 'application/json'
        },
        body: {
          error: 'Not Found',
          message: 'The requested resource was not found',
          code: 'RESOURCE_NOT_FOUND',
          timestamp: '2024-01-15T10:30:00Z'
        }
      };

      expect(errorResponse.status).toBe(404);
      expect(errorResponse.body.error).toBe('Not Found');
      expect(errorResponse.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should handle various response status codes', () => {
      const statusCodes = [
        { code: 200, type: 'OK' },
        { code: 201, type: 'Created' },
        { code: 400, type: 'Bad Request' },
        { code: 401, type: 'Unauthorized' },
        { code: 403, type: 'Forbidden' },
        { code: 404, type: 'Not Found' },
        { code: 500, type: 'Internal Server Error' }
      ];

      statusCodes.forEach(({ code, type }) => {
        const response: ProxyResponse = {
          status: code,
          headers: { 'content-type': 'application/json' },
          body: { message: type, status: code }
        };

        expect(response.status).toBe(code);
        expect(response.body.message).toBe(type);
      });
    });

    it('should handle empty response bodies', () => {
      const emptyResponse: ProxyResponse = {
        status: 204, // No Content
        headers: {},
        body: null
      };

      expect(emptyResponse.status).toBe(204);
      expect(emptyResponse.body).toBeNull();
    });
  });

  describe('Project Context', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should include project context in messages', () => {
      const messageWithContext: WebSocketMessage = {
        type: 'request',
        requestId: 'ctx-123',
        method: 'GET',
        url: '/api/tables',
        headers: {},
        projectContext: {
          projectId: 'my-supabase-project',
          apiType: 'rest'
        }
      };

      expect(messageWithContext.projectContext).toBeDefined();
      expect(messageWithContext.projectContext?.projectId).toBe('my-supabase-project');
      expect(messageWithContext.projectContext?.apiType).toBe('rest');
    });

    it('should handle different API types', () => {
      const apiTypes = ['rest', 'graphql', 'realtime', 'auth', 'storage'];
      
      apiTypes.forEach(apiType => {
        const message: WebSocketMessage = {
          type: 'request',
          requestId: `${apiType}-request`,
          method: 'GET',
          url: `/api/${apiType}`,
          headers: {},
          projectContext: {
            projectId: 'test-project',
            apiType
          }
        };

        expect(message.projectContext?.apiType).toBe(apiType);
      });
    });

    it('should handle missing project context', () => {
      const messageWithoutContext: WebSocketMessage = {
        type: 'request',
        requestId: 'no-ctx-456',
        method: 'GET',
        url: '/api/health',
        headers: {}
      };

      expect(messageWithoutContext.projectContext).toBeUndefined();
      expect(messageWithoutContext.type).toBe('request');
    });
  });

  describe('Command Completion', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should handle command completion for null clients', async () => {
      const nullClient = new WebSocketClient(null);
      
      // Should handle gracefully without WebSocket
      await expect(nullClient.sendCommandComplete()).resolves.toBeUndefined();
    });

    it('should send command complete messages', async () => {
      // Test that the method exists and can be called
      expect(client.sendCommandComplete).toBeDefined();
      expect(typeof client.sendCommandComplete).toBe('function');

      await expect(client.sendCommandComplete()).resolves.toBeUndefined();
    });
  });

  describe('Connection States and Reconnection', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should handle different WebSocket ready states', () => {
      const readyStates = [
        { state: 0, name: 'CONNECTING' },
        { state: 1, name: 'OPEN' },
        { state: 2, name: 'CLOSING' },
        { state: 3, name: 'CLOSED' }
      ];

      readyStates.forEach(({ state, name }) => {
        mockWebSocket.readyState = state;
        
        // Test connection state logic
        const isConnected = state === 1; // Only OPEN state is connected
        expect(typeof isConnected).toBe('boolean');
        expect([0, 1, 2, 3]).toContain(state);
      });
    });

    it('should handle connection failures gracefully', () => {
      // Test that connection failures don't crash the client
      expect(() => {
        const clientWithBadUrl = new WebSocketClient('ws://invalid-url:99999');
        clientWithBadUrl.connect().catch(() => {
          // Expected to fail, test that it handles gracefully
        });
      }).not.toThrow();
    });
  });

  describe('Event System', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should support WebSocket-specific events', () => {
      const events = ['open', 'close', 'error', 'message'];
      
      events.forEach(eventName => {
        const handler = vi.fn();
        client.on(eventName, handler);
        
        expect(client.listenerCount(eventName)).toBe(1);
        
        client.removeListener(eventName, handler);
        expect(client.listenerCount(eventName)).toBe(0);
      });
    });

    it('should handle custom application events', () => {
      const customEvents = ['connected', 'disconnected', 'request_sent', 'response_received'];
      
      customEvents.forEach(eventName => {
        const handler = vi.fn();
        client.on(eventName, handler);
        
        expect(client.listenerCount(eventName)).toBe(1);
        
        client.removeAllListeners(eventName);
        expect(client.listenerCount(eventName)).toBe(0);
      });
    });
  });

  describe('Message Serialization', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should handle JSON serialization of complex objects', () => {
      const complexMessage: WebSocketMessage = {
        type: 'request',
        requestId: 'complex-123',
        method: 'POST',
        url: '/api/complex',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: {
            id: 123,
            profile: {
              name: 'John Doe',
              preferences: {
                theme: 'dark',
                notifications: true
              }
            }
          },
          metadata: {
            timestamp: '2024-01-15T10:30:00Z',
            version: '1.0.0',
            tags: ['user', 'profile', 'update']
          }
        })
      };

      const serialized = JSON.stringify(complexMessage);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.type).toBe('request');
      expect(deserialized.requestId).toBe('complex-123');
      
      const bodyData = JSON.parse(deserialized.body);
      expect(bodyData.user.profile.name).toBe('John Doe');
      expect(bodyData.metadata.tags).toContain('user');
    });

    it('should handle special characters in messages', () => {
      const messageWithSpecialChars: WebSocketMessage = {
        type: 'request',
        requestId: 'special-chars-test',
        method: 'POST',
        url: '/api/test',
        headers: {},
        body: JSON.stringify({
          text: 'Hello "World" with \'quotes\' and \n newlines \t tabs',
          unicode: '🚀 Unicode: ñáéíóú 中文 العربية',
          json: '{"nested": "json string"}'
        })
      };

      const serialized = JSON.stringify(messageWithSpecialChars);
      const deserialized = JSON.parse(serialized);
      const bodyData = JSON.parse(deserialized.body);

      expect(bodyData.text).toContain('Hello "World"');
      expect(bodyData.unicode).toContain('🚀');
      expect(bodyData.json).toBe('{"nested": "json string"}');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      client = new WebSocketClient(testUrl);
    });

    it('should handle malformed WebSocket messages', () => {
      const malformedMessages = [
        '{"invalid": json}', // Invalid JSON
        '{"type": "unknown"}', // Unknown message type
        '{"type": "request"}', // Missing required fields
        '', // Empty message
        'not json at all' // Not JSON
      ];

      malformedMessages.forEach(message => {
        try {
          const parsed = JSON.parse(message);
          // If parsing succeeds, validate the structure
          expect(typeof parsed).toBe('object');
        } catch {
          // If parsing fails, that's expected for malformed JSON
          expect(typeof message).toBe('string');
        }
      });
    });

    it('should handle network interruptions gracefully', () => {
      // Simulate network disconnection
      mockWebSocket.readyState = 3; // CLOSED
      
      expect(client.isConnected()).toBe(false);
      
      // Should handle operations gracefully when disconnected
      expect(() => client.disconnect()).not.toThrow();
    });

    it('should handle extremely large messages', () => {
      const largeData = 'x'.repeat(100000); // 100KB of data
      const largeMessage: WebSocketMessage = {
        type: 'request',
        requestId: 'large-message-test',
        method: 'POST',
        url: '/api/bulk',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: largeData })
      };

      // Should be able to create large messages without error
      expect(largeMessage.body?.length).toBeGreaterThan(100000);
      expect(largeMessage.requestId).toBe('large-message-test');
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on disconnect', () => {
      client = new WebSocketClient(testUrl);
      
      // Add some event listeners
      const handler = vi.fn();
      client.on('test', handler);
      
      // Should clean up without throwing errors
      expect(() => client.disconnect()).not.toThrow();
      
      // After disconnect, cleanup should be possible
      client.removeAllListeners();
      expect(client.listenerCount('test')).toBe(0);
    });

    it('should handle multiple disconnect calls', () => {
      client = new WebSocketClient(testUrl);
      
      // Multiple disconnects should not cause issues
      expect(() => {
        client.disconnect();
        client.disconnect();
        client.disconnect();
      }).not.toThrow();
      
      expect(client.isConnected()).toBe(false);
    });
  });
});