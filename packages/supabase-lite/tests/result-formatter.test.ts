import { describe, it, expect } from 'vitest';
import { ResultFormatter } from '../src/lib/result-formatter.js';
import { QueryResult, QueryError } from '../src/types/index.js';

describe('ResultFormatter', () => {
  describe('formatResult', () => {
    it('should format simple query results', () => {
      const result: QueryResult = {
        data: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ],
        rowCount: 2,
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'text' },
          { name: 'email', type: 'text' }
        ],
        executionTime: 42.5
      };

      const formatted = ResultFormatter.formatResult(result);
      
      expect(formatted).toContain('John');
      expect(formatted).toContain('Jane');
      expect(formatted).toContain('john@example.com');
      expect(formatted).toContain('(2 rows)');
      expect(formatted).toContain('Time: 42.5ms');
    });

    it('should format empty results', () => {
      const result: QueryResult = {
        data: [],
        rowCount: 0,
        fields: []
      };

      const formatted = ResultFormatter.formatResult(result);
      expect(formatted).toBe('(0 rows)');
    });

    it('should handle null and undefined values', () => {
      const result: QueryResult = {
        data: [
          { id: 1, name: 'John', description: null },
          { id: 2, name: null, description: undefined }
        ],
        rowCount: 2,
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'name', type: 'text' },
          { name: 'description', type: 'text' }
        ]
      };

      const formatted = ResultFormatter.formatResult(result);
      expect(formatted).toContain('John');
      expect(formatted).not.toContain('null');
      expect(formatted).not.toContain('undefined');
    });

    it('should truncate long values', () => {
      const longValue = 'a'.repeat(100);
      const result: QueryResult = {
        data: [{ id: 1, content: longValue }],
        rowCount: 1,
        fields: [
          { name: 'id', type: 'integer' },
          { name: 'content', type: 'text' }
        ]
      };

      const formatted = ResultFormatter.formatResult(result);
      // The full long value should not be present in the output
      expect(formatted).not.toContain(longValue);
      // Should contain some indication of truncation
      expect(formatted).toContain('..');
    });
  });

  describe('formatError', () => {
    it('should format PostgreSQL errors', () => {
      const error: QueryError = {
        error: 'PGRST106',
        message: 'relation "nonexistent_table" does not exist',
        details: 'Could not find table in schema',
        hint: 'Check your table name and schema'
      };

      const formatted = ResultFormatter.formatError(error);
      
      expect(formatted).toContain('❌');
      expect(formatted).toContain('PGRST106');
      expect(formatted).toContain('relation "nonexistent_table" does not exist');
      expect(formatted).toContain('Details: Could not find table in schema');
      expect(formatted).toContain('Hint: Check your table name and schema');
    });

    it('should format errors without details and hint', () => {
      const error: QueryError = {
        error: 'SYNTAX_ERROR',
        message: 'Invalid SQL syntax'
      };

      const formatted = ResultFormatter.formatError(error);
      
      expect(formatted).toContain('❌');
      expect(formatted).toContain('SYNTAX_ERROR');
      expect(formatted).toContain('Invalid SQL syntax');
      expect(formatted).not.toContain('Details:');
      expect(formatted).not.toContain('Hint:');
    });
  });

  describe('formatConnection', () => {
    it('should format connection without project ID', () => {
      const formatted = ResultFormatter.formatConnection('http://localhost:5173');
      
      expect(formatted).toContain('🔗 Connected to Supabase Lite');
      expect(formatted).toContain('URL: http://localhost:5173');
      expect(formatted).toContain('Type "\\?" for help');
      expect(formatted).not.toContain('Project:');
    });

    it('should format connection with project ID', () => {
      const formatted = ResultFormatter.formatConnection(
        'http://localhost:5173/abc123', 
        'abc123'
      );
      
      expect(formatted).toContain('🔗 Connected to Supabase Lite');
      expect(formatted).toContain('URL: http://localhost:5173/abc123');
      expect(formatted).toContain('Project: abc123');
      expect(formatted).toContain('Type "\\?" for help');
    });
  });

  describe('formatHelp', () => {
    it('should include all meta commands', () => {
      const help = ResultFormatter.formatHelp();
      
      expect(help).toContain('\\q');
      expect(help).toContain('\\l');
      expect(help).toContain('\\dt');
      expect(help).toContain('\\d <table>');
      expect(help).toContain('\\dn');
      expect(help).toContain('\\du');
      expect(help).toContain('\\?');
    });

    it('should include SQL examples', () => {
      const help = ResultFormatter.formatHelp();
      
      expect(help).toContain('SELECT * FROM auth.users LIMIT 5;');
      expect(help).toContain('Examples:');
    });
  });

  describe('formatTableList', () => {
    it('should format table list', () => {
      const tables = [
        { schema_name: 'public', table_name: 'users', table_type: 'table' },
        { schema_name: 'auth', table_name: 'users', table_type: 'table' }
      ];

      const formatted = ResultFormatter.formatTableList(tables);
      
      expect(formatted).toContain('public');
      expect(formatted).toContain('auth');
      expect(formatted).toContain('users');
      expect(formatted).toContain('(2 tables)');
    });

    it('should handle empty table list', () => {
      const formatted = ResultFormatter.formatTableList([]);
      expect(formatted).toBe('No tables found.');
    });
  });

  describe('formatTableDescription', () => {
    it('should format table structure', () => {
      const columns = [
        {
          column_name: 'id',
          data_type: 'uuid',
          is_nullable: 'NO',
          column_default: 'gen_random_uuid()'
        },
        {
          column_name: 'email',
          data_type: 'character varying',
          character_maximum_length: 255,
          is_nullable: 'NO',
          column_default: null
        }
      ];

      const formatted = ResultFormatter.formatTableDescription(columns, 'users');
      
      expect(formatted).toContain('Table "users"');
      expect(formatted).toContain('id');
      expect(formatted).toContain('uuid');
      expect(formatted).toContain('email');
      expect(formatted).toContain('character varying(255)');
      expect(formatted).toContain('not null');
      expect(formatted).toContain('gen_random_uuid()');
    });

    it('should handle non-existent table', () => {
      const formatted = ResultFormatter.formatTableDescription([], 'nonexistent');
      expect(formatted).toContain('Table "nonexistent" not found');
    });
  });
});