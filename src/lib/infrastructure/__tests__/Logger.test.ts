import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InfrastructureLogger, logger } from '../Logger';
import type { LogLevel } from '@/types/infrastructure';

describe('InfrastructureLogger', () => {
  let testLogger: InfrastructureLogger;

  beforeEach(() => {
    testLogger = new InfrastructureLogger(100, 'debug');
    vi.clearAllMocks();
  });

  describe('Basic logging functionality', () => {
    it('should log debug messages when log level allows', () => {
      testLogger.debug('Test debug message', { key: 'value' });
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('debug');
      expect(entries[0].message).toBe('Test debug message');
      expect(entries[0].context).toEqual({ key: 'value' });
    });

    it('should log info messages', () => {
      testLogger.info('Test info message');
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('info');
      expect(entries[0].message).toBe('Test info message');
    });

    it('should log warn messages', () => {
      testLogger.warn('Test warn message');
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('warn');
      expect(entries[0].message).toBe('Test warn message');
    });

    it('should log error messages with error objects', () => {
      const error = new Error('Test error');
      testLogger.error('Something went wrong', error, { userId: 123 });
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
      expect(entries[0].message).toBe('Something went wrong');
      expect(entries[0].context).toEqual({
        userId: 123,
        error: {
          name: 'Error',
          message: 'Test error',
          stack: error.stack,
        },
      });
    });
  });

  describe('Log level filtering', () => {
    it('should respect log level filtering', () => {
      testLogger.setLogLevel('warn');
      
      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warn message');
      testLogger.error('Error message');
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('should get and set log levels correctly', () => {
      expect(testLogger.getLogLevel()).toBe('debug');
      
      testLogger.setLogLevel('info');
      expect(testLogger.getLogLevel()).toBe('info');
    });
  });

  describe('Entry management', () => {
    it('should limit the number of entries', () => {
      const smallLogger = new InfrastructureLogger(3, 'debug');
      
      smallLogger.info('Message 1');
      smallLogger.info('Message 2');
      smallLogger.info('Message 3');
      smallLogger.info('Message 4');
      smallLogger.info('Message 5');
      
      const entries = smallLogger.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe('Message 3');
      expect(entries[2].message).toBe('Message 5');
    });

    it('should clear entries', () => {
      testLogger.info('Test message');
      expect(testLogger.getEntries()).toHaveLength(1);
      
      testLogger.clear();
      expect(testLogger.getEntries()).toHaveLength(0);
    });
  });

  describe('Performance timing', () => {
    it('should time synchronous operations', () => {
      const result = testLogger.time('sync-operation', () => {
        return 'result';
      });
      
      expect(result).toBe('result');
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('sync-operation completed');
      expect(entries[0].context).toHaveProperty('duration');
      expect(typeof entries[0].context!.duration).toBe('number');
    });

    it('should time asynchronous operations', async () => {
      const result = await testLogger.time('async-operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async-result';
      });
      
      expect(result).toBe('async-result');
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('async-operation completed');
      expect(entries[0].context).toHaveProperty('duration');
    });

    it('should handle errors in timed operations', () => {
      expect(() => {
        testLogger.time('error-operation', () => {
          throw new Error('Operation failed');
        });
      }).toThrow('Operation failed');
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
      expect(entries[0].message).toBe('error-operation failed');
    });

    it('should time async operations with timeAsync', async () => {
      const result = await testLogger.timeAsync('async-test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 42;
      });
      
      expect(result).toBe(42);
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('async-test completed');
    });
  });

  describe('Export and import functionality', () => {
    it('should export logs as JSON', () => {
      testLogger.info('Test message', { data: 'value' });
      
      const exported = testLogger.export();
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].message).toBe('Test message');
    });

    it('should import logs from JSON', () => {
      const logData = [
        {
          level: 'info' as LogLevel,
          message: 'Imported message',
          timestamp: new Date().toISOString(),
          context: { imported: true },
        },
      ];
      
      testLogger.import(JSON.stringify(logData));
      
      const entries = testLogger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Imported message');
      expect(entries[0].context).toEqual({ imported: true });
    });

    it('should handle invalid JSON during import', () => {
      testLogger.import('invalid json');
      
      const entries = testLogger.getEntries();
      // Should have one error entry for the failed import
      expect(entries.some(entry => 
        entry.level === 'error' && 
        entry.message === 'Failed to import logs'
      )).toBe(true);
    });
  });

  describe('Console output in development', () => {
    it('should call console methods in development mode', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const originalEnv = import.meta.env.DEV;
      
      // Mock DEV environment
      (import.meta.env as any).DEV = true;
      
      const devLogger = new InfrastructureLogger(100, 'debug');
      devLogger.info('Test message');
      
      expect(consoleSpy).toHaveBeenCalled();
      
      // Restore
      (import.meta.env as any).DEV = originalEnv;
      consoleSpy.mockRestore();
    });
  });
});

describe('Global logger instance', () => {
  beforeEach(() => {
    logger.clear();
  });

  it('should be available as a singleton', () => {
    logger.info('Test message');
    expect(logger.getEntries()).toHaveLength(1);
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    logger.clear();
  });

  it('should provide logQuery convenience function', async () => {
    const { logQuery } = await import('../Logger');
    
    logQuery('SELECT * FROM users', 123.45, 10);
    
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('debug');
    expect(entries[0].message).toBe('Database query executed');
    expect(entries[0].context).toEqual({
      sql: 'SELECT * FROM users',
      duration: 123.45,
      rowCount: 10,
    });
  });

  it('should provide logError convenience function', async () => {
    const { logError } = await import('../Logger');
    const error = new Error('Test error');
    
    logError('Database operation', error, { table: 'users' });
    
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('error');
    expect(entries[0].message).toBe('Database operation failed');
  });

  it('should provide logPerformance convenience function', async () => {
    const { logPerformance } = await import('../Logger');
    
    logPerformance('API request', 250, { endpoint: '/api/users' });
    
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe('info');
    expect(entries[0].message).toBe('Performance: API request');
    expect(entries[0].context).toEqual({
      duration: 250,
      endpoint: '/api/users',
    });
  });
});