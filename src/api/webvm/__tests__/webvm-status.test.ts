/**
 * Contract Test: GET /api/webvm/status
 * 
 * This test validates the contract for getting WebVM instance status
 * Based on webvm-api.yaml specification
 * 
 * CRITICAL: This test MUST FAIL initially (no implementation exists)
 */

import { describe, it, expect } from 'vitest';

describe('Contract: GET /api/webvm/status', () => {



  it('should return WebVM instance status', async () => {
    // This test MUST FAIL initially since no handler exists
    const response = await fetch('/api/webvm/status');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();

    // Validate WebVMInstance schema
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('runtimeIds');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('config');

    // Validate types
    expect(typeof data.id).toBe('string');
    expect(['uninitialized', 'initializing', 'ready', 'running', 'error']).toContain(data.status);
    expect(Array.isArray(data.runtimeIds)).toBe(true);
    expect(typeof data.config).toBe('object');
  });

  it('should return valid WebVM configuration object', async () => {
    const response = await fetch('/api/webvm/status');

    if (response.status === 200) {
      const data = await response.json();

      // Validate WebVMConfig schema
      const config = data.config;
      expect(config).toHaveProperty('memoryLimit');
      expect(config).toHaveProperty('diskLimit');
      expect(config).toHaveProperty('networkEnabled');
      expect(config).toHaveProperty('snapshotEnabled');

      // Validate types and constraints
      expect(typeof config.memoryLimit).toBe('number');
      expect(config.memoryLimit).toBeGreaterThanOrEqual(512);
      expect(config.memoryLimit).toBeLessThanOrEqual(4096);

      expect(typeof config.diskLimit).toBe('number');
      expect(config.diskLimit).toBeGreaterThanOrEqual(1024);
      expect(config.diskLimit).toBeLessThanOrEqual(10240);

      expect(typeof config.networkEnabled).toBe('boolean');
      expect(typeof config.snapshotEnabled).toBe('boolean');
    }
  });

  it('should include runtime IDs array', async () => {
    const response = await fetch('/api/webvm/status');

    if (response.status === 200) {
      const data = await response.json();

      expect(Array.isArray(data.runtimeIds)).toBe(true);
      
      // Each runtime ID should be a string
      data.runtimeIds.forEach((runtimeId: any) => {
        expect(typeof runtimeId).toBe('string');
      });
    }
  });

  it('should include optional fields when present', async () => {
    const response = await fetch('/api/webvm/status');

    if (response.status === 200) {
      const data = await response.json();

      // Optional fields should have correct types if present
      if (data.activeApplicationId !== undefined) {
        expect(typeof data.activeApplicationId).toBe('string');
      }

      if (data.lastSnapshot !== undefined) {
        expect(new Date(data.lastSnapshot)).toBeInstanceOf(Date);
      }

      if (data.memoryUsage !== undefined) {
        expect(typeof data.memoryUsage).toBe('number');
        expect(data.memoryUsage).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('should handle uninitialized WebVM state', async () => {
    const response = await fetch('/api/webvm/status');

    expect(response.status).toBe(200);

    const data = await response.json();
    
    // WebVM might be uninitialized initially
    if (data.status === 'uninitialized') {
      expect(data.runtimeIds).toHaveLength(0);
      expect(data.activeApplicationId).toBeUndefined();
    }
  });

  it('should support CORS headers', async () => {
    const response = await fetch('/api/webvm/status');

    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });
});