import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock external dependencies
vi.mock('../src/lib/sql-client.js', () => ({
  SqlClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    executeQuery: vi.fn().mockResolvedValue({ rows: [], affectedRows: 0 }),
    getConnectionInfo: vi.fn().mockReturnValue({ 
      url: 'http://localhost:5173', 
      projectId: 'test-project' 
    })
  }))
}));

vi.mock('../src/lib/repl.js', () => ({
  Repl: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../src/lib/file-executor.js', () => ({
  FileExecutor: vi.fn().mockImplementation(() => ({
    executeFile: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../src/lib/proxy/auto-proxy-manager.js', () => ({
  AutoProxyManager: {
    getInstance: vi.fn().mockReturnValue({
      ensureProxy: vi.fn().mockImplementation((url: string) => Promise.resolve(url))
    })
  }
}));

vi.mock('../src/lib/url-parser.js', () => ({
  UrlParser: {
    validate: vi.fn().mockReturnValue({ valid: true }),
    parse: vi.fn().mockReturnValue({ baseUrl: 'http://localhost:5173' })
  }
}));

vi.mock('../src/lib/result-formatter.js', () => ({
  ResultFormatter: {
    formatQueryResult: vi.fn().mockReturnValue('formatted result'),
    formatError: vi.fn().mockReturnValue('formatted error'),
    formatGeneralError: vi.fn().mockReturnValue('formatted general error'),
    formatConnection: vi.fn().mockReturnValue('connection info')
  }
}));

// Mock console and process
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
};

const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

describe('PSQL Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    processExitSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Creation', () => {
    it('should create psql command with correct configuration', async () => {
      const { createPsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('psql');
      expect(command.description()).toContain('Connect to Supabase Lite database');
    });

    it('should have required URL option', async () => {
      const { createPsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      const options = command.options;
      
      const urlOption = options.find((opt: any) => opt.short === '-u');
      expect(urlOption).toBeDefined();
      expect(urlOption.long).toBe('--url');
      expect(urlOption.required).toBe(true);
    });

    it('should have optional command option', async () => {
      const { createPsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      const options = command.options;
      
      const commandOption = options.find((opt: any) => opt.short === '-c');
      expect(commandOption).toBeDefined();
      expect(commandOption.long).toBe('--command');
      expect(commandOption.required).toBe(false);
    });

    it('should have optional file option', async () => {
      const { createPsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      const options = command.options;
      
      const fileOption = options.find((opt: any) => opt.short === '-f');
      expect(fileOption).toBeDefined();
      expect(fileOption.long).toBe('--file');
      expect(fileOption.required).toBe(false);
    });

    it('should have quiet option', async () => {
      const { createPsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      const options = command.options;
      
      const quietOption = options.find((opt: any) => opt.short === '-q');
      expect(quietOption).toBeDefined();
      expect(quietOption.long).toBe('--quiet');
    });

    it('should have continue-on-error option', async () => {
      const { createPsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      const options = command.options;
      
      const continueOption = options.find((opt: any) => opt.long === '--continue-on-error');
      expect(continueOption).toBeDefined();
    });

    it('should have show-progress option', async () => {
      const { createPsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      const options = command.options;
      
      const progressOption = options.find((opt: any) => opt.long === '--show-progress');
      expect(progressOption).toBeDefined();
    });
  });

  describe('URL Validation', () => {
    it('should validate URL before executing', async () => {
      const { UrlParser } = await import('../src/lib/url-parser.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      UrlParser.validate.mockReturnValueOnce({ valid: false, error: 'Invalid URL' });
      
      await expect(async () => {
        await executePsqlCommand({ url: 'invalid-url' });
      }).rejects.toThrow('process.exit called');
      
      expect(UrlParser.validate).toHaveBeenCalledWith('invalid-url');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should proceed with valid URL', async () => {
      const { UrlParser } = await import('../src/lib/url-parser.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      UrlParser.validate.mockReturnValueOnce({ valid: true });
      
      await executePsqlCommand({ url: 'http://localhost:5173' });
      
      expect(UrlParser.validate).toHaveBeenCalledWith('http://localhost:5173');
    });
  });

  describe('Proxy Management', () => {
    it('should set up proxy for HTTPS URLs', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockManager = AutoProxyManager.getInstance();
      mockManager.ensureProxy.mockResolvedValueOnce('http://localhost:3000');
      
      await executePsqlCommand({ url: 'https://supabase-lite.pages.dev' });
      
      expect(mockManager.ensureProxy).toHaveBeenCalledWith('https://supabase-lite.pages.dev');
    });
  });

  describe('Command Execution Mode', () => {
    it('should execute single command when -c option provided', async () => {
      const { SqlClient } = await import('../src/lib/sql-client.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockClient = new SqlClient('http://localhost:5173');
      
      await executePsqlCommand({ 
        url: 'http://localhost:5173', 
        command: 'SELECT 1' 
      });
      
      expect(mockClient.executeQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('should execute file when -f option provided', async () => {
      const { FileExecutor } = await import('../src/lib/file-executor.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockExecutor = new FileExecutor(expect.any(Object));
      
      await executePsqlCommand({ 
        url: 'http://localhost:5173', 
        file: 'test.sql' 
      });
      
      expect(mockExecutor.executeFile).toHaveBeenCalledWith('test.sql', {
        continueOnError: false,
        showProgress: false
      });
    });

    it('should start REPL when no command or file provided', async () => {
      const { Repl } = await import('../src/lib/repl.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockRepl = new Repl(expect.any(Object));
      
      await expect(async () => {
        await executePsqlCommand({ url: 'http://localhost:5173' });
      }).rejects.toThrow('process.exit called');
      
      expect(mockRepl.start).toHaveBeenCalled();
    });
  });

  describe('Options Processing', () => {
    it('should pass continueOnError option to file executor', async () => {
      const { FileExecutor } = await import('../src/lib/file-executor.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockExecutor = new FileExecutor(expect.any(Object));
      
      await executePsqlCommand({ 
        url: 'http://localhost:5173', 
        file: 'test.sql',
        continueOnError: true
      });
      
      expect(mockExecutor.executeFile).toHaveBeenCalledWith('test.sql', {
        continueOnError: true,
        showProgress: false
      });
    });

    it('should pass showProgress option to file executor', async () => {
      const { FileExecutor } = await import('../src/lib/file-executor.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockExecutor = new FileExecutor(expect.any(Object));
      
      await executePsqlCommand({ 
        url: 'http://localhost:5173', 
        file: 'test.sql',
        showProgress: true
      });
      
      expect(mockExecutor.executeFile).toHaveBeenCalledWith('test.sql', {
        continueOnError: false,
        showProgress: true
      });
    });

    it('should suppress connection messages when quiet option is true', async () => {
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      await executePsqlCommand({ 
        url: 'http://localhost:5173',
        quiet: true
      });
      
      // When quiet, should not log connection info
      // This is implementation specific and may need adjustment based on actual behavior
      expect(consoleSpy.log).not.toHaveBeenCalledWith(
        expect.stringContaining('connection info')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle SQL client connection errors', async () => {
      const { SqlClient } = await import('../src/lib/sql-client.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockClient = new SqlClient('http://localhost:5173');
      mockClient.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(async () => {
        await executePsqlCommand({ url: 'http://localhost:5173' });
      }).rejects.toThrow();
    });

    it('should handle query execution errors', async () => {
      const { SqlClient } = await import('../src/lib/sql-client.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockClient = new SqlClient('http://localhost:5173');
      mockClient.executeQuery.mockRejectedValueOnce(new Error('Query failed'));
      
      await expect(async () => {
        await executePsqlCommand({ 
          url: 'http://localhost:5173', 
          command: 'INVALID SQL' 
        });
      }).rejects.toThrow();
    });

    it('should handle file execution errors', async () => {
      const { FileExecutor } = await import('../src/lib/file-executor.js');
      const { executePsqlCommand } = await import('../src/commands/psql.js');
      
      const mockExecutor = new FileExecutor(expect.any(Object));
      mockExecutor.executeFile.mockRejectedValueOnce(new Error('File not found'));
      
      await expect(async () => {
        await executePsqlCommand({ 
          url: 'http://localhost:5173', 
          file: 'nonexistent.sql' 
        });
      }).rejects.toThrow();
    });
  });

  describe('Integration', () => {
    it('should create complete PSQL workflow', async () => {
      const { createPsqlCommand, executePsqlCommand } = await import('../src/commands/psql.js');
      
      const command = createPsqlCommand();
      expect(command).toBeDefined();
      
      // Should be able to execute without errors
      await executePsqlCommand({ url: 'http://localhost:5173' });
    });
  });
});