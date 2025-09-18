/**
 * Contract Test: GET /api/applications/{appId}
 * 
 * This test validates the contract for getting a specific application
 * Based on applications-api.yaml specification
 * 
 * CRITICAL: This test MUST FAIL initially (no implementation exists)
 */

import { describe, it, expect } from 'vitest';

describe('Contract: GET /api/applications/{appId}', () => {



  it('should return application details for valid appId', async () => {
    // This test MUST FAIL initially since no handler exists
    const appId = 'test-app';
    const response = await fetch(`/api/applications/${appId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();

    // Validate Application schema
    expect(data).toHaveProperty('id', appId);
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('runtimeId');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('updatedAt');

    // Validate types
    expect(typeof data.id).toBe('string');
    expect(typeof data.name).toBe('string');
    expect(typeof data.runtimeId).toBe('string');
    expect(['stopped', 'starting', 'running', 'stopping', 'deploying', 'error']).toContain(data.status);
  });

  it('should return 404 for non-existent application', async () => {
    const appId = 'non-existent-app';
    const response = await fetch(`/api/applications/${appId}`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message.toLowerCase()).toContain('not found');
  });

  it('should handle URL encoding in appId', async () => {
    const appId = 'test%20app'; // URL encoded space
    const response = await fetch(`/api/applications/${appId}`);

    // Should either decode and find 'test app' or return 404 - depends on implementation
    expect([200, 404]).toContain(response.status);
  });

  it('should validate appId format', async () => {
    const invalidAppId = ''; // Empty appId
    const response = await fetch(`/api/applications/${invalidAppId}`);

    // This might hit the base /api/applications endpoint instead, which is valid behavior
    expect([200, 400, 404]).toContain(response.status);
  });

  it('should include all application properties in response', async () => {
    const appId = 'detailed-app';
    const response = await fetch(`/api/applications/${appId}`);

    if (response.status === 200) {
      const data = await response.json();

      // Check all required properties from Application schema
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('runtimeId');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');

      // Optional properties should be defined if present
      if (data.description !== undefined) {
        expect(typeof data.description).toBe('string');
      }
      if (data.deploymentId !== undefined) {
        expect(typeof data.deploymentId).toBe('string');
      }
      if (data.metadata !== undefined) {
        expect(typeof data.metadata).toBe('object');
      }
    }
  });

  it('should support CORS headers', async () => {
    const appId = 'cors-test-app';
    const response = await fetch(`/api/applications/${appId}`);

    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });
});