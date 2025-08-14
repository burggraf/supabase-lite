import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Plus, 
  Download, 
  Table as TableIcon,
  Database,
  Rows 
} from 'lucide-react';
import type { TableInfo } from '@/types';

interface TableToolbarProps {
  tables: TableInfo[];
  selectedTable: string;
  selectedSchema: string;
  totalRows: number;
  loading: boolean;
  onTableSelect: (tableName: string, schema: string) => void;
  onRefresh: () => void;
  onAddRow?: () => void;
  onExport?: () => void;
}

export function TableToolbar({
  tables,
  selectedTable,
  selectedSchema,
  totalRows,
  loading,
  onTableSelect,
  onRefresh,
  onAddRow,
  onExport,
}: TableToolbarProps) {
  const [_selectedTableInfo, setSelectedTableInfo] = useState<string>('');

  const handleTableChange = (value: string) => {
    setSelectedTableInfo(value);
    const [schema, tableName] = value.split('.');
    onTableSelect(tableName, schema);
  };

  const currentTableValue = selectedTable ? `${selectedSchema}.${selectedTable}` : '';

  const exportToCSV = () => {
    if (onExport) {
      onExport();
    } else {
      // Placeholder for CSV export functionality
      console.log('Export to CSV functionality would be implemented here');
    }
  };

  const addNewRow = () => {
    if (onAddRow) {
      onAddRow();
    } else {
      // Placeholder for add row functionality
      console.log('Add new row functionality would be implemented here');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TableIcon className="h-5 w-5" />
            <CardTitle>Table Editor</CardTitle>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={addNewRow}
              disabled={!selectedTable || loading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={!selectedTable || loading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Table Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium mb-2 block">Select Table</label>
            <Select
              value={currentTableValue}
              onValueChange={handleTableChange}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a table to edit" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem
                    key={`${table.schema}.${table.name}`}
                    value={`${table.schema}.${table.name}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <span>{table.schema}.{table.name}</span>
                      </div>
                      <Badge variant="secondary" className="ml-2">
                        {table.rows} rows
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Table Stats */}
          <div className="flex flex-col justify-end">
            {selectedTable && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Rows className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Total Rows:</span>
                  <Badge variant="outline">{totalRows.toLocaleString()}</Badge>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Schema:</span>
                  <Badge variant="outline">{selectedSchema}</Badge>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        {!selectedTable && (
          <div className="text-center py-8 text-muted-foreground">
            <TableIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Select a table to start editing</p>
            <p className="text-sm">
              Choose a table from the dropdown above to view and edit its data.
              You can click on any cell to edit its value inline.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}