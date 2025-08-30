import { describe, it, expect } from 'vitest';
import { SqlScriptParser } from '../src/lib/sql-script-parser.js';

describe('SqlScriptParser', () => {
  describe('parseScript', () => {
    it('should parse single statement', () => {
      const script = 'SELECT 1;';
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(1);
      expect(statements[0].sql).toBe('SELECT 1');
      expect(statements[0].lineNumber).toBe(1);
    });

    it('should parse multiple statements', () => {
      const script = `
        SELECT 1;
        SELECT 2;
        SELECT 3;
      `;
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(3);
      expect(statements[0].sql).toBe('SELECT 1');
      expect(statements[1].sql).toBe('SELECT 2');
      expect(statements[2].sql).toBe('SELECT 3');
    });

    it('should handle statements without trailing semicolon', () => {
      const script = 'SELECT 1';
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(1);
      expect(statements[0].sql).toBe('SELECT 1');
    });

    it('should remove line comments by default', () => {
      const script = `
        -- This is a comment
        SELECT 1; -- inline comment
        SELECT 2;
      `;
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(2);
      expect(statements[0].sql).toBe('SELECT 1');
      expect(statements[1].sql).toBe('SELECT 2');
    });

    it('should remove block comments by default', () => {
      const script = `
        /* This is a block comment */
        SELECT 1;
        /* Multi-line
           comment */
        SELECT 2 /* inline block */ FROM table;
      `;
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(2);
      expect(statements[0].sql).toBe('SELECT 1');
      expect(statements[1].sql).toBe('SELECT 2  FROM table');
    });

    it('should preserve comments when requested', () => {
      const script = '/* block comment */ SELECT 1;';
      const statements = SqlScriptParser.parseScript(script, { removeComments: false });
      
      expect(statements).toHaveLength(1);
      expect(statements[0].originalText).toContain('/*');
    });

    it('should handle quoted strings with semicolons', () => {
      const script = `
        SELECT 'hello; world';
        SELECT "test; data";
      `;
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(2);
      expect(statements[0].sql).toBe("SELECT 'hello; world'");
      expect(statements[1].sql).toBe('SELECT "test; data"');
    });

    it('should handle complex multi-line statements', () => {
      const script = `
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100)
        );
        
        INSERT INTO users (name) 
        VALUES 
          ('Alice'),
          ('Bob');
      `;
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(2);
      expect(statements[0].sql).toContain('CREATE TABLE');
      expect(statements[0].sql).toContain('VARCHAR(100)');
      expect(statements[1].sql).toContain('INSERT INTO');
      expect(statements[1].sql).toContain("('Alice')");
    });

    it('should skip empty statements by default', () => {
      const script = 'SELECT 1; SELECT 2;';
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(2);
      expect(statements[0].sql).toBe('SELECT 1');
      expect(statements[1].sql).toBe('SELECT 2');
    });

    it('should track line numbers correctly', () => {
      const script = `SELECT 1;
SELECT 2;`;
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(2);
      expect(statements[0].lineNumber).toBe(1);
      expect(statements[1].lineNumber).toBe(2);
    });

    it('should handle nested quotes correctly', () => {
      const script = `
        SELECT 'It''s a test';
        SELECT "He said ""hello""";
      `;
      const statements = SqlScriptParser.parseScript(script);
      
      expect(statements).toHaveLength(2);
      expect(statements[0].sql).toBe("SELECT 'It''s a test'");
      expect(statements[1].sql).toBe('SELECT "He said ""hello"""');
    });
  });

  describe('validateScript', () => {
    it('should validate correct script', () => {
      const script = `
        SELECT 'test';
        /* comment */ SELECT 1;
      `;
      const validation = SqlScriptParser.validateScript(script);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect unmatched single quotes', () => {
      const script = "SELECT 'unclosed string;";
      const validation = SqlScriptParser.validateScript(script);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Unmatched single quote in SQL script');
    });

    it('should detect unmatched double quotes', () => {
      const script = 'SELECT "unclosed string;';
      const validation = SqlScriptParser.validateScript(script);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Unmatched double quote in SQL script');
    });

    it('should detect unmatched block comments', () => {
      const script = 'SELECT 1; /* unclosed comment';
      const validation = SqlScriptParser.validateScript(script);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Unmatched block comment (/* without */) in SQL script');
    });
  });

  describe('extractStatements', () => {
    it('should return array of SQL strings', () => {
      const script = `
        SELECT 1;
        SELECT 2;
      `;
      const statements = SqlScriptParser.extractStatements(script);
      
      expect(statements).toEqual(['SELECT 1', 'SELECT 2']);
    });
  });

  describe('countStatements', () => {
    it('should count statements correctly', () => {
      const script = `
        SELECT 1;
        SELECT 2;
        SELECT 3;
      `;
      const count = SqlScriptParser.countStatements(script);
      
      expect(count).toBe(3);
    });

    it('should count zero for empty script', () => {
      const count = SqlScriptParser.countStatements('');
      expect(count).toBe(0);
    });

    it('should count zero for comment-only script', () => {
      const script = `
        -- Just comments
        /* More comments */
      `;
      const count = SqlScriptParser.countStatements(script);
      expect(count).toBe(0);
    });
  });
});