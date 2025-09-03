import { useState, useEffect, useCallback } from 'react';
import { dbManager } from '@/lib/database/connection';
import { useDatabase } from './useDatabase';
import type { TableInfo, ColumnInfo, TableDataResponse, FilterRule } from '@/types';

export function useTableData() {
  const { connectionId, isConnected } = useDatabase();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [selectedSchema, setSelectedSchema] = useState<string>('public');
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [tableData, setTableData] = useState<TableDataResponse>({ rows: [], totalCount: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 100,
  });
  const [filters, setFilters] = useState<FilterRule[]>([]);
  
  // Transition states for optimistic UI
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousTables, setPreviousTables] = useState<TableInfo[]>([]);
  const [_lastConnectionId, _setLastConnectionId] = useState<string | null>(null);
  const [hasLoadedForConnection, setHasLoadedForConnection] = useState<string | null>(null);

  // Load available tables
  const loadTables = useCallback(async () => {
    try {
      setError(null);
      const tableList = await dbManager.getTableList();
      setTables(tableList);
      return tableList;
    } catch (err) {
      console.error('🚀 loadTables: error getting table list:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tables');
      return [];
    }
  }, []); // Remove selectedTable dependency to prevent infinite loop

  // Load table schema
  const loadTableSchema = useCallback(async (tableName: string, schema: string) => {
    if (!tableName) return;
    
    try {
      setError(null);
      const schemaData = await dbManager.getTableSchema(tableName, schema);
      setColumns(schemaData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table schema');
    }
  }, []);

  // Load table data
  const loadTableData = useCallback(async (
    tableName: string, 
    schema: string, 
    pageIndex: number = 0, 
    pageSize: number = 100,
    filtersToApply: FilterRule[] = []
  ) => {
    if (!tableName) return;
    
    setLoading(true);
    try {
      setError(null);
      const offset = pageIndex * pageSize;
      
      // Convert FilterRule[] to the format expected by dbManager
      const dbFilters = filtersToApply.length > 0 ? filtersToApply.map(filter => ({
        column: filter.column,
        operator: filter.operator,
        value: filter.value
      })) : undefined;
      
      const data = await dbManager.getTableData(tableName, schema, pageSize, offset, dbFilters);
      setTableData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload current table data
  const refreshTableData = useCallback(() => {
    if (selectedTable && selectedSchema) {
      loadTableData(selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize, filters);
    }
  }, [selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize, filters, loadTableData]);

  // Change selected table
  const selectTable = useCallback((tableName: string, schema: string = 'public') => {
    setSelectedTable(tableName);
    setSelectedSchema(schema);
    setPagination({ pageIndex: 0, pageSize: 100 }); // Reset pagination
    setFilters([]); // Reset filters when changing tables
  }, []);

  // Update pagination
  const updatePagination = useCallback((newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination);
  }, []);

  // Get primary key column
  const getPrimaryKeyColumn = useCallback(() => {
    return columns.find(col => col.is_primary_key)?.column_name || columns[0]?.column_name || 'id';
  }, [columns]);

  // FIXED: Load tables on connection AND on first load/refresh
  useEffect(() => {
    
    // Only proceed if we have a valid connection
    if (!isConnected || !connectionId) {
      return;
    }
    
    // Check if we need to load tables for this connection:
    // 1. If we've never loaded for this connection (refresh/initial load)
    // 2. If the connection has changed (project switching)
    const needsLoad = hasLoadedForConnection !== connectionId;
    
    if (!needsLoad) {
      return;
    }
    
    
    // Start transition with optimistic UI
    setIsTransitioning(true);
    setError(null);
    
    // Store current tables as previous (keep UI stable)
    if (tables.length > 0) {
      setPreviousTables(tables);
    }
    
    // Load tables for new connection without clearing current state
    const loadNewConnection = async () => {
      try {
        const tableList = await dbManager.getTableList();
        
        // Only now update the state atomically
        setTables(tableList);
        // Always update lastConnectionId to track the actual successful load
        setLastConnectionId(connectionId);
        // Mark that we've loaded tables for this connection (fixes refresh bug)
        setHasLoadedForConnection(connectionId);
        
        // FIXED: Don't clear selection if we're returning to a project that has tables
        // Instead, try to restore a sensible selection
        const publicTables = tableList.filter(t => t.schema === 'public');
        const hasPublicTables = publicTables.length > 0;
        
        if (hasPublicTables) {
          setSelectedTable(publicTables[0].name);
          setSelectedSchema('public');
        } else if (tableList.length > 0) {
          setSelectedTable(tableList[0].name);
          setSelectedSchema(tableList[0].schema);
        } else {
          // Only clear selection if there are truly no tables
          setSelectedTable('');
          setSelectedSchema('public');
        }
        
        // Always reset table data and pagination for new selection
        setColumns([]);
        setTableData({ rows: [], totalCount: 0 });
        setFilters([]);
        setPagination({ pageIndex: 0, pageSize: 100 });
        
        setIsTransitioning(false);
      } catch (err) {
        console.error('🚀 useTableData: error loading new connection tables:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tables');
        setIsTransitioning(false);
      }
    };
    
    loadNewConnection();
  }, [connectionId, isConnected]); // Only watch for connection changes, not internal load tracking

  // Load schema when table changes
  useEffect(() => {
    if (selectedTable && selectedSchema) {
      loadTableSchema(selectedTable, selectedSchema);
    }
  }, [selectedTable, selectedSchema, loadTableSchema]);

  // Load data when table, pagination, or filters change
  useEffect(() => {
    if (selectedTable && selectedSchema) {
      loadTableData(selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize, filters);
    }
  }, [selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize, filters, loadTableData]);

  return {
    // Data
    tables: isTransitioning && previousTables.length > 0 ? previousTables : tables,
    selectedTable,
    selectedSchema,
    columns,
    tableData,
    pagination,
    filters,
    
    // State
    loading,
    error,
    isTransitioning,
    
    // Actions
    selectTable,
    updatePagination,
    refreshTableData,
    getPrimaryKeyColumn,
    loadTables,
    setFilters,
  };
}