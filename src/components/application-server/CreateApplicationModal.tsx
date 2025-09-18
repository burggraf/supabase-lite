/**
 * CreateApplicationModal Component - Modal for creating new applications
 * 
 * Provides a comprehensive form for creating applications with proper validation,
 * runtime selection, and file upload capabilities.
 */

import { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Upload, 
  Folder, 
  File, 
  X, 
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { CreateApplicationRequest, RuntimeEnvironment } from '@/types/application-server';

interface CreateApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (request: CreateApplicationRequest) => Promise<void>;
  runtimes: RuntimeEnvironment[];
  loading?: boolean;
}

interface UploadedFile {
  file: File;
  path: string;
  content: string;
}

export function CreateApplicationModal({
  open,
  onClose,
  onSubmit,
  runtimes,
  loading = false
}: CreateApplicationModalProps) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    runtimeId: '',
    entryPoint: 'index.js'
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newFiles: UploadedFile[] = [];
    
    for (const file of files) {
      const content = await readFileContent(file);
      newFiles.push({
        file,
        path: file.name,
        content
      });
    }
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newFiles: UploadedFile[] = [];
    
    for (const file of files) {
      const content = await readFileContent(file);
      const path = file.webkitRelativePath || file.name;
      newFiles.push({
        file,
        path,
        content
      });
    }
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): string | null => {
    if (!formData.id.trim()) {
      return 'App ID is required';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(formData.id.trim())) {
      return 'App ID must contain only letters, numbers, hyphens, and underscores';
    }
    if (!formData.name.trim()) {
      return 'Application name is required';
    }
    if (!formData.runtimeId) {
      return 'Runtime selection is required';
    }
    if (uploadedFiles.length === 0) {
      return 'At least one file must be uploaded';
    }
    if (!formData.entryPoint.trim()) {
      return 'Entry point is required';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const request: CreateApplicationRequest = {
        id: formData.id.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        runtimeId: formData.runtimeId,
        metadata: {
          entryPoint: formData.entryPoint.trim(),
          environmentVariables: {},
          files: uploadedFiles.map(f => ({
            name: f.path,
            size: f.file.size,
            type: f.file.type,
            content: f.content // Add file content
          }))
        }
      };

      await onSubmit(request);
      
      // Reset form on success
      setFormData({
        id: '',
        name: '',
        description: '',
        runtimeId: '',
        entryPoint: 'index.js'
      });
      setUploadedFiles([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFormData({
        id: '',
        name: '',
        description: '',
        runtimeId: '',
        entryPoint: 'index.js'
      });
      setUploadedFiles([]);
      setError(null);
      onClose();
    }
  };

  const selectedRuntime = runtimes.find(r => r.id === formData.runtimeId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Application</DialogTitle>
          <DialogDescription>
            Deploy a new application to the WebVM environment. Upload your files and configure the runtime settings.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id">App ID *</Label>
              <Input
                id="id"
                value={formData.id}
                onChange={(e) => handleInputChange('id', e.target.value)}
                placeholder="hello-world"
                disabled={isSubmitting}
              />
              <p className="text-sm text-muted-foreground">
                This will be the URL path: /app/{formData.id || 'your-app-id'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Application Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="My Awesome App"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="A brief description of your application"
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="runtime">Runtime Environment *</Label>
              <Select 
                value={formData.runtimeId} 
                onValueChange={(value) => handleInputChange('runtimeId', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a runtime" />
                </SelectTrigger>
                <SelectContent>
                  {runtimes.map((runtime) => (
                    <SelectItem key={runtime.id} value={runtime.id}>
                      <div className="flex items-center space-x-2">
                        <span>{runtime.name}</span>
                        <span className="text-sm text-muted-foreground">
                          v{runtime.version}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRuntime && (
                <p className="text-sm text-muted-foreground">
                  {selectedRuntime.description}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryPoint">Entry Point *</Label>
              <Input
                id="entryPoint"
                value={formData.entryPoint}
                onChange={(e) => handleInputChange('entryPoint', e.target.value)}
                placeholder="index.js"
                disabled={isSubmitting}
              />
              <p className="text-sm text-muted-foreground">
                The main file that will be executed when your application starts
              </p>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-4">
            <Label>Application Files *</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="text-center space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                    >
                      Upload Files
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select individual files
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-center space-y-2">
                  <Folder className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isSubmitting}
                    >
                      Upload Folder
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select entire folder
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={isSubmitting}
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              className="hidden"
              onChange={handleFolderUpload}
              disabled={isSubmitting}
            />

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Uploaded Files ({uploadedFiles.length})</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setUploadedFiles([])}
                      disabled={isSubmitting}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                        <div className="flex items-center space-x-2">
                          <File className="h-4 w-4" />
                          <span className="truncate">{file.path}</span>
                          <span className="text-muted-foreground">
                            ({(file.file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || loading}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Create Application
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}