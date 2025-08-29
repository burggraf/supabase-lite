import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTableMutations } from '../useTableMutations';
import { dbManager } from '@/lib/database/connection';

// Mock database manager
vi.mock('@/lib/database/connection', () => ({
  dbManager: {
    updateTableRow: vi.fn(),
    insertTableRow: vi.fn(),
    deleteTableRow: vi.fn(),
  }
}));

const mockDbManager = vi.mocked(dbManager);

describe('useTableMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTableMutations());

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isInserting).toBe(false);
      expect(result.current.isDeleting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useTableMutations());

      expect(typeof result.current.updateRow).toBe('function');
      expect(typeof result.current.insertRow).toBe('function');
      expect(typeof result.current.deleteRow).toBe('function');
      expect(typeof result.current.updateCell).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('updateRow', () => {
    it('should update row successfully', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      let updateResult: boolean;
      await act(async () => {
        updateResult = await result.current.updateRow(
          'users',
          'id',
          1,
          { name: 'Updated Name', email: 'updated@example.com' },
          'public'
        );
      });

      expect(updateResult!).toBe(true);
      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        { name: 'Updated Name', email: 'updated@example.com' },
        'public'
      );
      expect(result.current.error).toBeNull();
      expect(result.current.isUpdating).toBe(false);
    });

    it('should handle update failure', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(false);

      const { result } = renderHook(() => useTableMutations());

      let updateResult: boolean;
      await act(async () => {
        updateResult = await result.current.updateRow(
          'users',
          'id',
          1,
          { name: 'Updated Name' }
        );
      });

      expect(updateResult!).toBe(false);
      expect(result.current.error).toBe('Update operation failed');
      expect(result.current.isUpdating).toBe(false);
    });

    it('should handle update error', async () => {
      const errorMessage = 'Database connection failed';
      mockDbManager.updateTableRow.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useTableMutations());

      let updateResult: boolean;
      await act(async () => {
        updateResult = await result.current.updateRow(
          'users',
          'id',
          1,
          { name: 'Updated Name' }
        );
      });

      expect(updateResult!).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isUpdating).toBe(false);
    });

    it('should set loading state during update', async () => {
      let resolveUpdate: (value: boolean) => void;
      const updatePromise = new Promise<boolean>(resolve => {
        resolveUpdate = resolve;
      });
      mockDbManager.updateTableRow.mockReturnValue(updatePromise);

      const { result } = renderHook(() => useTableMutations());

      act(() => {
        result.current.updateRow('users', 'id', 1, { name: 'Updated Name' });
      });

      expect(result.current.isUpdating).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveUpdate!(true);
        await updatePromise;
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should use default schema when not provided', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.updateRow(
          'users',
          'id',
          1,
          { name: 'Updated Name' }
        );
      });

      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        { name: 'Updated Name' },
        'public'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockDbManager.updateTableRow.mockRejectedValue('String error');

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.updateRow('users', 'id', 1, { name: 'Test' });
      });

      expect(result.current.error).toBe('Failed to update row');
    });
  });

  describe('insertRow', () => {
    it('should insert row successfully', async () => {
      mockDbManager.insertTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      let insertResult: boolean;
      await act(async () => {
        insertResult = await result.current.insertRow(
          'users',
          { name: 'New User', email: 'new@example.com' },
          'public'
        );
      });

      expect(insertResult!).toBe(true);
      expect(mockDbManager.insertTableRow).toHaveBeenCalledWith(
        'users',
        { name: 'New User', email: 'new@example.com' },
        'public'
      );
      expect(result.current.error).toBeNull();
      expect(result.current.isInserting).toBe(false);
    });

    it('should handle insert failure', async () => {
      mockDbManager.insertTableRow.mockResolvedValue(false);

      const { result } = renderHook(() => useTableMutations());

      let insertResult: boolean;
      await act(async () => {
        insertResult = await result.current.insertRow(
          'users',
          { name: 'New User', email: 'new@example.com' }
        );
      });

      expect(insertResult!).toBe(false);
      expect(result.current.error).toBe('Insert operation failed');
      expect(result.current.isInserting).toBe(false);
    });

    it('should handle insert error', async () => {
      const errorMessage = 'Constraint violation';
      mockDbManager.insertTableRow.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useTableMutations());

      let insertResult: boolean;
      await act(async () => {
        insertResult = await result.current.insertRow(
          'users',
          { name: 'New User', email: 'new@example.com' }
        );
      });

      expect(insertResult!).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isInserting).toBe(false);
    });

    it('should set loading state during insert', async () => {
      let resolveInsert: (value: boolean) => void;
      const insertPromise = new Promise<boolean>(resolve => {
        resolveInsert = resolve;
      });
      mockDbManager.insertTableRow.mockReturnValue(insertPromise);

      const { result } = renderHook(() => useTableMutations());

      act(() => {
        result.current.insertRow('users', { name: 'New User' });
      });

      expect(result.current.isInserting).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveInsert!(true);
        await insertPromise;
      });

      expect(result.current.isInserting).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should use default schema when not provided', async () => {
      mockDbManager.insertTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.insertRow('users', { name: 'New User' });
      });

      expect(mockDbManager.insertTableRow).toHaveBeenCalledWith(
        'users',
        { name: 'New User' },
        'public'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockDbManager.insertTableRow.mockRejectedValue('String error');

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.insertRow('users', { name: 'Test' });
      });

      expect(result.current.error).toBe('Failed to insert row');
    });
  });

  describe('deleteRow', () => {
    it('should delete row successfully', async () => {
      mockDbManager.deleteTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      let deleteResult: boolean;
      await act(async () => {
        deleteResult = await result.current.deleteRow(
          'users',
          'id',
          1,
          'public'
        );
      });

      expect(deleteResult!).toBe(true);
      expect(mockDbManager.deleteTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        'public'
      );
      expect(result.current.error).toBeNull();
      expect(result.current.isDeleting).toBe(false);
    });

    it('should handle delete failure', async () => {
      mockDbManager.deleteTableRow.mockResolvedValue(false);

      const { result } = renderHook(() => useTableMutations());

      let deleteResult: boolean;
      await act(async () => {
        deleteResult = await result.current.deleteRow('users', 'id', 1);
      });

      expect(deleteResult!).toBe(false);
      expect(result.current.error).toBe('Delete operation failed');
      expect(result.current.isDeleting).toBe(false);
    });

    it('should handle delete error', async () => {
      const errorMessage = 'Foreign key constraint';
      mockDbManager.deleteTableRow.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useTableMutations());

      let deleteResult: boolean;
      await act(async () => {
        deleteResult = await result.current.deleteRow('users', 'id', 1);
      });

      expect(deleteResult!).toBe(false);
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isDeleting).toBe(false);
    });

    it('should set loading state during delete', async () => {
      let resolveDelete: (value: boolean) => void;
      const deletePromise = new Promise<boolean>(resolve => {
        resolveDelete = resolve;
      });
      mockDbManager.deleteTableRow.mockReturnValue(deletePromise);

      const { result } = renderHook(() => useTableMutations());

      act(() => {
        result.current.deleteRow('users', 'id', 1);
      });

      expect(result.current.isDeleting).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveDelete!(true);
        await deletePromise;
      });

      expect(result.current.isDeleting).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should use default schema when not provided', async () => {
      mockDbManager.deleteTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.deleteRow('users', 'id', 1);
      });

      expect(mockDbManager.deleteTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        'public'
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockDbManager.deleteTableRow.mockRejectedValue('String error');

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.deleteRow('users', 'id', 1);
      });

      expect(result.current.error).toBe('Failed to delete row');
    });
  });

  describe('updateCell', () => {
    it('should update single cell successfully', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      let updateResult: boolean;
      await act(async () => {
        updateResult = await result.current.updateCell(
          'users',
          'id',
          1,
          'name',
          'Updated Name',
          'public'
        );
      });

      expect(updateResult!).toBe(true);
      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        { name: 'Updated Name' },
        'public'
      );
    });

    it('should handle cell update failure', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(false);

      const { result } = renderHook(() => useTableMutations());

      let updateResult: boolean;
      await act(async () => {
        updateResult = await result.current.updateCell(
          'users',
          'id',
          1,
          'name',
          'Updated Name'
        );
      });

      expect(updateResult!).toBe(false);
      expect(result.current.error).toBe('Update operation failed');
    });

    it('should use default schema when not provided', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.updateCell('users', 'id', 1, 'name', 'Updated Name');
      });

      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        { name: 'Updated Name' },
        'public'
      );
    });

    it('should set loading state during cell update', async () => {
      let resolveUpdate: (value: boolean) => void;
      const updatePromise = new Promise<boolean>(resolve => {
        resolveUpdate = resolve;
      });
      mockDbManager.updateTableRow.mockReturnValue(updatePromise);

      const { result } = renderHook(() => useTableMutations());

      act(() => {
        result.current.updateCell('users', 'id', 1, 'name', 'Updated Name');
      });

      expect(result.current.isUpdating).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveUpdate!(true);
        await updatePromise;
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error Management', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useTableMutations());

      act(() => {
        // Set an error first (simulate error state)
        (result.current as any).error = 'Test error';
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('should reset error on new operations', async () => {
      mockDbManager.updateTableRow
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(true);

      const { result } = renderHook(() => useTableMutations());

      // First operation fails
      await act(async () => {
        await result.current.updateRow('users', 'id', 1, { name: 'Test' });
      });

      expect(result.current.error).toBe('First error');

      // Second operation succeeds
      await act(async () => {
        await result.current.updateRow('users', 'id', 1, { name: 'Test2' });
      });

      expect(result.current.error).toBeNull();
    });

    it('should preserve error state until cleared or new operation', async () => {
      mockDbManager.insertTableRow.mockRejectedValue(new Error('Insert error'));

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.insertRow('users', { name: 'Test' });
      });

      expect(result.current.error).toBe('Insert error');

      // Error persists until cleared
      expect(result.current.error).toBe('Insert error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple operations correctly', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);
      mockDbManager.insertTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        const updatePromise = result.current.updateRow('users', 'id', 1, { name: 'Updated' });
        const insertPromise = result.current.insertRow('users', { name: 'New User' });
        
        await Promise.all([updatePromise, insertPromise]);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should track individual operation states', async () => {
      let resolveUpdate: (value: boolean) => void;
      let resolveInsert: (value: boolean) => void;

      const updatePromise = new Promise<boolean>(resolve => {
        resolveUpdate = resolve;
      });
      const insertPromise = new Promise<boolean>(resolve => {
        resolveInsert = resolve;
      });

      mockDbManager.updateTableRow.mockReturnValue(updatePromise);
      mockDbManager.insertTableRow.mockReturnValue(insertPromise);

      const { result } = renderHook(() => useTableMutations());

      act(() => {
        result.current.updateRow('users', 'id', 1, { name: 'Updated' });
        result.current.insertRow('users', { name: 'New User' });
      });

      expect(result.current.isUpdating).toBe(true);
      expect(result.current.isInserting).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveUpdate!(true);
        await updatePromise;
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isInserting).toBe(true);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveInsert!(true);
        await insertPromise;
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.isInserting).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values in updates', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.updateRow('users', 'id', 1, { 
          name: null, 
          description: undefined,
          active: false 
        });
      });

      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        { name: null, description: undefined, active: false },
        'public'
      );
    });

    it('should handle empty updates object', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.updateRow('users', 'id', 1, {});
      });

      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'users',
        'id',
        1,
        {},
        'public'
      );
    });

    it('should handle different primary key types', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);
      mockDbManager.deleteTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      // String primary key
      await act(async () => {
        await result.current.updateRow('users', 'uuid', 'abc-123', { name: 'Test' });
      });

      // Number primary key
      await act(async () => {
        await result.current.deleteRow('users', 'id', 42);
      });

      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'users',
        'uuid',
        'abc-123',
        { name: 'Test' },
        'public'
      );
      expect(mockDbManager.deleteTableRow).toHaveBeenCalledWith('users', 'id', 42, 'public');
    });

    it('should handle special characters in table/column names', async () => {
      mockDbManager.updateTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.updateCell(
          'user-profiles',
          'user_id',
          1,
          'first_name',
          "O'Connor"
        );
      });

      expect(mockDbManager.updateTableRow).toHaveBeenCalledWith(
        'user-profiles',
        'user_id',
        1,
        { first_name: "O'Connor" },
        'public'
      );
    });

    it('should handle non-public schemas', async () => {
      mockDbManager.insertTableRow.mockResolvedValue(true);

      const { result } = renderHook(() => useTableMutations());

      await act(async () => {
        await result.current.insertRow(
          'logs',
          { message: 'Test log', level: 'info' },
          'private'
        );
      });

      expect(mockDbManager.insertTableRow).toHaveBeenCalledWith(
        'logs',
        { message: 'Test log', level: 'info' },
        'private'
      );
    });
  });
});