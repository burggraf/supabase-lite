import { describe, it, expect } from 'vitest';

describe('Package Exports', () => {
  describe('Main Module Exports', () => {
    it('should export SqlClient class', async () => {
      const module = await import('../src/index.js');
      expect(module.SqlClient).toBeDefined();
      expect(typeof module.SqlClient).toBe('function');
    });

    it('should export UrlParser class', async () => {
      const module = await import('../src/index.js');
      expect(module.UrlParser).toBeDefined();
      expect(typeof module.UrlParser).toBe('function');
    });

    it('should export ResultFormatter class', async () => {
      const module = await import('../src/index.js');
      expect(module.ResultFormatter).toBeDefined();
      expect(typeof module.ResultFormatter).toBe('function');
    });

    it('should export Repl class', async () => {
      const module = await import('../src/index.js');
      expect(module.Repl).toBeDefined();
      expect(typeof module.Repl).toBe('function');
    });

    it('should export createPsqlCommand function', async () => {
      const module = await import('../src/index.js');
      expect(module.createPsqlCommand).toBeDefined();
      expect(typeof module.createPsqlCommand).toBe('function');
    });

    it('should export executePsqlCommand function', async () => {
      const module = await import('../src/index.js');
      expect(module.executePsqlCommand).toBeDefined();
      expect(typeof module.executePsqlCommand).toBe('function');
    });
  });

  describe('Type Exports', () => {
    it('should export all types from types/index.js', async () => {
      // Test that types module can be imported without errors
      const module = await import('../src/index.js');
      
      // The types are exported with * so we can't test them directly,
      // but we can ensure the module loads successfully
      expect(module).toBeDefined();
    });
  });

  describe('Export Functionality', () => {
    it('should create SqlClient instance', async () => {
      const { SqlClient } = await import('../src/index.js');
      
      const client = new SqlClient('http://localhost:5173');
      expect(client).toBeInstanceOf(SqlClient);
      expect(client.getConnectionInfo).toBeDefined();
      expect(typeof client.getConnectionInfo).toBe('function');
    });

    it('should create UrlParser instance', async () => {
      const { UrlParser } = await import('../src/index.js');
      
      const parser = new UrlParser();
      expect(parser).toBeInstanceOf(UrlParser);
    });

    it('should use UrlParser static methods', async () => {
      const { UrlParser } = await import('../src/index.js');
      
      expect(typeof UrlParser.validate).toBe('function');
      expect(typeof UrlParser.parse).toBe('function');
      expect(typeof UrlParser.extractProjectId).toBe('function');
    });

    it('should create ResultFormatter instance', async () => {
      const { ResultFormatter } = await import('../src/index.js');
      
      const formatter = new ResultFormatter();
      expect(formatter).toBeInstanceOf(ResultFormatter);
    });

    it('should use ResultFormatter static methods', async () => {
      const { ResultFormatter } = await import('../src/index.js');
      
      expect(typeof ResultFormatter.formatQueryResult).toBe('function');
      expect(typeof ResultFormatter.formatError).toBe('function');
      expect(typeof ResultFormatter.formatConnection).toBe('function');
    });

    it('should create Repl instance', async () => {
      const { Repl, SqlClient } = await import('../src/index.js');
      
      const sqlClient = new SqlClient('http://localhost:5173');
      const repl = new Repl(sqlClient);
      expect(repl).toBeInstanceOf(Repl);
      expect(repl.start).toBeDefined();
      expect(typeof repl.start).toBe('function');
    });

    it('should create psql command', async () => {
      const { createPsqlCommand } = await import('../src/index.js');
      
      const command = createPsqlCommand();
      expect(command).toBeDefined();
      expect(command.name).toBeDefined();
      expect(typeof command.name).toBe('function');
    });
  });

  describe('Module Structure', () => {
    it('should have consistent export structure', async () => {
      const module = await import('../src/index.js');
      
      // Check that all expected exports are present
      const expectedExports = [
        'SqlClient',
        'UrlParser', 
        'ResultFormatter',
        'Repl',
        'createPsqlCommand',
        'executePsqlCommand'
      ];
      
      for (const exportName of expectedExports) {
        expect(module[exportName]).toBeDefined();
      }
    });

    it('should not export unexpected items', async () => {
      const module = await import('../src/index.js');
      
      // Should not export internal implementation details
      expect(module.internal).toBeUndefined();
      expect(module.private).toBeUndefined();
      expect(module.test).toBeUndefined();
    });
  });

  describe('Cross-Module Integration', () => {
    it('should work together - SqlClient and Repl', async () => {
      const { SqlClient, Repl } = await import('../src/index.js');
      
      const sqlClient = new SqlClient('http://localhost:5173');
      const repl = new Repl(sqlClient);
      
      expect(repl).toBeInstanceOf(Repl);
      expect(sqlClient).toBeInstanceOf(SqlClient);
    });

    it('should work together - UrlParser and SqlClient', async () => {
      const { SqlClient, UrlParser } = await import('../src/index.js');
      
      const url = 'http://localhost:5173';
      const validation = UrlParser.validate(url);
      expect(validation.valid).toBe(true);
      
      const sqlClient = new SqlClient(url);
      expect(sqlClient).toBeInstanceOf(SqlClient);
    });

    it('should work together - ResultFormatter and SqlClient', async () => {
      const { SqlClient, ResultFormatter } = await import('../src/index.js');
      
      const sqlClient = new SqlClient('http://localhost:5173');
      const connectionInfo = sqlClient.getConnectionInfo();
      
      const formatted = ResultFormatter.formatConnection(
        connectionInfo.url, 
        connectionInfo.projectId || 'default'
      );
      
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});