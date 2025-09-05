import { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronLeft,
  Home, 
  Upload, 
  MoreVertical, 
  Download,
  Trash2,
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
import { Label } from '@/components/ui/label';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
  const [previewFile, setPreviewFile] = useState<VFSFile | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  
  // Rename dialog state
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [fileToRename, setFileToRename] = useState<VFSFile | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  
  // Move dialog state
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [fileToMove, setFileToMove] = useState<VFSFile | null>(null);
  const [newFilePath, setNewFilePath] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // Initialize Storage Client - Route through Envoy proxy
  const storageClient = new StorageClient({
    apiUrl: 'http://localhost:8080',
    apiKey: 'dummy-key'
  });
  const storageBucket = storageClient.from(bucket.name);

  useEffect(() => {
    loadFiles();
  }, [bucket.name, currentPath]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      
      // Special handling for buckets that contain nested structures
      if (bucket.name === 'app') {
        await loadAppBucketFiles();
      } else if (bucket.name === 'edge-functions') {
        await loadEdgeFunctionsBucketFiles();
      } else {
        await loadRegularBucketFiles();
      }
    } catch (error) {
      logger.error('Failed to load files', error as Error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAppBucketFiles = async () => {
    // Get files in current path for app bucket
    const directoryPath = currentPath ? `${bucket.name}/${currentPath}` : bucket.name;
    const files = await vfsManager.listFiles({
      directory: directoryPath,
      recursive: true // Need recursive to find nested app folders
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
        // File is in a subfolder - for app bucket, only count immediate subfolders
        const folderName = pathParts[0];
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, []);
        }
        folderMap.get(folderName)!.push(file);
      }
    });

    // Create browser items
    const browserItems: BrowserItem[] = [];

    // Add folders (app folders in root, or subfolders within apps)
    folderMap.forEach((files, folderName) => {
      // Count all files in this folder (including nested ones)
      const totalFileCount = files.length;
      browserItems.push({
        type: 'folder',
        name: folderName,
        path: currentPath ? `${currentPath}/${folderName}` : folderName,
        fileCount: totalFileCount
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
    logger.info('Loaded files for app bucket', { 
      path: currentPath,
      count: browserItems.length,
      folders: folderMap.size,
      rootFiles: rootFiles.length
    });
  };

  const loadEdgeFunctionsBucketFiles = async () => {
    // Get files in current path for edge-functions bucket
    const directoryPath = currentPath ? `${bucket.name}/${currentPath}` : bucket.name;
    const files = await vfsManager.listFiles({
      directory: directoryPath,
      recursive: true // Need recursive to find nested function folders
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
        // File is in a subfolder - for edge-functions bucket, only count immediate subfolders
        const folderName = pathParts[0];
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, []);
        }
        folderMap.get(folderName)!.push(file);
      }
    });

    // Create browser items
    const browserItems: BrowserItem[] = [];

    // Add folders (function folders in root, or subfolders within functions)
    folderMap.forEach((files, folderName) => {
      // Count all files in this folder (including nested ones)
      const totalFileCount = files.length;
      browserItems.push({
        type: 'folder',
        name: folderName,
        path: currentPath ? `${currentPath}/${folderName}` : folderName,
        fileCount: totalFileCount
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
    logger.info('Loaded files for edge-functions bucket', { 
      path: currentPath,
      count: browserItems.length,
      folders: folderMap.size,
      rootFiles: rootFiles.length
    });
  };

  const loadRegularBucketFiles = async () => {
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

  const handleGetUrlWithExpiry = async (file: VFSFile, expiresIn: number, expiryLabel: string) => {
    try {
      const filePath = getRelativePathInBucket(file);
      
      // Always use signed URLs for consistency with Supabase
      const { data, error } = await storageBucket.createSignedUrl(filePath, expiresIn);
      
      if (error) {
        toast.error(`Failed to generate URL: ${error.message}`);
        return;
      }

      if (data?.signedUrl) {
        await navigator.clipboard.writeText(data.signedUrl);
        toast.success(`URL copied to clipboard (expires ${expiryLabel})`);
      }
    } catch (error) {
      logger.error('Get URL failed', error as Error);
      toast.error('Failed to generate URL');
    }
  };


  const _handlePreviewFile = async (file: VFSFile) => {
    try {
      const filePath = getRelativePathInBucket(file);
      
      // Always use signed URLs for consistency 
      const { data, error } = await storageBucket.createSignedUrl(filePath, 3600);
      if (error) {
        toast.error(`Failed to preview file: ${error.message}`);
        return;
      }
      if (data?.signedUrl) {
        setPreviewFile(file);
        setPreviewBlobUrl(data.signedUrl);
      }
    } catch (error) {
      logger.error('Preview file failed', error as Error);
      toast.error('Failed to preview file');
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewBlobUrl(null);
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

  const handleRename = (file: VFSFile) => {
    setFileToRename(file);
    setNewFileName(file.name);
    setShowRenameDialog(true);
  };

  const handleMove = (file: VFSFile) => {
    setFileToMove(file);
    // Set current path as default, user can edit it
    setNewFilePath(getRelativePathInBucket(file));
    setShowMoveDialog(true);
  };

  const executeRename = async () => {
    if (!fileToRename || !newFileName.trim()) {
      toast.error('Please enter a valid file name');
      return;
    }

    if (newFileName === fileToRename.name) {
      setShowRenameDialog(false);
      return;
    }

    // Validate filename - no path separators allowed
    if (newFileName.includes('/') || newFileName.includes('\\')) {
      toast.error('File name cannot contain path separators');
      return;
    }

    setIsRenaming(true);
    try {
      const currentPath = getRelativePathInBucket(fileToRename);
      const pathParts = currentPath.split('/');
      pathParts[pathParts.length - 1] = newFileName; // Replace filename
      const newPath = pathParts.join('/');

      const { error } = await storageBucket.move(currentPath, newPath);
      
      if (error) {
        toast.error(`Failed to rename ${fileToRename.name}: ${error.message}`);
        return;
      }

      toast.success(`Renamed ${fileToRename.name} to ${newFileName}`);
      setShowRenameDialog(false);
      loadFiles(); // Refresh the file list
    } catch (error) {
      logger.error('Rename failed', error as Error);
      toast.error(`Failed to rename ${fileToRename.name}`);
    } finally {
      setIsRenaming(false);
    }
  };

  const executeMove = async () => {
    if (!fileToMove || !newFilePath.trim()) {
      toast.error('Please enter a valid file path');
      return;
    }

    const currentPath = getRelativePathInBucket(fileToMove);
    if (newFilePath === currentPath) {
      setShowMoveDialog(false);
      return;
    }

    setIsMoving(true);
    try {
      const { error } = await storageBucket.move(currentPath, newFilePath);
      
      if (error) {
        toast.error(`Failed to move ${fileToMove.name}: ${error.message}`);
        return;
      }

      toast.success(`Moved ${fileToMove.name} to ${newFilePath}`);
      setShowMoveDialog(false);
      loadFiles(); // Refresh the file list
    } catch (error) {
      logger.error('Move failed', error as Error);
      toast.error(`Failed to move ${fileToMove.name}`);
    } finally {
      setIsMoving(false);
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
    let _errorCount = 0;

    try {
      const filePaths = selectedFiles.map(file => getRelativePathInBucket(file));
      const { error } = await storageBucket.remove(filePaths);
      
      if (error) {
        logger.error('Bulk delete failed', error);
        toast.error(`Failed to delete files: ${error.message}`);
        _errorCount = selectedFiles.length;
      } else {
        successCount = selectedFiles.length;
        toast.success(`Deleted ${successCount} file${successCount !== 1 ? 's' : ''}`);
        handleClearSelection();
        loadFiles(); // Refresh the file list
      }
    } catch (error) {
      logger.error('Bulk delete failed', error as Error);
      toast.error('Failed to delete files');
      _errorCount = selectedFiles.length;
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {/* Back Button - only show when not at root */}
            {currentPath && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const pathParts = currentPath.split('/');
                  const parentPath = pathParts.slice(0, -1).join('/');
                  onPathChange(parentPath);
                }}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            
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
          </div>

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
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Link className="h-4 w-4 mr-2" />
                              Get URL
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => handleGetUrlWithExpiry(item as VFSFile, 604800, 'in 1 week')}>
                                Expire in 1 week
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGetUrlWithExpiry(item as VFSFile, 2629746, 'in 1 month')}>
                                Expire in 1 month
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGetUrlWithExpiry(item as VFSFile, 31556952, 'in 1 year')}>
                                Expire in 1 year
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleGetUrlWithExpiry(item as VFSFile, 3600, 'in 1 hour')}>
                                Custom expiry
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuItem onClick={() => handleRename(item as VFSFile)}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleMove(item as VFSFile)}>
                            Move
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(item as VFSFile)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
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

      {/* File Preview Modal */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
            <DialogDescription>
              {previewFile && formatFileSize(previewFile.size)} • {previewFile && formatDate(previewFile.updatedAt)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex items-center justify-center min-h-[400px] bg-muted/10 rounded-lg">
            {previewFile && previewBlobUrl && (
              <div className="max-w-full max-h-full overflow-auto">
                {/* Image Preview */}
                {['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(
                  previewFile.name.split('.').pop()?.toLowerCase() || ''
                ) && (
                  <img
                    src={previewBlobUrl}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: '70vh' }}
                  />
                )}
                
                {/* Video Preview */}
                {['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm'].includes(
                  previewFile.name.split('.').pop()?.toLowerCase() || ''
                ) && (
                  <video
                    src={previewBlobUrl}
                    controls
                    className="max-w-full max-h-full"
                    style={{ maxHeight: '70vh' }}
                  />
                )}
                
                {/* Audio Preview */}
                {['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(
                  previewFile.name.split('.').pop()?.toLowerCase() || ''
                ) && (
                  <div className="p-8">
                    <div className="text-center mb-4">
                      <Music className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Audio File</p>
                    </div>
                    <audio
                      src={previewBlobUrl}
                      controls
                      className="w-full"
                    />
                  </div>
                )}
                
                {/* Text Preview */}
                {['txt', 'md', 'json', 'xml', 'csv', 'js', 'ts', 'html', 'css'].includes(
                  previewFile.name.split('.').pop()?.toLowerCase() || ''
                ) && (
                  <div className="p-4 max-h-96 overflow-auto">
                    <iframe
                      src={previewBlobUrl}
                      className="w-full h-96 border rounded"
                      title={previewFile.name}
                    />
                  </div>
                )}
                
                {/* PDF Preview */}
                {previewFile.name.split('.').pop()?.toLowerCase() === 'pdf' && (
                  <iframe
                    src={previewBlobUrl}
                    className="w-full h-96 border rounded"
                    title={previewFile.name}
                  />
                )}
                
                {/* Generic File Preview */}
                {!['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm', 'mp3', 'wav', 'flac', 'aac', 'ogg', 'txt', 'md', 'json', 'xml', 'csv', 'js', 'ts', 'html', 'css', 'pdf'].includes(
                  previewFile.name.split('.').pop()?.toLowerCase() || ''
                ) && (
                  <div className="p-8 text-center">
                    <File className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">{previewFile.name}</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      This file type cannot be previewed
                    </p>
                    <Button onClick={() => handleDownload(previewFile)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for "{fileToRename?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newFileName">New file name</Label>
              <Input
                id="newFileName"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Enter new file name"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    executeRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={executeRename}
              disabled={isRenaming || !newFileName.trim()}
            >
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move File</DialogTitle>
            <DialogDescription>
              Enter a new path for "{fileToMove?.name}". You can move it to a different folder or rename it in the process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newFilePath">New file path</Label>
              <Input
                id="newFilePath"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder="Enter new file path (e.g., folder/filename.ext)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    executeMove();
                  }
                }}
              />
              <div className="text-sm text-muted-foreground">
                Examples: "images/photo.jpg", "documents/readme.txt", or just change the filename
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMoveDialog(false)}
              disabled={isMoving}
            >
              Cancel
            </Button>
            <Button
              onClick={executeMove}
              disabled={isMoving || !newFilePath.trim()}
            >
              {isMoving ? 'Moving...' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

