/**
 * EditApplicationModal Component - Modal for editing existing applications
 * 
 * Provides a form for updating application settings, uploading new files,
 * and managing application configuration.
 */

import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  AlertCircle,
  Settings,
  FileText,
  Play,
  Square
} from 'lucide-react';
import { Application, UpdateApplicationRequest, RuntimeEnvironment, ApplicationStatus } from '@/types/application-server';

interface EditApplicationModalProps {
  open: boolean;
  onClose: () => void;
  application: Application | null;
  onSubmit: (id: string, request: UpdateApplicationRequest) => Promise<void>;
  onStart?: (id: string) => Promise<void>;
  onStop?: (id: string) => Promise<void>;
  runtimes: RuntimeEnvironment[];
  loading?: boolean;
}

export function EditApplicationModal({
  open,
  onClose,
  application,
  onSubmit,
  onStart,
  onStop,
  runtimes,
  loading = false
}: EditApplicationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    runtimeId: '',
    entryPoint: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  // Update form data when application changes
  useEffect(() => {
    if (application) {
      setFormData({
        name: application.name,
        description: application.description || '',
        runtimeId: application.runtimeId,
        entryPoint: application.metadata?.entryPoint || 'index.js'
      });
      setError(null);
    }
  }, [application]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) {
      return 'Application name is required';
    }
    if (!formData.runtimeId) {
      return 'Runtime selection is required';
    }
    if (!formData.entryPoint.trim()) {
      return 'Entry point is required';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!application) return;

    setError(null);
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const request: UpdateApplicationRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        runtimeId: formData.runtimeId,
        metadata: {
          ...application.metadata,
          entryPoint: formData.entryPoint.trim()
        }
      };

      await onSubmit(application.id, request);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartStop = async () => {
    if (!application) return;

    try {
      if (application.status === ApplicationStatus.RUNNING) {
        await onStop?.(application.id);
      } else {
        await onStart?.(application.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to change application status');
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      setActiveTab('settings');
      onClose();
    }
  };

  const selectedRuntime = runtimes.find(r => r.id === formData.runtimeId);
  const isRunning = application?.status === ApplicationStatus.RUNNING;

  if (!application) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Edit Application</DialogTitle>
              <DialogDescription>
                Update application settings and manage deployment
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge 
                variant={isRunning ? 'default' : 'secondary'}
                className={isRunning ? 'bg-green-100 text-green-800' : ''}
              >
                {application.status}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleStartStop}
                disabled={isSubmitting}
              >
                {isRunning ? (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Start
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Files</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Application Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="my-awesome-app"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="A brief description of your application"
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-runtime">Runtime Environment *</Label>
                <Select 
                  value={formData.runtimeId} 
                  onValueChange={(value) => handleInputChange('runtimeId', value)}
                  disabled={isSubmitting || isRunning}
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
                {isRunning && (
                  <p className="text-sm text-yellow-600">
                    Stop the application to change the runtime
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-entryPoint">Entry Point *</Label>
                <Input
                  id="edit-entryPoint"
                  value={formData.entryPoint}
                  onChange={(e) => handleInputChange('entryPoint', e.target.value)}
                  placeholder="index.js"
                  disabled={isSubmitting || isRunning}
                />
                <p className="text-sm text-muted-foreground">
                  The main file that will be executed when your application starts
                </p>
                {isRunning && (
                  <p className="text-sm text-yellow-600">
                    Stop the application to change the entry point
                  </p>
                )}
              </div>

              {/* Application Info */}
              <div className="space-y-2">
                <Label>Application Details</Label>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono">{application.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{new Date(application.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span>{new Date(application.updatedAt).toLocaleString()}</span>
                  </div>
                  {application.url && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">URL:</span>
                      <a 
                        href={application.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {application.url}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">File Management</h3>
              <p className="text-muted-foreground mb-4">
                File upload and management features coming soon
              </p>
              <p className="text-sm text-muted-foreground">
                Current files: {application.metadata?.files?.length || 0} files
              </p>
            </div>
          </TabsContent>
        </Tabs>

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
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}