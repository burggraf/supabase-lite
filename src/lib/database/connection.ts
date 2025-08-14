import { PGlite } from '@electric-sql/pglite';
import { DATABASE_CONFIG } from '../constants';
import type { QueryResult, DatabaseConnection } from '@/types';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: PGlite | null = null;
  private isInitialized = false;
  private connectionInfo: DatabaseConnection | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    try {
      this.db = new PGlite({
        // Use IndexedDB for persistence in the browser
        dataDir: `idb://${DATABASE_CONFIG.DEFAULT_DB_NAME}`,
      });

      await this.db.waitReady;
      
      this.connectionInfo = {
        id: DATABASE_CONFIG.DEFAULT_DB_NAME,
        name: 'Supabase Lite DB',
        createdAt: new Date(),
        lastAccessed: new Date(),
      };

      // Initialize with some basic schemas
      await this.initializeSchemas();
      
      this.isInitialized = true;
      console.log('✅ PGlite initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize PGlite:', error);
      throw error;
    }
  }

  private async initializeSchemas(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Create auth schema for future auth functionality
      await this.db.exec(`
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE SCHEMA IF NOT EXISTS realtime;
      `);

      // Create a simple users table to get started
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS public.users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create a posts table for demo purposes
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS public.posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          content TEXT,
          user_id INTEGER REFERENCES public.users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('✅ Database schemas initialized');
    } catch (error) {
      console.error('❌ Failed to initialize schemas:', error);
      throw error;
    }
  }

  public async query(sql: string): Promise<QueryResult> {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    
    try {
      const result = await this.db.query(sql);
      const duration = performance.now() - startTime;
      
      // Update last accessed time
      if (this.connectionInfo) {
        this.connectionInfo.lastAccessed = new Date();
      }
      
      return {
        rows: result.rows,
        fields: result.fields,
        rowCount: result.rows.length,
        command: sql.trim().split(' ')[0].toUpperCase(),
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      const errorObj = error instanceof Error ? { message: error.message } : error;
      throw {
        ...errorObj,
        duration: Math.round(duration * 100) / 100,
      };
    }
  }

  public async exec(sql: string): Promise<void> {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      await this.db.exec(sql);
      
      // Update last accessed time
      if (this.connectionInfo) {
        this.connectionInfo.lastAccessed = new Date();
      }
    } catch (error) {
      throw error;
    }
  }

  public getConnectionInfo(): DatabaseConnection | null {
    return this.connectionInfo;
  }

  public isConnected(): boolean {
    return this.isInitialized && this.db !== null;
  }

  public async getDatabaseSize(): Promise<string> {
    if (!this.db || !this.isInitialized) {
      return '0 B';
    }

    try {
      const result = await this.db.query(`
        SELECT pg_database_size(current_database()) as size;
      `);
      
      const sizeInBytes = (result.rows[0] as any)?.size || 0;
      return this.formatBytes(sizeInBytes);
    } catch {
      return 'Unknown';
    }
  }

  public async getTableList(): Promise<Array<{ name: string; schema: string; rows: number }>> {
    if (!this.db || !this.isInitialized) {
      return [];
    }

    try {
      const result = await this.db.query(`
        SELECT 
          schemaname as schema,
          tablename as name,
          n_tup_ins - n_tup_del as rows
        FROM pg_stat_user_tables 
        ORDER BY schemaname, tablename;
      `);
      
      return result.rows as Array<{ name: string; schema: string; rows: number }>;
    } catch {
      return [];
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      this.connectionInfo = null;
    }
  }
}

// Export singleton instance
export const dbManager = DatabaseManager.getInstance();