import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter, ArrowUpDown, Plus } from 'lucide-react';

interface FilterToolbarProps {
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  selectedTable?: string;
  loading?: boolean;
  onAddRow?: () => void;
}

export function FilterToolbar({
  globalFilter,
  onGlobalFilterChange,
  selectedTable,
  loading = false,
  onAddRow,
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
        <Button 
          size="sm" 
          onClick={onAddRow}
          disabled={!selectedTable || loading}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Insert
        </Button>
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