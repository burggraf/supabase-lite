import { PGlite } from '@electric-sql/pglite';
import { DATABASE_CONFIG } from '../constants';
import { roleSimulator } from './roleSimulator';
import type { QueryResult, ScriptResult, DatabaseConnection } from '@/types';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: PGlite | null = null;
  private isInitialized = false;
  private connectionInfo: DatabaseConnection | null = null;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.db) {
      return;
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization and store the promise
    this.initializationPromise = this.doInitialization();
    
    try {
      await this.initializationPromise;
    } finally {
      // Clear the promise once done (success or failure)
      this.initializationPromise = null;
    }
  }

  private async doInitialization(): Promise<void> {
    try {
      console.log('🚀 Initializing PGlite with config:', DATABASE_CONFIG);
      this.db = new PGlite({
        // Use IndexedDB for persistence in the browser
        dataDir: `idb://${DATABASE_CONFIG.DEFAULT_DB_NAME}`,
        database: 'postgres',
      });
      console.log('📦 PGlite instance created, waiting for ready...');

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
      console.log('Database instance:', this.db);
      console.log('Connection info:', this.connectionInfo);
    } catch (error) {
      console.error('❌ Failed to initialize PGlite:', error);
      throw error;
    }
  }

  private async initializeSchemas(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check if database is already seeded by looking for auth.users table
      const checkResult = await this.db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'auth' 
          AND table_name = 'users'
        ) as exists;
      `);
      
      const isSeeded = (checkResult.rows[0] as any)?.exists;
      
      if (isSeeded) {
        console.log('✅ Database already seeded with Supabase schema');
        return;
      }

      console.log('🌱 Initializing database with Supabase seed schema...');
      
      // Load the seed.sql file
      const seedSql = await this.loadSeedSql();
      
      // Execute the seed script
      await this.db.exec(seedSql);

      console.log('✅ Supabase database schema initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize schemas:', error);
      throw error;
    }
  }

  private async loadSeedSql(): Promise<string> {
    try {
      // In a browser environment, we'll need to fetch the seed.sql file
      // First try to load it as a static asset
      const response = await fetch('/sql_scripts/seed.sql');
      if (!response.ok) {
        throw new Error(`Failed to load seed.sql: ${response.statusText}`);
      }
      const seedSql = await response.text();
      return seedSql;
    } catch (error) {
      console.warn('⚠️ Could not load seed.sql file, falling back to basic schema');
      // Fallback to basic schema if seed.sql is not available
      return `
        -- Fallback basic schema
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE SCHEMA IF NOT EXISTS realtime;
        CREATE SCHEMA IF NOT EXISTS extensions;
        
        -- Basic users table for compatibility
        CREATE TABLE IF NOT EXISTS public.users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          name VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Basic posts table for demo
        CREATE TABLE IF NOT EXISTS public.posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          content TEXT,
          user_id INTEGER REFERENCES public.users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    }
  }

  public async query(sql: string): Promise<QueryResult> {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    
    try {
      // Validate query permissions based on current role
      roleSimulator.preprocessQuery(sql); // This now only validates, doesn't modify SQL
      
      // Execute the original query
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

  public async execScript(sql: string): Promise<ScriptResult> {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    
    try {
      // Validate script permissions based on current role
      roleSimulator.preprocessQuery(sql); // This now only validates, doesn't modify SQL
      
      // Execute the original script
      const results = await this.db.exec(sql);
      const totalDuration = performance.now() - startTime;
      
      // Update last accessed time
      if (this.connectionInfo) {
        this.connectionInfo.lastAccessed = new Date();
      }
      
      // Convert PGlite results to our QueryResult format
      const queryResults: QueryResult[] = results.map((result, index) => {
        // Extract command from the statement (first word)
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
        const command = statements[index]?.split(' ')[0]?.toUpperCase() || 'UNKNOWN';
        
        return {
          rows: result.rows || [],
          fields: result.fields || [],
          rowCount: (result.rows || []).length,
          command,
          duration: Math.round((totalDuration / results.length) * 100) / 100, // Approximate duration per statement
        };
      });

      return {
        results: queryResults,
        totalDuration: Math.round(totalDuration * 100) / 100,
        successCount: queryResults.length,
        errorCount: 0,
        errors: [],
      };
    } catch (error: any) {
      const totalDuration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Script execution failed';
      
      // If the error occurred, we assume all statements failed
      throw {
        message: errorMessage,
        duration: Math.round(totalDuration * 100) / 100,
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
          t.table_schema as schema,
          t.table_name as name,
          COALESCE(s.n_tup_ins - s.n_tup_del, 0) as rows
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON (t.table_name = s.relname AND t.table_schema = s.schemaname)
        WHERE t.table_type = 'BASE TABLE' 
          AND t.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY t.table_schema, t.table_name;
      `);
      
      return result.rows as Array<{ name: string; schema: string; rows: number }>;
    } catch (error) {
      console.error('Failed to get table list:', error);
      return [];
    }
  }

  public async getTableSchema(tableName: string, schema: string = 'public'): Promise<Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
    is_primary_key: boolean;
  }>> {
    if (!this.db || !this.isInitialized) {
      return [];
    }

    try {
      const result = await this.db.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku 
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = $1
            AND tc.table_schema = $2
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = $1 
          AND c.table_schema = $2
        ORDER BY c.ordinal_position;
      `, [tableName, schema]);
      
      return result.rows as Array<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
        is_primary_key: boolean;
      }>;
    } catch (error) {
      console.error('Failed to get table schema:', error);
      return [];
    }
  }

  public async getTableData(
    tableName: string, 
    schema: string = 'public', 
    limit: number = 100, 
    offset: number = 0,
    filters?: Array<{ column: string; operator: string; value: string }>
  ): Promise<{
    rows: any[];
    totalCount: number;
  }> {
    if (!this.db || !this.isInitialized) {
      return { rows: [], totalCount: 0 };
    }

    try {
      // Build WHERE clause from filters
      let whereClause = '';
      const values: any[] = [];
      
      if (filters && filters.length > 0) {
        const conditions = filters.map((filter, index) => {
          const paramIndex = index + 1;
          values.push(filter.value);
          
          switch (filter.operator) {
            case 'equals':
              return `${filter.column} = $${paramIndex}`;
            case 'not_equal':
              return `${filter.column} != $${paramIndex}`;
            case 'greater_than':
              return `${filter.column} > $${paramIndex}`;
            case 'less_than':
              return `${filter.column} < $${paramIndex}`;
            case 'greater_than_or_equal':
              return `${filter.column} >= $${paramIndex}`;
            case 'less_than_or_equal':
              return `${filter.column} <= $${paramIndex}`;
            case 'like':
              return `${filter.column} LIKE $${paramIndex}`;
            case 'ilike':
              return `${filter.column} ILIKE $${paramIndex}`;
            case 'in':
              // For IN operator, split comma-separated values
              const inValues = filter.value.split(',').map(v => v.trim());
              const inParams = inValues.map((_, i) => `$${paramIndex + i}`).join(',');
              values.splice(index, 1, ...inValues); // Replace single value with array
              return `${filter.column} IN (${inParams})`;
            case 'is':
              // For IS operator, handle special values
              if (filter.value.toLowerCase() === 'null') {
                values.pop(); // Remove the value from parameters
                return `${filter.column} IS NULL`;
              } else if (filter.value.toLowerCase() === 'not null') {
                values.pop(); // Remove the value from parameters
                return `${filter.column} IS NOT NULL`;
              } else {
                return `${filter.column} IS $${paramIndex}`;
              }
            default:
              return `${filter.column} = $${paramIndex}`;
          }
        });
        whereClause = ' WHERE ' + conditions.join(' AND ');
      }

      // Get total count with filters
      const countQuery = `SELECT COUNT(*) as total FROM ${schema}.${tableName}${whereClause}`;
      const countResult = await this.db.query(countQuery, values);
      const totalCount = (countResult.rows[0] as any)?.total || 0;
      
      // Get paginated data with filters
      const dataQuery = `
        SELECT * FROM ${schema}.${tableName}${whereClause}
        ORDER BY (SELECT column_name FROM information_schema.columns 
                  WHERE table_name = '${tableName}' AND table_schema = '${schema}' 
                  ORDER BY ordinal_position LIMIT 1)
        LIMIT ${limit} OFFSET ${offset}
      `;
      const dataResult = await this.db.query(dataQuery, values);
      
      return {
        rows: dataResult.rows,
        totalCount: parseInt(totalCount, 10)
      };
    } catch (error) {
      console.error('Failed to get table data:', error);
      return { rows: [], totalCount: 0 };
    }
  }

  public async updateTableRow(
    tableName: string, 
    primaryKeyColumn: string, 
    primaryKeyValue: any, 
    updates: Record<string, any>,
    schema: string = 'public'
  ): Promise<boolean> {
    if (!this.db || !this.isInitialized) {
      return false;
    }

    try {
      const updateColumns = Object.keys(updates);
      const updateValues = Object.values(updates);
      
      const setClause = updateColumns.map((col, index) => `${col} = $${index + 1}`).join(', ');
      
      await this.db.query(`
        UPDATE ${schema}.${tableName}
        SET ${setClause}
        WHERE ${primaryKeyColumn} = $${updateColumns.length + 1};
      `, [...updateValues, primaryKeyValue]);
      
      return true;
    } catch (error) {
      console.error('Failed to update table row:', error);
      return false;
    }
  }

  public async insertTableRow(
    tableName: string, 
    data: Record<string, any>,
    schema: string = 'public'
  ): Promise<boolean> {
    if (!this.db || !this.isInitialized) {
      return false;
    }

    try {
      const columns = Object.keys(data);
      const values = Object.values(data);
      
      const columnsClause = columns.join(', ');
      const valuesClause = values.map((_, index) => `$${index + 1}`).join(', ');
      
      await this.db.query(`
        INSERT INTO ${schema}.${tableName} (${columnsClause})
        VALUES (${valuesClause});
      `, values);
      
      return true;
    } catch (error) {
      console.error('Failed to insert table row:', error);
      return false;
    }
  }

  public async deleteTableRow(
    tableName: string, 
    primaryKeyColumn: string, 
    primaryKeyValue: any,
    schema: string = 'public'
  ): Promise<boolean> {
    if (!this.db || !this.isInitialized) {
      return false;
    }

    try {
      await this.db.query(`
        DELETE FROM ${schema}.${tableName}
        WHERE ${primaryKeyColumn} = $1;
      `, [primaryKeyValue]);
      
      return true;
    } catch (error) {
      console.error('Failed to delete table row:', error);
      return false;
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