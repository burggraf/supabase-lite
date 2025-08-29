import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTableData } from '../useTableData';
import type { TableInfo, ColumnInfo, TableDataResponse, FilterRule } from '@/types';

// Mock database manager
const mockDbManager = {
  getTableList: vi.fn(),
  getTableSchema: vi.fn(),
  getTableData: vi.fn(),
};

// Mock useDatabase hook
const mockUseDatabase = {
  connectionId: 'test-connection-id',
  isConnected: true,
};

vi.mock('@/lib/database/connection', () => ({
  dbManager: mockDbManager
}));

vi.mock('../useDatabase', () => ({
  useDatabase: () => mockUseDatabase
}));

describe('useTableData', () => {
  const mockTables: TableInfo[] = [
    { name: 'users', schema: 'public', type: 'table' },
    { name: 'posts', schema: 'public', type: 'table' },
    { name: 'logs', schema: 'private', type: 'table' }
  ];

  const mockColumns: ColumnInfo[] = [
    { column_name: 'id', data_type: 'integer', is_nullable: false, is_primary_key: true, column_default: null },
    { column_name: 'email', data_type: 'text', is_nullable: false, is_primary_key: false, column_default: null },
    { column_name: 'name', data_type: 'text', is_nullable: true, is_primary_key: false, column_default: null }
  ];

  const mockTableData: TableDataResponse = {
    rows: [
      { id: 1, email: 'user1@example.com', name: 'User 1' },
      { id: 2, email: 'user2@example.com', name: 'User 2' }
    ],
    totalCount: 2
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDatabase.connectionId = 'test-connection-id';
    mockUseDatabase.isConnected = true;
    mockDbManager.getTableList.mockResolvedValue(mockTables);
    mockDbManager.getTableSchema.mockResolvedValue(mockColumns);
    mockDbManager.getTableData.mockResolvedValue(mockTableData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default state', () => {
      mockUseDatabase.isConnected = false;
      
      const { result } = renderHook(() => useTableData());

      expect(result.current.tables).toEqual([]);
      expect(result.current.selectedTable).toBe('');
      expect(result.current.selectedSchema).toBe('public');
      expect(result.current.columns).toEqual([]);
      expect(result.current.tableData).toEqual({ rows: [], totalCount: 0 });
      expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 });
      expect(result.current.filters).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isTransitioning).toBe(false);
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useTableData());

      expect(typeof result.current.selectTable).toBe('function');
      expect(typeof result.current.updatePagination).toBe('function');
      expect(typeof result.current.refreshTableData).toBe('function');
      expect(typeof result.current.getPrimaryKeyColumn).toBe('function');
      expect(typeof result.current.loadTables).toBe('function');
      expect(typeof result.current.setFilters).toBe('function');
    });
  });

  describe('Table Loading', () => {
    it('should load tables on connection', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableList).toHaveBeenCalled();
        expect(result.current.tables).toEqual(mockTables);
      });
    });

    it('should select first public table automatically', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.selectedTable).toBe('users');
        expect(result.current.selectedSchema).toBe('public');
      });
    });

    it('should select first table if no public tables exist', async () => {
      const tablesWithoutPublic = [
        { name: 'logs', schema: 'private', type: 'table' }
      ];
      mockDbManager.getTableList.mockResolvedValue(tablesWithoutPublic);

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.selectedTable).toBe('logs');
        expect(result.current.selectedSchema).toBe('private');
      });
    });

    it('should handle empty table list', async () => {
      mockDbManager.getTableList.mockResolvedValue([]);

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual([]);
        expect(result.current.selectedTable).toBe('');
        expect(result.current.selectedSchema).toBe('public');
      });
    });

    it('should handle table loading errors', async () => {
      mockDbManager.getTableList.mockRejectedValue(new Error('Failed to load tables'));

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load tables');
      });
    });

    it('should not load tables when disconnected', () => {
      mockUseDatabase.isConnected = false;

      renderHook(() => useTableData());

      expect(mockDbManager.getTableList).not.toHaveBeenCalled();
    });

    it('should handle connection changes', async () => {
      const { result, rerender } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      // Change connection ID
      mockUseDatabase.connectionId = 'new-connection-id';
      const newTables = [{ name: 'new_table', schema: 'public', type: 'table' }];
      mockDbManager.getTableList.mockResolvedValue(newTables);

      rerender();

      await waitFor(() => {
        expect(result.current.tables).toEqual(newTables);
      });
    });

    it('should show transition state during connection changes', async () => {
      const { result, rerender } = renderHook(() => useTableData());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      // Change connection and delay response
      mockUseDatabase.connectionId = 'new-connection-id';
      let resolveTableLoad: (value: TableInfo[]) => void;
      const tableLoadPromise = new Promise<TableInfo[]>(resolve => {
        resolveTableLoad = resolve;
      });
      mockDbManager.getTableList.mockReturnValue(tableLoadPromise);

      rerender();

      await waitFor(() => {
        expect(result.current.isTransitioning).toBe(true);
      });

      act(() => {
        resolveTableLoad!([]);
      });

      await waitFor(() => {
        expect(result.current.isTransitioning).toBe(false);
      });
    });
  });

  describe('Table Schema Loading', () => {
    it('should load schema when table is selected', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableSchema).toHaveBeenCalledWith('users', 'public');
        expect(result.current.columns).toEqual(mockColumns);
      });
    });

    it('should handle schema loading errors', async () => {
      mockDbManager.getTableSchema.mockRejectedValue(new Error('Failed to load schema'));

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load schema');
      });
    });

    it('should not load schema for empty table name', async () => {
      mockDbManager.getTableList.mockResolvedValue([]);

      renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableSchema).not.toHaveBeenCalled();
      });
    });
  });

  describe('Table Data Loading', () => {
    it('should load table data when table is selected', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith('users', 'public', 100, 0, undefined);
        expect(result.current.tableData).toEqual(mockTableData);
      });
    });

    it('should set loading state during data fetch', async () => {
      let resolveDataLoad: (value: TableDataResponse) => void;
      const dataLoadPromise = new Promise<TableDataResponse>(resolve => {
        resolveDataLoad = resolve;
      });
      mockDbManager.getTableData.mockReturnValue(dataLoadPromise);

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      act(() => {
        resolveDataLoad!(mockTableData);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should handle data loading errors', async () => {
      mockDbManager.getTableData.mockRejectedValue(new Error('Failed to load data'));

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load data');
        expect(result.current.loading).toBe(false);
      });
    });

    it('should not load data for empty table name', async () => {
      mockDbManager.getTableList.mockResolvedValue([]);

      renderHook(() => useTableData());

      await waitFor(() => {
        // Wait for tables to load (empty)
        expect(mockDbManager.getTableList).toHaveBeenCalled();
      });

      expect(mockDbManager.getTableData).not.toHaveBeenCalled();
    });
  });

  describe('Table Selection', () => {
    it('should select table and reset pagination/filters', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      act(() => {
        result.current.selectTable('posts', 'public');
      });

      expect(result.current.selectedTable).toBe('posts');
      expect(result.current.selectedSchema).toBe('public');
      expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 100 });
      expect(result.current.filters).toEqual([]);
    });

    it('should use default schema when not provided', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      act(() => {
        result.current.selectTable('posts');
      });

      expect(result.current.selectedTable).toBe('posts');
      expect(result.current.selectedSchema).toBe('public');
    });

    it('should load schema and data for new table selection', async () => {
      const postsSchema = [
        { column_name: 'id', data_type: 'integer', is_nullable: false, is_primary_key: true, column_default: null },
        { column_name: 'title', data_type: 'text', is_nullable: false, is_primary_key: false, column_default: null }
      ];
      const postsData = { rows: [{ id: 1, title: 'Test Post' }], totalCount: 1 };

      mockDbManager.getTableSchema.mockResolvedValueOnce(mockColumns);
      mockDbManager.getTableData.mockResolvedValueOnce(mockTableData);

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      mockDbManager.getTableSchema.mockResolvedValueOnce(postsSchema);
      mockDbManager.getTableData.mockResolvedValueOnce(postsData);

      act(() => {
        result.current.selectTable('posts', 'public');
      });

      await waitFor(() => {
        expect(mockDbManager.getTableSchema).toHaveBeenCalledWith('posts', 'public');
        expect(mockDbManager.getTableData).toHaveBeenCalledWith('posts', 'public', 100, 0, undefined);
      });
    });
  });

  describe('Pagination', () => {
    it('should update pagination', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      act(() => {
        result.current.updatePagination({ pageIndex: 1, pageSize: 50 });
      });

      expect(result.current.pagination).toEqual({ pageIndex: 1, pageSize: 50 });
    });

    it('should reload data when pagination changes', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith('users', 'public', 100, 0, undefined);
      });

      act(() => {
        result.current.updatePagination({ pageIndex: 1, pageSize: 50 });
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith('users', 'public', 50, 50, undefined);
      });
    });
  });

  describe('Filtering', () => {
    it('should apply filters to data loading', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      const filters: FilterRule[] = [
        { column: 'email', operator: 'contains', value: 'test' }
      ];

      act(() => {
        result.current.setFilters(filters);
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith(
          'users',
          'public',
          100,
          0,
          [{ column: 'email', operator: 'contains', value: 'test' }]
        );
      });
    });

    it('should handle empty filters', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith('users', 'public', 100, 0, undefined);
      });

      act(() => {
        result.current.setFilters([]);
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith('users', 'public', 100, 0, undefined);
      });
    });

    it('should convert FilterRule format correctly', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      const filters: FilterRule[] = [
        { column: 'name', operator: 'equals', value: 'John' },
        { column: 'age', operator: 'greater_than', value: 18 }
      ];

      act(() => {
        result.current.setFilters(filters);
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith(
          'users',
          'public',
          100,
          0,
          [
            { column: 'name', operator: 'equals', value: 'John' },
            { column: 'age', operator: 'greater_than', value: 18 }
          ]
        );
      });
    });
  });

  describe('Data Refresh', () => {
    it('should refresh table data', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledTimes(1);
      });

      act(() => {
        result.current.refreshTableData();
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledTimes(2);
        expect(mockDbManager.getTableData).toHaveBeenLastCalledWith('users', 'public', 100, 0, undefined);
      });
    });

    it('should refresh with current pagination and filters', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      // Set pagination and filters
      act(() => {
        result.current.updatePagination({ pageIndex: 2, pageSize: 25 });
        result.current.setFilters([{ column: 'email', operator: 'contains', value: 'test' }]);
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledWith(
          'users',
          'public',
          25,
          50,
          [{ column: 'email', operator: 'contains', value: 'test' }]
        );
      });

      act(() => {
        result.current.refreshTableData();
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenLastCalledWith(
          'users',
          'public',
          25,
          50,
          [{ column: 'email', operator: 'contains', value: 'test' }]
        );
      });
    });

    it('should not refresh when no table is selected', async () => {
      mockDbManager.getTableList.mockResolvedValue([]);

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.selectedTable).toBe('');
      });

      const initialCallCount = mockDbManager.getTableData.mock.calls.length;

      act(() => {
        result.current.refreshTableData();
      });

      await waitFor(() => {
        expect(mockDbManager.getTableData).toHaveBeenCalledTimes(initialCallCount);
      });
    });
  });

  describe('Primary Key Detection', () => {
    it('should return primary key column', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.columns).toEqual(mockColumns);
      });

      const primaryKey = result.current.getPrimaryKeyColumn();
      expect(primaryKey).toBe('id');
    });

    it('should fallback to first column when no primary key', async () => {
      const columnsWithoutPK = mockColumns.map(col => ({ ...col, is_primary_key: false }));
      mockDbManager.getTableSchema.mockResolvedValue(columnsWithoutPK);

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.columns).toEqual(columnsWithoutPK);
      });

      const primaryKey = result.current.getPrimaryKeyColumn();
      expect(primaryKey).toBe('id'); // First column name
    });

    it('should fallback to "id" when no columns', () => {
      mockDbManager.getTableList.mockResolvedValue([]);
      mockDbManager.getTableSchema.mockResolvedValue([]);

      const { result } = renderHook(() => useTableData());

      const primaryKey = result.current.getPrimaryKeyColumn();
      expect(primaryKey).toBe('id');
    });
  });

  describe('Manual Table Loading', () => {
    it('should allow manual table loading', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(mockDbManager.getTableList).toHaveBeenCalledTimes(1);
      });

      const newTables = [{ name: 'new_table', schema: 'public', type: 'table' }];
      mockDbManager.getTableList.mockResolvedValueOnce(newTables);

      let loadResult: TableInfo[];
      await act(async () => {
        loadResult = await result.current.loadTables();
      });

      expect(loadResult!).toEqual(newTables);
      expect(mockDbManager.getTableList).toHaveBeenCalledTimes(2);
    });

    it('should handle manual table loading errors', async () => {
      const { result } = renderHook(() => useTableData());

      mockDbManager.getTableList.mockRejectedValueOnce(new Error('Manual load failed'));

      let loadResult: TableInfo[];
      await act(async () => {
        loadResult = await result.current.loadTables();
      });

      expect(loadResult!).toEqual([]);
      expect(result.current.error).toBe('Manual load failed');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockDbManager.getTableList.mockRejectedValue('String error');

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load tables');
      });
    });

    it('should clear error on successful operations', async () => {
      // First operation fails
      mockDbManager.getTableData.mockRejectedValueOnce(new Error('Data load failed'));

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.error).toBe('Data load failed');
      });

      // Second operation succeeds
      mockDbManager.getTableData.mockResolvedValueOnce(mockTableData);

      act(() => {
        result.current.refreshTableData();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('should preserve error state until next operation', async () => {
      mockDbManager.getTableSchema.mockRejectedValue(new Error('Schema error'));

      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.error).toBe('Schema error');
      });

      // Error persists
      expect(result.current.error).toBe('Schema error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid table selection changes', async () => {
      const { result } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      act(() => {
        result.current.selectTable('posts');
        result.current.selectTable('logs', 'private');
        result.current.selectTable('users');
      });

      expect(result.current.selectedTable).toBe('users');
      expect(result.current.selectedSchema).toBe('public');
    });

    it('should handle empty connection ID', () => {
      mockUseDatabase.connectionId = '';

      renderHook(() => useTableData());

      expect(mockDbManager.getTableList).not.toHaveBeenCalled();
    });

    it('should handle null connection ID', () => {
      mockUseDatabase.connectionId = null as any;

      renderHook(() => useTableData());

      expect(mockDbManager.getTableList).not.toHaveBeenCalled();
    });

    it('should maintain previous tables during transition', async () => {
      const { result, rerender } = renderHook(() => useTableData());

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });

      // Change connection and delay response
      mockUseDatabase.connectionId = 'new-connection-id';
      let resolveTableLoad: (value: TableInfo[]) => void;
      const tableLoadPromise = new Promise<TableInfo[]>(resolve => {
        resolveTableLoad = resolve;
      });
      mockDbManager.getTableList.mockReturnValue(tableLoadPromise);

      rerender();

      await waitFor(() => {
        expect(result.current.isTransitioning).toBe(true);
        expect(result.current.tables).toEqual(mockTables); // Previous tables maintained
      });

      const newTables = [{ name: 'new_table', schema: 'public', type: 'table' }];
      act(() => {
        resolveTableLoad!(newTables);
      });

      await waitFor(() => {
        expect(result.current.tables).toEqual(newTables);
        expect(result.current.isTransitioning).toBe(false);
      });
    });

    it('should handle connection ID changes without previous tables', async () => {
      mockUseDatabase.connectionId = 'initial-connection';

      const { result, rerender } = renderHook(() => useTableData());

      // Change connection before any tables are loaded
      mockUseDatabase.connectionId = 'new-connection';
      mockDbManager.getTableList.mockResolvedValue(mockTables);

      rerender();

      await waitFor(() => {
        expect(result.current.tables).toEqual(mockTables);
      });
    });
  });
});