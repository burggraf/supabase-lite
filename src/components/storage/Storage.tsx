import { useState, useEffect, useCallback } from 'react';
import { BucketList } from './BucketList';
import { FileBrowser } from './FileBrowser';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { logger } from '@/lib/infrastructure/Logger';
import type { VFSBucket } from '@/types/vfs';

export function Storage() {
  const [buckets, setBuckets] = useState<VFSBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<VFSBucket | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadBuckets = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get current project ID
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        throw new Error('No active project found. Please create or select a project first.');
      }
      
      await vfsManager.initialize(activeProject.id);
      await vfsManager.initializeDefaultBuckets();
      
      const bucketList = await vfsManager.listBuckets();
      setBuckets(bucketList);
      
      // Select first bucket by default
      if (bucketList.length > 0 && !selectedBucket) {
        setSelectedBucket(bucketList[0]);
      }
      
      logger.info('Loaded storage buckets', { count: bucketList.length });
    } catch (error) {
      logger.error('Failed to load storage buckets', error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBucket]);

  useEffect(() => {
    loadBuckets();
  }, [loadBuckets]);

  const handleBucketSelect = (bucket: VFSBucket) => {
    setSelectedBucket(bucket);
    setCurrentPath(''); // Reset to root when switching buckets
  };

  const handleBucketCreated = (bucket: VFSBucket) => {
    setBuckets(prev => [...prev, bucket]);
    setSelectedBucket(bucket);
  };

  const handleBucketDeleted = (bucketId: string) => {
    setBuckets(prev => prev.filter(bucket => bucket.id !== bucketId));
    if (selectedBucket?.id === bucketId) {
      const remainingBuckets = buckets.filter(bucket => bucket.id !== bucketId);
      setSelectedBucket(remainingBuckets.length > 0 ? remainingBuckets[0] : null);
    }
  };

  const filteredBuckets = buckets.filter(bucket =>
    bucket.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading storage...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar - Bucket list */}
      <div className="w-80 border-r bg-muted/30">
        <BucketList
          buckets={filteredBuckets}
          selectedBucket={selectedBucket}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onBucketSelect={handleBucketSelect}
          onBucketCreated={handleBucketCreated}
          onBucketDeleted={handleBucketDeleted}
          onRefresh={loadBuckets}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1">
        {selectedBucket ? (
          <FileBrowser
            bucket={selectedBucket}
            currentPath={currentPath}
            onPathChange={setCurrentPath}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-2xl font-semibold mb-2">Storage</h2>
              <p className="text-muted-foreground mb-6">
                Create buckets to store and serve any type of digital content.
              </p>
              <p className="text-sm text-muted-foreground">
                Make your buckets private or public depending on your security preference.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}