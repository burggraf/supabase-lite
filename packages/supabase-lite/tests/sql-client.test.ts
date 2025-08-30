import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { SqlClient } from '../src/lib/sql-client.js';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('SqlClient', () => {
  let client: SqlClient;
  const testUrl = 'http://localhost:5173';

  beforeEach(() => {
    client = new SqlClient(testUrl);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should parse URL correctly', () => {
      const config = client.getConnectionInfo();
      expect(config.url).toBe(testUrl);
      expect(config.baseUrl).toBe(testUrl);
    });

    it('should handle project-specific URLs', () => {
      const projectClient = new SqlClient('http://localhost:5173/abc123');
      const config = projectClient.getConnectionInfo();
      
      expect(config.projectId).toBe('abc123');
      expect(config.baseUrl).toBe('http://localhost:5173');
    });
  });

  describe('connect', () => {
    it('should connect successfully with valid response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ test: 1 }] }
      });

      await client.connect();
      
      expect(client.isConnected()).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5173/debug/sql',
        { sql: 'SELECT 1 as test' },
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        })
      );
    });

    it('should handle connection refused error', async () => {
      const error = new Error('Connection refused');
      (error as any).code = 'ECONNREFUSED';
      (error as any).isAxiosError = true;
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(client.connect()).rejects.toThrow();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle 404 not found error', async () => {
      const error = new Error('Not found');
      (error as any).response = { status: 404 };
      (error as any).isAxiosError = true;
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(client.connect()).rejects.toThrow();
    });

    it('should handle server error', async () => {
      const error = new Error('Server error');
      (error as any).response = { status: 500 };
      (error as any).isAxiosError = true;
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(client.connect()).rejects.toThrow();
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      // Mock successful connection
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ test: 1 }] }
      });
      await client.connect();
      vi.clearAllMocks();
    });

    it('should execute query successfully', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: [
            { id: 1, name: 'John' },
            { id: 2, name: 'Jane' }
          ],
          rowCount: 2,
          fields: [
            { name: 'id', type: 'integer' },
            { name: 'name', type: 'text' }
          ]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await client.executeQuery('SELECT id, name FROM users');

      expect(result.data).toEqual(mockResponse.data.data);
      expect(result.rowCount).toBe(2);
      expect(result.fields).toEqual(mockResponse.data.fields);
      expect(result.executionTime).toBeTypeOf('number');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5173/debug/sql',
        { sql: 'SELECT id, name FROM users' },
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        })
      );
    });

    it('should handle PostgreSQL errors', async () => {
      const mockError = {
        response: {
          data: {
            error: 'PGRST106',
            message: 'relation "nonexistent" does not exist',
            details: 'Table not found',
            hint: 'Check table name'
          }
        },
        isAxiosError: true
      };

      mockedAxios.post.mockRejectedValueOnce(mockError);

      await expect(
        client.executeQuery('SELECT * FROM nonexistent')
      ).rejects.toThrow();
    });

    it('should throw error for empty query', async () => {
      await expect(client.executeQuery('')).rejects.toThrow(
        'SQL query cannot be empty'
      );
      
      await expect(client.executeQuery('   ')).rejects.toThrow(
        'SQL query cannot be empty'
      );
    });

    it('should throw error when not connected', async () => {
      const disconnectedClient = new SqlClient(testUrl);
      
      await expect(
        disconnectedClient.executeQuery('SELECT 1')
      ).rejects.toThrow('Not connected. Call connect() first.');
    });

    it('should handle network errors', async () => {
      const error = new Error('Network error');
      (error as any).code = 'ENOTFOUND';
      (error as any).isAxiosError = true;
      mockedAxios.post.mockRejectedValueOnce(error);

      await expect(
        client.executeQuery('SELECT 1')
      ).rejects.toThrow();
    });
  });

  describe('ping', () => {
    it('should return true when connection is active', async () => {
      // Mock successful connection
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ test: 1 }] }
      });
      await client.connect();
      
      // Mock successful ping
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ '?column?': 1 }] }
      });

      const isActive = await client.ping();
      expect(isActive).toBe(true);
    });

    it('should return false and disconnect when ping fails', async () => {
      // Mock successful connection
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ test: 1 }] }
      });
      await client.connect();
      expect(client.isConnected()).toBe(true);
      
      // Mock failed ping
      mockedAxios.post.mockRejectedValueOnce(new Error('Connection lost'));

      const isActive = await client.ping();
      expect(isActive).toBe(false);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should mark client as disconnected', async () => {
      // Mock successful connection
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: { data: [{ test: 1 }] }
      });
      await client.connect();
      
      expect(client.isConnected()).toBe(true);
      
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });
});