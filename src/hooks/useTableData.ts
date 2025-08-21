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

  // Load available tables
  const loadTables = useCallback(async () => {
    try {
      console.log('🚀 loadTables: calling dbManager.getTableList()');
      setError(null);
      const tableList = await dbManager.getTableList();
      console.log('🚀 loadTables: got table list from dbManager:', tableList);
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

  // Load initial data and reload when database connection changes
  useEffect(() => {
    console.log('🚀 useTableData: connection changed', { isConnected, connectionId });
    if (isConnected && connectionId) {
      console.log('🚀 useTableData: resetting state and loading tables');
      // Reset state when database changes
      setSelectedTable('');
      setSelectedSchema('public');
      setColumns([]);
      setTableData({ rows: [], totalCount: 0 });
      setFilters([]);
      setPagination({ pageIndex: 0, pageSize: 100 });
      
      // Load tables for new database and auto-select first one
      const loadAndSelect = async () => {
        try {
          console.log('🚀 useTableData: calling dbManager.getTableList() directly');
          setError(null);
          const tableList = await dbManager.getTableList();
          console.log('🚀 useTableData: loaded tables:', tableList);
          setTables(tableList);
          
          // Auto-select first table if available
          if (tableList.length > 0) {
            console.log('🚀 useTableData: auto-selecting first table:', tableList[0]);
            setSelectedTable(tableList[0].name);
            setSelectedSchema(tableList[0].schema);
          }
        } catch (err) {
          console.error('🚀 useTableData: error loading tables:', err);
          setError(err instanceof Error ? err.message : 'Failed to load tables');
        }
      };
      
      loadAndSelect();
    }
  }, [connectionId, isConnected]); // Remove loadTables from dependencies to prevent infinite loop

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
    tables,
    selectedTable,
    selectedSchema,
    columns,
    tableData,
    pagination,
    filters,
    
    // State
    loading,
    error,
    
    // Actions
    selectTable,
    updatePagination,
    refreshTableData,
    getPrimaryKeyColumn,
    loadTables,
    setFilters,
  };
}