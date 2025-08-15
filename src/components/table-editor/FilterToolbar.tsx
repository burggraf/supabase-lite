import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter, ArrowUpDown, Plus, ChevronDown, TableProperties, Upload } from 'lucide-react';

interface FilterToolbarProps {
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  selectedTable?: string;
  loading?: boolean;
  onInsertRow?: () => void;
  onInsertColumn?: () => void;
  onImportCSV?: () => void;
}

export function FilterToolbar({
  globalFilter,
  onGlobalFilterChange,
  selectedTable,
  loading = false,
  onInsertRow,
  onInsertColumn,
  onImportCSV,
}: FilterToolbarProps) {
  if (!selectedTable) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
        <Button variant="ghost" size="sm">
          <ArrowUpDown className="h-4 w-4 mr-2" />
          Sort
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="sm" 
              disabled={!selectedTable || loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Insert
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onClick={onInsertRow} className="cursor-pointer">
              <TableProperties className="h-4 w-4 mr-3" />
              <div>
                <div className="font-medium">Insert row</div>
                <div className="text-xs text-muted-foreground">Insert a new row into {selectedTable}</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onInsertColumn} 
              disabled 
              className="cursor-pointer opacity-50"
            >
              <TableProperties className="h-4 w-4 mr-3" />
              <div>
                <div className="font-medium">Insert column</div>
                <div className="text-xs text-muted-foreground">Insert a new column into {selectedTable}</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={onImportCSV} 
              disabled 
              className="cursor-pointer opacity-50"
            >
              <Upload className="h-4 w-4 mr-3" />
              <div>
                <div className="font-medium">Import data from CSV</div>
                <div className="text-xs text-muted-foreground">Insert new rows from a CSV</div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search all columns..."
          value={globalFilter}
          onChange={(event) => onGlobalFilterChange(event.target.value)}
          className="w-64"
        />
      </div>
    </div>
  );
}