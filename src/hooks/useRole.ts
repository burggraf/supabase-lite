import { useState, useEffect, useCallback } from 'react';
import { ROLE_CONFIG } from '@/lib/constants';
import { roleSimulator, AVAILABLE_ROLES, type DatabaseRole } from '@/lib/database/roleSimulator';

export interface UseRoleReturn {
  currentRole: DatabaseRole;
  availableRoles: DatabaseRole[];
  setRole: (role: DatabaseRole) => void;
  setRoleById: (roleId: string) => void;
  isLoading: boolean;
  error: string | null;
}

export function useRole(): UseRoleReturn {
  const [currentRole, setCurrentRole] = useState<DatabaseRole>(AVAILABLE_ROLES.postgres);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load saved role from localStorage on mount
  useEffect(() => {
    try {
      const savedRoleId = localStorage.getItem(ROLE_CONFIG.STORAGE_KEY);
      if (savedRoleId && AVAILABLE_ROLES[savedRoleId]) {
        const role = AVAILABLE_ROLES[savedRoleId];
        setCurrentRole(role);
        roleSimulator.setRole(role);
      } else {
        // Set default role
        const defaultRole = AVAILABLE_ROLES[ROLE_CONFIG.DEFAULT_ROLE_ID];
        setCurrentRole(defaultRole);
        roleSimulator.setRole(defaultRole);
      }
    } catch (err) {
      console.error('Failed to load saved role:', err);
      setError('Failed to load saved role');
      // Fallback to default role
      const defaultRole = AVAILABLE_ROLES[ROLE_CONFIG.DEFAULT_ROLE_ID];
      setCurrentRole(defaultRole);
      roleSimulator.setRole(defaultRole);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setRole = useCallback((role: DatabaseRole) => {
    try {
      setError(null);
      setCurrentRole(role);
      roleSimulator.setRole(role);
      
      // Save to localStorage
      localStorage.setItem(ROLE_CONFIG.STORAGE_KEY, role.id);
    } catch (err) {
      console.error('Failed to set role:', err);
      setError('Failed to set role');
    }
  }, []);

  const setRoleById = useCallback((roleId: string) => {
    const role = AVAILABLE_ROLES[roleId];
    if (role) {
      setRole(role);
    } else {
      setError(`Role ${roleId} not found`);
    }
  }, [setRole]);

  const availableRoles = Object.values(AVAILABLE_ROLES);

  return {
    currentRole,
    availableRoles,
    setRole,
    setRoleById,
    isLoading,
    error,
  };
}