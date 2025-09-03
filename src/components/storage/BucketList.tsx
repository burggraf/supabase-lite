import { useState } from 'react';
import { Search, Plus, ChevronDown, RefreshCw, FolderOpen, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateBucketDialog } from './CreateBucketDialog';
import { cn } from '@/lib/utils';
import type { VFSBucket } from '@/types/vfs';

interface BucketListProps {
  buckets: VFSBucket[];
  selectedBucket: VFSBucket | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onBucketSelect: (bucket: VFSBucket) => void;
  onBucketCreated: (bucket: VFSBucket) => void;
  onBucketDeleted: (bucketId: string) => void;
  onRefresh: () => void;
}

export function BucketList({
  buckets,
  selectedBucket,
  searchQuery,
  onSearchChange,
  onBucketSelect,
  onBucketCreated,
  onBucketDeleted: _onBucketDeleted,
  onRefresh
}: BucketListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatFileCount = (count: number) => {
    if (count === 0) return 'No files';
    if (count === 1) return '1 file';
    return `${count} files`;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Storage</h2>
          <Button 
            size="sm" 
            onClick={() => setShowCreateDialog(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New bucket
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search buckets..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
          <ChevronDown className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Bucket List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              ALL BUCKETS
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </Button>
          </div>

          {buckets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm mb-1">No buckets available</p>
              <p className="text-xs">
                Buckets that you create will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {buckets.map((bucket) => (
                <div
                  key={bucket.id}
                  onClick={() => onBucketSelect(bucket)}
                  className={cn(
                    "p-3 rounded-md cursor-pointer transition-colors hover:bg-accent",
                    selectedBucket?.id === bucket.id && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 mt-0.5">
                      {bucket.isPublic ? (
                        <Unlock className="h-4 w-4 text-green-600" />
                      ) : (
                        <Lock className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {bucket.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatFileCount(bucket.fileCount)} • {formatSize(bucket.totalSize)}
                      </div>
                      {bucket.isPublic && (
                        <div className="text-xs text-green-600 mt-1">
                          Public bucket
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configuration Section */}
        <div className="p-4 border-t">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
            CONFIGURATION
          </div>
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm"
              disabled
            >
              Policies
            </Button>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sm"
              disabled
            >
              Settings
            </Button>
          </div>
        </div>
      </div>

      <CreateBucketDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onBucketCreated={onBucketCreated}
      />
    </div>
  );
}