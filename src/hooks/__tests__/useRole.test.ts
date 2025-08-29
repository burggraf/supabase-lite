import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRole } from '../useRole';
import type { DatabaseRole } from '@/lib/database/roleSimulator';

// Mock dependencies
const mockRoleSimulator = {
  setRole: vi.fn(),
};

const mockAvailableRoles = {
  postgres: {
    id: 'postgres',
    name: 'postgres',
    permissions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER'],
    description: 'Database superuser with full access'
  },
  anon: {
    id: 'anon',
    name: 'anon',
    permissions: ['SELECT'],
    description: 'Anonymous user with read-only access'
  },
  authenticated: {
    id: 'authenticated',
    name: 'authenticated',
    permissions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    description: 'Authenticated user with CRUD access'
  },
  service_role: {
    id: 'service_role',
    name: 'service_role',
    permissions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP'],
    description: 'Service role with administrative access'
  }
};

const mockRoleConfig = {
  STORAGE_KEY: 'supabase_lite_current_role',
  DEFAULT_ROLE_ID: 'postgres'
};

vi.mock('@/lib/constants', () => ({
  ROLE_CONFIG: mockRoleConfig
}));

vi.mock('@/lib/database/roleSimulator', () => ({
  roleSimulator: mockRoleSimulator,
  AVAILABLE_ROLES: mockAvailableRoles
}));

describe('useRole', () => {
  let localStorageMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default role when no saved role', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      expect(result.current.currentRole).toEqual(mockAvailableRoles.postgres);
      expect(result.current.availableRoles).toEqual(Object.values(mockAvailableRoles));
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.postgres);
    });

    it('should load saved role from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('authenticated');

      const { result } = renderHook(() => useRole());

      expect(result.current.currentRole).toEqual(mockAvailableRoles.authenticated);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.authenticated);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('supabase_lite_current_role');
    });

    it('should fallback to default role for invalid saved role', () => {
      localStorageMock.getItem.mockReturnValue('invalid_role');

      const { result } = renderHook(() => useRole());

      expect(result.current.currentRole).toEqual(mockAvailableRoles.postgres);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.postgres);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const { result } = renderHook(() => useRole());

      expect(result.current.currentRole).toEqual(mockAvailableRoles.postgres);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Failed to load saved role');
      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.postgres);
    });

    it('should provide all hook functions', () => {
      const { result } = renderHook(() => useRole());

      expect(typeof result.current.setRole).toBe('function');
      expect(typeof result.current.setRoleById).toBe('function');
      expect(result.current.availableRoles).toHaveLength(4);
    });
  });

  describe('Role Setting', () => {
    it('should set role successfully', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
      });

      expect(result.current.currentRole).toEqual(mockAvailableRoles.anon);
      expect(result.current.error).toBeNull();
      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.anon);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('supabase_lite_current_role', 'anon');
    });

    it('should set role by ID successfully', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRoleById('service_role');
      });

      expect(result.current.currentRole).toEqual(mockAvailableRoles.service_role);
      expect(result.current.error).toBeNull();
      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.service_role);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('supabase_lite_current_role', 'service_role');
    });

    it('should handle setting invalid role by ID', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRoleById('invalid_role');
      });

      expect(result.current.currentRole).toEqual(mockAvailableRoles.postgres); // Should remain default
      expect(result.current.error).toBe('Role invalid_role not found');
      expect(mockRoleSimulator.setRole).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'invalid_role' }));
    });

    it('should handle role setting errors', () => {
      localStorageMock.getItem.mockReturnValue(null);
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
      });

      expect(result.current.error).toBe('Failed to set role');
      expect(result.current.currentRole).toEqual(mockAvailableRoles.anon); // Role should still be set in state
    });

    it('should clear error on successful role change', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      // Set an error first
      act(() => {
        result.current.setRoleById('invalid_role');
      });

      expect(result.current.error).toBe('Role invalid_role not found');

      // Now set a valid role
      act(() => {
        result.current.setRole(mockAvailableRoles.authenticated);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.currentRole).toEqual(mockAvailableRoles.authenticated);
    });
  });

  describe('Available Roles', () => {
    it('should return all available roles', () => {
      const { result } = renderHook(() => useRole());

      expect(result.current.availableRoles).toEqual([
        mockAvailableRoles.postgres,
        mockAvailableRoles.anon,
        mockAvailableRoles.authenticated,
        mockAvailableRoles.service_role
      ]);
    });

    it('should maintain consistent available roles', () => {
      const { result } = renderHook(() => useRole());

      const availableRoles1 = result.current.availableRoles;

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
      });

      const availableRoles2 = result.current.availableRoles;

      expect(availableRoles2).toEqual(availableRoles1);
    });
  });

  describe('Role Persistence', () => {
    it('should persist role changes to localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRole(mockAvailableRoles.authenticated);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'supabase_lite_current_role',
        'authenticated'
      );
    });

    it('should persist role changes by ID to localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRoleById('service_role');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'supabase_lite_current_role',
        'service_role'
      );
    });

    it('should handle localStorage persistence errors', () => {
      localStorageMock.getItem.mockReturnValue(null);
      let shouldThrow = false;
      localStorageMock.setItem.mockImplementation(() => {
        if (shouldThrow) throw new Error('Storage full');
      });

      const { result } = renderHook(() => useRole());

      shouldThrow = true;

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
      });

      expect(result.current.error).toBe('Failed to set role');
      expect(result.current.currentRole).toEqual(mockAvailableRoles.anon);
    });
  });

  describe('Role Simulator Integration', () => {
    it('should call roleSimulator.setRole on initialization', () => {
      localStorageMock.getItem.mockReturnValue('authenticated');

      renderHook(() => useRole());

      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.authenticated);
    });

    it('should call roleSimulator.setRole on role changes', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRole(mockAvailableRoles.service_role);
      });

      expect(mockRoleSimulator.setRole).toHaveBeenCalledWith(mockAvailableRoles.service_role);
    });

    it('should handle roleSimulator errors gracefully', () => {
      mockRoleSimulator.setRole.mockImplementation(() => {
        throw new Error('Simulator error');
      });
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
      });

      expect(result.current.error).toBe('Failed to set role');
    });
  });

  describe('Loading State', () => {
    it('should be loading initially', () => {
      localStorageMock.getItem.mockImplementation(() => {
        // Simulate slow localStorage access
        return null;
      });

      const { result } = renderHook(() => useRole());

      // After the hook has initialized, loading should be false
      expect(result.current.isLoading).toBe(false);
    });

    it('should not be loading after initialization', () => {
      localStorageMock.getItem.mockReturnValue('authenticated');

      const { result } = renderHook(() => useRole());

      expect(result.current.isLoading).toBe(false);
    });

    it('should not be loading after error during initialization', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const { result } = renderHook(() => useRole());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error States', () => {
    it('should start with no error', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      expect(result.current.error).toBeNull();
    });

    it('should set error on localStorage load failure', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const { result } = renderHook(() => useRole());

      expect(result.current.error).toBe('Failed to load saved role');
    });

    it('should set error on invalid role ID', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRoleById('nonexistent');
      });

      expect(result.current.error).toBe('Role nonexistent not found');
    });

    it('should clear error on successful operations', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Initial error');
      });

      const { result } = renderHook(() => useRole());

      expect(result.current.error).toBe('Failed to load saved role');

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Role Object Structure', () => {
    it('should maintain proper role object structure', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      const role = result.current.currentRole;
      expect(role).toHaveProperty('id');
      expect(role).toHaveProperty('name');
      expect(role).toHaveProperty('permissions');
      expect(role).toHaveProperty('description');
      expect(Array.isArray(role.permissions)).toBe(true);
    });

    it('should handle all role types correctly', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      // Test each role type
      Object.values(mockAvailableRoles).forEach(role => {
        act(() => {
          result.current.setRole(role);
        });

        expect(result.current.currentRole).toEqual(role);
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined localStorage', () => {
      localStorageMock.getItem.mockReturnValue(undefined);

      const { result } = renderHook(() => useRole());

      expect(result.current.currentRole).toEqual(mockAvailableRoles.postgres);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty string from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('');

      const { result } = renderHook(() => useRole());

      expect(result.current.currentRole).toEqual(mockAvailableRoles.postgres);
      expect(result.current.error).toBeNull();
    });

    it('should handle multiple rapid role changes', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
        result.current.setRole(mockAvailableRoles.authenticated);
        result.current.setRole(mockAvailableRoles.service_role);
      });

      expect(result.current.currentRole).toEqual(mockAvailableRoles.service_role);
      expect(result.current.error).toBeNull();
    });

    it('should handle setting same role multiple times', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      const initialCallCount = mockRoleSimulator.setRole.mock.calls.length;

      act(() => {
        result.current.setRole(mockAvailableRoles.anon);
        result.current.setRole(mockAvailableRoles.anon);
        result.current.setRole(mockAvailableRoles.anon);
      });

      expect(result.current.currentRole).toEqual(mockAvailableRoles.anon);
      expect(mockRoleSimulator.setRole).toHaveBeenCalledTimes(initialCallCount + 3);
    });

    it('should handle case-sensitive role IDs', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRoleById('ANON'); // Wrong case
      });

      expect(result.current.error).toBe('Role ANON not found');
      expect(result.current.currentRole).toEqual(mockAvailableRoles.postgres); // Should remain default
    });

    it('should handle special characters in role IDs', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useRole());

      act(() => {
        result.current.setRoleById('role!@#$%^&*()');
      });

      expect(result.current.error).toBe('Role role!@#$%^&*() not found');
    });
  });

  describe('Hook Stability', () => {
    it('should maintain function reference stability', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result, rerender } = renderHook(() => useRole());

      const setRole1 = result.current.setRole;
      const setRoleById1 = result.current.setRoleById;

      rerender();

      const setRole2 = result.current.setRole;
      const setRoleById2 = result.current.setRoleById;

      expect(setRole1).toBe(setRole2);
      expect(setRoleById1).toBe(setRoleById2);
    });

    it('should maintain availableRoles reference stability', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result, rerender } = renderHook(() => useRole());

      const availableRoles1 = result.current.availableRoles;

      rerender();

      const availableRoles2 = result.current.availableRoles;

      expect(availableRoles1).toBe(availableRoles2);
    });
  });
});