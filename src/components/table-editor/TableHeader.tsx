import { Button } from '@/components/ui/button';
import { 
  RefreshCw, 
  Plus, 
  Download, 
  Filter,
  MoreHorizontal,
  Database
} from 'lucide-react';

interface TableHeaderProps {
  selectedTable: string;
  selectedSchema: string;
  totalRows: number;
  loading: boolean;
  onRefresh: () => void;
  onAddRow?: () => void;
  onExport?: () => void;
}

export function TableHeader({
  selectedTable,
  selectedSchema,
  totalRows,
  loading,
  onRefresh,
  onAddRow,
  onExport,
}: TableHeaderProps) {
  if (!selectedTable) {
    return (
      <div className="border-b bg-background p-6">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2">Select a table to edit</h2>
          <p className="text-muted-foreground">
            Choose a table from the sidebar to view and edit its data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-background">
      <div className="flex items-center justify-between p-4">
        {/* Table Info */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              {selectedTable}
              {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{selectedSchema} schema</span>
              <span>•</span>
              <span>{totalRows.toLocaleString()} rows</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
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
            disabled={loading}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={!selectedTable || loading}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button
            size="sm"
            onClick={onAddRow}
            disabled={!selectedTable || loading}
          >
            <Plus className="h-4 w-4 mr-2" />
            Insert
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}