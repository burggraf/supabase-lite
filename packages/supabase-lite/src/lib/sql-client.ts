import axios, { AxiosResponse } from 'axios';
import { ConnectionConfig, QueryResult, QueryError } from '../types/index.js';
import { UrlParser } from './url-parser.js';

export class SqlClient {
  private config: ConnectionConfig;
  private connected: boolean = false;

  constructor(url: string) {
    this.config = UrlParser.parse(url);
  }

  /**
   * Test connection to the Supabase Lite instance
   */
  async connect(): Promise<void> {
    try {
      const endpoint = UrlParser.getSqlEndpoint(this.config);
      
      // Test with a simple query to verify connection
      const response = await axios.post(
        endpoint,
        { sql: 'SELECT 1 as test' },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (response.status === 200) {
        this.connected = true;
      } else {
        throw new Error(`Connection failed with status ${response.status}`);
      }
    } catch (error) {
      this.connected = false;
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            `Connection refused. Make sure Supabase Lite is running at ${this.config.baseUrl}`
          );
        } else if (error.response?.status === 404) {
          throw new Error(
            `Endpoint not found. Make sure you're connecting to a valid Supabase Lite instance`
          );
        } else if (error.response && error.response.status >= 500) {
          throw new Error(
            `Server error (${error.response.status}). The Supabase Lite instance may be experiencing issues`
          );
        }
        throw new Error(`Connection failed: ${error.message}`);
      } else if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `Connection refused. Make sure Supabase Lite is running at ${this.config.baseUrl}`
        );
      } else if (error instanceof Error && error.message.includes('404')) {
        throw new Error(
          `Endpoint not found. Make sure you're connecting to a valid Supabase Lite instance`
        );
      } else if (error instanceof Error && error.message.includes('500')) {
        throw new Error(
          `Server error (500). The Supabase Lite instance may be experiencing issues`
        );
      }
      throw error;
    }
  }

  /**
   * Execute a SQL query
   */
  async executeQuery(sql: string): Promise<QueryResult> {
    if (!this.connected) {
      throw new Error('Not connected. Call connect() first.');
    }

    if (!sql.trim()) {
      throw new Error('SQL query cannot be empty');
    }

    try {
      const endpoint = UrlParser.getSqlEndpoint(this.config);
      const startTime = performance.now();

      const response: AxiosResponse = await axios.post(
        endpoint,
        { sql: sql.trim() },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout for queries
        }
      );

      const endTime = performance.now();
      const executionTime = Math.round((endTime - startTime) * 100) / 100; // Round to 2 decimal places

      if (response.status !== 200) {
        throw new Error(`Query failed with status ${response.status}`);
      }

      const result = response.data;

      // Handle error responses
      if (result.error) {
        const error: QueryError = {
          error: result.error,
          message: result.message || 'Query execution failed',
          details: result.details,
          hint: result.hint
        };
        throw error;
      }

      // Handle successful query results
      return {
        data: result.data || [],
        rowCount: result.rowCount || result.data?.length || 0,
        fields: result.fields || [],
        executionTime
      };

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          // This is a SQL/PostgreSQL error
          const pgError: QueryError = error.response.data;
          throw pgError;
        }
        
        if (error.code === 'ECONNREFUSED') {
          throw new Error(
            'Connection lost. Make sure Supabase Lite is still running.'
          );
        }
        
        if (error.code === 'ENOTFOUND') {
          throw new Error(
            `Could not resolve hostname. Check your URL: ${this.config.baseUrl}`
          );
        }

        throw new Error(`Network error: ${error.message}`);
      }

      // Re-throw QueryError objects
      if (typeof error === 'object' && error && 'error' in error) {
        throw error;
      }

      throw error;
    }
  }

  /**
   * Test if the connection is still active
   */
  async ping(): Promise<boolean> {
    try {
      await this.executeQuery('SELECT 1');
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }

  /**
   * Get connection information
   */
  getConnectionInfo(): ConnectionConfig {
    return { ...this.config };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close the connection (cleanup)
   */
  disconnect(): void {
    this.connected = false;
  }
}