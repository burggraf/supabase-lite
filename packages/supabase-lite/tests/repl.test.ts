import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Create mock readline interface
const createMockRl = () => {
  const mockRl = new EventEmitter() as any;
  mockRl.prompt = vi.fn();
  mockRl.setPrompt = vi.fn();
  mockRl.write = vi.fn();
  mockRl.close = vi.fn();
  mockRl.question = vi.fn();
  return mockRl;
};

let mockRl: any;

// Mock readline module
vi.mock('readline', () => ({
  createInterface: vi.fn().mockImplementation(() => {
    mockRl = createMockRl();
    return mockRl;
  })
}));

// Mock SqlClient
const mockSqlClient = {
  getConnectionInfo: vi.fn().mockReturnValue({
    url: 'http://localhost:5173',
    projectId: 'test-project'
  }),
  executeQuery: vi.fn().mockResolvedValue({
    rows: [{ id: 1, name: 'test' }],
    affectedRows: 1
  })
};

// Mock ResultFormatter
vi.mock('../src/lib/result-formatter.js', () => ({
  ResultFormatter: {
    formatConnection: vi.fn().mockReturnValue('Connected to test database'),
    formatQueryResult: vi.fn().mockReturnValue('Query result formatted'),
    formatError: vi.fn().mockReturnValue('Error formatted'),
    formatGeneralError: vi.fn().mockReturnValue('General error formatted')
  }
}));

// Mock console
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
};

// Mock process
const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('Repl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    processExitSpy.mockClear();
    mockRl.removeAllListeners();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create REPL instance with SQL client', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      expect(repl).toBeDefined();
      expect(readline.createInterface).toHaveBeenCalledWith({
        input: process.stdin,
        output: process.stdout,
        prompt: 'supabase-lite=# ',
        history: [],
        historySize: 100
      });
    });

    it('should set up event handlers during construction', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      new Repl(mockSqlClient as any);
      
      expect(mockRl.listenerCount('line')).toBeGreaterThan(0);
      expect(mockRl.listenerCount('SIGINT')).toBeGreaterThan(0);
    });
  });

  describe('Start Method', () => {
    it('should display connection info on start', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      const { ResultFormatter } = await import('../src/lib/result-formatter.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      // Simulate immediate close to resolve the promise
      setTimeout(() => mockRl.emit('close'), 10);
      
      await startPromise;
      
      expect(mockSqlClient.getConnectionInfo).toHaveBeenCalled();
      expect(ResultFormatter.formatConnection).toHaveBeenCalledWith(
        'http://localhost:5173',
        'test-project'
      );
      expect(consoleSpy.log).toHaveBeenCalledWith('Connected to test database');
    });

    it('should show initial prompt', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      setTimeout(() => mockRl.emit('close'), 10);
      await startPromise;
      
      expect(mockRl.prompt).toHaveBeenCalled();
    });

    it('should return promise that resolves when REPL closes', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      // Simulate close event
      setTimeout(() => mockRl.emit('close'), 10);
      
      await expect(startPromise).resolves.toBeUndefined();
    });
  });

  describe('Line Processing', () => {
    it('should handle simple SQL query', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      const { ResultFormatter } = await import('../src/lib/result-formatter.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      // Simulate user input
      setTimeout(() => {
        mockRl.emit('line', 'SELECT 1;');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(mockSqlClient.executeQuery).toHaveBeenCalledWith('SELECT 1');
      expect(ResultFormatter.formatQueryResult).toHaveBeenCalled();
    });

    it('should handle multiline queries', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', 'SELECT *');
        mockRl.emit('line', 'FROM users;');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(mockSqlClient.executeQuery).toHaveBeenCalledWith('SELECT *\nFROM users');
    });

    it('should change prompt for continuation lines', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', 'SELECT *');
        // Check that prompt changes for continuation
        expect(mockRl.setPrompt).toHaveBeenCalledWith('supabase-lite-# ');
        
        mockRl.emit('line', 'FROM users;');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
    });

    it('should handle empty lines gracefully', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', '');
        mockRl.emit('line', '   ');
        mockRl.emit('line', 'SELECT 1;');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      // Should only execute the actual query
      expect(mockSqlClient.executeQuery).toHaveBeenCalledTimes(1);
      expect(mockSqlClient.executeQuery).toHaveBeenCalledWith('SELECT 1');
    });
  });

  describe('Meta Commands', () => {
    it('should handle \\q quit command', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', '\\q');
        // Should close the readline interface
      }, 10);
      
      await startPromise;
      
      expect(mockRl.close).toHaveBeenCalled();
    });

    it('should handle \\h help command', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', '\\h');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Available commands:'));
    });

    it('should handle \\l list databases command', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', '\\l');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      // Should show connection info or database list
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should handle \\d describe tables command', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', '\\d');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      // Should execute a query to show tables
      expect(mockSqlClient.executeQuery).toHaveBeenCalled();
    });

    it('should handle unknown meta commands gracefully', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', '\\unknown');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown command')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle SQL query errors gracefully', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      const { ResultFormatter } = await import('../src/lib/result-formatter.js');
      
      mockSqlClient.executeQuery.mockRejectedValueOnce(new Error('Query failed'));
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', 'INVALID SQL;');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(ResultFormatter.formatError).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should continue after errors', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      mockSqlClient.executeQuery
        .mockRejectedValueOnce(new Error('First query failed'))
        .mockResolvedValueOnce({ rows: [], affectedRows: 0 });
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', 'INVALID SQL;');
        mockRl.emit('line', 'SELECT 1;');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(mockSqlClient.executeQuery).toHaveBeenCalledTimes(2);
      expect(mockRl.prompt).toHaveBeenCalledTimes(3); // Initial + after each command
    });
  });

  describe('SIGINT Handling', () => {
    it('should handle Ctrl+C gracefully', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('SIGINT');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Ctrl+C')
      );
    });

    it('should clear multiline buffer on SIGINT', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        // Start multiline query
        mockRl.emit('line', 'SELECT *');
        // Interrupt with Ctrl+C
        mockRl.emit('SIGINT');
        // Should reset to normal prompt
        expect(mockRl.setPrompt).toHaveBeenCalledWith('supabase-lite=# ');
        
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
    });
  });

  describe('Stop Method', () => {
    it('should close readline interface', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      repl.stop();
      
      expect(mockRl.close).toHaveBeenCalled();
    });
  });

  describe('Query Buffer Management', () => {
    it('should accumulate multiline queries correctly', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', 'SELECT id,');
        mockRl.emit('line', '       name,');
        mockRl.emit('line', '       email');
        mockRl.emit('line', 'FROM users;');
        setTimeout(() => mockRl.emit('close'), 10);
      }, 10);
      
      await startPromise;
      
      expect(mockSqlClient.executeQuery).toHaveBeenCalledWith(
        'SELECT id,\n       name,\n       email\nFROM users'
      );
    });

    it('should clear buffer after successful execution', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      
      const startPromise = repl.start();
      
      setTimeout(() => {
        mockRl.emit('line', 'SELECT 1;');
        // After execution, prompt should return to normal
        setTimeout(() => {
          expect(mockRl.setPrompt).toHaveBeenLastCalledWith('supabase-lite=# ');
          mockRl.emit('close');
        }, 10);
      }, 10);
      
      await startPromise;
    });
  });

  describe('Integration', () => {
    it('should work with real SqlClient interface', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      
      const repl = new Repl(mockSqlClient as any);
      expect(repl).toBeDefined();
      
      // Should be able to start and stop without errors
      const startPromise = repl.start();
      setTimeout(() => mockRl.emit('close'), 10);
      await startPromise;
      
      repl.stop();
    });
  });
});