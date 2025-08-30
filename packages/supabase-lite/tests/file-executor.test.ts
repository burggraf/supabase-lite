import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FileExecutor } from '../src/lib/file-executor.js';
import { SqlClient } from '../src/lib/sql-client.js';

// Mock file system
vi.mock('fs');
const mockedReadFileSync = vi.mocked(readFileSync);

// Mock SqlClient
vi.mock('../src/lib/sql-client.js');

describe('FileExecutor', () => {
  let mockSqlClient: any;
  let fileExecutor: FileExecutor;

  beforeEach(() => {
    mockSqlClient = {
      executeQuery: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true)
    };
    
    fileExecutor = new FileExecutor(mockSqlClient);
    vi.clearAllMocks();
  });

  describe('executeFile', () => {
    it('should execute single statement file successfully', async () => {
      const scriptContent = 'SELECT 1 as test;';
      mockedReadFileSync.mockReturnValue(scriptContent);
      
      mockSqlClient.executeQuery.mockResolvedValue({
        data: [{ test: 1 }],
        rowCount: 1,
        fields: [{ name: 'test', type: 'integer' }],
        executionTime: 5.2
      });

      const result = await fileExecutor.executeFile('/path/to/script.sql');

      expect(result.success).toBe(true);
      expect(result.totalStatements).toBe(1);
      expect(result.successfulStatements).toBe(1);
      expect(result.failedStatements).toBe(0);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
      expect(mockSqlClient.executeQuery).toHaveBeenCalledWith('SELECT 1 as test');
    });

    it('should execute multiple statements file successfully', async () => {
      const scriptContent = `
        SELECT 1 as first;
        SELECT 2 as second;
        SELECT 3 as third;
      `;
      mockedReadFileSync.mockReturnValue(scriptContent);
      
      mockSqlClient.executeQuery
        .mockResolvedValueOnce({ data: [{ first: 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ data: [{ second: 2 }], rowCount: 1 })
        .mockResolvedValueOnce({ data: [{ third: 3 }], rowCount: 1 });

      const result = await fileExecutor.executeFile('/path/to/script.sql');

      expect(result.success).toBe(true);
      expect(result.totalStatements).toBe(3);
      expect(result.successfulStatements).toBe(3);
      expect(result.failedStatements).toBe(0);
      expect(mockSqlClient.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle file read errors', async () => {
      mockedReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(fileExecutor.executeFile('/nonexistent/script.sql'))
        .rejects.toThrow('Failed to read SQL file');
    });

    it('should handle SQL execution errors', async () => {
      const scriptContent = `
        SELECT 1;
        SELECT * FROM nonexistent_table;
        SELECT 2;
      `;
      mockedReadFileSync.mockReturnValue(scriptContent);
      
      mockSqlClient.executeQuery
        .mockResolvedValueOnce({ data: [{ '?column?': 1 }], rowCount: 1 })
        .mockRejectedValueOnce({ 
          error: 'PGRST106', 
          message: 'relation "nonexistent_table" does not exist' 
        })
        .mockResolvedValueOnce({ data: [{ '?column?': 2 }], rowCount: 1 });

      // Test with continueOnError = false (default)
      const result = await fileExecutor.executeFile('/path/to/script.sql');

      expect(result.success).toBe(false);
      expect(result.totalStatements).toBe(3);
      expect(result.successfulStatements).toBe(1);
      expect(result.failedStatements).toBe(1);
      expect(result.results).toHaveLength(2); // Stopped after error
      expect(mockSqlClient.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should continue on error when requested', async () => {
      const scriptContent = `
        SELECT 1;
        SELECT * FROM nonexistent_table;
        SELECT 2;
      `;
      mockedReadFileSync.mockReturnValue(scriptContent);
      
      mockSqlClient.executeQuery
        .mockResolvedValueOnce({ data: [{ '?column?': 1 }], rowCount: 1 })
        .mockRejectedValueOnce({ 
          error: 'PGRST106', 
          message: 'relation "nonexistent_table" does not exist' 
        })
        .mockResolvedValueOnce({ data: [{ '?column?': 2 }], rowCount: 1 });

      const result = await fileExecutor.executeFile('/path/to/script.sql', {
        continueOnError: true
      });

      expect(result.success).toBe(false);
      expect(result.totalStatements).toBe(3);
      expect(result.successfulStatements).toBe(2);
      expect(result.failedStatements).toBe(1);
      expect(result.results).toHaveLength(3);
      expect(mockSqlClient.executeQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle empty file', async () => {
      mockedReadFileSync.mockReturnValue('-- Just comments\n/* More comments */');

      await expect(fileExecutor.executeFile('/path/to/empty.sql'))
        .rejects.toThrow('No executable SQL statements found in file');
    });

    it('should validate SQL script before execution', async () => {
      mockedReadFileSync.mockReturnValue("SELECT 'unclosed string;");

      await expect(fileExecutor.executeFile('/path/to/invalid.sql'))
        .rejects.toThrow('Invalid SQL script');
    });

    it('should track execution time', async () => {
      const scriptContent = 'SELECT 1;';
      mockedReadFileSync.mockReturnValue(scriptContent);
      
      mockSqlClient.executeQuery.mockResolvedValue({
        data: [{ '?column?': 1 }],
        rowCount: 1
      });

      const result = await fileExecutor.executeFile('/path/to/script.sql');

      expect(result.totalExecutionTime).toBeGreaterThan(0);
      expect(result.results[0].executionTime).toBeGreaterThan(0);
    });
  });

  describe('executeFiles', () => {
    it('should execute multiple files successfully', async () => {
      mockedReadFileSync
        .mockReturnValueOnce('SELECT 1;')
        .mockReturnValueOnce('SELECT 2;');
      
      mockSqlClient.executeQuery
        .mockResolvedValueOnce({ data: [{ '?column?': 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ data: [{ '?column?': 2 }], rowCount: 1 });

      const results = await fileExecutor.executeFiles([
        '/path/to/script1.sql',
        '/path/to/script2.sql'
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockSqlClient.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should stop on error when continueOnError is false', async () => {
      mockedReadFileSync
        .mockReturnValueOnce('SELECT 1;')
        .mockImplementationOnce(() => {
          throw new Error('File not found');
        });

      await expect(fileExecutor.executeFiles([
        '/path/to/script1.sql',
        '/path/to/nonexistent.sql'
      ])).rejects.toThrow('File not found');
    });

    it('should continue on error when requested', async () => {
      mockedReadFileSync
        .mockReturnValueOnce('SELECT 1;')
        .mockImplementationOnce(() => {
          throw new Error('File not found');
        })
        .mockReturnValueOnce('SELECT 3;');
      
      mockSqlClient.executeQuery
        .mockResolvedValueOnce({ data: [{ '?column?': 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ data: [{ '?column?': 3 }], rowCount: 1 });

      const results = await fileExecutor.executeFiles([
        '/path/to/script1.sql',
        '/path/to/nonexistent.sql',
        '/path/to/script3.sql'
      ], { continueOnError: true });

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('summarizeResults', () => {
    it('should summarize multiple file results', () => {
      const results = [
        {
          filePath: '/script1.sql',
          totalStatements: 2,
          successfulStatements: 2,
          failedStatements: 0,
          results: [],
          totalExecutionTime: 10.5,
          success: true
        },
        {
          filePath: '/script2.sql',
          totalStatements: 3,
          successfulStatements: 2,
          failedStatements: 1,
          results: [],
          totalExecutionTime: 15.2,
          success: false
        }
      ];

      const summary = FileExecutor.summarizeResults(results);

      expect(summary.totalFiles).toBe(2);
      expect(summary.successfulFiles).toBe(1);
      expect(summary.failedFiles).toBe(1);
      expect(summary.totalStatements).toBe(5);
      expect(summary.successfulStatements).toBe(4);
      expect(summary.failedStatements).toBe(1);
      expect(summary.totalExecutionTime).toBe(25.7);
    });
  });
});