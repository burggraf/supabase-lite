import { useState, useEffect, useCallback } from 'react';
import { dbManager } from '@/lib/database/connection';
import type { TableInfo, ColumnInfo, TableDataResponse } from '@/types';

export function useTableData() {
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

  // Load available tables
  const loadTables = useCallback(async () => {
    try {
      setError(null);
      const tableList = await dbManager.getTableList();
      setTables(tableList);
      
      // Auto-select first table if none selected
      if (tableList.length > 0 && !selectedTable) {
        setSelectedTable(tableList[0].name);
        setSelectedSchema(tableList[0].schema);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tables');
    }
  }, [selectedTable]);

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
    pageSize: number = 100
  ) => {
    if (!tableName) return;
    
    setLoading(true);
    try {
      setError(null);
      const offset = pageIndex * pageSize;
      const data = await dbManager.getTableData(tableName, schema, pageSize, offset);
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
      loadTableData(selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize);
    }
  }, [selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize, loadTableData]);

  // Change selected table
  const selectTable = useCallback((tableName: string, schema: string = 'public') => {
    setSelectedTable(tableName);
    setSelectedSchema(schema);
    setPagination({ pageIndex: 0, pageSize: 100 }); // Reset pagination
  }, []);

  // Update pagination
  const updatePagination = useCallback((newPagination: { pageIndex: number; pageSize: number }) => {
    setPagination(newPagination);
  }, []);

  // Get primary key column
  const getPrimaryKeyColumn = useCallback(() => {
    return columns.find(col => col.is_primary_key)?.column_name || columns[0]?.column_name || 'id';
  }, [columns]);

  // Load initial data
  useEffect(() => {
    loadTables();
  }, [loadTables]);

  // Load schema when table changes
  useEffect(() => {
    if (selectedTable && selectedSchema) {
      loadTableSchema(selectedTable, selectedSchema);
    }
  }, [selectedTable, selectedSchema, loadTableSchema]);

  // Load data when table or pagination changes
  useEffect(() => {
    if (selectedTable && selectedSchema) {
      loadTableData(selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize);
    }
  }, [selectedTable, selectedSchema, pagination.pageIndex, pagination.pageSize, loadTableData]);

  return {
    // Data
    tables,
    selectedTable,
    selectedSchema,
    columns,
    tableData,
    pagination,
    
    // State
    loading,
    error,
    
    // Actions
    selectTable,
    updatePagination,
    refreshTableData,
    getPrimaryKeyColumn,
    loadTables,
  };
}