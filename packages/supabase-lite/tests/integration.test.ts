import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SqlClient } from '../src/lib/sql-client.js';
import { UrlParser } from '../src/lib/url-parser.js';
import { ResultFormatter } from '../src/lib/result-formatter.js';
import { Repl } from '../src/lib/repl.js';

describe('Package Integration Tests', () => {
  describe('SqlClient Integration', () => {
    let client: SqlClient;

    beforeEach(() => {
      client = new SqlClient('http://localhost:5173');
    });

    it('should integrate URL parsing with SQL client', async () => {
      const url = 'postgresql://user:pass@localhost:5432/testdb';
      const parsed = UrlParser.parse(url);
      
      expect(parsed).toMatchObject({
        protocol: 'postgresql',
        username: 'user',
        password: 'pass',
        hostname: 'localhost',
        port: 5432,
        database: 'testdb'
      });

      // Should be able to use parsed URL for connection
      const connectionString = UrlParser.buildConnectionString(parsed);
      expect(connectionString).toContain('localhost:5432');
    });

    it('should integrate result formatting with SQL execution', async () => {
      // Mock successful query result
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 1, name: 'Test User', email: 'test@example.com' },
            { id: 2, name: 'Another User', email: 'another@example.com' }
          ],
          count: 2
        })
      });

      const result = await client.query('SELECT * FROM users');
      
      // Format results using ResultFormatter
      const formatted = ResultFormatter.formatTable(result.data || []);
      
      expect(formatted).toContain('Test User');
      expect(formatted).toContain('test@example.com');
      expect(formatted).toContain('Another User');
      
      // Should also work with different formats
      const json = ResultFormatter.formatJson(result.data || []);
      expect(json).toContain('"name": "Test User"');
      
      const csv = ResultFormatter.formatCsv(result.data || []);
      expect(csv).toContain('id,name,email');
      expect(csv).toContain('1,Test User,test@example.com');
    });

    it('should handle error responses gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({
          error: 'Invalid SQL syntax'
        })
      });

      await expect(client.query('INVALID SQL')).rejects.toThrow('Invalid SQL syntax');
    });

    it('should support different authentication methods', async () => {
      // Test API key authentication
      const apiKeyClient = new SqlClient('http://localhost:5173', { 
        apiKey: 'test-api-key' 
      });
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      });

      await apiKeyClient.query('SELECT 1');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );

      // Test JWT authentication
      const jwtClient = new SqlClient('http://localhost:5173', { 
        jwt: 'jwt-token' 
      });

      await jwtClient.query('SELECT 1');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer jwt-token'
          })
        })
      );
    });
  });

  describe('REPL Integration', () => {
    let repl: Repl;
    let mockSqlClient: SqlClient;

    beforeEach(() => {
      mockSqlClient = {
        query: vi.fn(),
        execute: vi.fn(),
        close: vi.fn()
      } as any;
      
      repl = new Repl(mockSqlClient);
    });

    it('should execute SQL commands through REPL', async () => {
      (mockSqlClient.query as any).mockResolvedValue({
        data: [{ count: 5 }]
      });

      const result = await repl.executeCommand('SELECT COUNT(*) as count FROM users');
      
      expect(mockSqlClient.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM users');
      expect(result).toContain('count');
    });

    it('should handle REPL meta commands', async () => {
      // Test \\d command (describe tables)
      (mockSqlClient.query as any).mockResolvedValue({
        data: [
          { table_name: 'users', table_schema: 'public' },
          { table_name: 'posts', table_schema: 'public' }
        ]
      });

      const result = await repl.executeCommand('\\d');
      
      expect(result).toContain('users');
      expect(result).toContain('posts');
    });

    it('should provide help for REPL commands', async () => {
      const helpResult = await repl.executeCommand('\\h');
      
      expect(helpResult).toContain('Available commands');
      expect(helpResult).toContain('\\d');
      expect(helpResult).toContain('\\l');
      expect(helpResult).toContain('\\q');
    });

    it('should handle multi-line queries', async () => {
      const multiLineQuery = `
        SELECT u.name, COUNT(p.id) as post_count
        FROM users u
        LEFT JOIN posts p ON u.id = p.user_id
        GROUP BY u.id, u.name
        ORDER BY post_count DESC;
      `;

      (mockSqlClient.query as any).mockResolvedValue({
        data: [
          { name: 'John', post_count: 5 },
          { name: 'Jane', post_count: 3 }
        ]
      });

      const result = await repl.executeCommand(multiLineQuery);
      
      expect(mockSqlClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT u.name'));
      expect(result).toContain('John');
      expect(result).toContain('post_count');
    });
  });

  describe('End-to-End Workflow', () => {
    it('should support complete database workflow', async () => {
      // 1. Parse connection URL
      const dbUrl = 'postgresql://admin:secret@db.example.com:5432/myapp';
      const parsedUrl = UrlParser.parse(dbUrl);
      
      expect(parsedUrl.username).toBe('admin');
      expect(parsedUrl.database).toBe('myapp');

      // 2. Create SQL client with parsed connection
      const client = new SqlClient(`http://${parsedUrl.hostname}:5173`);

      // 3. Mock database operations
      global.fetch = vi.fn()
        // Create table
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
        // Insert data
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            data: [{ id: 1, name: 'Test Item' }]
          })
        })
        // Query data
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { id: 1, name: 'Test Item', status: 'active' },
              { id: 2, name: 'Another Item', status: 'inactive' }
            ]
          })
        });

      // 4. Execute workflow
      await client.execute(`
        CREATE TABLE items (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'active'
        )
      `);

      const insertResult = await client.query(
        "INSERT INTO items (name) VALUES ('Test Item') RETURNING *"
      );

      const queryResult = await client.query('SELECT * FROM items');

      // 5. Format results
      const tableOutput = ResultFormatter.formatTable(queryResult.data || []);
      const jsonOutput = ResultFormatter.formatJson(queryResult.data || []);
      const csvOutput = ResultFormatter.formatCsv(queryResult.data || []);

      // 6. Verify outputs
      expect(tableOutput).toContain('Test Item');
      expect(jsonOutput).toContain('"name": "Test Item"');
      expect(csvOutput).toContain('id,name,status');

      // 7. Test with REPL
      const repl = new Repl(client);
      const replResult = await repl.executeCommand('SELECT COUNT(*) FROM items');
      expect(replResult).toBeDefined();
    });

    it('should handle connection failures gracefully', async () => {
      const client = new SqlClient('http://nonexistent:5173');

      global.fetch = vi.fn().mockRejectedValue(
        new Error('Connection refused')
      );

      await expect(client.query('SELECT 1')).rejects.toThrow('Connection refused');
    });

    it('should support transaction workflows', async () => {
      const client = new SqlClient('http://localhost:5173');

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });

      // Execute transaction
      await client.execute('BEGIN');
      await client.execute("INSERT INTO accounts (name, balance) VALUES ('Alice', 1000)");
      await client.execute("INSERT INTO accounts (name, balance) VALUES ('Bob', 500)");
      await client.execute('COMMIT');

      expect(fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error Handling Integration', () => {
    it('should provide comprehensive error information', async () => {
      const client = new SqlClient('http://localhost:5173');

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: () => Promise.resolve({
          error: 'Constraint violation',
          details: 'UNIQUE constraint failed: users.email',
          hint: 'Check for duplicate email addresses'
        })
      });

      try {
        await client.query("INSERT INTO users (email) VALUES ('duplicate@test.com')");
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Constraint violation');
        expect(error.details).toContain('UNIQUE constraint failed');
        expect(error.hint).toContain('duplicate email addresses');
      }
    });

    it('should handle network timeouts', async () => {
      const client = new SqlClient('http://localhost:5173', { timeout: 100 });

      global.fetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(client.query('SELECT * FROM slow_table')).rejects.toThrow();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large result sets efficiently', async () => {
      const client = new SqlClient('http://localhost:5173');

      // Generate large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        description: `Description for item ${i + 1}`.repeat(10)
      }));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: largeDataset
        })
      });

      const startTime = Date.now();
      const result = await client.query('SELECT * FROM large_table');
      const endTime = Date.now();

      expect(result.data).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second

      // Test formatting performance
      const formatStartTime = Date.now();
      const formatted = ResultFormatter.formatTable(result.data || []);
      const formatEndTime = Date.now();

      expect(formatted).toBeDefined();
      expect(formatEndTime - formatStartTime).toBeLessThan(500); // Format should be fast
    });
  });
});