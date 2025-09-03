import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { logger } from '@/lib/infrastructure/Logger';
import type { VFSBucket, VFSBucketOptions } from '@/types/vfs';

interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBucketCreated: (bucket: VFSBucket) => void;
}

const COMMON_MIME_TYPES = [
  { value: 'image/*', label: 'Images (PNG, JPG, GIF, etc.)' },
  { value: 'video/*', label: 'Videos (MP4, AVI, MOV, etc.)' },
  { value: 'audio/*', label: 'Audio (MP3, WAV, etc.)' },
  { value: 'application/pdf', label: 'PDF Documents' },
  { value: 'text/*', label: 'Text Files' },
  { value: '*/*', label: 'All File Types' },
];

const FILE_SIZE_LIMITS = [
  { value: 1024 * 1024, label: '1 MB' },
  { value: 5 * 1024 * 1024, label: '5 MB' },
  { value: 10 * 1024 * 1024, label: '10 MB' },
  { value: 50 * 1024 * 1024, label: '50 MB' },
  { value: 100 * 1024 * 1024, label: '100 MB' },
  { value: 500 * 1024 * 1024, label: '500 MB' },
  { value: 1024 * 1024 * 1024, label: '1 GB' },
];

export function CreateBucketDialog({ 
  open, 
  onOpenChange, 
  onBucketCreated 
}: CreateBucketDialogProps) {
  const [bucketName, setBucketName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [maxFileSize, setMaxFileSize] = useState<number | undefined>(50 * 1024 * 1024); // 50MB default
  const [allowedMimeTypes, setAllowedMimeTypes] = useState<string>('*/*');
  const [customMimeTypes, setCustomMimeTypes] = useState('');
  const [useCustomMimeTypes, setUseCustomMimeTypes] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!bucketName.trim()) {
      setError('Bucket name is required');
      return;
    }

    // Validate bucket name
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(bucketName)) {
      setError('Bucket name must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      setIsCreating(true);
      
      const mimeTypes = useCustomMimeTypes 
        ? customMimeTypes.split(',').map(type => type.trim()).filter(Boolean)
        : [allowedMimeTypes];

      const options: VFSBucketOptions = {
        isPublic,
        maxFileSize,
        allowedMimeTypes: mimeTypes,
      };

      const bucket = await vfsManager.createBucket(bucketName, options);
      
      logger.info('Created storage bucket', { 
        name: bucketName, 
        isPublic, 
        maxFileSize,
        allowedMimeTypes: mimeTypes 
      });

      onBucketCreated(bucket);
      handleClose();
    } catch (error) {
      const errorMessage = (error as Error).message;
      setError(errorMessage);
      logger.error('Failed to create bucket', error as Error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setBucketName('');
    setIsPublic(false);
    setMaxFileSize(50 * 1024 * 1024);
    setAllowedMimeTypes('*/*');
    setCustomMimeTypes('');
    setUseCustomMimeTypes(false);
    setError(null);
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a new bucket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bucket-name">Bucket name</Label>
            <Input
              id="bucket-name"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              placeholder="my-bucket"
              disabled={isCreating}
            />
            <p className="text-xs text-muted-foreground">
              Must be lowercase, can contain hyphens and numbers
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Make bucket public</Label>
              <p className="text-xs text-muted-foreground">
                Public buckets allow anyone to download files
              </p>
            </div>
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={isCreating}
            />
          </div>

          <div className="space-y-2">
            <Label>Maximum file size</Label>
            <Select
              value={maxFileSize?.toString()}
              onValueChange={(value) => setMaxFileSize(parseInt(value))}
              disabled={isCreating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_SIZE_LIMITS.map((limit) => (
                  <SelectItem key={limit.value} value={limit.value.toString()}>
                    {limit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Allowed file types</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={!useCustomMimeTypes}
                onCheckedChange={(checked) => setUseCustomMimeTypes(!checked)}
                disabled={isCreating}
              />
              <span className="text-sm">Use predefined types</span>
            </div>

            {!useCustomMimeTypes ? (
              <Select
                value={allowedMimeTypes}
                onValueChange={setAllowedMimeTypes}
                disabled={isCreating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_MIME_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={customMimeTypes}
                  onChange={(e) => setCustomMimeTypes(e.target.value)}
                  placeholder="image/png, image/jpeg, application/pdf"
                  disabled={isCreating}
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Enter MIME types separated by commas
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !bucketName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create bucket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}