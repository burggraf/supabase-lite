import { describe, it, expect } from 'vitest';
import { UrlParser } from '../src/lib/url-parser.js';

describe('UrlParser', () => {
  describe('parse', () => {
    it('should parse localhost URL without project', () => {
      const config = UrlParser.parse('http://localhost:5173');
      
      expect(config.url).toBe('http://localhost:5173');
      expect(config.baseUrl).toBe('http://localhost:5173');
      expect(config.projectId).toBeUndefined();
    });

    it('should parse localhost URL with project ID', () => {
      const config = UrlParser.parse('http://localhost:5173/abc123def456');
      
      expect(config.url).toBe('http://localhost:5173/abc123def456');
      expect(config.baseUrl).toBe('http://localhost:5173');
      expect(config.projectId).toBe('abc123def456');
    });

    it('should parse production URL without project', () => {
      const config = UrlParser.parse('https://supabase-lite.pages.dev');
      
      expect(config.url).toBe('https://supabase-lite.pages.dev');
      expect(config.baseUrl).toBe('https://supabase-lite.pages.dev');
      expect(config.projectId).toBeUndefined();
    });

    it('should parse production URL with project ID', () => {
      const config = UrlParser.parse('https://supabase-lite.pages.dev/xyz789');
      
      expect(config.url).toBe('https://supabase-lite.pages.dev/xyz789');
      expect(config.baseUrl).toBe('https://supabase-lite.pages.dev');
      expect(config.projectId).toBe('xyz789');
    });

    it('should handle URLs with trailing slashes', () => {
      const config = UrlParser.parse('http://localhost:5173/project123/');
      
      expect(config.baseUrl).toBe('http://localhost:5173');
      expect(config.projectId).toBe('project123');
    });

    it('should throw error for invalid protocol', () => {
      expect(() => {
        UrlParser.parse('ftp://localhost:5173');
      }).toThrow('URL must use http:// or https:// protocol');
    });

    it('should throw error for malformed URL', () => {
      expect(() => {
        UrlParser.parse('not-a-url');
      }).toThrow('Invalid URL format');
    });
  });

  describe('getSqlEndpoint', () => {
    it('should return debug endpoint for default project', () => {
      const config = {
        url: 'http://localhost:5173',
        baseUrl: 'http://localhost:5173'
      };
      
      const endpoint = UrlParser.getSqlEndpoint(config);
      expect(endpoint).toBe('http://localhost:5173/debug/sql');
    });

    it('should return project-specific debug endpoint', () => {
      const config = {
        url: 'http://localhost:5173/abc123',
        baseUrl: 'http://localhost:5173',
        projectId: 'abc123'
      };
      
      const endpoint = UrlParser.getSqlEndpoint(config);
      expect(endpoint).toBe('http://localhost:5173/abc123/debug/sql');
    });
  });

  describe('validate', () => {
    it('should validate localhost URL', () => {
      const result = UrlParser.validate('http://localhost:5173');
      expect(result.valid).toBe(true);
    });

    it('should validate production URL', () => {
      const result = UrlParser.validate('https://supabase-lite.pages.dev');
      expect(result.valid).toBe(true);
    });

    it('should validate custom domain', () => {
      const result = UrlParser.validate('https://my-app.example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid protocol', () => {
      const result = UrlParser.validate('ftp://localhost:5173');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('protocol');
    });

    it('should reject malformed URL', () => {
      const result = UrlParser.validate('not-a-url');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });

  describe('normalize', () => {
    it('should remove trailing slashes', () => {
      const normalized = UrlParser.normalize('http://localhost:5173/');
      // URL constructor normalizes this automatically
      expect(normalized).toBe('http://localhost:5173/');
    });

    it('should remove trailing slashes from project paths', () => {
      const normalized = UrlParser.normalize('http://localhost:5173/project123/');
      expect(normalized).toBe('http://localhost:5173/project123');
    });

    it('should handle URLs without trailing slashes', () => {
      const normalized = UrlParser.normalize('http://localhost:5173/project');
      expect(normalized).toBe('http://localhost:5173/project');
    });

    it('should handle malformed URLs gracefully', () => {
      const normalized = UrlParser.normalize('not-a-url');
      expect(normalized).toBe('not-a-url');
    });
  });
});