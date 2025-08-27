import { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Home, 
  Upload, 
  MoreVertical, 
  Download,
  Trash2,
  Copy,
  Link,
  File,
  Folder,
  Image,
  Video,
  Music,
  FileText,
  Search,
  Grid3X3,
  List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Toggle } from '@/components/ui/toggle';
import { FileUpload } from './FileUpload';
import { MultiSelectActionBar } from './MultiSelectActionBar';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { logger } from '@/lib/infrastructure/Logger';
import { cn } from '@/lib/utils';
import { StorageClient } from '@/lib/storage/StorageClient';
import { toast } from 'sonner';
import type { VFSBucket, VFSFile } from '@/types/vfs';

interface FileBrowserProps {
  bucket: VFSBucket;
  currentPath: string;
  onPathChange: (path: string) => void;
}

interface FileItem extends VFSFile {
  type: 'file';
}

interface FolderItem {
  type: 'folder';
  name: string;
  path: string;
  fileCount: number;
}

type BrowserItem = FileItem | FolderItem;

export function FileBrowser({ bucket, currentPath, onPathChange }: FileBrowserProps) {
  const [items, setItems] = useState<BrowserItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Initialize Storage Client
  const storageClient = new StorageClient({
    apiUrl: 'http://localhost:5173',
    apiKey: 'dummy-key'
  });
  const storageBucket = storageClient.from(bucket.name);

  useEffect(() => {
    loadFiles();
  }, [bucket.name, currentPath]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      
      // Get files in current path - construct directory path for bucket + current path
      const directoryPath = currentPath ? `${bucket.name}/${currentPath}` : bucket.name;
      const files = await vfsManager.listFiles({
        directory: directoryPath,
        recursive: false // Only get files in current directory
      });
      
      // Group files by folder and create folder items
      const folderMap = new Map<string, VFSFile[]>();
      const rootFiles: VFSFile[] = [];

      files.forEach(file => {
        // Remove bucket name from file path to get relative path within bucket
        let relativePath = file.path.startsWith(bucket.name + '/') 
          ? file.path.substring(bucket.name.length + 1)
          : file.path;
        
        // If we're in a subfolder, remove the current path prefix
        if (currentPath && relativePath.startsWith(currentPath + '/')) {
          relativePath = relativePath.substring(currentPath.length + 1);
        }
        
        const pathParts = relativePath.split('/');
        
        if (pathParts.length === 1 && pathParts[0] !== '') {
          // File is in current directory
          rootFiles.push(file);
        } else if (pathParts.length > 1) {
          // File is in a subfolder
          const folderName = pathParts[0];
          if (!folderMap.has(folderName)) {
            folderMap.set(folderName, []);
          }
          folderMap.get(folderName)!.push(file);
        }
      });

      // Create browser items
      const browserItems: BrowserItem[] = [];

      // Add folders
      folderMap.forEach((files, folderName) => {
        browserItems.push({
          type: 'folder',
          name: folderName,
          path: currentPath ? `${currentPath}/${folderName}` : folderName,
          fileCount: files.length
        });
      });

      // Add files
      rootFiles.forEach(file => {
        browserItems.push({
          ...file,
          type: 'file'
        });
      });

      // Sort: folders first, then files, both alphabetically
      browserItems.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      setItems(browserItems);
      logger.info('Loaded files for bucket', { 
        bucket: bucket.name, 
        path: currentPath,
        count: browserItems.length 
      });
    } catch (error) {
      logger.error('Failed to load files', error as Error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleItemClick = (item: BrowserItem) => {
    if (item.type === 'folder') {
      onPathChange(item.path);
    }
    // For files, we could open a preview or download
  };

  const handleItemSelect = (itemName: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemName)) {
      newSelected.delete(itemName);
    } else {
      newSelected.add(itemName);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    const fileNames = filteredItems.filter(item => item.type === 'file').map(item => item.name);
    setSelectedItems(new Set(fileNames));
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  const getSelectedFiles = (): VFSFile[] => {
    return filteredItems.filter(item => 
      item.type === 'file' && selectedItems.has(item.name)
    ) as VFSFile[];
  };

  const handleBreadcrumbClick = (path: string) => {
    onPathChange(path);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="h-4 w-4" />;
    }
    if (['mp4', 'avi', 'mov', 'wmv', 'mkv'].includes(ext || '')) {
      return <Video className="h-4 w-4" />;
    }
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext || '')) {
      return <Music className="h-4 w-4" />;
    }
    if (['txt', 'md', 'json', 'xml', 'csv'].includes(ext || '')) {
      return <FileText className="h-4 w-4" />;
    }
    
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Create breadcrumb items
  const breadcrumbItems = currentPath 
    ? currentPath.split('/').reduce<Array<{name: string, path: string}>>((acc, segment, index, array) => {
        const path = array.slice(0, index + 1).join('/');
        acc.push({ name: segment, path });
        return acc;
      }, [])
    : [];

  // File action handlers
  const handleDownload = async (file: VFSFile) => {
    try {
      const filePath = getRelativePathInBucket(file);
      const { data, error } = await storageBucket.download(filePath);
      
      if (error) {
        toast.error(`Failed to download ${file.name}: ${error.message}`);
        return;
      }

      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${file.name}`);
      }
    } catch (error) {
      logger.error('Download failed', error as Error);
      toast.error(`Failed to download ${file.name}`);
    }
  };

  const handleCopyUrl = async (file: VFSFile) => {
    try {
      const filePath = getRelativePathInBucket(file);
      
      if (bucket.isPublic) {
        const { data } = storageBucket.getPublicUrl(filePath);
        await navigator.clipboard.writeText(data.publicUrl);
        toast.success('Public URL copied to clipboard');
      } else {
        const { data, error } = await storageBucket.createSignedUrl(filePath, 3600);
        if (error) {
          toast.error(`Failed to generate URL: ${error.message}`);
          return;
        }
        if (data?.signedUrl) {
          await navigator.clipboard.writeText(data.signedUrl);
          toast.success('Signed URL copied to clipboard');
        }
      }
    } catch (error) {
      logger.error('Copy URL failed', error as Error);
      toast.error('Failed to copy URL');
    }
  };

  const handleGetSignedUrl = async (file: VFSFile) => {
    try {
      const filePath = getRelativePathInBucket(file);
      const { data, error } = await storageBucket.createSignedUrl(filePath, 3600);
      
      if (error) {
        toast.error(`Failed to generate signed URL: ${error.message}`);
        return;
      }

      if (data?.signedUrl) {
        await navigator.clipboard.writeText(data.signedUrl);
        toast.success('Signed URL copied to clipboard (expires in 1 hour)');
      }
    } catch (error) {
      logger.error('Get signed URL failed', error as Error);
      toast.error('Failed to generate signed URL');
    }
  };

  const handleDelete = async (file: VFSFile) => {
    if (!confirm(`Are you sure you want to delete ${file.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const filePath = getRelativePathInBucket(file);
      const { error } = await storageBucket.remove([filePath]);
      
      if (error) {
        toast.error(`Failed to delete ${file.name}: ${error.message}`);
        return;
      }

      toast.success(`Deleted ${file.name}`);
      loadFiles(); // Refresh the file list
    } catch (error) {
      logger.error('Delete failed', error as Error);
      toast.error(`Failed to delete ${file.name}`);
    }
  };

  // Helper to get file path relative to bucket
  const getRelativePathInBucket = (file: VFSFile): string => {
    let relativePath = file.path;
    
    // Remove bucket name from path if present
    if (relativePath.startsWith(bucket.name + '/')) {
      relativePath = relativePath.substring(bucket.name.length + 1);
    }
    
    return relativePath;
  };

  // Bulk action handlers
  const handleBulkDownload = async () => {
    const selectedFiles = getSelectedFiles();
    if (selectedFiles.length === 0) return;

    setIsBulkActionLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const file of selectedFiles) {
        try {
          const filePath = getRelativePathInBucket(file);
          const { data, error } = await storageBucket.download(filePath);
          
          if (error) {
            logger.error(`Failed to download ${file.name}`, error);
            errorCount++;
            continue;
          }

          if (data) {
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            successCount++;
            
            // Small delay between downloads to avoid overwhelming the browser
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          logger.error(`Download failed for ${file.name}`, error as Error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Downloaded ${successCount} file${successCount !== 1 ? 's' : ''}`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to download ${errorCount} file${errorCount !== 1 ? 's' : ''}`);
      }
      
      // Clear selection after successful downloads
      if (successCount > 0) {
        handleClearSelection();
      }
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    const selectedFiles = getSelectedFiles();
    if (selectedFiles.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsBulkActionLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const filePaths = selectedFiles.map(file => getRelativePathInBucket(file));
      const { error } = await storageBucket.remove(filePaths);
      
      if (error) {
        logger.error('Bulk delete failed', error);
        toast.error(`Failed to delete files: ${error.message}`);
        errorCount = selectedFiles.length;
      } else {
        successCount = selectedFiles.length;
        toast.success(`Deleted ${successCount} file${successCount !== 1 ? 's' : ''}`);
        handleClearSelection();
        loadFiles(); // Refresh the file list
      }
    } catch (error) {
      logger.error('Bulk delete failed', error as Error);
      toast.error('Failed to delete files');
      errorCount = selectedFiles.length;
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <button
                  onClick={() => handleBreadcrumbClick('')}
                  className="cursor-pointer flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  <Home className="h-4 w-4" />
                  {bucket.name}
                </button>
              </BreadcrumbItem>
              {breadcrumbItems.map((item, index) => (
                <div key={item.path} className="flex items-center">
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {index === breadcrumbItems.length - 1 ? (
                      <BreadcrumbPage>{item.name}</BreadcrumbPage>
                    ) : (
                      <button 
                        onClick={() => handleBreadcrumbClick(item.path)}
                        className="cursor-pointer transition-colors hover:text-foreground"
                      >
                        {item.name}
                      </button>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowUpload(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>

        {/* Search and View Controls */}
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Toggle
              pressed={viewMode === 'grid'}
              onPressedChange={(pressed) => setViewMode(pressed ? 'grid' : 'list')}
              aria-label="Grid view"
            >
              <Grid3X3 className="h-4 w-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={(pressed) => setViewMode(pressed ? 'list' : 'grid')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
      </div>

      {/* Multi-Select Action Bar */}
      {selectedItems.size > 0 && (
        <div className="px-6 py-2">
          <MultiSelectActionBar
            selectedCount={selectedItems.size}
            totalCount={filteredItems.filter(item => item.type === 'file').length}
            onClearSelection={handleClearSelection}
            onSelectAll={handleSelectAll}
            onDownload={handleBulkDownload}
            onDelete={handleBulkDelete}
            isLoading={isBulkActionLoading}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-lg font-medium mb-2">
              {searchQuery ? 'No files found' : 'No files in this folder'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? `No files match "${searchQuery}"`
                : 'Upload files to get started'
              }
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowUpload(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload files
              </Button>
            )}
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid' 
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
              : "space-y-2"
          )}>
            {filteredItems.map((item) => (
              <div
                key={`${item.type}-${item.name}`}
                className={cn(
                  "group cursor-pointer transition-colors",
                  viewMode === 'grid'
                    ? "p-3 rounded-lg border hover:bg-accent"
                    : "flex items-center gap-3 p-2 rounded-md hover:bg-accent",
                  selectedItems.has(item.name) && "bg-accent"
                )}
                onClick={() => handleItemClick(item)}
              >
                {viewMode === 'grid' ? (
                  <div className="text-center relative">
                    {item.type === 'file' && (
                      <div className="absolute top-0 left-0 z-10">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.name)}
                          onChange={() => handleItemSelect(item.name)}
                          className="rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                    <div className="mb-2 flex justify-center">
                      {item.type === 'folder' ? (
                        <Folder className="h-8 w-8 text-blue-600" />
                      ) : (
                        <div className="h-8 w-8 flex items-center justify-center">
                          {getFileIcon(item.name)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium truncate" title={item.name}>
                      {item.name}
                    </div>
                    {item.type === 'file' ? (
                      <div className="text-xs text-muted-foreground">
                        {formatFileSize(item.size)}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {item.fileCount} files
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {item.type === 'file' ? (
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.name)}
                        onChange={() => handleItemSelect(item.name)}
                        className="rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="w-4" />
                    )}
                    
                    <div className="flex-shrink-0">
                      {item.type === 'folder' ? (
                        <Folder className="h-5 w-5 text-blue-600" />
                      ) : (
                        getFileIcon(item.name)
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.type === 'file' && (
                        <div className="text-sm text-muted-foreground">
                          {formatFileSize(item.size)} • {formatDate(item.updatedAt)}
                        </div>
                      )}
                      {item.type === 'folder' && (
                        <div className="text-sm text-muted-foreground">
                          {item.fileCount} files
                        </div>
                      )}
                    </div>

                    {item.type === 'file' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(item as VFSFile)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyUrl(item as VFSFile)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy URL
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGetSignedUrl(item as VFSFile)}>
                            <Link className="h-4 w-4 mr-2" />
                            Get signed URL
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(item as VFSFile)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <FileUpload
        open={showUpload}
        onOpenChange={setShowUpload}
        bucket={bucket}
        currentPath={currentPath}
        onUploadComplete={loadFiles}
      />
    </div>
  );
}

