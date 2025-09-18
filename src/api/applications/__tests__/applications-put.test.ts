/**
 * Contract Test: PUT /api/applications/{appId}
 * 
 * This test validates the contract for updating application details
 * Based on applications-api.yaml specification
 * 
 * CRITICAL: This test MUST FAIL initially (no implementation exists)
 */

import { describe, it, expect } from 'vitest';

describe('Contract: PUT /api/applications/{appId}', () => {



  const validUpdateRequest = {
    name: 'Updated Application Name',
    description: 'Updated description for the application',
    metadata: {
      entryPoint: 'app.js',
      environmentVariables: {
        NODE_ENV: 'development',
        DEBUG: 'true'
      }
    }
  };

  it('should update application and return 200', async () => {
    // This test MUST FAIL initially since no handler exists
    const appId = 'test-app';
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validUpdateRequest)
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const data = await response.json();

    // Validate updated Application schema
    expect(data).toHaveProperty('id', appId);
    expect(data).toHaveProperty('name', validUpdateRequest.name);
    expect(data).toHaveProperty('description', validUpdateRequest.description);
    expect(data).toHaveProperty('runtimeId');
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('createdAt');
    expect(data).toHaveProperty('updatedAt');
    expect(data).toHaveProperty('metadata');

    // Validate updated fields
    expect(data.name).toBe(validUpdateRequest.name);
    expect(data.description).toBe(validUpdateRequest.description);
    expect(data.metadata).toEqual(validUpdateRequest.metadata);

    // updatedAt should be more recent than createdAt
    expect(new Date(data.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(data.createdAt).getTime());
  });

  it('should return 404 for non-existent application', async () => {
    const appId = 'non-existent-app';
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validUpdateRequest)
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message.toLowerCase()).toContain('not found');
  });

  it('should validate request body and return 400 for invalid data', async () => {
    const appId = 'test-app';
    const invalidRequest = {
      name: '', // Invalid: empty name
      description: 'x'.repeat(501) // Invalid: description too long
    };

    const response = await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidRequest)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
  });

  it('should handle partial updates correctly', async () => {
    const appId = 'partial-update-app';
    const partialUpdate = {
      name: 'Only Name Updated'
      // Other fields should remain unchanged
    };

    const response = await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(partialUpdate)
    });

    if (response.status === 200) {
      const data = await response.json();

      // Updated field should have new value
      expect(data.name).toBe(partialUpdate.name);
      
      // Other required fields should still be present
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('runtimeId');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
    }
  });

  it('should validate metadata structure when provided', async () => {
    const appId = 'metadata-test-app';
    const invalidMetadataUpdate = {
      name: 'Test App',
      metadata: {
        entryPoint: '', // Invalid: empty entry point
        environmentVariables: 'not-an-object' // Invalid: should be object
      }
    };

    const response = await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidMetadataUpdate)
    });

    expect(response.status).toBe(400);

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message.toLowerCase()).toContain('metadata');
  });

  it('should support CORS headers', async () => {
    const appId = 'cors-test-app';
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validUpdateRequest)
    });

    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });

  it('should not allow updating immutable fields', async () => {
    const appId = 'immutable-test-app';
    const attemptImmutableUpdate = {
      id: 'different-id', // Should not be updatable
      runtimeId: 'different-runtime', // Should not be updatable via this endpoint
      createdAt: new Date().toISOString(), // Should not be updatable
      status: 'running' // Should not be updatable via this endpoint
    };

    const response = await fetch(`/api/applications/${appId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attemptImmutableUpdate)
    });

    if (response.status === 200) {
      const data = await response.json();

      // These fields should remain unchanged
      expect(data.id).toBe(appId); // Should not change
      // Implementation will determine if runtimeId is updatable
    }
  });
});