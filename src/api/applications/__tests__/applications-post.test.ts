/**
 * Contract Test: POST /api/applications
 * 
 * This test validates the contract for creating new applications
 * Based on applications-api.yaml specification
 * 
 * CRITICAL: This test MUST FAIL initially (no implementation exists)
 */

import { describe, it, expect } from 'vitest';

describe('Contract: POST /api/applications', () => {

  const validApplicationRequest = {
    id: 'test-app',
    name: 'Test Application',
    description: 'A test application',
    runtimeId: 'nodejs-20',
    metadata: {
      entryPoint: 'index.js',
      environmentVariables: {
        NODE_ENV: 'production'
      }
    }
  };

  it('should create application with valid request and return 201', async () => {
    // This test MUST FAIL initially since no handler exists
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validApplicationRequest)
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();

    // Validate response matches Application schema
    expect(data).toHaveProperty('id', validApplicationRequest.id);
    expect(data).toHaveProperty('name', validApplicationRequest.name);
    expect(data).toHaveProperty('description', validApplicationRequest.description);
    expect(data).toHaveProperty('runtimeId', validApplicationRequest.runtimeId);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('updatedAt');
    expect(data).toHaveProperty('metadata');

    // Validate types
    expect(typeof data.id).toBe('string');
    expect(typeof data.name).toBe('string');
    expect(typeof data.runtimeId).toBe('string');
    expect(['stopped', 'starting', 'running', 'stopping', 'deploying', 'error']).toContain(data.status);
  });

  it('should validate required fields and return 400 for missing id', async () => {
    const invalidRequest = {
      name: 'Test Application',
      runtimeId: 'nodejs-20'
      // Missing required 'id' field
    };

    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message).toContain('id');
  });

  it('should validate required fields and return 400 for missing name', async () => {
    const invalidRequest = {
      id: 'test-app',
      runtimeId: 'nodejs-20'
      // Missing required 'name' field
    };

    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message).toContain('name');
  });

  it('should validate required fields and return 400 for missing runtimeId', async () => {
    const invalidRequest = {
      id: 'test-app',
      name: 'Test Application'
      // Missing required 'runtimeId' field
    };

    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message).toContain('runtimeId');
  });

  it('should validate id pattern and return 400 for invalid id format', async () => {
    const invalidRequest = {
      ...validApplicationRequest,
      id: 'INVALID_ID!' // Should be alphanumeric with hyphens only
    };

    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message).toContain('id');
  });

  it('should validate name length constraints', async () => {
    const invalidRequest = {
      ...validApplicationRequest,
      name: '' // Name must be 1-100 characters
    };

    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message).toContain('name');
  });

  it('should validate description length constraints', async () => {
    const invalidRequest = {
      ...validApplicationRequest,
      description: 'x'.repeat(501) // Description max 500 characters
    };

    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message).toContain('description');
  });

  it('should handle duplicate id and return appropriate error', async () => {
    // First create application
    await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validApplicationRequest)
    });

    // Try to create another with same id
    const response = await fetch('/api/applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validApplicationRequest)
    });

    expect([400, 409]).toContain(response.status); // Bad Request or Conflict

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message.toLowerCase()).toContain('exists');
  });

  it('should support CORS for OPTIONS request', async () => {
    const response = await fetch('/api/applications', {
      method: 'OPTIONS'
    });

    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });
});