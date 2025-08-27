import { useState, useRef } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { logger } from '@/lib/infrastructure/Logger';
import type { VFSBucket } from '@/types/vfs';

interface FileUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucket: VFSBucket;
  currentPath: string;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export function FileUpload({ 
  open, 
  onOpenChange, 
  bucket, 
  currentPath, 
  onUploadComplete 
}: FileUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateFileId = () => crypto.randomUUID();

  const addFiles = (files: File[]) => {
    const newFiles: UploadFile[] = files.map(file => ({
      file,
      id: generateFileId(),
      progress: 0,
      status: 'pending'
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileProgress = (id: string, progress: number, status: UploadFile['status'], error?: string) => {
    setUploadFiles(prev => prev.map(f => 
      f.id === id ? { ...f, progress, status, error } : f
    ));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
    // Reset input
    if (e.target) {
      e.target.value = '';
    }
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    if (bucket.maxFileSize && file.size > bucket.maxFileSize) {
      return `File size exceeds limit of ${formatBytes(bucket.maxFileSize)}`;
    }

    // Check MIME type
    if (bucket.allowedMimeTypes && bucket.allowedMimeTypes.length > 0) {
      const isAllowed = bucket.allowedMimeTypes.some(mimeType => {
        if (mimeType === '*/*') return true;
        if (mimeType.endsWith('/*')) {
          return file.type.startsWith(mimeType.slice(0, -2));
        }
        return file.type === mimeType;
      });

      if (!isAllowed) {
        return `File type ${file.type} is not allowed`;
      }
    }

    return null;
  };

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    const { file, id } = uploadFile;
    
    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      updateFileProgress(id, 0, 'error', validationError);
      return;
    }

    try {
      updateFileProgress(id, 0, 'uploading');

      // Create full file path with bucket name
      const filePath = currentPath 
        ? `${bucket.name}/${currentPath}/${file.name}` 
        : `${bucket.name}/${file.name}`;

      // Handle file content based on type
      let content: string;
      let encoding: 'utf-8' | 'base64' = 'utf-8';
      
      if (file.type.startsWith('text/') || file.type === 'application/json') {
        // Text files - read as text
        content = await file.text();
        encoding = 'utf-8';
      } else {
        // Binary files - use browser's built-in base64 conversion
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
        content = btoa(binaryString);
        encoding = 'base64';
      }

      // Upload file
      await vfsManager.createFile(filePath, {
        content,
        mimeType: file.type,
        encoding,
        metadata: {
          originalName: file.name,
          size: file.size,
          lastModified: new Date(file.lastModified)
        }
      });

      updateFileProgress(id, 100, 'completed');
      logger.info('File uploaded successfully', { 
        bucket: bucket.name, 
        path: filePath,
        size: file.size 
      });
    } catch (error) {
      const errorMessage = (error as Error).message;
      updateFileProgress(id, 0, 'error', errorMessage);
      logger.error('File upload failed', error as Error, { 
        bucket: bucket.name, 
        filename: file.name 
      });
    }
  };

  const handleUploadAll = async () => {
    if (uploadFiles.length === 0) return;

    setIsUploading(true);
    
    try {
      // Upload all pending files
      const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
      await Promise.all(pendingFiles.map(uploadFile));

      // Check if all uploads were successful
      const hasErrors = uploadFiles.some(f => f.status === 'error');
      if (!hasErrors) {
        // Auto-close dialog and refresh file list after successful upload
        setTimeout(() => {
          handleClose();
          onUploadComplete();
        }, 1000);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setUploadFiles([]);
    setIsDragOver(false);
    setIsUploading(false);
    onOpenChange(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const completedCount = uploadFiles.filter(f => f.status === 'completed').length;
  const errorCount = uploadFiles.filter(f => f.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Upload files to {bucket.name}</DialogTitle>
          {currentPath && (
            <p className="text-sm text-muted-foreground">
              Uploading to: /{currentPath}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragOver 
                ? "border-blue-500 bg-blue-50" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
            </p>
            <p className="text-muted-foreground mb-4">
              or click to select files from your computer
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Files ({uploadFiles.length})
                </span>
                {completedCount > 0 && (
                  <span className="text-sm text-green-600">
                    {completedCount} completed
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="text-sm text-red-600">
                    {errorCount} failed
                  </span>
                )}
              </div>

              {uploadFiles.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    <File className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {uploadFile.file.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {uploadFile.status === 'completed' && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                        {uploadFile.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        {uploadFile.status !== 'uploading' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(uploadFile.id)}
                            disabled={isUploading}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{formatBytes(uploadFile.file.size)}</span>
                      {uploadFile.status === 'uploading' && (
                        <span>{uploadFile.progress}%</span>
                      )}
                    </div>

                    {uploadFile.status === 'uploading' && (
                      <Progress value={uploadFile.progress} className="mt-2" />
                    )}

                    {uploadFile.error && (
                      <p className="text-xs text-red-600 mt-1">
                        {uploadFile.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              {completedCount > 0 ? 'Close' : 'Cancel'}
            </Button>

            {uploadFiles.length > 0 && (
              <Button
                onClick={handleUploadAll}
                disabled={isUploading || uploadFiles.every(f => f.status !== 'pending')}
              >
                {isUploading ? 'Uploading...' : `Upload ${uploadFiles.filter(f => f.status === 'pending').length} files`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

