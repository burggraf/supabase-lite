import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('PostgREST API Compatibility', () => {
  const BASE_URL = 'http://localhost:5173';
  
  beforeAll(async () => {
    // Wait a bit for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
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
      data.forEach(product => {
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
      data.forEach(product => {
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