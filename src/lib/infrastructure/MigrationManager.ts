import type { MigrationManager, Migration, MigrationResult } from '@/types/infrastructure';
import { DatabaseManager } from '../database/connection';
import { logger } from './Logger';
import { createMigrationError } from './ErrorHandler';

export class InfrastructureMigrationManager implements MigrationManager {
  private dbManager: DatabaseManager;
  private readonly MIGRATIONS_TABLE = 'supabase_lite_migrations';

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  async getMigrations(): Promise<Migration[]> {
    // In a full implementation, this would read from a migrations directory
    // For now, we'll return built-in migrations
    return this.getBuiltInMigrations();
  }

  async getAppliedMigrations(): Promise<Migration[]> {
    try {
      await this.ensureMigrationsTable();
      
      const result = await this.dbManager.query(`
        SELECT version, name, up as query, down, checksum, applied_at 
        FROM ${this.MIGRATIONS_TABLE} 
        ORDER BY version ASC
      `);

      return result.rows.map(row => ({
        version: row.version,
        name: row.name,
        up: row.query,
        down: row.down || undefined,
        checksum: row.checksum || undefined,
        appliedAt: new Date(row.applied_at),
      }));
    } catch (error) {
      logger.error('Failed to get applied migrations', error as Error);
      throw createMigrationError('Failed to retrieve applied migrations', error as Error);
    }
  }

  async getPendingMigrations(): Promise<Migration[]> {
    try {
      const allMigrations = await this.getMigrations();
      const appliedMigrations = await this.getAppliedMigrations();
      
      const appliedVersions = new Set(appliedMigrations.map(m => m.version));
      
      return allMigrations.filter(migration => !appliedVersions.has(migration.version));
    } catch (error) {
      logger.error('Failed to get pending migrations', error as Error);
      throw createMigrationError('Failed to retrieve pending migrations', error as Error);
    }
  }

  async runMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = performance.now();
    
    try {
      await this.ensureMigrationsTable();
      
      // Check if migration is already applied
      const appliedResult = await this.dbManager.query(`
        SELECT version FROM ${this.MIGRATIONS_TABLE} WHERE version = '${migration.version}'
      `);

      if (appliedResult.rows.length > 0) {
        logger.info(`Migration ${migration.version} already applied, skipping`);
        return {
          version: migration.version,
          success: true,
          error: undefined,
          duration: performance.now() - startTime,
        };
      }

      // Validate migration
      this.validateMigration(migration);

      logger.info(`Running migration ${migration.version}: ${migration.name}`);

      // Execute the migration first
      await this.dbManager.exec(migration.up);
      
      // Record the migration (handle duplicates gracefully outside of transaction)
      const checksum = this.calculateChecksum(migration.up);
      try {
        await this.dbManager.query(`
          INSERT INTO ${this.MIGRATIONS_TABLE} (version, name, up, down, checksum, applied_at)
          VALUES ('${migration.version}', '${migration.name}', '${migration.up.replace(/'/g, "''")}', ${migration.down ? `'${migration.down.replace(/'/g, "''")}'` : 'NULL'}, '${checksum}', '${new Date().toISOString()}')
        `);
      } catch (insertError: any) {
        // If this is a duplicate key error, the migration was already recorded
        if (insertError.message && insertError.message.includes('duplicate key')) {
          logger.warn(`Migration ${migration.version} record already exists, continuing`);
        } else {
          throw insertError;
        }
      }

      const duration = performance.now() - startTime;
      logger.info(`Migration ${migration.version} completed successfully`, { duration });

      return {
        version: migration.version,
        success: true,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(`Migration ${migration.version} failed`, error as Error, { duration });
      
      return {
        version: migration.version,
        success: false,
        error: (error as Error).message,
        duration,
      };
    }
  }

  async rollbackMigration(version: string): Promise<MigrationResult> {
    const startTime = performance.now();
    
    try {
      await this.ensureMigrationsTable();
      
      // Get the migration record
      const migrationResult = await this.dbManager.query(`
        SELECT version, name, down FROM ${this.MIGRATIONS_TABLE} 
        WHERE version = '${version}'
      `);

      if (migrationResult.rows.length === 0) {
        return {
          version,
          success: false,
          error: 'Migration not found or not applied',
          duration: performance.now() - startTime,
        };
      }

      const migration = migrationResult.rows[0];
      
      if (!migration.down) {
        return {
          version,
          success: false,
          error: 'Migration does not have a rollback script',
          duration: performance.now() - startTime,
        };
      }

      logger.info(`Rolling back migration ${version}: ${migration.name}`);

      // Execute rollback in a transaction
      await this.dbManager.transaction([
        async () => {
          // Execute the rollback
          await this.dbManager.exec(migration.down);
          
          // Remove the migration record
          await this.dbManager.query(`
            DELETE FROM ${this.MIGRATIONS_TABLE} WHERE version = '${version}'
          `);
        },
      ]);

      const duration = performance.now() - startTime;
      logger.info(`Migration ${version} rolled back successfully`, { duration });

      return {
        version,
        success: true,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error(`Migration ${version} rollback failed`, error as Error, { duration });
      
      return {
        version,
        success: false,
        error: (error as Error).message,
        duration,
      };
    }
  }

  async runAll(): Promise<MigrationResult[]> {
    try {
      const pendingMigrations = await this.getPendingMigrations();
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations to run');
        return [];
      }

      logger.info(`Running ${pendingMigrations.length} pending migrations`);
      const results: MigrationResult[] = [];

      // Run migrations in order
      for (const migration of pendingMigrations) {
        const result = await this.runMigration(migration);
        results.push(result);
        
        // Stop on first failure
        if (!result.success) {
          logger.error(`Migration batch stopped at ${migration.version} due to failure`);
          break;
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      logger.info('Migration batch completed', {
        total: results.length,
        successful,
        failed,
      });

      return results;
    } catch (error) {
      logger.error('Failed to run migration batch', error as Error);
      throw createMigrationError('Failed to run migrations', error as Error);
    }
  }

  // Utility methods
  async getMigrationStatus(): Promise<{
    total: number;
    applied: number;
    pending: number;
    lastApplied?: string;
  }> {
    const [allMigrations, appliedMigrations] = await Promise.all([
      this.getMigrations(),
      this.getAppliedMigrations(),
    ]);

    const lastApplied = appliedMigrations.length > 0 
      ? appliedMigrations[appliedMigrations.length - 1].version 
      : undefined;

    return {
      total: allMigrations.length,
      applied: appliedMigrations.length,
      pending: allMigrations.length - appliedMigrations.length,
      lastApplied,
    };
  }

  async validateMigrations(): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      const migrations = await this.getMigrations();
      const versions = new Set<string>();

      for (const migration of migrations) {
        // Check for duplicate versions
        if (versions.has(migration.version)) {
          errors.push(`Duplicate migration version: ${migration.version}`);
        }
        versions.add(migration.version);

        // Validate migration structure
        try {
          this.validateMigration(migration);
        } catch (error) {
          errors.push(`Migration ${migration.version}: ${(error as Error).message}`);
        }
      }

      // Check version ordering
      const sortedVersions = Array.from(versions).sort();
      const originalVersions = migrations.map(m => m.version);
      
      if (JSON.stringify(sortedVersions) !== JSON.stringify(originalVersions)) {
        errors.push('Migration versions are not in chronological order');
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      logger.error('Failed to validate migrations', error as Error);
      return {
        valid: false,
        errors: [`Validation failed: ${(error as Error).message}`],
      };
    }
  }

  private async ensureMigrationsTable(): Promise<void> {
    try {
      await this.dbManager.exec(`
        CREATE TABLE IF NOT EXISTS ${this.MIGRATIONS_TABLE} (
          version VARCHAR(20) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          up TEXT NOT NULL,
          down TEXT,
          checksum VARCHAR(64),
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error) {
      throw createMigrationError('Failed to create migrations table', error as Error);
    }
  }

  private validateMigration(migration: Migration): void {
    if (!migration.version || typeof migration.version !== 'string') {
      throw new Error('Migration version is required and must be a string');
    }

    if (!migration.name || typeof migration.name !== 'string') {
      throw new Error('Migration name is required and must be a string');
    }

    if (!migration.up || typeof migration.up !== 'string') {
      throw new Error('Migration up script is required and must be a string');
    }

    // Validate version format (should be like "001", "002", etc. or timestamp)
    if (!/^\d{3,14}$/.test(migration.version)) {
      throw new Error('Migration version must be numeric (e.g., "001" or "20231201120000")');
    }

    // Basic SQL validation
    if (migration.up.trim().length === 0) {
      throw new Error('Migration up script cannot be empty');
    }

    if (migration.down && migration.down.trim().length === 0) {
      throw new Error('Migration down script cannot be empty');
    }
  }

  private calculateChecksum(sql: string): string {
    // Simple checksum for migration integrity
    return btoa(sql).slice(0, 32);
  }

  private getBuiltInMigrations(): Migration[] {
    return [
      {
        version: '001',
        name: 'Create auth schema',
        up: `
          CREATE SCHEMA IF NOT EXISTS auth;
          
          CREATE TABLE IF NOT EXISTS auth.users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            encrypted_password VARCHAR(255),
            email_confirmed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            raw_user_meta_data TEXT DEFAULT '{}',
            raw_app_meta_data TEXT DEFAULT '{}'
          );
          
          CREATE TABLE IF NOT EXISTS auth.sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);
          CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth.sessions(user_id);
        `,
        down: `
          DROP TABLE IF EXISTS auth.sessions;
          DROP TABLE IF EXISTS auth.users;
          DROP SCHEMA IF EXISTS auth CASCADE;
        `,
      },
      {
        version: '002',
        name: 'Create storage schema',
        up: `
          CREATE SCHEMA IF NOT EXISTS storage;
          
          CREATE TABLE IF NOT EXISTS storage.buckets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner INTEGER REFERENCES auth.users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            public BOOLEAN DEFAULT false
          );
          
          CREATE TABLE IF NOT EXISTS storage.objects (
            id SERIAL PRIMARY KEY,
            bucket_id TEXT NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            owner INTEGER REFERENCES auth.users(id),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT DEFAULT '{}',
            UNIQUE(bucket_id, name)
          );
          
          CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id ON storage.objects(bucket_id);
          CREATE INDEX IF NOT EXISTS idx_storage_objects_owner ON storage.objects(owner);
        `,
        down: `
          DROP TABLE IF EXISTS storage.objects;
          DROP TABLE IF EXISTS storage.buckets;
          DROP SCHEMA IF EXISTS storage CASCADE;
        `,
      },
      {
        version: '003',
        name: 'Create realtime schema',
        up: `
          CREATE SCHEMA IF NOT EXISTS realtime;
          
          CREATE TABLE IF NOT EXISTS realtime.schema_migrations (
            version VARCHAR(255) PRIMARY KEY,
            inserted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS realtime.subscription (
            id BIGSERIAL PRIMARY KEY,
            subscription_id TEXT NOT NULL,
            entity TEXT NOT NULL,
            filters TEXT DEFAULT '{}',
            claims TEXT DEFAULT '{}',
            claims_role TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `,
        down: `
          DROP TABLE IF EXISTS realtime.subscription;
          DROP TABLE IF EXISTS realtime.schema_migrations;
          DROP SCHEMA IF EXISTS realtime CASCADE;
        `,
      },
      {
        version: '004',
        name: 'Create test tables (products and orders)',
        up: `
          CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            description TEXT,
            tags TEXT[] DEFAULT '{}',
            metadata JSONB DEFAULT '{}',
            in_stock BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL DEFAULT 1,
            total_price REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
          CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
          CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
          
          -- Insert sample products
          INSERT INTO products (name, price, category, description, in_stock) VALUES
            ('Wireless Headphones', 99.99, 'Electronics', 'High-quality wireless headphones with noise cancellation', true),
            ('Running Shoes', 129.99, 'Footwear', 'Comfortable running shoes for daily exercise', true),
            ('Coffee Mug', 15.99, 'Home & Kitchen', 'Ceramic coffee mug with ergonomic handle', true),
            ('Laptop Stand', 49.99, 'Electronics', 'Adjustable aluminum laptop stand', true),
            ('Desk Lamp', 35.99, 'Home & Kitchen', 'LED desk lamp with adjustable brightness', true),
            ('Water Bottle', 24.99, 'Sports', 'Stainless steel water bottle with insulation', true),
            ('Notebook Set', 12.99, 'Office Supplies', 'Set of 3 lined notebooks', true),
            ('Phone Case', 19.99, 'Electronics', 'Protective phone case with raised edges', true),
            ('Yoga Mat', 45.99, 'Sports', 'Non-slip yoga mat with carrying strap', true),
            ('Bluetooth Speaker', 79.99, 'Electronics', 'Portable Bluetooth speaker with bass boost', true);
          
          -- Insert sample orders
          INSERT INTO orders (user_id, product_id, quantity, total_price, status) VALUES
            (1, 1, 1, 99.99, 'completed'),
            (1, 3, 2, 31.98, 'completed'),
            (2, 2, 1, 129.99, 'pending'),
            (2, 6, 1, 24.99, 'shipped'),
            (3, 4, 1, 49.99, 'completed'),
            (1, 10, 1, 79.99, 'pending'),
            (3, 7, 3, 38.97, 'completed'),
            (2, 8, 2, 39.98, 'shipped'),
            (1, 9, 1, 45.99, 'delivered'),
            (3, 5, 1, 35.99, 'completed');
        `,
        down: `
          DROP TABLE IF EXISTS orders;
          DROP TABLE IF EXISTS products;
        `,
      },
      {
        version: '005',
        name: 'Create RPC functions',
        up: `
          -- Create function to get product statistics
          CREATE OR REPLACE FUNCTION get_product_stats()
          RETURNS JSON AS $$
          DECLARE
            result JSON;
          BEGIN
            SELECT json_build_object(
              'total_products', (SELECT COUNT(*) FROM products),
              'avg_price', (SELECT ROUND(AVG(price)::numeric, 2) FROM products),
              'in_stock_count', (SELECT COUNT(*) FROM products WHERE in_stock = true),
              'categories', (SELECT COUNT(DISTINCT category) FROM products)
            ) INTO result;
            
            RETURN result;
          END;
          $$ LANGUAGE plpgsql;
          
          -- Create function to get products by category
          CREATE OR REPLACE FUNCTION get_products_by_category(category_name TEXT)
          RETURNS TABLE(
            id INTEGER,
            name TEXT,
            price REAL,
            category TEXT,
            description TEXT,
            in_stock BOOLEAN,
            created_at TIMESTAMP
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT p.id, p.name, p.price, p.category, p.description, p.in_stock, p.created_at
            FROM products p
            WHERE LOWER(p.category) LIKE LOWER('%' || category_name || '%');
          END;
          $$ LANGUAGE plpgsql;
          
          -- Create function to get category summary
          CREATE OR REPLACE FUNCTION get_category_summary()
          RETURNS TABLE(
            category TEXT,
            product_count BIGINT,
            avg_price NUMERIC
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              p.category,
              COUNT(*) as product_count,
              ROUND(AVG(p.price)::numeric, 2) as avg_price
            FROM products p
            WHERE p.category IS NOT NULL
            GROUP BY p.category
            ORDER BY p.category;
          END;
          $$ LANGUAGE plpgsql;
        `,
        down: `
          DROP FUNCTION IF EXISTS get_product_stats();
          DROP FUNCTION IF EXISTS get_products_by_category(TEXT);
          DROP FUNCTION IF EXISTS get_category_summary();
        `,
      },
      {
        version: '006',
        name: 'Add tags and metadata columns to products table',
        up: `
          -- Check and add tags column if it doesn't exist
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tags') THEN
              ALTER TABLE products ADD COLUMN tags TEXT[] DEFAULT '{}';
            END IF;
          END $$;
          
          -- Check and add metadata column if it doesn't exist  
          DO $$ 
          BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='metadata') THEN
              ALTER TABLE products ADD COLUMN metadata JSONB DEFAULT '{}';
            END IF;
          END $$;
        `,
        down: `
          ALTER TABLE products 
          DROP COLUMN IF EXISTS tags,
          DROP COLUMN IF EXISTS metadata;
        `,
      },
      {
        version: '007',
        name: 'Convert orders.user_id to UUID and enable RLS',
        up: `
          -- First, we need to fix the auth.users table to use UUID instead of SERIAL
          -- Step 1: Add new UUID column to auth.users
          ALTER TABLE auth.users ADD COLUMN user_uuid UUID DEFAULT gen_random_uuid();
          
          -- Step 2: Update sessions table to reference the new UUID
          ALTER TABLE auth.sessions ADD COLUMN user_uuid UUID;
          UPDATE auth.sessions SET user_uuid = (SELECT user_uuid FROM auth.users WHERE auth.users.id = auth.sessions.user_id);
          
          -- Step 3: Drop old foreign key and add new one
          ALTER TABLE auth.sessions DROP CONSTRAINT auth_sessions_user_id_fkey;
          ALTER TABLE auth.sessions ADD CONSTRAINT auth_sessions_user_uuid_fkey 
            FOREIGN KEY (user_uuid) REFERENCES auth.users(user_uuid) ON DELETE CASCADE;
          
          -- Step 4: Drop old integer columns and rename UUID columns
          ALTER TABLE auth.sessions DROP COLUMN user_id;
          ALTER TABLE auth.sessions RENAME COLUMN user_uuid TO user_id;
          
          -- Step 5: Update auth.users primary key
          ALTER TABLE auth.users DROP CONSTRAINT auth_users_pkey;
          ALTER TABLE auth.users DROP COLUMN id;
          ALTER TABLE auth.users RENAME COLUMN user_uuid TO id;
          ALTER TABLE auth.users ADD PRIMARY KEY (id);
          
          -- Step 6: Clear existing orders since we need to regenerate with proper UUIDs
          DELETE FROM orders;
          
          -- Step 7: Convert orders.user_id to UUID
          ALTER TABLE orders ALTER COLUMN user_id TYPE UUID USING NULL;
          
          -- Step 8: Add foreign key constraint to auth.users
          ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
          
          -- Step 9: Enable RLS on orders table
          ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
          
          -- Step 10: Create RLS policies for orders
          CREATE POLICY "users_can_access_own_orders" 
            ON orders FOR ALL 
            TO authenticated 
            USING (user_id = (SELECT auth.uid())) 
            WITH CHECK (user_id = (SELECT auth.uid()));
          
          CREATE POLICY "service_role_full_access" 
            ON orders FOR ALL 
            TO service_role 
            USING (true) 
            WITH CHECK (true);
          
          -- Step 11: Add performance index for RLS
          CREATE INDEX IF NOT EXISTS idx_orders_user_id_rls ON orders(user_id);
          
          -- Step 12: Create auth.uid() function for RLS compatibility
          CREATE OR REPLACE FUNCTION auth.uid() 
          RETURNS UUID AS $$
          BEGIN
            -- In our local environment, we'll extract from current session context
            -- This will be set by the API bridge when processing requests
            RETURN current_setting('jwt.claims.sub', true)::UUID;
          EXCEPTION
            WHEN OTHERS THEN
              RETURN NULL;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
          
          -- Step 13: Add missing fields to match test app expectations
          ALTER TABLE orders 
          ADD COLUMN IF NOT EXISTS items TEXT,
          ADD COLUMN IF NOT EXISTS order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          
          -- Step 14: Create some sample users and orders for testing
          INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at) VALUES
            ('550e8400-e29b-41d4-a716-446655440001', 'user1@example.com', 'hashed_password_1', NOW(), NOW(), NOW()),
            ('550e8400-e29b-41d4-a716-446655440002', 'user2@example.com', 'hashed_password_2', NOW(), NOW(), NOW()),
            ('550e8400-e29b-41d4-a716-446655440003', 'user3@example.com', 'hashed_password_3', NOW(), NOW(), NOW())
          ON CONFLICT (id) DO NOTHING;
          
          -- Step 15: Create sample orders with UUID user_ids
          INSERT INTO orders (user_id, product_id, quantity, total_price, status, items, order_date) VALUES
            ('550e8400-e29b-41d4-a716-446655440001', 1, 1, 99.99, 'completed', 'Wireless Headphones x1', '2024-01-15 10:30:00'),
            ('550e8400-e29b-41d4-a716-446655440001', 3, 2, 31.98, 'completed', 'Coffee Mug x2', '2024-01-20 14:22:00'),
            ('550e8400-e29b-41d4-a716-446655440002', 2, 1, 129.99, 'pending', 'Running Shoes x1', '2024-02-01 09:15:00'),
            ('550e8400-e29b-41d4-a716-446655440002', 6, 1, 24.99, 'shipped', 'Water Bottle x1', '2024-02-05 16:45:00'),
            ('550e8400-e29b-41d4-a716-446655440003', 4, 1, 49.99, 'completed', 'Laptop Stand x1', '2024-02-10 11:30:00')
          ON CONFLICT DO NOTHING;
        `,
        down: `
          -- Rollback script (simplified - removes RLS and reverts to integer IDs)
          DROP POLICY IF EXISTS "users_can_access_own_orders" ON orders;
          DROP POLICY IF EXISTS "service_role_full_access" ON orders;
          ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
          
          DROP INDEX IF EXISTS idx_orders_user_id_rls;
          DROP FUNCTION IF EXISTS auth.uid();
          
          -- Remove added columns
          ALTER TABLE orders 
          DROP COLUMN IF EXISTS items,
          DROP COLUMN IF EXISTS order_date;
          
          -- Clear data and revert to integer user_id
          DELETE FROM orders;
          DELETE FROM auth.sessions;
          DELETE FROM auth.users;
          
          ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
          ALTER TABLE orders ALTER COLUMN user_id TYPE INTEGER USING NULL;
          
          -- Revert auth.users to SERIAL
          ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS auth_users_pkey;
          ALTER TABLE auth.users RENAME COLUMN id TO user_uuid;
          ALTER TABLE auth.users ADD COLUMN id SERIAL PRIMARY KEY;
          
          -- Revert sessions table  
          ALTER TABLE auth.sessions RENAME COLUMN user_id TO user_uuid;
          ALTER TABLE auth.sessions ADD COLUMN user_id INTEGER;
          ALTER TABLE auth.sessions ADD CONSTRAINT auth_sessions_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
          ALTER TABLE auth.sessions DROP COLUMN user_uuid;
          
          -- Clean up auth.users
          ALTER TABLE auth.users DROP COLUMN user_uuid;
        `,
      },
      {
        version: '008',
        name: 'Actually fix orders table - UUID user_id and RLS',
        up: `
          -- STEP 1: Delete all existing orders data
          DELETE FROM orders;
          
          -- STEP 2: Convert orders.user_id from INTEGER to UUID
          ALTER TABLE orders ALTER COLUMN user_id TYPE UUID USING NULL;
          
          -- STEP 3: Add foreign key constraint to auth.users (assuming auth.users.id is UUID)
          ALTER TABLE orders ADD CONSTRAINT orders_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
          
          -- STEP 4: Enable RLS on orders table
          ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
          
          -- STEP 5: Create RLS policies for orders table
          CREATE POLICY "users_can_access_own_orders" 
            ON orders FOR ALL 
            TO authenticated 
            USING (user_id = (SELECT auth.uid())) 
            WITH CHECK (user_id = (SELECT auth.uid()));
          
          CREATE POLICY "service_role_full_access" 
            ON orders FOR ALL 
            TO service_role 
            USING (true) 
            WITH CHECK (true);
          
          -- STEP 6: Add performance index for RLS
          CREATE INDEX IF NOT EXISTS idx_orders_user_id_rls ON orders(user_id);
          
          -- STEP 7: Create auth.uid() function for RLS compatibility (if not exists)
          CREATE OR REPLACE FUNCTION auth.uid() 
          RETURNS UUID AS $$
          BEGIN
            -- In our local environment, we'll extract from current session context
            -- This will be set by the API bridge when processing requests
            RETURN current_setting('jwt.claims.sub', true)::UUID;
          EXCEPTION
            WHEN OTHERS THEN
              RETURN NULL;
          END;
          $$ LANGUAGE plpgsql SECURITY DEFINER;
          
          -- STEP 8: Add missing fields for test app compatibility
          ALTER TABLE orders 
          ADD COLUMN IF NOT EXISTS items TEXT,
          ADD COLUMN IF NOT EXISTS order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          
          -- STEP 9: Create sample orders with UUID user_ids from auth.users
          INSERT INTO orders (user_id, product_id, quantity, total_price, status, items, order_date) 
          SELECT 
            u.id as user_id,
            1 as product_id,
            1 as quantity,
            99.99 as total_price,
            'completed' as status,
            'Sample Order for ' || u.email as items,
            NOW() as order_date
          FROM auth.users u 
          LIMIT 3;
        `,
        down: `
          -- Rollback script
          DROP POLICY IF EXISTS "users_can_access_own_orders" ON orders;
          DROP POLICY IF EXISTS "service_role_full_access" ON orders;
          ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
          
          DROP INDEX IF EXISTS idx_orders_user_id_rls;
          DROP FUNCTION IF EXISTS auth.uid();
          
          -- Remove added columns
          ALTER TABLE orders 
          DROP COLUMN IF EXISTS items,
          DROP COLUMN IF EXISTS order_date;
          
          -- Clear data and revert to integer user_id
          DELETE FROM orders;
          ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
          ALTER TABLE orders ALTER COLUMN user_id TYPE INTEGER USING NULL;
        `,
      },
    ];
  }
}

// Factory function to create migration manager
export const createMigrationManager = (dbManager: DatabaseManager): MigrationManager => {
  return new InfrastructureMigrationManager(dbManager);
};

// Default migration manager instance
export const migrationManager = createMigrationManager(DatabaseManager.getInstance());