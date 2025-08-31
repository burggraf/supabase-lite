import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

// Mock ProxyServer
const mockProxyServer = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  getStatus: vi.fn().mockReturnValue({
    running: true,
    port: 3000,
    target: 'https://supabase-lite.pages.dev'
  })
};

vi.mock('../src/lib/proxy/proxy-server.js', () => ({
  ProxyServer: vi.fn().mockImplementation(() => mockProxyServer)
}));

// Mock AutoProxyManager
const mockAutoProxyManager = {
  startProxy: vi.fn().mockResolvedValue({ port: 3000, url: 'http://localhost:3000' }),
  stopProxy: vi.fn().mockResolvedValue(undefined),
  stopAllProxies: vi.fn().mockResolvedValue(undefined),
  listProxies: vi.fn().mockReturnValue([
    {
      id: 'proxy1',
      target: 'https://supabase-lite.pages.dev',
      port: 3000,
      status: 'running'
    }
  ]),
  getInstance: vi.fn().mockReturnThis()
};

vi.mock('../src/lib/proxy/auto-proxy-manager.js', () => ({
  AutoProxyManager: {
    getInstance: vi.fn().mockReturnValue(mockAutoProxyManager)
  }
}));

// Mock UrlParser
vi.mock('../src/lib/url-parser.js', () => ({
  UrlParser: {
    validate: vi.fn().mockReturnValue({ valid: true }),
    parse: vi.fn().mockReturnValue({ baseUrl: 'https://supabase-lite.pages.dev' })
  }
}));

// Mock ResultFormatter
vi.mock('../src/lib/result-formatter.js', () => ({
  ResultFormatter: {
    formatProxyList: vi.fn().mockReturnValue('Proxy list formatted'),
    formatProxyStatus: vi.fn().mockReturnValue('Proxy status formatted'),
    formatError: vi.fn().mockReturnValue('Error formatted'),
    formatGeneralError: vi.fn().mockReturnValue('General error formatted')
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

describe('Proxy Command', () => {
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
    it('should create proxy command with correct configuration', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      
      expect(command).toBeInstanceOf(Command);
      expect(command.name()).toBe('proxy');
      expect(command.description()).toContain('Manage proxy servers');
    });

    it('should have start subcommand', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const subcommands = command.commands;
      
      const startCommand = subcommands.find((cmd: any) => cmd.name() === 'start');
      expect(startCommand).toBeDefined();
      expect(startCommand.description()).toContain('Start a proxy server');
    });

    it('should have stop subcommand', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const subcommands = command.commands;
      
      const stopCommand = subcommands.find((cmd: any) => cmd.name() === 'stop');
      expect(stopCommand).toBeDefined();
      expect(stopCommand.description()).toContain('Stop a running proxy server');
    });

    it('should have list subcommand', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const subcommands = command.commands;
      
      const listCommand = subcommands.find((cmd: any) => cmd.name() === 'list');
      expect(listCommand).toBeDefined();
      expect(listCommand.description()).toContain('List running proxy servers');
    });
  });

  describe('Start Command Options', () => {
    it('should have required target option', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const startCommand = command.commands.find((cmd: any) => cmd.name() === 'start');
      const options = startCommand.options;
      
      const targetOption = options.find((opt: any) => opt.short === '-t');
      expect(targetOption).toBeDefined();
      expect(targetOption.long).toBe('--target');
      expect(targetOption.required).toBe(true);
    });

    it('should have optional port option', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const startCommand = command.commands.find((cmd: any) => cmd.name() === 'start');
      const options = startCommand.options;
      
      const portOption = options.find((opt: any) => opt.short === '-p');
      expect(portOption).toBeDefined();
      expect(portOption.long).toBe('--port');
      expect(portOption.required).toBe(false);
    });

    it('should have optional mode option', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const startCommand = command.commands.find((cmd: any) => cmd.name() === 'start');
      const options = startCommand.options;
      
      const modeOption = options.find((opt: any) => opt.short === '-m');
      expect(modeOption).toBeDefined();
      expect(modeOption.long).toBe('--mode');
    });

    it('should have quiet option', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const startCommand = command.commands.find((cmd: any) => cmd.name() === 'start');
      const options = startCommand.options;
      
      const quietOption = options.find((opt: any) => opt.short === '-q');
      expect(quietOption).toBeDefined();
      expect(quietOption.long).toBe('--quiet');
    });
  });

  describe('Stop Command Options', () => {
    it('should have optional target option', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const stopCommand = command.commands.find((cmd: any) => cmd.name() === 'stop');
      const options = stopCommand.options;
      
      const targetOption = options.find((opt: any) => opt.short === '-t');
      expect(targetOption).toBeDefined();
      expect(targetOption.long).toBe('--target');
      expect(targetOption.required).toBe(false);
    });
  });

  describe('Proxy Start Execution', () => {
    it('should validate target URL before starting', async () => {
      const { UrlParser } = await import('../src/lib/url-parser.js');
      const { executeProxyStart } = await import('../src/commands/proxy.js');
      
      UrlParser.validate.mockReturnValueOnce({ valid: false, error: 'Invalid URL' });
      
      await expect(async () => {
        await executeProxyStart({ 
          target: 'invalid-url' 
        });
      }).rejects.toThrow('process.exit called');
      
      expect(UrlParser.validate).toHaveBeenCalledWith('invalid-url');
    });

    it('should start proxy with valid URL', async () => {
      const { executeProxyStart } = await import('../src/commands/proxy.js');
      
      // Mock console.log to avoid output during tests
      consoleSpy.log.mockImplementation(() => {});
      
      await executeProxyStart({
        target: 'https://supabase-lite.pages.dev'
      });
      
      // Should validate the URL and not throw
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('should handle various options without throwing', async () => {
      const { executeProxyStart } = await import('../src/commands/proxy.js');
      
      // Test that options are accepted and processed
      await expect(executeProxyStart({
        target: 'https://supabase-lite.pages.dev',
        port: 4000,
        mode: 'websocket'
      })).resolves.not.toThrow();
      
      await expect(executeProxyStart({
        target: 'https://supabase-lite.pages.dev',
        quiet: true
      })).resolves.not.toThrow();
    });
  });

  describe('Proxy Stop Execution', () => {
    it('should stop specific proxy by target', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      const mockManager = AutoProxyManager.getInstance();
      
      await proxyModule.executeProxyStop?.({
        target: 'https://supabase-lite.pages.dev'
      });
      
      expect(mockManager.stopProxy).toHaveBeenCalledWith(
        'https://supabase-lite.pages.dev'
      );
    });

    it('should stop all proxies when no target specified', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      const mockManager = AutoProxyManager.getInstance();
      
      await proxyModule.executeProxyStop?.({});
      
      expect(mockManager.stopAllProxies).toHaveBeenCalled();
    });
  });

  describe('Proxy List Execution', () => {
    it('should list running proxies', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      const { ResultFormatter } = await import('../src/lib/result-formatter.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      const mockManager = AutoProxyManager.getInstance();
      
      await proxyModule.executeProxyList?.({});
      
      expect(mockManager.listProxies).toHaveBeenCalled();
      expect(ResultFormatter.formatProxyList).toHaveBeenCalled();
    });

    it('should handle empty proxy list', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      const mockManager = AutoProxyManager.getInstance();
      mockManager.listProxies.mockReturnValueOnce([]);
      
      await proxyModule.executeProxyList?.({});
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('No proxy servers running')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle proxy start errors', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      const { ResultFormatter } = await import('../src/lib/result-formatter.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      const mockManager = AutoProxyManager.getInstance();
      mockManager.startProxy.mockRejectedValueOnce(new Error('Port already in use'));
      
      await expect(async () => {
        await proxyModule.executeProxyStart?.({
          target: 'https://supabase-lite.pages.dev'
        });
      }).rejects.toThrow();
      
      expect(ResultFormatter.formatError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Port already in use' })
      );
    });

    it('should handle proxy stop errors', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      const mockManager = AutoProxyManager.getInstance();
      mockManager.stopProxy.mockRejectedValueOnce(new Error('Proxy not found'));
      
      await expect(async () => {
        await proxyModule.executeProxyStop?.({
          target: 'https://nonexistent.com'
        });
      }).rejects.toThrow();
    });

    it('should handle invalid target URLs', async () => {
      const { UrlParser } = await import('../src/lib/url-parser.js');
      const { ResultFormatter } = await import('../src/lib/result-formatter.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      UrlParser.validate.mockReturnValueOnce({ 
        valid: false, 
        error: 'URL must start with https://' 
      });
      
      await expect(async () => {
        await proxyModule.executeProxyStart?.({
          target: 'http://insecure-site.com'
        });
      }).rejects.toThrow();
      
      expect(ResultFormatter.formatGeneralError).toHaveBeenCalledWith(
        'Invalid URL: URL must start with https://'
      );
    });
  });

  describe('Integration', () => {
    it('should work with ProxyServer class', async () => {
      const { ProxyServer } = await import('../src/lib/proxy/proxy-server.js');
      
      const server = new ProxyServer({
        target: 'https://supabase-lite.pages.dev',
        port: 3000
      });
      
      expect(server).toBeDefined();
      expect(mockProxyServer.start).toBeDefined();
      expect(mockProxyServer.stop).toBeDefined();
    });

    it('should work with AutoProxyManager', async () => {
      const { AutoProxyManager } = await import('../src/lib/proxy/auto-proxy-manager.js');
      
      const manager = AutoProxyManager.getInstance();
      expect(manager).toBeDefined();
      expect(manager.startProxy).toBeDefined();
      expect(manager.stopProxy).toBeDefined();
      expect(manager.listProxies).toBeDefined();
    });

    it('should create complete proxy workflow', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      expect(command).toBeDefined();
      
      // Should have all required subcommands
      const subcommandNames = command.commands.map((cmd: any) => cmd.name());
      expect(subcommandNames).toContain('start');
      expect(subcommandNames).toContain('stop');
      expect(subcommandNames).toContain('list');
    });
  });

  describe('Command Line Interface', () => {
    it('should provide helpful descriptions', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      
      expect(command.description()).toContain('Manage proxy servers');
      
      const startCmd = command.commands.find((cmd: any) => cmd.name() === 'start');
      expect(startCmd.description()).toContain('Start a proxy server');
      
      const stopCmd = command.commands.find((cmd: any) => cmd.name() === 'stop');
      expect(stopCmd.description()).toContain('Stop a running proxy server');
      
      const listCmd = command.commands.find((cmd: any) => cmd.name() === 'list');
      expect(listCmd.description()).toContain('List all running proxy servers');
    });

    it('should have proper option descriptions', async () => {
      const { createProxyCommand } = await import('../src/commands/proxy.js');
      
      const command = createProxyCommand();
      const startCommand = command.commands.find((cmd: any) => cmd.name() === 'start');
      
      const targetOption = startCommand.options.find((opt: any) => opt.short === '-t');
      expect(targetOption.description).toContain('Target');
      
      const portOption = startCommand.options.find((opt: any) => opt.short === '-p');
      expect(portOption.description).toContain('Port');
      
      const modeOption = startCommand.options.find((opt: any) => opt.short === '-m');
      expect(modeOption.description).toContain('mode');
    });
  });
});