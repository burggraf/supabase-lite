import { ConnectionConfig } from '../types/index.js';

export class UrlParser {
  /**
   * Parse and validate a Supabase Lite connection URL
   * Supports formats:
   * - http://localhost:5173 (default project)
   * - https://supabase-lite.pages.dev (production)
   * - http://localhost:5173/abc123def456 (specific project)
   */
  static parse(url: string): ConnectionConfig {
    try {
      const parsedUrl = new URL(url);
      
      // Validate protocol
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL must use http:// or https:// protocol');
      }
      
      // Extract project ID from pathname if present
      const pathname = parsedUrl.pathname.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
      const projectId = pathname || undefined;
      
      // Construct base URL (without project path)
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      
      return {
        url: url,
        projectId: projectId,
        baseUrl: baseUrl
      };
      
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Invalid URL format: ${url}`);
      }
      throw error;
    }
  }

  /**
   * Construct the SQL endpoint URL for the given connection config
   */
  static getSqlEndpoint(config: ConnectionConfig): string {
    if (config.projectId) {
      return `${config.baseUrl}/${config.projectId}/debug/sql`;
    }
    return `${config.baseUrl}/debug/sql`;
  }

  /**
   * Validate that a URL is reachable (basic format validation)
   */
  static validate(url: string): { valid: boolean; error?: string } {
    try {
      const config = this.parse(url);
      
      // Basic hostname validation
      if (!config.baseUrl.includes('localhost') && 
          !config.baseUrl.includes('supabase-lite.pages.dev') &&
          !config.baseUrl.match(/^https?:\/\/[\w.-]+\.[\w]+/)) {
        return {
          valid: false,
          error: 'URL must be localhost or a valid domain'
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Normalize URL by removing trailing slashes and ensuring proper format
   */
  static normalize(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash from pathname unless it's the root path
      if (parsed.pathname === '/') {
        parsed.pathname = '';
      } else {
        parsed.pathname = parsed.pathname.replace(/\/+$/, '');
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }
}