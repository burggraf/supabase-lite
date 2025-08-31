import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Mock external dependencies
vi.mock('commander', () => {
  const mockCommand = {
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    addCommand: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    parse: vi.fn().mockReturnThis(),
  };
  return {
    Command: vi.fn(() => mockCommand)
  };
});

vi.mock('../src/commands/psql.js', () => ({
  createPsqlCommand: vi.fn(() => ({ name: 'psql' }))
}));

vi.mock('../src/commands/admin.js', () => ({
  createAdminCommand: vi.fn(() => ({ name: 'admin' }))
}));

vi.mock('../src/commands/proxy.js', () => ({
  createProxyCommand: vi.fn(() => ({ name: 'proxy' }))
}));

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

// Mock process.exit
const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Mock process.argv
let originalArgv: string[];

describe('CLI Entry Point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    originalArgv = process.argv;
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
    processExitSpy.mockClear();
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  describe('CLI Setup', () => {
    it('should create CLI program with correct configuration', async () => {
      const { Command } = await import('commander');
      
      // Import CLI module to trigger setup
      await import('../src/cli.js');
      
      expect(Command).toHaveBeenCalled();
    });

    it('should import command creation modules', async () => {
      const psqlModule = await import('../src/commands/psql.js');
      const adminModule = await import('../src/commands/admin.js');
      const proxyModule = await import('../src/commands/proxy.js');
      
      // Verify modules can be imported
      expect(psqlModule.createPsqlCommand).toBeDefined();
      expect(adminModule.createAdminCommand).toBeDefined();
      expect(proxyModule.createProxyCommand).toBeDefined();
    });

    it('should read version from package.json', async () => {
      // This tests the file reading logic
      await expect(import('../src/cli.js')).resolves.toBeDefined();
    });
  });

  describe('Help Display', () => {
    it('should show help when no arguments provided', async () => {
      // Mock empty argv (only node and script name)
      process.argv = ['node', 'cli.js'];
      
      await import('../src/cli.js');
      
      expect(consoleSpy.log).toHaveBeenCalledWith('🚀 Supabase Lite CLI');
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Available commands:'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('psql'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('admin'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('proxy'));
    });

    it('should display examples in help text', async () => {
      process.argv = ['node', 'cli.js'];
      
      await import('../src/cli.js');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('Examples:'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('supabase-lite psql --url'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('supabase-lite admin list-projects'));
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.stringContaining('supabase-lite proxy start'));
    });
  });

  describe('Command Registration', () => {
    it('should register command handlers', async () => {
      const { Command } = await import('commander');
      const mockProgram = new Command();
      
      await import('../src/cli.js');
      
      expect(mockProgram.addCommand).toHaveBeenCalledTimes(3);
    });

    it('should set up unknown command handler', async () => {
      const { Command } = await import('commander');
      const mockProgram = new Command();
      
      await import('../src/cli.js');
      
      expect(mockProgram.on).toHaveBeenCalledWith('command:*', expect.any(Function));
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown commands gracefully', async () => {
      const { Command } = await import('commander');
      const mockProgram = new Command();
      
      // Get the command handler
      let unknownCommandHandler: Function;
      mockProgram.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'command:*') {
          unknownCommandHandler = handler;
        }
        return mockProgram;
      });
      
      await import('../src/cli.js');
      
      expect(() => {
        unknownCommandHandler(['unknown-cmd']);
      }).toThrow('process.exit called');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining("Unknown command 'unknown-cmd'"));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Available commands:'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should provide helpful error messages for unknown commands', async () => {
      const { Command } = await import('commander');
      const mockProgram = new Command();
      
      let unknownCommandHandler: Function;
      mockProgram.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'command:*') {
          unknownCommandHandler = handler;
        }
        return mockProgram;
      });
      
      await import('../src/cli.js');
      
      expect(() => {
        unknownCommandHandler(['invalid']);
      }).toThrow('process.exit called');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('psql'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('admin'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('proxy'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Use --help'));
    });
  });
});

describe('CLI Integration', () => {
  // Integration tests that actually spawn the CLI process
  const timeout = 10000;
  
  it('should show version when --version flag is used', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    
    const result = await new Promise<{stdout: string, stderr: string, code: number}>((resolve, reject) => {
      const child = spawn('node', ['dist/cli.js', '--version'], {
        cwd: process.cwd(),
        timeout: 5000
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
      
      child.on('error', reject);
    });
    
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(packageJson.version);
  }, timeout);

  it('should show help when --help flag is used', async () => {
    const result = await new Promise<{stdout: string, stderr: string, code: number}>((resolve, reject) => {
      const child = spawn('node', ['dist/cli.js', '--help'], {
        cwd: process.cwd(),
        timeout: 5000
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
      
      child.on('error', reject);
    });
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stdout).toContain('Commands:');
  }, timeout);

  it('should show default help when no arguments provided', async () => {
    const result = await new Promise<{stdout: string, stderr: string, code: number}>((resolve, reject) => {
      const child = spawn('node', ['dist/cli.js'], {
        cwd: process.cwd(),
        timeout: 5000
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({ stdout, stderr, code: code || 0 });
      });
      
      child.on('error', reject);
    });
    
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('🚀 Supabase Lite CLI');
    expect(result.stdout).toContain('Available commands:');
    expect(result.stdout).toContain('Examples:');
  }, timeout);
});