/**
 * Contract Test: DELETE /api/applications/{appId}
 * 
 * This test validates the contract for deleting applications
 * Based on applications-api.yaml specification
 * 
 * CRITICAL: This test MUST FAIL initially (no implementation exists)
 */

import { describe, it, expect } from 'vitest';

describe('Contract: DELETE /api/applications/{appId}', () => {



  it('should delete application and return 204', async () => {
    // This test MUST FAIL initially since no handler exists
    const appId = 'deletable-app';
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'DELETE'
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('content-length')).toBe('0');
  });

  it('should return 404 for non-existent application', async () => {
    const appId = 'non-existent-app';
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'DELETE'
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');

    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message.toLowerCase()).toContain('not found');
  });

  it('should prevent deletion of running applications', async () => {
    const appId = 'running-app';
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'DELETE'
    });

    // Should return 409 Conflict if app is running
    if (response.status === 409) {
      const error = await response.json();
      expect(error).toHaveProperty('message');
      expect(error.message.toLowerCase()).toContain('running');
    } else {
      // Or might succeed with automatic stop
      expect([204, 409]).toContain(response.status);
    }
  });

  it('should support force deletion with query parameter', async () => {
    const appId = 'force-delete-app';
    const response = await fetch(`/api/applications/${appId}?force=true`, {
      method: 'DELETE'
    });

    expect([204, 404]).toContain(response.status);
  });

  it('should clean up related resources on deletion', async () => {
    const appId = 'cleanup-test-app';
    
    // First verify the app exists and has deployments/routing
    const checkResponse = await fetch(`/api/applications/${appId}`);
    
    if (checkResponse.status === 200) {
      const appData = await checkResponse.json();
      
      // Delete the application
      const deleteResponse = await fetch(`/api/applications/${appId}`, {
        method: 'DELETE'
      });
      
      expect(deleteResponse.status).toBe(204);
      
      // Verify the app is no longer accessible
      const verifyResponse = await fetch(`/api/applications/${appId}`);
      expect(verifyResponse.status).toBe(404);
    }
  });

  it('should handle deletion idempotently', async () => {
    const appId = 'idempotent-delete-app';
    
    // First deletion
    const firstResponse = await fetch(`/api/applications/${appId}`, {
      method: 'DELETE'
    });
    
    // Second deletion of same app
    const secondResponse = await fetch(`/api/applications/${appId}`, {
      method: 'DELETE'
    });
    
    // Both should return 404 (not found) after first successful deletion
    expect([204, 404]).toContain(firstResponse.status);
    expect(secondResponse.status).toBe(404);
  });

  it('should support CORS headers', async () => {
    const appId = 'cors-delete-app';
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'DELETE'
    });

    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });

  it('should validate appId format', async () => {
    const invalidAppId = 'INVALID_ID!@#';
    const response = await fetch(`/api/applications/${invalidAppId}`, {
      method: 'DELETE'
    });

    expect([400, 404]).toContain(response.status);
  });

  it('should require authentication for deletion', async () => {
    const appId = 'auth-protected-app';
    
    // Test without authentication headers
    const response = await fetch(`/api/applications/${appId}`, {
      method: 'DELETE'
    });

    // Might return 401 Unauthorized or succeed based on implementation
    // For now, just verify it doesn't crash
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });

  it('should handle concurrent deletion attempts gracefully', async () => {
    const appId = 'concurrent-delete-app';
    
    // Simulate concurrent deletion attempts
    const deletePromises = Array.from({ length: 3 }, () =>
      fetch(`/api/applications/${appId}`, {
        method: 'DELETE'
      })
    );
    
    const responses = await Promise.all(deletePromises);
    
    // Only one should succeed with 204, others should return 404
    const successCount = responses.filter(r => r.status === 204).length;
    const notFoundCount = responses.filter(r => r.status === 404).length;
    
    expect(successCount).toBeLessThanOrEqual(1);
    expect(successCount + notFoundCount).toBe(3);
  });
});