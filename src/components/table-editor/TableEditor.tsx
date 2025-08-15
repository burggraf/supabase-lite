import { useCallback, useState } from 'react';
import { TableSidebar } from './TableSidebar';
import { TableHeader } from './TableHeader';
import { FilterToolbar } from './FilterToolbar';
import { InsertRowDialog } from './InsertRowDialog';
import { RowEditPanel } from './RowEditPanel';
import { DataTable } from './DataTable';
import { useTableData } from '@/hooks/useTableData';
import { useTableMutations } from '@/hooks/useTableMutations';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export function TableEditor() {
  const [globalFilter, setGlobalFilter] = useState('');
  const [showInsertDialog, setShowInsertDialog] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  
  const {
    tables,
    selectedTable,
    selectedSchema,
    columns,
    tableData,
    pagination,
    loading,
    error: dataError,
    selectTable,
    updatePagination,
    refreshTableData,
    getPrimaryKeyColumn,
  } = useTableData();

  const {
    updateCell,
    insertRow,
    error: mutationError,
    isLoading: isMutating,
  } = useTableMutations();

  // Handle row click to open edit panel
  const handleRowClick = useCallback((row: Record<string, any>) => {
    setEditingRow(row);
  }, []);

  // Handle row updates
  const handleRowUpdate = useCallback(async (updatedData: Record<string, any>): Promise<boolean> => {
    if (!selectedTable || !selectedSchema || !editingRow) {
      return false;
    }

    const primaryKeyColumn = getPrimaryKeyColumn();
    const primaryKeyValue = editingRow[primaryKeyColumn];

    if (!primaryKeyValue) {
      console.error('No primary key value found for row');
      return false;
    }

    // Update each changed field
    const updates: Promise<boolean>[] = [];
    for (const [columnName, newValue] of Object.entries(updatedData)) {
      if (editingRow[columnName] !== newValue) {
        updates.push(
          updateCell(
            selectedTable,
            primaryKeyColumn,
            primaryKeyValue,
            columnName,
            newValue,
            selectedSchema
          )
        );
      }
    }

    if (updates.length === 0) {
      // No changes made
      return true;
    }

    const results = await Promise.all(updates);
    const success = results.every(result => result);

    if (success) {
      // Refresh the table data to show the updated values
      refreshTableData();
    }

    return success;
  }, [selectedTable, selectedSchema, editingRow, getPrimaryKeyColumn, updateCell, refreshTableData]);

  // Handle pagination changes
  const handlePaginationChange = useCallback((newPagination: { pageIndex: number; pageSize: number }) => {
    updatePagination(newPagination);
  }, [updatePagination]);

  // Export to CSV functionality
  const handleExport = useCallback(() => {
    if (!tableData.rows.length || !columns.length) {
      return;
    }

    // Create CSV content
    const headers = columns.map(col => col.column_name);
    const csvContent = [
      headers.join(','),
      ...tableData.rows.map(row => 
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) {
            return '';
          }
          // Escape commas and quotes in values
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ].join('\n');

    // Download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedSchema}_${selectedTable}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [tableData.rows, columns, selectedSchema, selectedTable]);

  // Handle insert row
  const handleInsertRow = useCallback(async (data: Record<string, any>): Promise<boolean> => {
    if (!selectedTable || !selectedSchema) {
      return false;
    }

    const success = await insertRow(selectedTable, data, selectedSchema);
    
    if (success) {
      // Refresh the table data to show the new row
      refreshTableData();
    }
    
    return success;
  }, [selectedTable, selectedSchema, insertRow, refreshTableData]);

  // Show error if any
  const error = dataError || mutationError;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Sidebar with Tables */}
      <TableSidebar
        tables={tables}
        selectedTable={selectedTable}
        selectedSchema={selectedSchema}
        onTableSelect={selectTable}
        loading={loading}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Table Actions */}
        <TableHeader
          selectedTable={selectedTable}
          selectedSchema={selectedSchema}
          totalRows={tableData.totalCount}
          loading={loading || isMutating}
          onRefresh={refreshTableData}
          onExport={handleExport}
        />

        {/* Filter Toolbar */}
        <FilterToolbar
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          selectedTable={selectedTable}
          loading={loading || isMutating}
          onInsertRow={() => setShowInsertDialog(true)}
          onInsertColumn={() => console.log('Insert column functionality coming soon')}
          onImportCSV={() => console.log('Import CSV functionality coming soon')}
        />

        {/* Insert Row Dialog */}
        {selectedTable && (
          <InsertRowDialog
            open={showInsertDialog}
            onOpenChange={setShowInsertDialog}
            columns={columns}
            tableName={selectedTable}
            schema={selectedSchema}
            onInsert={handleInsertRow}
            loading={loading || isMutating}
          />
        )}

        {/* Row Edit Panel */}
        {selectedTable && (
          <RowEditPanel
            isOpen={editingRow !== null}
            onClose={() => setEditingRow(null)}
            row={editingRow}
            columns={columns}
            tableName={selectedTable}
            schema={selectedSchema}
            onSave={handleRowUpdate}
            loading={loading || isMutating}
          />
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 border-b">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Table Data */}
        <div className="flex-1 overflow-auto">
          {selectedTable ? (
            loading && !tableData.rows.length ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-lg text-muted-foreground">Loading table data...</span>
              </div>
            ) : (
              <div className="h-full">
                <DataTable
                  data={tableData.rows}
                  columns={columns}
                  totalCount={tableData.totalCount}
                  pageIndex={pagination.pageIndex}
                  pageSize={pagination.pageSize}
                  onPaginationChange={handlePaginationChange}
                  onRowClick={handleRowClick}
                  primaryKeyColumn={getPrimaryKeyColumn()}
                  globalFilter={globalFilter}
                />
              </div>
            )
          ) : null}
        </div>

        {/* Loading Overlay for Mutations */}
        {isMutating && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-4 shadow-lg flex items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Updating...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}