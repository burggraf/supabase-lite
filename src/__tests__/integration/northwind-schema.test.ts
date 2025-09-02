import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseManager } from '../../lib/database/connection';

describe('Northwind Database Schema Integration', () => {
  let dbManager: DatabaseManager;

  beforeAll(async () => {
    dbManager = DatabaseManager.getInstance();
    await dbManager.initialize();
  });

  afterAll(async () => {
    await dbManager.close();
  });

  beforeEach(async () => {
    // Clean up any test tables that might exist
    try {
      await dbManager.exec('DROP TABLE IF EXISTS order_details CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS orders CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS products CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS categories CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS suppliers CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS customers CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS employees CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS employee_territories CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS territories CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS region CASCADE;');
      await dbManager.exec('DROP TABLE IF EXISTS shippers CASCADE;');
    } catch (error) {
      // Ignore cleanup errors - tables might not exist
    }
  });

  describe('Schema Initialization', () => {
    it('should have products table with proper structure', async () => {
      // This test will fail initially - no products table exists
      const tables = await dbManager.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'products' AND table_schema = 'public';
      `);
      
      expect(tables.rows).toHaveLength(1);
      expect(tables.rows[0].table_name).toBe('products');

      // Verify column structure
      const columns = await dbManager.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'products' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `);

      const expectedColumns = [
        { column_name: 'product_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'product_name', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'supplier_id', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'category_id', data_type: 'integer', is_nullable: 'YES' },
        { column_name: 'quantity_per_unit', data_type: 'character varying', is_nullable: 'YES' },
        { column_name: 'unit_price', data_type: 'numeric', is_nullable: 'YES' },
        { column_name: 'units_in_stock', data_type: 'smallint', is_nullable: 'YES' },
        { column_name: 'units_on_order', data_type: 'smallint', is_nullable: 'YES' },
        { column_name: 'reorder_level', data_type: 'smallint', is_nullable: 'YES' },
        { column_name: 'discontinued', data_type: 'integer', is_nullable: 'NO' }
      ];

      expect(columns.rows).toHaveLength(expectedColumns.length);
      
      expectedColumns.forEach((expectedCol, index) => {
        const actualCol = columns.rows[index];
        expect(actualCol.column_name).toBe(expectedCol.column_name);
        expect(actualCol.is_nullable).toBe(expectedCol.is_nullable);
      });
    });

    it('should have categories table with proper structure', async () => {
      // This test will fail initially - no categories table exists
      const tables = await dbManager.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'categories' AND table_schema = 'public';
      `);
      
      expect(tables.rows).toHaveLength(1);
      expect(tables.rows[0].table_name).toBe('categories');

      const columns = await dbManager.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'categories' AND table_schema = 'public'
        ORDER BY ordinal_position;
      `);

      const expectedColumns = [
        { column_name: 'category_id', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'category_name', data_type: 'character varying', is_nullable: 'NO' },
        { column_name: 'description', data_type: 'text', is_nullable: 'YES' },
        { column_name: 'picture', data_type: 'bytea', is_nullable: 'YES' }
      ];

      expect(columns.rows).toHaveLength(expectedColumns.length);
      
      expectedColumns.forEach((expectedCol, index) => {
        const actualCol = columns.rows[index];
        expect(actualCol.column_name).toBe(expectedCol.column_name);
        expect(actualCol.is_nullable).toBe(expectedCol.is_nullable);
      });
    });

    it('should have suppliers table with proper structure', async () => {
      // This test will fail initially - no suppliers table exists
      const tables = await dbManager.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'suppliers' AND table_schema = 'public';
      `);
      
      expect(tables.rows).toHaveLength(1);
      expect(tables.rows[0].table_name).toBe('suppliers');
    });

    it('should have customers table with proper structure', async () => {
      // This test will fail initially - no customers table exists
      const tables = await dbManager.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'customers' AND table_schema = 'public';
      `);
      
      expect(tables.rows).toHaveLength(1);
      expect(tables.rows[0].table_name).toBe('customers');
    });

    it('should have orders table with proper structure', async () => {
      // This test will fail initially - no orders table exists
      const tables = await dbManager.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'orders' AND table_schema = 'public';
      `);
      
      expect(tables.rows).toHaveLength(1);
      expect(tables.rows[0].table_name).toBe('orders');
    });

    it('should have order_details table with proper structure', async () => {
      // This test will fail initially - no order_details table exists
      const tables = await dbManager.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'order_details' AND table_schema = 'public';
      `);
      
      expect(tables.rows).toHaveLength(1);
      expect(tables.rows[0].table_name).toBe('order_details');
    });
  });

  describe('Foreign Key Relationships', () => {
    it('should have proper foreign key from products to categories', async () => {
      // This test will fail initially - foreign keys don't exist
      const foreignKeys = await dbManager.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'products'
          AND kcu.column_name = 'category_id';
      `);

      expect(foreignKeys.rows).toHaveLength(1);
      expect(foreignKeys.rows[0].foreign_table_name).toBe('categories');
      expect(foreignKeys.rows[0].foreign_column_name).toBe('category_id');
    });

    it('should have proper foreign key from products to suppliers', async () => {
      // This test will fail initially - foreign keys don't exist
      const foreignKeys = await dbManager.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'products'
          AND kcu.column_name = 'supplier_id';
      `);

      expect(foreignKeys.rows).toHaveLength(1);
      expect(foreignKeys.rows[0].foreign_table_name).toBe('suppliers');
      expect(foreignKeys.rows[0].foreign_column_name).toBe('supplier_id');
    });
  });

  describe('Sample Data Validation', () => {
    it('should have sample products data loaded', async () => {
      // This test will fail initially - no sample data exists
      const products = await dbManager.query(`
        SELECT COUNT(*) as count FROM products;
      `);
      
      const productCount = parseInt(products.rows[0].count);
      expect(productCount).toBeGreaterThan(0);
      expect(productCount).toBeGreaterThanOrEqual(77); // Northwind has 77 products
    });

    it('should have sample categories data loaded', async () => {
      // This test will fail initially - no sample data exists
      const categories = await dbManager.query(`
        SELECT COUNT(*) as count FROM categories;
      `);
      
      const categoryCount = parseInt(categories.rows[0].count);
      expect(categoryCount).toBeGreaterThan(0);
      expect(categoryCount).toBeGreaterThanOrEqual(8); // Northwind has 8 categories
    });

    it('should have specific test product needed by curl tests', async () => {
      // The curl test tries to update product_id=1, so it must exist
      const product = await dbManager.query(`
        SELECT * FROM products WHERE product_id = 1;
      `);
      
      expect(product.rows).toHaveLength(1);
      expect(product.rows[0].product_id).toBe(1);
      expect(product.rows[0].product_name).toBeDefined();
      expect(product.rows[0].unit_price).toBeDefined();
    });

    it('should have proper data relationships', async () => {
      // Test that foreign key relationships work with actual data
      const productsWithCategories = await dbManager.query(`
        SELECT p.product_name, c.category_name
        FROM products p
        JOIN categories c ON p.category_id = c.category_id
        LIMIT 5;
      `);

      expect(productsWithCategories.rows).toHaveLength(5);
      productsWithCategories.rows.forEach(row => {
        expect(row.product_name).toBeDefined();
        expect(row.category_name).toBeDefined();
      });
    });
  });

  describe('CRUD Operations Compatibility', () => {
    it('should support CREATE operations on products', async () => {
      // This test validates that we can create products (needed for curl POST test)
      const insertResult = await dbManager.query(`
        INSERT INTO products (product_id, product_name, unit_price, units_in_stock, category_id, supplier_id, discontinued)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `, [999, 'Test Product', 25.99, 100, 1, 1, 0]);

      expect(insertResult.rows).toHaveLength(1);
      expect(insertResult.rows[0].product_id).toBe(999);
      expect(insertResult.rows[0].product_name).toBe('Test Product');
      expect(parseFloat(insertResult.rows[0].unit_price)).toBe(25.99);
    });

    it('should support UPDATE operations on products', async () => {
      // This test validates that we can update products (needed for curl PATCH test)
      const updateResult = await dbManager.query(`
        UPDATE products SET unit_price = $1 WHERE product_id = $2 RETURNING *;
      `, [29.99, 1]);

      expect(updateResult.rows).toHaveLength(1);
      expect(updateResult.rows[0].product_id).toBe(1);
      expect(parseFloat(updateResult.rows[0].unit_price)).toBe(29.99);
    });

    it('should support DELETE operations on products', async () => {
      // First create a test product to delete
      await dbManager.query(`
        INSERT INTO products (product_id, product_name, unit_price, units_in_stock, category_id, supplier_id, discontinued)
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `, [998, 'Test Product', 25.99, 100, 1, 1, 0]);

      // This test validates that we can delete products (needed for curl DELETE test)
      const deleteResult = await dbManager.query(`
        DELETE FROM products WHERE product_name = $1 RETURNING *;
      `, ['Test Product']);

      expect(deleteResult.rows).toHaveLength(1);
      expect(deleteResult.rows[0].product_name).toBe('Test Product');

      // Verify it's actually deleted
      const verifyResult = await dbManager.query(`
        SELECT * FROM products WHERE product_name = $1;
      `, ['Test Product']);
      expect(verifyResult.rows).toHaveLength(0);
    });
  });
});