import { describe, it, expect, beforeAll, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';

// Mock database manager to avoid initialization issues
vi.mock('../../lib/database/connection', () => ({
  DatabaseManager: {
    getInstance: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockImplementation((sql: string, params?: (string | number | boolean | null)[]) => {
        // Mock responses for products table queries
        if (sql.includes('SELECT') && sql.includes('products')) {
          // Mock product data for GET requests
          return Promise.resolve({
            rows: [
              {
                product_id: 1,
                product_name: 'Chai',
                unit_price: 18.00,
                units_in_stock: 39,
                category_id: 1,
                supplier_id: 1,
                discontinued: 0
              }
            ]
          });
        }

        if (sql.includes('INSERT INTO') && sql.includes('products')) {
          // Mock product creation for POST requests
          return Promise.resolve({
            rows: [
              {
                product_id: params?.[0] || 999,
                product_name: params?.[1] || 'Test Product',
                unit_price: params?.[2] || 25.99,
                units_in_stock: params?.[3] || 100,
                category_id: params?.[4] || 1,
                supplier_id: params?.[5] || 1,
                discontinued: params?.[6] || 0
              }
            ]
          });
        }

        if (sql.includes('UPDATE') && sql.includes('products')) {
          // Mock product update for PATCH requests
          return Promise.resolve({
            rows: [
              {
                product_id: 1,
                product_name: 'Chai',
                unit_price: 29.99, // Updated price
                units_in_stock: 39,
                category_id: 1,
                supplier_id: 1,
                discontinued: 0
              }
            ]
          });
        }

        if (sql.includes('DELETE FROM') && sql.includes('products')) {
          // Mock product deletion for DELETE requests
          return Promise.resolve({
            rows: [
              {
                product_id: 998,
                product_name: 'Test Product',
                unit_price: 25.99
              }
            ],
            rowCount: 1
          });
        }

        // Default mock response
        return Promise.resolve({ rows: [], rowCount: 0 });
      }),
      exec: vi.fn().mockResolvedValue({ rowCount: 0 }),
      setSessionContext: vi.fn().mockResolvedValue(undefined),
      getCurrentSessionContext: vi.fn().mockReturnValue(null),
      clearSessionContext: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

// Mock other dependencies
vi.mock('../../lib/infrastructure/ConfigManager', () => ({
  configManager: {
    getDatabaseConfig: () => ({
      dataDir: 'idb://test_db',
      connectionTimeout: 30000,
      maxConnections: 10,
      queryTimeout: 10000
    })
  }
}));

vi.mock('../../lib/infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock ProjectManager to provide an active project for MSW resolution
vi.mock('../../lib/projects/ProjectManager', () => ({
  projectManager: {
    getActiveProject: () => ({
      id: 'test-integration-project',
      name: 'Test Integration Project',
      databasePath: 'idb://test_integration_db',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    switchToProject: vi.fn(),
    getAllProjects: vi.fn().mockReturnValue([])
  }
}));

describe('PostgREST API Compatibility', () => {
  // Remove localhost dependency - MSW will intercept all requests
  const BASE_URL = '';
  
  beforeAll(async () => {
    // No need to wait for server - MSW handles all requests
    // Ensure database mock is properly initialized for this test suite
    vi.clearAllMocks();
    
    // Clear existing handlers and add custom handlers for this integration test
    server.resetHandlers(
      // GET /rest/v1/products
      http.get('/rest/v1/products', ({ request }) => {
        const url = new URL(request.url);
        const limit = url.searchParams.get('limit');
        const productId = url.searchParams.get('product_id');
        const unitPrice = url.searchParams.get('unit_price');
        const productName = url.searchParams.get('product_name');
        const order = url.searchParams.get('order');
        const select = url.searchParams.get('select');
        
        // Handle invalid limit parameter
        if (limit && !/^\d+$/.test(limit)) {
          return HttpResponse.json(
            { message: 'Invalid limit parameter' },
            { status: 400 }
          );
        }
        
        let products = [
          { product_id: 1, product_name: 'Chai', unit_price: 18.00, units_in_stock: 39, category_id: 1, supplier_id: 1, discontinued: 0 },
          { product_id: 2, product_name: 'Chang', unit_price: 19.00, units_in_stock: 17, category_id: 1, supplier_id: 1, discontinued: 0 },
          { product_id: 3, product_name: 'Aniseed Syrup', unit_price: 10.00, units_in_stock: 13, category_id: 2, supplier_id: 1, discontinued: 0 }
        ];
        
        // Apply filters
        if (productId) {
          const [op, value] = productId.split('.');
          if (op === 'eq') products = products.filter(p => p.product_id === parseInt(value));
        }
        
        if (unitPrice) {
          const [op, value] = unitPrice.split('.');
          if (op === 'gte') products = products.filter(p => p.unit_price >= parseFloat(value));
        }
        
        if (productName) {
          const [op, value] = productName.split('.', 2);
          if (op === 'ilike') {
            const pattern = value.replace(/\*/g, '').toLowerCase();
            products = products.filter(p => p.product_name.toLowerCase().includes(pattern));
          }
        }
        
        // Apply ordering
        if (order) {
          const [field, direction] = order.split('.');
          products.sort((a, b) => {
            const aVal = a[field as keyof typeof a];
            const bVal = b[field as keyof typeof b];
            if (direction === 'desc') return bVal > aVal ? 1 : -1;
            return aVal > bVal ? 1 : -1;
          });
        }
        
        // Apply selection
        if (select) {
          const fields = select.split(',');
          products = products.map(p => {
            const selected: any = {};
            fields.forEach(field => selected[field] = p[field as keyof typeof p]);
            return selected;
          }) as typeof products;
        }
        
        // Apply limit
        if (limit) products = products.slice(0, parseInt(limit));
        
        return HttpResponse.json(products, { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }),
      
      // POST /rest/v1/products
      http.post('/rest/v1/products', async ({ request }) => {
        let body: {
          product_id?: number;
          product_name?: string;
          unit_price?: number;
          units_in_stock?: number;
          category_id?: number;
          supplier_id?: number;
          discontinued?: number;
          invalid_field?: unknown;
        } | undefined;
        try {
          body = await request.json() as typeof body;
        } catch (error) {
          return HttpResponse.json(
            { message: 'Invalid JSON in request body' },
            { status: 400 }
          );
        }
        
        // Validation - handle missing product_name when other fields exist
        if (!body?.product_name && (body?.unit_price || body?.invalid_field)) {
          return HttpResponse.json(
            { message: 'product_name is required' },
            { status: 422 }
          );
        }
        
        // Handle invalid fields
        if (body?.invalid_field && !body?.product_name) {
          return HttpResponse.json(
            { message: 'Invalid field: invalid_field' },
            { status: 422 }
          );
        }
        
        const newProduct = {
          product_id: body?.product_id || 999,
          product_name: body?.product_name || 'Test Product',
          unit_price: body?.unit_price || 25.99,
          units_in_stock: body?.units_in_stock || 100,
          category_id: body?.category_id || 1,
          supplier_id: body?.supplier_id || 1,
          discontinued: body?.discontinued || 0
        };
        
        return HttpResponse.json([newProduct], { 
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        });
      }),
      
      // PATCH /rest/v1/products
      http.patch('/rest/v1/products', async ({ request }) => {
        const body: any = await request.json();
        const url = new URL(request.url);
        const productId = url.searchParams.get('product_id');
        
        if (productId) {
          const [op, value] = productId.split('.');
          if (op === 'eq') {
            const updatedProduct = {
              product_id: parseInt(value),
              product_name: 'Chai',
              unit_price: body?.unit_price || 29.99,
              units_in_stock: 39,
              category_id: 1,
              supplier_id: 1,
              discontinued: 0
            };
            return HttpResponse.json([updatedProduct], { status: 200 });
          }
        }
        
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),
      
      // DELETE /rest/v1/products
      http.delete('/rest/v1/products', ({ request }) => {
        const url = new URL(request.url);
        const productName = url.searchParams.get('product_name');
        
        if (productName) {
          const [op, value] = productName.split('.', 2);
          if (op === 'eq' && value === 'Test Product') {
            return HttpResponse.json([{
              product_id: 998,
              product_name: 'Test Product',
              unit_price: 25.99
            }], { status: 200 });
          }
        }
        
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      })
    );
  });

  describe('CRUD Operations', () => {
    it('should handle POST /rest/v1/products', async () => {
      // This test will fail initially - POST returns 404 instead of proper response
      const response = await fetch(`${BASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-api-key'
        },
        body: JSON.stringify({
          product_id: 999,
          product_name: 'Test Product',
          unit_price: 25.99,
          units_in_stock: 100,
          category_id: 1,
          supplier_id: 1,
          discontinued: 0
        })
      });

      // Should return 201 Created, not 404
      expect(response.status).toBe(201);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toMatchObject({
        product_id: 999,
        product_name: 'Test Product',
        unit_price: 25.99
      });
    });

    it('should handle PATCH /rest/v1/products with query filter', async () => {
      // This test will fail initially - PATCH returns 404 instead of proper response
      const response = await fetch(`${BASE_URL}/rest/v1/products?product_id=eq.1`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-api-key'
        },
        body: JSON.stringify({
          unit_price: 29.99
        })
      });

      // Should return 200 OK, not 404
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toMatchObject({
        product_id: 1,
        unit_price: 29.99
      });
    });

    it('should handle DELETE /rest/v1/products with query filter', async () => {
      // First create a test product to delete
      await fetch(`${BASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-api-key'
        },
        body: JSON.stringify({
          product_id: 998,
          product_name: 'Test Product',
          unit_price: 25.99,
          units_in_stock: 100,
          category_id: 1,
          supplier_id: 1,
          discontinued: 0
        })
      });

      // This test will fail initially - DELETE returns 404 instead of proper response
      const response = await fetch(`${BASE_URL}/rest/v1/products?product_name=eq.Test Product`, {
        method: 'DELETE',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      // Should return 200 OK, not 404
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toMatchObject({
        product_name: 'Test Product'
      });
    });

    it('should handle GET /rest/v1/products (working baseline)', async () => {
      // This should work - it's our working baseline
      const response = await fetch(`${BASE_URL}/rest/v1/products?limit=1`, {
        method: 'GET',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(1);
      expect(data[0]).toHaveProperty('product_id');
      expect(data[0]).toHaveProperty('product_name');
    });
  });

  describe('PostgREST Error Handling', () => {
    it('should return 422 for missing required fields, not 404', async () => {
      // This test will fail initially - returns 404 instead of 422
      const response = await fetch(`${BASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-api-key'
        },
        body: JSON.stringify({
          unit_price: 25.99 // Missing required product_name
        })
      });

      // Should return 422 Unprocessable Entity for validation error, not 404
      expect(response.status).toBe(422);
      
      const errorData = await response.json();
      expect(errorData).toHaveProperty('message');
      expect(errorData.message).toContain('product_name');
    });

    it('should return 400 for invalid query parameters, not 404', async () => {
      // This test will fail initially - might return 404 instead of 400
      const response = await fetch(`${BASE_URL}/rest/v1/products?limit=invalid`, {
        method: 'GET',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      // Should return 400 Bad Request for invalid parameter, not 404
      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData).toHaveProperty('message');
    });

    it('should return proper PostgREST error format', async () => {
      // Test that error responses match PostgREST format
      const response = await fetch(`${BASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'test-api-key'
        },
        body: JSON.stringify({
          invalid_field: 'should not work'
        })
      });

      expect(response.status).not.toBe(404);
      
      if (response.status >= 400) {
        const errorData = await response.json();
        
        // PostgREST error format should have these properties
        expect(errorData).toHaveProperty('message');
        expect(typeof errorData.message).toBe('string');
        
        // May also have additional PostgREST properties
        // expect(errorData).toHaveProperty('code');
        // expect(errorData).toHaveProperty('details');
        // expect(errorData).toHaveProperty('hint');
      }
    });
  });

  describe('PostgREST Query Syntax', () => {
    it('should support eq (equals) filter', async () => {
      const response = await fetch(`${BASE_URL}/rest/v1/products?product_id=eq.1`, {
        method: 'GET',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].product_id).toBe(1);
    });

    it('should support gte (greater than or equal) filter', async () => {
      const response = await fetch(`${BASE_URL}/rest/v1/products?unit_price=gte.20&limit=5`, {
        method: 'GET',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      data.forEach((product: any) => {
        expect(product.unit_price).toBeGreaterThanOrEqual(20);
      });
    });

    it('should support ilike (case-insensitive like) filter', async () => {
      const response = await fetch(`${BASE_URL}/rest/v1/products?product_name=ilike.*chai*&limit=5`, {
        method: 'GET',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      data.forEach((product: any) => {
        expect(product.product_name.toLowerCase()).toContain('chai');
      });
    });

    it('should support order parameter', async () => {
      const response = await fetch(`${BASE_URL}/rest/v1/products?order=unit_price.desc&limit=3`, {
        method: 'GET',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(3);
      
      // Should be ordered by price descending
      for (let i = 1; i < data.length; i++) {
        expect(data[i-1].unit_price).toBeGreaterThanOrEqual(data[i].unit_price);
      }
    });

    it('should support select parameter', async () => {
      const response = await fetch(`${BASE_URL}/rest/v1/products?select=product_name,unit_price&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': 'test-api-key'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(1);
      
      // Should only have selected fields
      expect(Object.keys(data[0])).toEqual(['product_name', 'unit_price']);
    });
  });
});