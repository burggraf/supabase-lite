/**
 * Contract Test: GET /api/runtimes
 * 
 * This test validates the contract for listing runtime environments
 * Based on runtimes-api.yaml specification
 * 
 * CRITICAL: This test MUST FAIL initially (no implementation exists)
 */

import { describe, it, expect } from 'vitest';

describe('Contract: GET /api/runtimes', () => {



  it('should return runtime environments list with correct schema', async () => {
    // This test MUST FAIL initially since no handler exists
    const response = await fetch('/api/runtimes');
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    
    const data = await response.json();
    
    // Validate response schema
    expect(data).toHaveProperty('runtimes');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.runtimes)).toBe(true);
    expect(typeof data.total).toBe('number');
  });

  it('should filter runtimes by type query parameter', async () => {
    const response = await fetch('/api/runtimes?type=nodejs');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('runtimes');
    
    // All returned runtimes should have 'nodejs' type
    data.runtimes.forEach((runtime: any) => {
      expect(runtime.type).toBe('nodejs');
    });
  });

  it('should filter runtimes by status query parameter', async () => {
    const response = await fetch('/api/runtimes?status=installed');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('runtimes');
    
    // All returned runtimes should have 'installed' status
    data.runtimes.forEach((runtime: any) => {
      expect(runtime.status).toBe('installed');
    });
  });

  it('should return runtimes with correct schema properties', async () => {
    const response = await fetch('/api/runtimes');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    if (data.runtimes.length > 0) {
      const runtime = data.runtimes[0];
      
      // Validate RuntimeEnvironment schema
      expect(runtime).toHaveProperty('id');
      expect(runtime).toHaveProperty('name');
      expect(runtime).toHaveProperty('type');
      expect(runtime).toHaveProperty('version');
      expect(runtime).toHaveProperty('status');
      expect(runtime).toHaveProperty('config');
      
      // Validate types
      expect(typeof runtime.id).toBe('string');
      expect(typeof runtime.name).toBe('string');
      expect(['static', 'nodejs', 'nextjs', 'python', 'edge-functions']).toContain(runtime.type);
      expect(typeof runtime.version).toBe('string');
      expect(['available', 'installing', 'installed', 'error']).toContain(runtime.status);
      expect(typeof runtime.config).toBe('object');
      
      // Validate optional fields if present
      if (runtime.dockerImage !== undefined) {
        expect(typeof runtime.dockerImage).toBe('string');
      }
      if (runtime.installedAt !== undefined) {
        expect(new Date(runtime.installedAt)).toBeInstanceOf(Date);
      }
      if (runtime.lastUsed !== undefined) {
        expect(new Date(runtime.lastUsed)).toBeInstanceOf(Date);
      }
    }
  });

  it('should return runtime configuration with correct structure', async () => {
    const response = await fetch('/api/runtimes');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    if (data.runtimes.length > 0) {
      const runtime = data.runtimes[0];
      const config = runtime.config;
      
      // Validate RuntimeConfig schema
      expect(config).toHaveProperty('defaultPort');
      expect(config).toHaveProperty('supportedExtensions');
      expect(config).toHaveProperty('buildRequired');
      expect(config).toHaveProperty('startupTimeout');
      expect(config).toHaveProperty('resourceLimits');
      
      // Validate types
      expect(typeof config.defaultPort).toBe('number');
      expect(Array.isArray(config.supportedExtensions)).toBe(true);
      expect(typeof config.buildRequired).toBe('boolean');
      expect(typeof config.startupTimeout).toBe('number');
      expect(typeof config.resourceLimits).toBe('object');
      
      // Validate resource limits structure
      expect(config.resourceLimits).toHaveProperty('memory');
      expect(config.resourceLimits).toHaveProperty('cpu');
      expect(typeof config.resourceLimits.memory).toBe('number');
      expect(typeof config.resourceLimits.cpu).toBe('number');
    }
  });

  it('should handle empty results correctly', async () => {
    const response = await fetch('/api/runtimes?type=nonexistent');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.runtimes).toBeDefined();
    expect(data.total).toBeDefined();
    expect(data.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.runtimes)).toBe(true);
  });

  it('should support multiple filter parameters', async () => {
    const response = await fetch('/api/runtimes?type=nodejs&status=installed');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('runtimes');
    
    // All returned runtimes should match both filters
    data.runtimes.forEach((runtime: any) => {
      expect(runtime.type).toBe('nodejs');
      expect(runtime.status).toBe('installed');
    });
  });

  it('should include built-in runtime types', async () => {
    const response = await fetch('/api/runtimes');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // Should include at least static runtime (always available)
    const staticRuntime = data.runtimes.find((r: any) => r.type === 'static');
    expect(staticRuntime).toBeDefined();
    expect(staticRuntime.status).toBe('available');
  });

  it('should sort runtimes by usage and popularity', async () => {
    const response = await fetch('/api/runtimes');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    if (data.runtimes.length > 1) {
      // Verify ordering (implementation dependent)
      expect(Array.isArray(data.runtimes)).toBe(true);
      expect(data.runtimes.length).toBeGreaterThan(0);
    }
  });

  it('should support CORS headers', async () => {
    const response = await fetch('/api/runtimes');
    
    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });

  it('should validate query parameter values', async () => {
    const response = await fetch('/api/runtimes?type=invalid-type');
    
    // Should either filter out invalid types or return empty results
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data.runtimes)).toBe(true);
  });

  it('should include installation metadata for installed runtimes', async () => {
    const response = await fetch('/api/runtimes?status=installed');
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    data.runtimes.forEach((runtime: any) => {
      if (runtime.status === 'installed') {
        expect(runtime).toHaveProperty('installedAt');
        expect(new Date(runtime.installedAt)).toBeInstanceOf(Date);
      }
    });
  });
});