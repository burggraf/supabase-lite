import { X, Download, Trash2, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MultiSelectActionBarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onMove?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function MultiSelectActionBar({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  onDownload,
  onDelete,
  onMove,
  isLoading = false,
  className
}: MultiSelectActionBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className={cn(
      "sticky top-0 z-10 bg-green-100 border border-green-200 rounded-lg p-3 transition-all duration-300 ease-in-out",
      "animate-in slide-in-from-top-2 fade-in-0",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-6 w-6 p-0 hover:bg-green-200"
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium text-green-800">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="text-xs text-green-700 hover:bg-green-200 hover:text-green-800"
            disabled={isLoading}
          >
            {allSelected ? 'Deselect all' : `Select all ${totalCount} files`}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={isLoading || selectedCount === 0}
            className="gap-2 border-green-300 bg-white hover:bg-green-50 text-green-700 hover:text-green-800"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          
          <Button
            variant="outline" 
            size="sm"
            onClick={onDelete}
            disabled={isLoading || selectedCount === 0}
            className="gap-2 border-red-300 bg-white hover:bg-red-50 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          
          {onMove && (
            <Button
              variant="outline"
              size="sm" 
              onClick={onMove}
              disabled={isLoading || selectedCount === 0}
              className="gap-2 border-blue-300 bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700"
            >
              <Move className="h-4 w-4" />
              Move
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}