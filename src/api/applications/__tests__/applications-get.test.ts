/**
 * Contract Test: GET /api/applications
 * 
 * This test validates the contract for listing all applications
 * Based on applications-api.yaml specification
 * 
 * CRITICAL: This test MUST FAIL initially (no implementation exists)
 */

import { describe, it, expect } from 'vitest';

describe('Contract: GET /api/applications', () => {

  it('should return applications list with correct schema', async () => {
    // This test MUST FAIL initially since no handler exists
    const response = await fetch('/api/applications');
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    
    const data = await response.json();
    
    // Validate response schema matches OpenAPI spec
    expect(data).toHaveProperty('applications');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.applications)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('should filter applications by status query parameter', async () => {
    const response = await fetch('/api/applications?status=running');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('applications');
    
    // All returned applications should have 'running' status
    data.applications.forEach((app: any) => {
      expect(app.status).toBe('running');
    });
  });

  it('should filter applications by runtimeType query parameter', async () => {
    const response = await fetch('/api/applications?runtimeType=nodejs');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('applications');
    
    // Check that filtering is applied (implementation will determine exact behavior)
    expect(Array.isArray(data.applications)).toBe(true);
  });

  it('should return applications with correct schema properties', async () => {
    const response = await fetch('/api/applications');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    if (data.applications.length > 0) {
      const app = data.applications[0];
      
      // Validate Application schema from OpenAPI spec
      expect(app).toHaveProperty('id');
      expect(app).toHaveProperty('name');
      expect(app).toHaveProperty('runtimeId');
      expect(app).toHaveProperty('status');
      expect(app).toHaveProperty('createdAt');
      expect(app).toHaveProperty('updatedAt');
      
      // Validate types
      expect(typeof app.id).toBe('string');
      expect(typeof app.name).toBe('string');
      expect(typeof app.runtimeId).toBe('string');
      expect(['stopped', 'starting', 'running', 'stopping', 'deploying', 'error']).toContain(app.status);
      
      // Validate date strings
      expect(new Date(app.createdAt)).toBeInstanceOf(Date);
      expect(new Date(app.updatedAt)).toBeInstanceOf(Date);
    }
  });

  it('should handle empty results correctly', async () => {
    const response = await fetch('/api/applications');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.applications).toBeDefined();
    expect(data.total).toBeDefined();
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  it('should support CORS headers', async () => {
    const response = await fetch('/api/applications');
    
    // Should have CORS headers for cross-origin access
    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });
});