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
      "sticky top-0 z-10 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 transition-all duration-300 ease-in-out",
      "animate-in slide-in-from-top-2 fade-in-0",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-6 w-6 p-0 hover:bg-green-200 dark:hover:bg-green-800/50"
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
          
          <span className="text-sm font-medium text-green-800 dark:text-green-300">
            {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="text-xs text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50 hover:text-green-800 dark:hover:text-green-200"
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
            className="gap-2 border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          
          <Button
            variant="outline" 
            size="sm"
            onClick={onDelete}
            disabled={isLoading || selectedCount === 0}
            className="gap-2 border-red-300 dark:border-red-700 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
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
              className="gap-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
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