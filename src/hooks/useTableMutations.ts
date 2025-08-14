import { useState, useCallback } from 'react';
import { dbManager } from '@/lib/database/connection';

export function useTableMutations() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update a single row
  const updateRow = useCallback(async (
    tableName: string,
    primaryKeyColumn: string,
    primaryKeyValue: any,
    updates: Record<string, any>,
    schema: string = 'public'
  ): Promise<boolean> => {
    setIsUpdating(true);
    setError(null);
    
    try {
      const success = await dbManager.updateTableRow(
        tableName,
        primaryKeyColumn,
        primaryKeyValue,
        updates,
        schema
      );
      
      if (!success) {
        throw new Error('Update operation failed');
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update row';
      setError(errorMessage);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Insert a new row
  const insertRow = useCallback(async (
    tableName: string,
    data: Record<string, any>,
    schema: string = 'public'
  ): Promise<boolean> => {
    setIsInserting(true);
    setError(null);
    
    try {
      const success = await dbManager.insertTableRow(tableName, data, schema);
      
      if (!success) {
        throw new Error('Insert operation failed');
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to insert row';
      setError(errorMessage);
      return false;
    } finally {
      setIsInserting(false);
    }
  }, []);

  // Delete a row
  const deleteRow = useCallback(async (
    tableName: string,
    primaryKeyColumn: string,
    primaryKeyValue: any,
    schema: string = 'public'
  ): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);
    
    try {
      const success = await dbManager.deleteTableRow(
        tableName,
        primaryKeyColumn,
        primaryKeyValue,
        schema
      );
      
      if (!success) {
        throw new Error('Delete operation failed');
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete row';
      setError(errorMessage);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  // Update a cell value
  const updateCell = useCallback(async (
    tableName: string,
    primaryKeyColumn: string,
    primaryKeyValue: any,
    columnName: string,
    newValue: any,
    schema: string = 'public'
  ): Promise<boolean> => {
    return updateRow(tableName, primaryKeyColumn, primaryKeyValue, { [columnName]: newValue }, schema);
  }, [updateRow]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    isUpdating,
    isInserting,
    isDeleting,
    error,
    
    // Actions
    updateRow,
    insertRow,
    deleteRow,
    updateCell,
    clearError,
    
    // Derived state
    isLoading: isUpdating || isInserting || isDeleting,
  };
}