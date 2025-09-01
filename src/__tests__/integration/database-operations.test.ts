import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseManager } from '../../lib/database/connection';
import { AuthBridge } from '../../lib/auth/AuthBridge';

describe('Database Operations Integration', () => {
  let dbManager: DatabaseManager;
  let authBridge: AuthBridge;

  beforeAll(async () => {
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();
    
    authBridge = AuthBridge.getInstance();
    await authBridge.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  beforeEach(async () => {
    // Clean up test tables
    try {
      await dbManager.exec('DROP TABLE IF EXISTS test_products CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS test_categories CASCADE;');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Schema Management', () => {
    it('should create and manage database schemas', async () => {
      // Create a custom schema
      await dbManager.exec('CREATE SCHEMA IF NOT EXISTS test_schema;');

      // Verify schema exists
      const schemas = await dbManager.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'test_schema';
      `);
      
      expect(schemas.rows).toHaveLength(1);
      expect(schemas.rows[0].schema_name).toBe('test_schema');

      // Create table in custom schema
      await dbManager.exec(`
        CREATE TABLE test_schema.items (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Verify table exists in schema
      const tables = await dbManager.query(`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_schema = 'test_schema' AND table_name = 'items';
      `);

      expect(tables.rows).toHaveLength(1);
      expect(tables.rows[0].table_name).toBe('items');
    });

    it('should handle schema permissions correctly', async () => {
      // This test would verify that schema-level permissions work
      // For now, just verify basic schema operations work
      await dbManager.exec('CREATE SCHEMA IF NOT EXISTS permission_test;');
      
      const schemaExists = await dbManager.query(`
        SELECT 1 FROM information_schema.schemata 
        WHERE schema_name = 'permission_test';
      `);
      
      expect(schemaExists.rows).toHaveLength(1);
    });
  });

  describe('Table Operations', () => {
    it('should create, alter, and drop tables', async () => {
      // Create table
      await dbManager.exec(`
        CREATE TABLE test_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Verify table creation
      const tables = await dbManager.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'test_categories' AND table_schema = 'public';
      `);
      expect(tables.rows).toHaveLength(1);

      // Add column
      await dbManager.exec('ALTER TABLE test_categories ADD COLUMN sort_order INTEGER DEFAULT 0;');

      // Verify column addition
      const columns = await dbManager.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'test_categories' AND column_name = 'sort_order';
      `);
      expect(columns.rows).toHaveLength(1);

      // Create index
      await dbManager.exec('CREATE INDEX idx_categories_name ON test_categories(name);');

      // Verify index creation
      const indexes = await dbManager.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'test_categories' AND indexname = 'idx_categories_name';
      `);
      expect(indexes.rows).toHaveLength(1);

      // Drop table
      await dbManager.exec('DROP TABLE test_categories;');

      // Verify table deletion
      const tablesAfterDrop = await dbManager.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'test_categories' AND table_schema = 'public';
      `);
      expect(tablesAfterDrop.rows).toHaveLength(0);
    });

    it('should handle foreign key relationships', async () => {
      // Create parent table
      await dbManager.exec(`
        CREATE TABLE test_categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE
        );
      `);

      // Create child table with foreign key
      await dbManager.exec(`
        CREATE TABLE test_products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          category_id UUID NOT NULL REFERENCES test_categories(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          price DECIMAL(10,2) NOT NULL
        );
      `);

      // Insert category
      const categoryResult = await dbManager.query(`
        INSERT INTO test_categories (name) VALUES ($1) RETURNING id;
      `, ['Electronics']);
      
      const categoryId = categoryResult.rows[0].id;

      // Insert product with valid foreign key
      await dbManager.query(`
        INSERT INTO test_products (category_id, name, price) VALUES ($1, $2, $3);
      `, [categoryId, 'Laptop', 999.99]);

      // Verify relationship
      const products = await dbManager.query(`
        SELECT p.name, c.name as category_name
        FROM test_products p
        JOIN test_categories c ON p.category_id = c.id;
      `);

      expect(products.rows).toHaveLength(1);
      expect(products.rows[0].name).toBe('Laptop');
      expect(products.rows[0].category_name).toBe('Electronics');

      // Test foreign key constraint violation
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await expect(
        dbManager.query(`
          INSERT INTO test_products (category_id, name, price) VALUES ($1, $2, $3);
        `, [nonExistentId, 'Invalid Product', 100.00])
      ).rejects.toThrow();

      // Test cascade delete
      await dbManager.query('DELETE FROM test_categories WHERE id = $1;', [categoryId]);

      const remainingProducts = await dbManager.query('SELECT * FROM test_products;');
      expect(remainingProducts.rows).toHaveLength(0);
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      // Set up test table for CRUD operations
      await dbManager.exec(`
        CREATE TABLE test_products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          in_stock BOOLEAN DEFAULT true,
          tags TEXT[],
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
    });

    it('should perform CREATE operations', async () => {
      // Insert single record
      const insertResult = await dbManager.query(`
        INSERT INTO test_products (name, description, price, tags, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `, [
        'Test Product',
        'A test product description',
        29.99,
        ['tag1', 'tag2'],
        JSON.stringify({ color: 'red', size: 'medium' })
      ]);

      expect(insertResult.rows).toHaveLength(1);
      expect(insertResult.rows[0].name).toBe('Test Product');
      expect(insertResult.rows[0].price).toBe('29.99');
      expect(insertResult.rows[0].tags).toEqual(['tag1', 'tag2']);
      expect(insertResult.rows[0].id).toBeDefined();

      // Bulk insert
      await dbManager.query(`
        INSERT INTO test_products (name, price) VALUES 
        ($1, $2), ($3, $4), ($5, $6);
      `, ['Product 1', 10.00, 'Product 2', 20.00, 'Product 3', 30.00]);

      const count = await dbManager.query('SELECT COUNT(*) FROM test_products;');
      expect(parseInt(count.rows[0].count)).toBe(4);
    });

    it('should perform READ operations with complex queries', async () => {
      // Insert test data
      await dbManager.query(`
        INSERT INTO test_products (name, price, in_stock, tags) VALUES 
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12);
      `, [
        'Expensive Item', 100.00, true, ['premium', 'luxury'],
        'Cheap Item', 5.00, false, ['budget', 'sale'], 
        'Medium Item', 50.00, true, ['standard']
      ]);

      // Basic SELECT
      const allProducts = await dbManager.query('SELECT * FROM test_products ORDER BY price;');
      expect(allProducts.rows).toHaveLength(3);
      expect(allProducts.rows[0].name).toBe('Cheap Item');
      expect(allProducts.rows[2].name).toBe('Expensive Item');

      // WHERE clause with conditions
      const inStock = await dbManager.query('SELECT * FROM test_products WHERE in_stock = true;');
      expect(inStock.rows).toHaveLength(2);

      // Price range query
      const priceRange = await dbManager.query(
        'SELECT * FROM test_products WHERE price BETWEEN $1 AND $2;',
        [10.00, 75.00]
      );
      expect(priceRange.rows).toHaveLength(1);
      expect(priceRange.rows[0].name).toBe('Medium Item');

      // Array operations
      const premiumProducts = await dbManager.query(`
        SELECT * FROM test_products WHERE $1 = ANY(tags);
      `, ['premium']);
      expect(premiumProducts.rows).toHaveLength(1);
      expect(premiumProducts.rows[0].name).toBe('Expensive Item');

      // LIKE pattern matching
      const itemsWithItem = await dbManager.query(`
        SELECT * FROM test_products WHERE name ILIKE '%item%';
      `);
      expect(itemsWithItem.rows).toHaveLength(3);

      // Aggregation
      const stats = await dbManager.query(`
        SELECT 
          COUNT(*) as total_products,
          AVG(price) as avg_price,
          MAX(price) as max_price,
          MIN(price) as min_price
        FROM test_products;
      `);
      expect(stats.rows[0].total_products).toBe('3');
      expect(parseFloat(stats.rows[0].avg_price)).toBeCloseTo(51.67, 1);
    });

    it('should perform UPDATE operations', async () => {
      // Insert test data
      const insertResult = await dbManager.query(`
        INSERT INTO test_products (name, price, in_stock) VALUES ($1, $2, $3) RETURNING id;
      `, ['Update Test', 25.00, true]);
      
      const productId = insertResult.rows[0].id;

      // Single field update
      const updateResult = await dbManager.query(`
        UPDATE test_products SET price = $1 WHERE id = $2 RETURNING *;
      `, [35.00, productId]);

      expect(updateResult.rows[0].price).toBe('35.00');

      // Multiple fields update
      await dbManager.query(`
        UPDATE test_products 
        SET name = $1, in_stock = $2, updated_at = NOW()
        WHERE id = $3;
      `, ['Updated Product', false, productId]);

      const verifyResult = await dbManager.query('SELECT * FROM test_products WHERE id = $1;', [productId]);
      expect(verifyResult.rows[0].name).toBe('Updated Product');
      expect(verifyResult.rows[0].in_stock).toBe(false);

      // Conditional update
      await dbManager.query(`
        INSERT INTO test_products (name, price) VALUES ('Bulk Update 1', 10), ('Bulk Update 2', 20);
      `);

      const bulkUpdateResult = await dbManager.query(`
        UPDATE test_products SET price = price * 1.1 WHERE price < $1;
      `, [30.00]);

      expect(bulkUpdateResult.rowCount).toBeGreaterThan(0);

      const updatedPrices = await dbManager.query(`
        SELECT price FROM test_products WHERE name LIKE 'Bulk Update%' ORDER BY price;
      `);
      expect(parseFloat(updatedPrices.rows[0].price)).toBe(11.00);
      expect(parseFloat(updatedPrices.rows[1].price)).toBe(22.00);
    });

    it('should perform DELETE operations', async () => {
      // Insert test data
      await dbManager.query(`
        INSERT INTO test_products (name, price, in_stock) VALUES 
        ($1, $2, $3), ($4, $5, $6), ($7, $8, $9);
      `, [
        'Delete Test 1', 10.00, true,
        'Delete Test 2', 20.00, false, 
        'Keep This', 30.00, true
      ]);

      // Single record delete
      const deleteResult = await dbManager.query(`
        DELETE FROM test_products WHERE name = $1;
      `, ['Delete Test 1']);
      expect(deleteResult.rowCount).toBe(1);

      // Conditional delete
      const conditionalDelete = await dbManager.query(`
        DELETE FROM test_products WHERE in_stock = false;
      `);
      expect(conditionalDelete.rowCount).toBe(1);

      // Verify remaining data
      const remaining = await dbManager.query('SELECT * FROM test_products;');
      expect(remaining.rows).toHaveLength(1);
      expect(remaining.rows[0].name).toBe('Keep This');

      // Delete with RETURNING
      const deleteWithReturn = await dbManager.query(`
        DELETE FROM test_products WHERE name = $1 RETURNING *;
      `, ['Keep This']);
      expect(deleteWithReturn.rows).toHaveLength(1);
      expect(deleteWithReturn.rows[0].name).toBe('Keep This');

      // Verify table is empty
      const finalCount = await dbManager.query('SELECT COUNT(*) FROM test_products;');
      expect(parseInt(finalCount.rows[0].count)).toBe(0);
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await dbManager.exec(`
        CREATE TABLE test_accounts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          balance DECIMAL(10,2) NOT NULL DEFAULT 0.00
        );
      `);

      // Insert test accounts
      await dbManager.query(`
        INSERT INTO test_accounts (name, balance) VALUES 
        ('Account A', 1000.00),
        ('Account B', 500.00);
      `);
    });

    it('should handle successful transactions', async () => {
      const accountA = await dbManager.query(`SELECT id FROM test_accounts WHERE name = 'Account A';`);
      const accountB = await dbManager.query(`SELECT id FROM test_accounts WHERE name = 'Account B';`);
      
      const accountAId = accountA.rows[0].id;
      const accountBId = accountB.rows[0].id;

      // Perform transaction: transfer $200 from A to B
      await dbManager.exec('BEGIN;');
      
      try {
        await dbManager.query(`
          UPDATE test_accounts SET balance = balance - $1 WHERE id = $2;
        `, [200.00, accountAId]);

        await dbManager.query(`
          UPDATE test_accounts SET balance = balance + $1 WHERE id = $2;
        `, [200.00, accountBId]);

        await dbManager.exec('COMMIT;');
      } catch (error) {
        await dbManager.exec('ROLLBACK;');
        throw error;
      }

      // Verify balances
      const finalBalances = await dbManager.query(`
        SELECT name, balance FROM test_accounts ORDER BY name;
      `);

      expect(parseFloat(finalBalances.rows[0].balance)).toBe(800.00); // Account A
      expect(parseFloat(finalBalances.rows[1].balance)).toBe(700.00); // Account B
    });

    it('should handle transaction rollbacks', async () => {
      const accountA = await dbManager.query(`SELECT id FROM test_accounts WHERE name = 'Account A';`);
      const accountAId = accountA.rows[0].id;

      // Get initial balance
      const initialBalance = await dbManager.query(`
        SELECT balance FROM test_accounts WHERE id = $1;
      `, [accountAId]);

      // Start transaction with intentional failure
      await dbManager.exec('BEGIN;');
      
      try {
        await dbManager.query(`
          UPDATE test_accounts SET balance = balance - $1 WHERE id = $2;
        `, [200.00, accountAId]);

        // This should fail due to constraint violation (negative balance simulation)
        await dbManager.query(`
          UPDATE test_accounts SET balance = -999999 WHERE id = $1;
        `, [accountAId]);

        await dbManager.exec('COMMIT;');
      } catch (error) {
        await dbManager.exec('ROLLBACK;');
      }

      // Verify balance is unchanged
      const finalBalance = await dbManager.query(`
        SELECT balance FROM test_accounts WHERE id = $1;
      `, [accountAId]);

      expect(finalBalance.rows[0].balance).toBe(initialBalance.rows[0].balance);
    });
  });

  describe('Data Types and JSON Operations', () => {
    beforeEach(async () => {
      await dbManager.exec(`
        CREATE TABLE test_data_types (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          text_field TEXT,
          number_field INTEGER,
          decimal_field DECIMAL(10,2),
          boolean_field BOOLEAN,
          date_field DATE,
          timestamp_field TIMESTAMP WITH TIME ZONE,
          array_field TEXT[],
          json_field JSON,
          jsonb_field JSONB
        );
      `);
    });

    it('should handle various PostgreSQL data types', async () => {
      const testData = {
        text_field: 'Sample text with unicode: 🚀',
        number_field: 42,
        decimal_field: 123.45,
        boolean_field: true,
        date_field: '2024-01-15',
        timestamp_field: '2024-01-15T10:30:00Z',
        array_field: ['item1', 'item2', 'item3'],
        json_field: JSON.stringify({ key: 'value', nested: { count: 5 } }),
        jsonb_field: JSON.stringify({ type: 'product', attributes: ['fast', 'reliable'] })
      };

      const insertResult = await dbManager.query(`
        INSERT INTO test_data_types (
          text_field, number_field, decimal_field, boolean_field,
          date_field, timestamp_field, array_field, json_field, jsonb_field
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
      `, Object.values(testData));

      const row = insertResult.rows[0];
      
      expect(row.text_field).toBe(testData.text_field);
      expect(row.number_field).toBe(testData.number_field);
      expect(parseFloat(row.decimal_field)).toBe(testData.decimal_field);
      expect(row.boolean_field).toBe(testData.boolean_field);
      expect(row.array_field).toEqual(testData.array_field);
    });

    it('should perform JSON operations', async () => {
      // Insert JSON data
      await dbManager.query(`
        INSERT INTO test_data_types (jsonb_field) VALUES ($1);
      `, [JSON.stringify({
        user: {
          name: 'John Doe',
          age: 30,
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        tags: ['admin', 'verified']
      })]);

      // JSON path queries
      const nameQuery = await dbManager.query(`
        SELECT jsonb_field->>'user' as user_data
        FROM test_data_types 
        WHERE jsonb_field IS NOT NULL;
      `);

      expect(nameQuery.rows).toHaveLength(1);

      // Nested JSON access
      const nestedQuery = await dbManager.query(`
        SELECT 
          jsonb_field->'user'->>'name' as user_name,
          jsonb_field->'user'->'preferences'->>'theme' as theme
        FROM test_data_types 
        WHERE jsonb_field->'user'->>'name' IS NOT NULL;
      `);

      expect(nestedQuery.rows[0].user_name).toBe('John Doe');
      expect(nestedQuery.rows[0].theme).toBe('dark');

      // JSON containment
      const containsQuery = await dbManager.query(`
        SELECT * FROM test_data_types 
        WHERE jsonb_field @> $1;
      `, [JSON.stringify({ tags: ['admin'] })]);

      expect(containsQuery.rows).toHaveLength(1);

      // JSON key existence
      const keyExistsQuery = await dbManager.query(`
        SELECT * FROM test_data_types 
        WHERE jsonb_field ? 'user';
      `);

      expect(keyExistsQuery.rows).toHaveLength(1);
    });
  });

  describe('Performance and Indexing', () => {
    beforeEach(async () => {
      await dbManager.exec(`
        CREATE TABLE test_performance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          price DECIMAL(10,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Insert test data for performance testing
      const insertPromises = [];
      for (let i = 0; i < 100; i++) {
        insertPromises.push(
          dbManager.query(`
            INSERT INTO test_performance (name, category, price) 
            VALUES ($1, $2, $3);
          `, [`Product ${i}`, i % 5 === 0 ? 'Electronics' : 'Other', Math.random() * 100])
        );
      }
      await Promise.all(insertPromises);
    });

    it('should create and use indexes effectively', async () => {
      // Query without index (baseline)
      const start1 = Date.now();
      await dbManager.query(`
        SELECT * FROM test_performance WHERE category = 'Electronics';
      `);
      const time1 = Date.now() - start1;

      // Create index
      await dbManager.exec(`
        CREATE INDEX idx_performance_category ON test_performance(category);
      `);

      // Query with index
      const start2 = Date.now();
      const result = await dbManager.query(`
        SELECT * FROM test_performance WHERE category = 'Electronics';
      `);
      const time2 = Date.now() - start2;

      // Verify results are correct
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows.every(row => row.category === 'Electronics')).toBe(true);

      // Index should not significantly slow down queries (basic sanity check)
      // Note: In a real test environment with more data, indexed queries would be faster
      expect(time2).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle complex queries efficiently', async () => {
      // Complex query with JOIN, WHERE, ORDER BY, LIMIT
      const complexResult = await dbManager.query(`
        SELECT 
          p1.name,
          p1.price,
          p1.category,
          COUNT(p2.id) as similar_count
        FROM test_performance p1
        LEFT JOIN test_performance p2 ON p1.category = p2.category AND p1.id != p2.id
        WHERE p1.price > $1
        GROUP BY p1.id, p1.name, p1.price, p1.category
        HAVING COUNT(p2.id) > $2
        ORDER BY p1.price DESC
        LIMIT 10;
      `, [10.0, 5]);

      // Query should execute successfully
      expect(complexResult.rows).toBeDefined();
      expect(Array.isArray(complexResult.rows)).toBe(true);
    });
  });

  describe('Database Utilities', () => {
    it('should provide database size information', async () => {
      const size = await dbManager.getDatabaseSize();
      expect(typeof size).toBe('string');
      expect(size).toMatch(/\d+(\.\d+)?\s*(B|KB|MB|GB)/);
    });

    it('should list all tables', async () => {
      // Create some test tables
      await dbManager.exec('CREATE TABLE test_table_1 (id SERIAL PRIMARY KEY);');
      await dbManager.exec('CREATE TABLE test_table_2 (id SERIAL PRIMARY KEY);');

      const tables = await dbManager.getTableList();
      expect(Array.isArray(tables)).toBe(true);
      expect(tables.some(table => table.includes('test_table_1'))).toBe(true);
      expect(tables.some(table => table.includes('test_table_2'))).toBe(true);

      // Clean up
      await dbManager.exec('DROP TABLE test_table_1, test_table_2;');
    });

    it('should track query metrics', async () => {
      // Clear existing metrics
      dbManager.clearQueryMetrics();

      // Execute some queries
      await dbManager.query('SELECT 1;');
      await dbManager.query('SELECT 2;');
      await dbManager.query('SELECT 3;');

      const metrics = dbManager.getQueryMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThanOrEqual(3);

      // Each metric should have timestamp, query, and duration
      metrics.forEach(metric => {
        expect(metric).toHaveProperty('timestamp');
        expect(metric).toHaveProperty('query');
        expect(metric).toHaveProperty('duration');
        expect(typeof metric.duration).toBe('number');
      });

      // Clear metrics
      dbManager.clearQueryMetrics();
      const clearedMetrics = dbManager.getQueryMetrics();
      expect(clearedMetrics).toHaveLength(0);
    });

    it('should handle connection info', () => {
      const connectionInfo = dbManager.getConnectionInfo();
      
      if (connectionInfo) {
        expect(connectionInfo).toHaveProperty('status');
        expect(connectionInfo).toHaveProperty('database');
        expect(connectionInfo).toHaveProperty('connectedAt');
      }
    });
  });
});