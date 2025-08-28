import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Folder, Upload, AlertCircle, CheckCircle, X } from 'lucide-react';
import { FolderUploadService } from '@/lib/vfs/FolderUploadService';
import { toast } from 'sonner';

interface AppDeploymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadProgress {
  uploaded: number;
  total: number;
  currentFile?: string;
}

export function AppDeploymentModal({ open, onClose, onSuccess }: AppDeploymentModalProps) {
  const [appName, setAppName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [draggedFiles, setDraggedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ uploaded: 0, total: 0 });
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if File System Access API is supported
  const isFileSystemAccessSupported = 'showDirectoryPicker' in window;

  const handleSelectFolder = async () => {
    if (isFileSystemAccessSupported) {
      try {
        // @ts-ignore - File System Access API types
        const dirHandle = await window.showDirectoryPicker();
        setSelectedFolder(dirHandle);
        
        // Generate preview of files
        const preview = await generateFilePreview(dirHandle);
        setFilePreview(preview);
        
        // Suggest app name from folder name
        if (!appName) {
          setAppName(dirHandle.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Failed to select folder');
        }
      }
    } else {
      // Fallback to file input for folder upload
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setDraggedFiles(files);
      
      // Generate preview
      const preview = Array.from(files).map(file => file.webkitRelativePath || file.name);
      setFilePreview(preview.slice(0, 20)); // Show first 20 files
      
      // Suggest app name from first file path
      if (!appName && files[0].webkitRelativePath) {
        const rootFolder = files[0].webkitRelativePath.split('/')[0];
        setAppName(rootFolder.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      }
    }
  };

  const generateFilePreview = async (dirHandle: FileSystemDirectoryHandle): Promise<string[]> => {
    const files: string[] = [];
    
    const processDirectory = async (handle: FileSystemDirectoryHandle, path = '') => {
      // @ts-ignore - File System Access API not fully typed
      for await (const [name, entry] of handle.entries()) {
        const fullPath = path ? `${path}/${name}` : name;
        
        if (entry.kind === 'file') {
          files.push(fullPath);
          if (files.length >= 20) break; // Limit preview
        } else if (entry.kind === 'directory') {
          await processDirectory(entry as FileSystemDirectoryHandle, fullPath);
          if (files.length >= 20) break;
        }
      }
    };
    
    await processDirectory(dirHandle);
    return files;
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      setDraggedFiles(files);
      
      // Generate preview
      const preview = Array.from(files).map(file => file.webkitRelativePath || file.name);
      setFilePreview(preview.slice(0, 20));
      
      // Suggest app name
      if (!appName && files[0].webkitRelativePath) {
        const rootFolder = files[0].webkitRelativePath.split('/')[0];
        setAppName(rootFolder.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
      }
    }
  };

  const validateAppName = (name: string): boolean => {
    return /^[a-z0-9-]+$/.test(name) && name.length >= 2 && name.length <= 50;
  };

  const handleDeploy = async () => {
    if (!appName.trim()) {
      toast.error('Please enter an app name');
      return;
    }

    if (!validateAppName(appName)) {
      toast.error('App name must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    if (!selectedFolder && !draggedFiles) {
      toast.error('Please select a folder to deploy');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress({ uploaded: 0, total: 0 });

    try {
      const folderService = new FolderUploadService();
      
      if (selectedFolder) {
        // Use File System Access API
        await folderService.uploadFromDirectoryHandle(
          selectedFolder,
          `app/${appName}`,
          (progress) => setUploadProgress(progress)
        );
      } else if (draggedFiles) {
        // Use drag and drop files
        await folderService.uploadFromFileList(
          draggedFiles,
          `app/${appName}`,
          (progress) => setUploadProgress(progress)
        );
      }

      toast.success(`App "${appName}" deployed successfully!`);
      onSuccess();
      handleClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUploadError(errorMessage);
      toast.error(`Deployment failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setAppName('');
    setSelectedFolder(null);
    setDraggedFiles(null);
    setFilePreview([]);
    setIsUploading(false);
    setUploadProgress({ uploaded: 0, total: 0 });
    setUploadError(null);
    onClose();
  };

  const progressPercent = uploadProgress.total > 0 
    ? Math.round((uploadProgress.uploaded / uploadProgress.total) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Deploy Static Web App</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* App Name Input */}
          <div className="space-y-2">
            <Label htmlFor="app-name">App Name</Label>
            <Input
              id="app-name"
              placeholder="my-awesome-app"
              value={appName}
              onChange={(e) => setAppName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              disabled={isUploading}
            />
            <p className="text-sm text-muted-foreground">
              Your app will be available at: <code>/app/{appName || 'your-app-name'}</code>
            </p>
          </div>

          {/* Folder Selection */}
          <div className="space-y-4">
            <Label>Select Folder</Label>
            
            {/* Drag and Drop Zone */}
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center transition-colors hover:border-muted-foreground/50"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {selectedFolder || draggedFiles ? (
                <div className="space-y-2">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                  <p className="font-medium">
                    {selectedFolder?.name || 'Folder selected'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {filePreview.length} files found
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="font-medium">Drop folder here or click to browse</p>
                    <p className="text-sm text-muted-foreground">
                      Select your built application folder (dist/, build/, public/, etc.)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Select Button */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSelectFolder}
                disabled={isUploading}
                className="flex-1"
              >
                <Folder className="h-4 w-4 mr-2" />
                {isFileSystemAccessSupported ? 'Browse Folder' : 'Upload Files'}
              </Button>
              {(selectedFolder || draggedFiles) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFolder(null);
                    setDraggedFiles(null);
                    setFilePreview([]);
                  }}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Fallback file input */}
            <input
              ref={fileInputRef}
              type="file"
              /* @ts-ignore */
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* File Preview */}
          {filePreview.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Files to deploy</Label>
                    <Badge variant="secondary">{filePreview.length}+ files</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                    {filePreview.map((file, index) => (
                      <div key={index} className="font-mono">{file}</div>
                    ))}
                    {filePreview.length >= 20 && (
                      <div className="italic">... and more files</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Uploading files...</Label>
                    <span className="text-sm text-muted-foreground">
                      {uploadProgress.uploaded} / {uploadProgress.total}
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  {uploadProgress.currentFile && (
                    <p className="text-sm text-muted-foreground truncate">
                      {uploadProgress.currentFile}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {uploadError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Upload Failed</p>
                    <p className="text-sm text-red-600 mt-1">{uploadError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={!appName || (!selectedFolder && !draggedFiles) || isUploading || !validateAppName(appName)}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Deploying...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Deploy App
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}