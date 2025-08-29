import { PGlite } from '@electric-sql/pglite';

// import { roleSimulator } from '../constants';
import { roleSimulator } from './roleSimulator';

import type { QueryResult, ScriptResult, DatabaseConnection } from '@/types';
import type { TransactionOptions, QueryOptions, QueryMetrics } from '@/types/infrastructure';
import { logger, logQuery, logError, logPerformance } from '../infrastructure/Logger';
import { createDatabaseError } from '../infrastructure/ErrorHandler';
import { configManager } from '../infrastructure/ConfigManager';

export interface SessionContext {
  role: 'anon' | 'authenticated' | 'service_role';
  userId?: string;
  claims?: any;
}


export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: PGlite | null = null; // Active connection (for backwards compatibility)
  private isInitialized = false;
  private connectionInfo: DatabaseConnection | null = null; // Active connection info
  private initializationPromise: Promise<void> | null = null;
  private queryMetrics: QueryMetrics[] = [];
  private queryCache = new Map<string, { result: QueryResult; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_METRICS = 1000;


  // Transition state for atomic connection switching
  private isTransitioning = false;

  // Session context for RLS
  private currentSessionContext: SessionContext | null = null;

  private constructor() { }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }



  public async initialize(customDataDir?: string): Promise<void> {
    const dbConfig = configManager.getDatabaseConfig();
    const targetDataDir = customDataDir || dbConfig.dataDir;


    // If already initialized with the CORRECT database, return immediately
    if (this.isInitialized && this.db && this.connectionInfo?.id === targetDataDir) {
      logger.debug('Already initialized with target database', { targetDataDir });
      return;
    }

    // If already initialized but with WRONG database, switch instead
    if (this.isInitialized && this.db && this.connectionInfo?.id !== targetDataDir) {
      logger.info('Database initialized with different path, switching', {
        current: this.connectionInfo?.id,
        target: targetDataDir
      });
      await this.switchDatabase(targetDataDir);
      return;
    }


    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization and store the promise
    this.initializationPromise = this.doInitialization(customDataDir);

    try {
      await this.initializationPromise;
    } finally {
      // Clear the promise once done (success or failure)
      this.initializationPromise = null;
    }
  }

  public async switchDatabase(dataDir: string): Promise<void> {
    const currentDataDir = this.connectionInfo?.id || 'none';
    const startTime = performance.now();

    // Prevent concurrent switches
    if (this.isTransitioning) {
      throw createDatabaseError('Database switch already in progress');
    }

    try {
      console.log('🟠🟠🟠 DatabaseManager.switchDatabase called:', {
        fromDataDir: currentDataDir,
        toDataDir: dataDir,
        isInitialized: this.isInitialized,
        hasDb: !!this.db
      });

      logger.info('Starting database switch (no pooling)', {
        fromDataDir: currentDataDir,
        toDataDir: dataDir
      });

      // Skip if we're already connected to this database
      if (this.isInitialized && this.connectionInfo?.id === dataDir && !this.isTransitioning) {
        logger.debug('Already connected to target database, skipping switch', { dataDir });
        return;
      }

      // Start atomic transition
      this.isTransitioning = true;

      // Close the current connection
      if (this.db) {
        await this.db.close();
      }

      // Reset state
      this.db = null;
      this.isInitialized = false;
      this.connectionInfo = null;
      this.queryMetrics = [];
      this.queryCache.clear();
      this.initializationPromise = null;


      // Initialize with the new database
      await this.initialize(dataDir);

      const switchTime = performance.now() - startTime;

      logger.info('Database switch completed successfully', {
        fromDataDir: currentDataDir,
        toDataDir: dataDir,
        switchTime: `${switchTime.toFixed(1)}ms`
      });

    } catch (error) {
      console.error('Database switch failed:', error);
      logger.error('Database switch failed', error as Error, {
        fromDataDir: currentDataDir,
        toDataDir: dataDir
      });
      throw createDatabaseError('Failed to switch database', error as Error);
    } finally {
      // Always clear transition state
      this.isTransitioning = false;
    }
  }

  /**
   * Validate that a connection is working properly
   */
  private async validateConnection(db: PGlite): Promise<void> {
    try {
      await db.query('SELECT 1');
    } catch (error) {
      throw createDatabaseError('Connection validation failed', error as Error);
    }
  }

  // Method for debugging current connection status
  public getConnectionStatus(): { dataDir: string | null; isConnected: boolean; isInitialized: boolean } {
    return {
      dataDir: this.connectionInfo?.id || null,
      isConnected: !!this.db,
      isInitialized: this.isInitialized
    };
  }

  public async deleteDatabase(dataDir: string): Promise<void> {
    try {
      logger.info('Deleting database', { dataDir });

      // If this is the current database, close it first
      const currentDataDir = configManager.getDatabaseConfig().dataDir;
      if (currentDataDir === dataDir && this.db) {
        await this.close();
      }

      // Extract database name from dataDir (e.g., "project_123" from "idb://project_123")
      const dbName = dataDir.replace('idb://', '');

      // Delete the IndexedDB database
      if (typeof indexedDB !== 'undefined') {
        return new Promise((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(dbName);

          deleteRequest.onsuccess = () => {
            logger.info('Database deleted successfully', { dataDir, dbName });
            resolve();
          };

          deleteRequest.onerror = () => {
            logger.error('Failed to delete database', deleteRequest.error as Error, { dataDir, dbName });
            reject(deleteRequest.error);
          };

          deleteRequest.onblocked = () => {
            logger.warn('Database deletion blocked - connections may still be open', { dataDir, dbName });
            resolve(); // Resolve anyway as deletion will complete when connections close
          };
        });
      }
    } catch (error) {
      logError('Database deletion', error as Error, { dataDir });
      throw createDatabaseError('Failed to delete database', error as Error);
    }
  }

  private async doInitialization(customDataDir?: string): Promise<void> {
    try {
      const dbConfig = configManager.getDatabaseConfig();
      logger.info('Initializing PGlite database', { config: dbConfig, customDataDir });

      // Browser-only IndexedDB-backed PGlite
      const rawDataDir = customDataDir || dbConfig.dataDir;

      // Ensure proper idb:// prefix for IndexedDB persistence
      const dataDir = rawDataDir.startsWith('idb://') ? rawDataDir : `idb://${rawDataDir}`;


      // Use documented dataDir approach for IndexedDB persistence
      this.db = new PGlite({
        dataDir: dataDir,
        database: 'postgres',
        relaxedDurability: true, // Allow async IndexedDB flushes for better performance
      });

      logger.debug(`Using IndexedDB PGlite database for browser: ${dataDir}`);

      await this.db.waitReady;

      // Give PGlite more time to fully load persisted IndexedDB data
      // This prevents schema detection issues on page refresh
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set connection ID
      const actualConnectionId = customDataDir || dbConfig.dataDir;
      this.connectionInfo = {
        id: actualConnectionId,
        name: customDataDir ? `Project DB (${customDataDir})` : 'Supabase Lite DB',
        createdAt: new Date(),
        lastAccessed: new Date(),
      };


      // Initialize with some basic schemas
      await this.initializeSchemas();

      // Schema initialization complete - IndexedDB persistence is automatic

      this.isInitialized = true;
      logger.info('PGlite initialized successfully', {
        databaseId: this.connectionInfo.id,
        dataDir: dataDir
      });
    } catch (error) {
      const dbConfig = configManager.getDatabaseConfig();
      logError('Database initialization', error as Error, { config: dbConfig });
      throw createDatabaseError('Failed to initialize database', error as Error);
    }
  }

  private async initializeSchemas(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {

      // Check if database has been seeded by looking for specific roles that we create
      // Since roles persist but schemas/tables might not, this is the most reliable check
      let isSeeded = false;
      try {
        const roleCheckResult = await this.db.query(`
          SELECT EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'anon'
          ) as anon_exists,
          EXISTS (
            SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
          ) as authenticated_exists;
        `);
        
        const anonExists = roleCheckResult.rows[0]?.anon_exists === true;
        const authenticatedExists = roleCheckResult.rows[0]?.authenticated_exists === true;
        isSeeded = anonExists && authenticatedExists;
        
        console.log('MDB: Role check - anon exists:', anonExists, 'authenticated exists:', authenticatedExists, 'isSeeded:', isSeeded);
        
      } catch (error) {
        console.log('MDB: Error checking for seeded database roles, assuming not seeded:', error);
        isSeeded = false;
      }

      if (isSeeded) {
        console.log('MDB: isSeeded is true');
        // Check what tables exist in public schema
        const publicTablesResult = await this.db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name;
        `);

        // Also check all tables to see what we have
        const allTablesResult = await this.db.query(`
          SELECT table_schema, table_name 
          FROM information_schema.tables 
          WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
          ORDER BY table_schema, table_name;
        `);

        logger.info('Database already seeded with Supabase schema');
        return;
      }

      logger.info('Initializing database with Supabase seed schema');


      console.log('MDB: loadRolesSql');

      // Load and execute roles
      const rolesSql = await this.loadRolesSql();
      await this.db.exec(rolesSql);

      console.log('MDB: loadSeedSql');

      // Load and execute the seed.sql file
      const seedSql = await this.loadSeedSql();
      await this.db.exec(seedSql);

      console.log('MDB: loadPoliciesSql');

      // Load and execute default RLS policies
      const policiesSql = await this.loadPoliciesSql();
      await this.db.exec(policiesSql);
      console.log('MDB: loadPoliciesSql completed');

      logger.info('Supabase database schema with RLS initialized successfully');

      // Ensure all schema changes are persisted to IndexedDB
      await this.db.query('CHECKPOINT');
      console.log('MDB: CHECKPOINT executed to ensure persistence');

      // Verify schema initialization with simple query
      try {
        await this.db.query('SELECT 1');
      } catch (error) {
        console.error('Schema validation failed:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error during schema initialization:', error);
      logError('Schema initialization', error as Error);
      throw createDatabaseError('Failed to initialize database schemas', error as Error);
    }
  }

  private async loadSeedSql(): Promise<string> {
    try {
      // Browser-only: fetch from static assets
      // const response = await fetch('/sql_scripts/seed.sql');
      const response = await fetch('/sql_scripts/schema.sql');
      if (!response.ok) {
        throw new Error(`Failed to load seed.sql: ${response.statusText}`);
      }
      const seedSql = await response.text();
      console.log('MDB: loaded seed.sql', response.statusText);

      logger.debug('Loaded seed.sql from static assets');
      return seedSql;
    } catch (error) {
      logger.warn('Could not load seed.sql file, falling back to basic schema', error as Error);
      // Fallback to basic schema if seed.sql is not available
      return `
        -- Fallback basic schema
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE SCHEMA IF NOT EXISTS realtime;
        CREATE SCHEMA IF NOT EXISTS extensions;
      `;
    }
  }

  private async loadRolesSql(): Promise<string> {
    try {
      // Browser-only: fetch from static assets
      const response = await fetch('/sql_scripts/roles.sql');
      if (!response.ok) {
        throw new Error(`Failed to load roles.sql: ${response.statusText}`);
      }
      const rolesSql = await response.text();
      logger.debug('Loaded roles.sql from static assets');
      return rolesSql;
    } catch (error) {
      logger.warn('Could not load roles.sql file, using basic roles', error as Error);
      // Fallback roles creation
      return `
        -- Basic roles fallback
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon NOLOGIN NOINHERIT NOBYPASSRLS;
          END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated NOLOGIN NOINHERIT NOBYPASSRLS;
          END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
          END IF;
        END $$;
      `;
    }
  }

  private async loadPoliciesSql(): Promise<string> {
    try {
      // Browser-only: fetch from static assets
      const response = await fetch('/sql_scripts/default_policies.sql');
      if (!response.ok) {
        throw new Error(`Failed to load default_policies.sql: ${response.statusText}`);
      }
      const policiesSql = await response.text();
      logger.debug('Loaded default_policies.sql from static assets');
      return policiesSql;
    } catch (error) {
      logger.warn('Could not load default_policies.sql file, skipping policies', error as Error);
      // Return empty string if policies can't be loaded
      return `-- No default policies loaded`;
    }
  }

  /**
   * Set session context for RLS enforcement
   * This sets PostgreSQL session variables that RLS policies can access
   */
  public async setSessionContext(context: SessionContext): Promise<void> {
    if (!this.db || !this.isInitialized) {
      throw createDatabaseError('Database not initialized. Call initialize() first.');
    }

    this.currentSessionContext = context;

    try {
      // For PGlite compatibility, we'll set session variables but skip role changes
      // if they fail (since PGlite might not support role switching the same way)

      // Try to set the role, but don't fail if it doesn't work
      try {
        await this.db.query(`SET LOCAL role = '${context.role}';`);
        logger.debug('Role set successfully', { role: context.role });
      } catch (roleError) {
        logger.warn('Role setting not supported, continuing with session variables only', {
          role: context.role,
          error: roleError
        });
        // Continue with session variable setting even if role setting fails
      }

      // Set JWT claims as session variables for RLS policies to access
      if (context.claims) {
        const claimsJson = JSON.stringify(context.claims);
        try {
          await this.db.query(`SET LOCAL request.jwt.claims = '${claimsJson.replace(/'/g, "''")}';`);
        } catch (claimError) {
          logger.warn('Could not set JWT claims variable', { error: claimError });
        }
      }

      // Set specific claim variables for convenience
      if (context.userId) {
        try {
          await this.db.query(`SET LOCAL request.jwt.claim.sub = '${context.userId}';`);
        } catch (subError) {
          logger.warn('Could not set sub claim variable', { error: subError });
        }
      }

      try {
        await this.db.query(`SET LOCAL request.jwt.claim.role = '${context.role}';`);
      } catch (roleClaimError) {
        logger.warn('Could not set role claim variable', { error: roleClaimError });
      }

      logger.debug('Session context set (with possible limitations)', {
        role: context.role,
        userId: context.userId
      });
    } catch (error) {
      logger.error('Failed to set session context', error as Error);
      // Don't throw error - log it but continue, since we want to degrade gracefully
      logger.warn('Continuing without full session context support');
    }
  }

  /**
   * Clear session context and reset to default role
   */
  public async clearSessionContext(): Promise<void> {
    if (!this.db || !this.isInitialized) {
      return;
    }

    try {
      // Reset to default role (anon) - handle gracefully if not supported
      try {
        await this.db.query(`SET LOCAL role = 'anon';`);
      } catch (roleError) {
        logger.warn('Could not reset role', { error: roleError });
      }

      // Clear session variables - handle each one gracefully
      try {
        await this.db.query(`SET LOCAL request.jwt.claims = '';`);
      } catch (claimError) {
        logger.warn('Could not clear JWT claims', { error: claimError });
      }

      try {
        await this.db.query(`SET LOCAL request.jwt.claim.sub = '';`);
      } catch (subError) {
        logger.warn('Could not clear sub claim', { error: subError });
      }

      try {
        await this.db.query(`SET LOCAL request.jwt.claim.role = 'anon';`);
      } catch (roleClaimError) {
        logger.warn('Could not clear role claim', { error: roleClaimError });
      }

      this.currentSessionContext = null;

      logger.debug('Session context cleared (with possible limitations)');
    } catch (error) {
      logger.error('Failed to clear session context', error as Error);
      // Don't throw here, as clearing context is best-effort
      this.currentSessionContext = null;
    }
  }

  /**
   * Execute a query with specific session context
   * Automatically sets and clears context around the query
   */
  public async queryWithContext(
    sql: string,
    context: SessionContext,
    optionsOrParams?: QueryOptions | any[]
  ): Promise<QueryResult> {
    const previousContext = this.currentSessionContext;

    try {
      // Set context for this query
      await this.setSessionContext(context);

      // Execute the query with the context
      const result = await this.query(sql, optionsOrParams);

      return result;
    } finally {
      // Always restore previous context
      if (previousContext) {
        await this.setSessionContext(previousContext);
      } else {
        await this.clearSessionContext();
      }
    }
  }

  /**
   * Get current session context
   */
  public getCurrentSessionContext(): SessionContext | null {
    return this.currentSessionContext;
  }

  public async query(sql: string, options?: QueryOptions): Promise<QueryResult>
  public async query(sql: string, params: any[]): Promise<QueryResult>
  public async query(sql: string, optionsOrParams?: QueryOptions | any[]): Promise<QueryResult> {
    if (!this.db || !this.isInitialized) {
      throw createDatabaseError('Database not initialized. Call initialize() first.');
    }

    // Handle overloaded method signatures
    let options: QueryOptions | undefined
    let params: any[] | undefined

    if (Array.isArray(optionsOrParams)) {
      params = optionsOrParams
      options = undefined
    } else {
      options = optionsOrParams
      params = undefined
    }

    const startTime = performance.now();
    const cacheKey = options?.cache ? this.getCacheKey(sql) : null;

    try {
      // Check cache if enabled
      if (cacheKey && configManager.get('enableQueryCaching')) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          logger.debug('Query served from cache', { sql: sql.slice(0, 100), cached: true });
          return cached;
        }
      }

      // Validate query permissions based on current role
      roleSimulator.preprocessQuery(sql);

      // Execute the query with timeout if specified
      const timeout = options?.timeout || configManager.getDatabaseConfig().queryTimeout;
      const result = params
        ? await this.executeWithTimeout(() => this.db!.query(sql, params), timeout)
        : await this.executeWithTimeout(() => this.db!.query(sql), timeout);

      const duration = performance.now() - startTime;

      // Update last accessed time
      if (this.connectionInfo) {
        this.connectionInfo.lastAccessed = new Date();
      }

      const queryResult: QueryResult = {
        rows: result.rows,
        fields: result.fields,
        rowCount: result.rows.length,
        command: sql.trim().split(' ')[0].toUpperCase(),
        duration: Math.round(duration * 100) / 100,
      };

      // Cache result if enabled
      if (cacheKey && this.shouldCacheQuery(sql)) {
        this.addToCache(cacheKey, queryResult);
      }

      // Track metrics
      this.addQueryMetric(sql, duration, queryResult.rowCount, !!cacheKey);

      // Log query execution
      if (configManager.getDatabaseConfig().enableQueryLogging) {
        logQuery(sql, duration, queryResult.rowCount);
      }

      return queryResult;
    } catch (error: any) {
      const duration = performance.now() - startTime;
      logError('Database query execution', error as Error, {
        sql: sql.slice(0, 200),
        duration
      });

      // Preserve the original PGlite error for PostgREST error mapping
      // Don't wrap it in a generic infrastructure error
      throw error;
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

  public isConnectionTransitioning(): boolean {
    return this.isTransitioning;
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
      const connectionInfo = this.getConnectionInfo();




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

  // Transaction support
  public async transaction<T>(
    queries: (() => Promise<T>)[],
    options?: TransactionOptions
  ): Promise<T[]> {
    if (!this.db || !this.isInitialized) {
      throw createDatabaseError('Database not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    logger.debug('Starting transaction', { queries: queries.length, options });

    try {
      // Start transaction
      await this.db.exec('BEGIN');

      // Set isolation level if specified
      if (options?.isolationLevel) {
        await this.db.exec(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }

      // Set read-only if specified
      if (options?.readOnly) {
        await this.db.exec('SET TRANSACTION READ ONLY');
      }

      const results: T[] = [];

      // Execute queries within transaction
      for (let i = 0; i < queries.length; i++) {
        try {
          const result = await queries[i]();
          results.push(result);
        } catch (error) {
          // Rollback on error
          await this.db.exec('ROLLBACK');
          const duration = performance.now() - startTime;
          logError(`Transaction failed at query ${i + 1}`, error as Error, {
            duration,
            queryIndex: i
          });
          throw createDatabaseError(
            `Transaction failed at query ${i + 1}`,
            error as Error
          );
        }
      }

      // Commit transaction
      await this.db.exec('COMMIT');

      const duration = performance.now() - startTime;
      logger.info('Transaction completed successfully', {
        queries: queries.length,
        duration
      });

      return results;
    } catch (error) {
      // Ensure rollback in case of any error
      try {
        await this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        logError('Transaction rollback failed', rollbackError as Error);
      }
      throw error;
    }
  }

  // Get query metrics
  public getQueryMetrics(): QueryMetrics[] {
    return [...this.queryMetrics];
  }

  // Clear query metrics
  public clearQueryMetrics(): void {
    this.queryMetrics = [];
    logger.info('Query metrics cleared');
  }

  // Clear query cache
  public clearQueryCache(): void {
    this.queryCache.clear();
    logger.info('Query cache cleared');
  }

  // Get cache statistics
  public getCacheStats(): { size: number; hitRate: number } {
    const size = this.queryCache.size;
    const totalQueries = this.queryMetrics.length;
    const cachedQueries = this.queryMetrics.filter(m => m.cached).length;
    const hitRate = totalQueries > 0 ? (cachedQueries / totalQueries) * 100 : 0;

    return { size, hitRate };
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    if (!timeout) return operation();

    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeout}ms`));
        }, timeout);
      }),
    ]);
  }

  private getCacheKey(sql: string): string {
    // Simple cache key generation - could be enhanced with parameter hashing
    return sql.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private getFromCache(key: string): QueryResult | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.queryCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private addToCache(key: string, result: QueryResult): void {
    // Clean old entries if cache is full
    if (this.queryCache.size >= 100) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, {
      result: { ...result },
      timestamp: Date.now(),
    });
  }

  private shouldCacheQuery(sql: string): boolean {
    const command = sql.trim().split(' ')[0].toUpperCase();
    // Only cache SELECT queries
    return command === 'SELECT' && !sql.toLowerCase().includes('random()');
  }

  private addQueryMetric(sql: string, duration: number, rowsAffected: number, cached: boolean): void {
    const metric: QueryMetrics = {
      query: sql.slice(0, 200), // Store first 200 chars
      duration,
      rowsAffected,
      cached,
      timestamp: new Date(),
    };

    this.queryMetrics.push(metric);

    // Keep only the last MAX_METRICS entries
    if (this.queryMetrics.length > this.MAX_METRICS) {
      this.queryMetrics = this.queryMetrics.slice(-this.MAX_METRICS);
    }

    // Log performance if tracking is enabled
    if (configManager.get('enablePerformanceTracking')) {
      logPerformance('Database query', duration, {
        command: sql.trim().split(' ')[0].toUpperCase(),
        rowsAffected,
        cached,
      });
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Create a backup of the current database
   * @param compression Compression option for the backup ('gzip', 'none', or 'auto')
   * @returns Promise that resolves to a Blob containing the backup
   */
  public async backupDatabase(compression: 'gzip' | 'none' | 'auto' = 'gzip'): Promise<Blob> {
    if (!this.db || !this.isInitialized) {
      throw createDatabaseError('Database not initialized. Cannot create backup.');
    }

    try {
      logger.info('Starting database backup', { compression });
      const startTime = performance.now();

      // Use PGlite's dumpDataDir method to create backup
      const backup = await this.db.dumpDataDir(compression);

      const duration = performance.now() - startTime;
      logger.info('Database backup completed successfully', {
        compression,
        duration: `${duration.toFixed(1)}ms`,
        size: backup.size
      });

      return backup instanceof File ? backup : backup;
    } catch (error) {
      logger.error('Database backup failed', error as Error, { compression });
      throw createDatabaseError('Failed to create database backup', error as Error);
    }
  }

  /**
   * Restore a database from a backup file
   * This is a static method that creates a new PGlite instance with the backup data
   * @param backupBlob The backup file to restore from
   * @param dataDir The data directory path for the restored database
   * @returns Promise that resolves to a new DatabaseManager instance
   */
  public static async restoreDatabase(backupBlob: Blob | File, dataDir: string): Promise<void> {
    try {
      logger.info('Starting database restore', {
        dataDir,
        backupSize: backupBlob.size
      });

      const startTime = performance.now();

      // Import PGlite dynamically to avoid circular dependencies
      const { PGlite } = await import('@electric-sql/pglite');

      // Ensure proper idb:// prefix for IndexedDB persistence
      const fullDataDir = dataDir.startsWith('idb://') ? dataDir : `idb://${dataDir}`;

      // Create new PGlite instance with the backup data
      const restoredDb = new PGlite({
        dataDir: fullDataDir,
        database: 'postgres',
        relaxedDurability: true,
        loadDataDir: backupBlob
      });

      // Wait for the restored database to be ready
      await restoredDb.waitReady;

      // Test the connection
      await restoredDb.query('SELECT 1');

      // Close the temporary instance (the actual instance will be created by initialize)
      await restoredDb.close();

      const duration = performance.now() - startTime;
      logger.info('Database restore completed successfully', {
        dataDir: fullDataDir,
        duration: `${duration.toFixed(1)}ms`,
        backupSize: backupBlob.size
      });
    } catch (error) {
      logger.error('Database restore failed', error as Error, {
        dataDir,
        backupSize: backupBlob.size
      });
      throw createDatabaseError('Failed to restore database from backup', error as Error);
    }
  }

  public async close(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        logger.debug('Database connection closed successfully');
      } catch (error) {
        logger.error('Error closing database connection', error as Error);
        // Continue with cleanup even if close fails
      }

      // Reset all state
      this.db = null;
      this.isInitialized = false;
      this.connectionInfo = null;
      this.queryMetrics = [];
      this.queryCache.clear();
      this.initializationPromise = null;
    }
  }

}

// Export singleton instance
export const dbManager = DatabaseManager.getInstance();