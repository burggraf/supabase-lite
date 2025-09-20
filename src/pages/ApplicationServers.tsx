import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Terminal as XtermTerminal } from '@xterm/xterm';
import type { FitAddon as XtermFitAddon } from '@xterm/addon-fit';
import {
  WebVMInstance,
  WebVMState,
  WebVMStatus,
} from '@/lib/webvm/WebVMManager';
import { webvmManager } from '@/lib/webvm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { registerServiceWorker } from '@/sw-register';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Pencil, Upload as UploadIcon, Trash2, FolderOpen, ExternalLink } from 'lucide-react';
import { projectManager } from '@/lib/projects/ProjectManager';
import { vfsManager } from '@/lib/vfs/VFSManager';
import type { VFSFile } from '@/types/vfs';
import { FolderUploadService, type UploadProgress as FolderUploadProgress } from '@/lib/vfs/FolderUploadService';
import '@xterm/xterm/css/xterm.css';

const WEBVM_STATIC_ROOT = '/home/user/www';
const APPLICATION_ROOT = 'app';
const APPLICATION_METADATA_FILENAME = 'app.json';
const DEFAULT_RUNTIME: ApplicationRuntime = 'static';
const APP_ID_PATTERN = /^[a-z0-9-]+$/;
const WEBVM_BASE64_CHUNK_SIZE = 4096;

type ApplicationRuntime = 'static' | 'node' | 'python' | 'nextjs';

interface ApplicationMetadata {
  appId: string;
  name?: string;
  description?: string;
  runtime: ApplicationRuntime;
  createdAt: string;
  updatedAt: string;
}

interface ApplicationSummary {
  appId: string;
  runtime: ApplicationRuntime;
  metadataName?: string;
  metadataDescription?: string;
  fileCount: number;
  totalSize: number;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  hasMetadata: boolean;
}

interface ApplicationFormState {
  appId: string;
  name: string;
  description: string;
  runtime: ApplicationRuntime;
}

interface UploadPreviewItem {
  id: string;
  path: string;
}

function escapeShellArg(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function encodeStringToBase64(content: string): string {
  if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
  }

  type BufferLike = {
    from(input: string, encoding: string): { toString(encoding: string): string };
  };

  const bufferConstructor = (globalThis as unknown as { Buffer?: BufferLike }).Buffer;
  if (bufferConstructor) {
    return bufferConstructor.from(content, 'utf-8').toString('base64');
  }

  throw new Error('Unable to encode string to base64 in this environment.');
}

async function writeBase64FileToWebVM(instance: WebVMInstance, targetPath: string, base64Content: string): Promise<void> {
  const sanitizedTarget = escapeShellArg(targetPath);
  const tempPath = `${targetPath}.b64.tmp`;
  const escapedTemp = escapeShellArg(tempPath);

  await instance.runShellCommand(`rm -f ${escapedTemp} ${sanitizedTarget}`);

  if (!base64Content) {
    await instance.runShellCommand(`: > ${sanitizedTarget}`);
    return;
  }

  for (let offset = 0; offset < base64Content.length; offset += WEBVM_BASE64_CHUNK_SIZE) {
    const chunk = base64Content.slice(offset, offset + WEBVM_BASE64_CHUNK_SIZE);
    const escapedChunk = chunk.replace(/'/g, "'\\''");
    await instance.runShellCommand(`printf '%s' '${escapedChunk}' >> ${escapedTemp}`);
  }

  await instance.runShellCommand(`base64 -d ${escapedTemp} > ${sanitizedTarget} && rm -f ${escapedTemp}`);
}

const runtimeOptions: Array<{
  value: ApplicationRuntime;
  label: string;
  description: string;
  disabled?: boolean;
}> = [
  {
    value: 'static',
    label: 'Static website',
    description: 'Serve pre-built static assets directly from Supabase Lite.',
  },
  {
    value: 'node',
    label: 'Node.js (coming soon)',
    description: 'Run Node.js applications with npm dependencies inside WebVM.',
    disabled: true,
  },
  {
    value: 'python',
    label: 'Python (coming soon)',
    description: 'Deploy Python apps and frameworks such as Flask or FastAPI.',
    disabled: true,
  },
  {
    value: 'nextjs',
    label: 'Next.js (coming soon)',
    description: 'Full Next.js runtime with hybrid rendering support.',
    disabled: true,
  },
];

function getDisplayName(app: ApplicationSummary): string {
  return app.metadataName?.trim() ? app.metadataName : app.appId;
}

function formatFileSize(bytes: number): string {
  if (!bytes) {
    return '0 B';
  }

  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const size = bytes / Math.pow(k, index);
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(date?: Date | null): string {
  if (!date) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function normalizeAppId(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
}

function ensureDate(value: Date | string | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createInitialFormState(overrides: Partial<ApplicationFormState> = {}): ApplicationFormState {
  return {
    appId: '',
    name: '',
    description: '',
    runtime: DEFAULT_RUNTIME,
    ...overrides,
  };
}

interface ApplicationFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  values: ApplicationFormState;
  onChange: (updates: Partial<ApplicationFormState>) => void;
  onSubmit: () => void;
  onClose: () => void;
  isSubmitting: boolean;
  error: string | null;
}

function ApplicationFormDialog({
  open,
  mode,
  values,
  onChange,
  onSubmit,
  onClose,
  isSubmitting,
  error,
}: ApplicationFormDialogProps) {
  const title = mode === 'create' ? 'Create application' : 'Edit application';
  const primaryLabel = mode === 'create' ? 'Create' : 'Save changes';

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isSubmitting) {
        onSubmit();
      }
    },
    [isSubmitting, onSubmit]
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Configure the application identifier and metadata. The `app-id` determines the deployment path at
              <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">/app/&lt;app-id&gt;</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="app-id">App ID</Label>
              <Input
                id="app-id"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="my-cool-app"
                value={values.appId}
                onChange={(event) => onChange({ appId: normalizeAppId(event.target.value) })}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only. Changing the app ID moves any uploaded files to the new
                path.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-name">Name (optional)</Label>
              <Input
                id="app-name"
                placeholder="Marketing site"
                value={values.name}
                onChange={(event) => onChange({ name: event.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-description">Description (optional)</Label>
              <Textarea
                id="app-description"
                placeholder="A short summary to help identify this deployment."
                value={values.description}
                onChange={(event) => onChange({ description: event.target.value })}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Runtime</Label>
              <Select
                value={values.runtime}
                onValueChange={(value) => onChange({ runtime: value as ApplicationRuntime })}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose runtime" />
                </SelectTrigger>
                <SelectContent>
                  {runtimeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                      <div className="flex flex-col gap-0.5">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Static sites are available today. Additional runtimes are coming soon.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : primaryLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ApplicationUploadDialogProps {
  open: boolean;
  app: ApplicationSummary | null;
  onClose: () => void;
  onUploaded: () => void;
}

function ApplicationUploadDialog({ open, app, onClose, onUploaded }: ApplicationUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FileSystemDirectoryHandle | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [filePreview, setFilePreview] = useState<UploadPreviewItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<FolderUploadProgress>({ uploaded: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const isFileSystemAccessSupported = useMemo(
    () => (typeof window === 'undefined' ? false : 'showDirectoryPicker' in window),
    []
  );

  useEffect(() => {
    if (!open) {
      setSelectedFolder(null);
      setSelectedFiles(null);
      setFilePreview([]);
      setIsUploading(false);
      setProgress({ uploaded: 0, total: 0 });
      setError(null);
    }
  }, [open]);

  const resetSelection = useCallback(() => {
    setSelectedFolder(null);
    setSelectedFiles(null);
    setFilePreview([]);
    setError(null);
  }, []);

  const generatePreviewFromDirectory = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const items: UploadPreviewItem[] = [];

    const traverse = async (
      directory: FileSystemDirectoryHandle,
      prefix: string
    ): Promise<void> => {
      // @ts-expect-error - File System Access API iterator typing is not yet standardised
      for await (const [name, entry] of directory.entries()) {
        const path = prefix ? `${prefix}/${name}` : name;
        if (entry.kind === 'file') {
          items.push({ id: `${prefix}-${name}-${items.length}`, path });
          if (items.length >= 20) {
            break;
          }
        } else if (entry.kind === 'directory') {
          await traverse(entry as FileSystemDirectoryHandle, path);
          if (items.length >= 20) {
            break;
          }
        }
      }
    };

    await traverse(handle, '');
    setFilePreview(items);
  }, []);

  const handleSelectFolder = useCallback(async () => {
    if (!isFileSystemAccessSupported) {
      fileInputRef.current?.click();
      return;
    }

    try {
      // @ts-expect-error - showDirectoryPicker is not typed in lib DOM yet
      const directoryHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
      setSelectedFolder(directoryHandle);
      setSelectedFiles(null);
      await generatePreviewFromDirectory(directoryHandle);
    } catch (selectError) {
      if ((selectError as Error).name !== 'AbortError') {
        toast.error('Unable to access folder.');
      }
    }
  }, [generatePreviewFromDirectory, isFileSystemAccessSupported]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      resetSelection();
      return;
    }

    setSelectedFiles(files);
    setSelectedFolder(null);

    const previewItems: UploadPreviewItem[] = Array.from(files)
      .slice(0, 20)
      .map((file, index) => ({
        id: `${file.name}-${index}`,
        path: file.webkitRelativePath || file.name,
      }));
    setFilePreview(previewItems);
  }, [resetSelection]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    setSelectedFiles(files);
    setSelectedFolder(null);

    const previewItems: UploadPreviewItem[] = Array.from(files)
      .slice(0, 20)
      .map((file, index) => ({
        id: `${file.name}-${index}`,
        path: file.webkitRelativePath || file.name,
      }));
    setFilePreview(previewItems);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleUpload = useCallback(async () => {
    if (!app) {
      return;
    }

    if (!selectedFolder && !selectedFiles) {
      setError('Select a folder or files to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setProgress({ uploaded: 0, total: 0 });

    try {
      const service = new FolderUploadService();
      const targetPath = `${APPLICATION_ROOT}/${app.appId}`;

      if (selectedFolder) {
        await service.uploadFromDirectoryHandle(selectedFolder, targetPath, (next) => setProgress({ ...next }));
      } else if (selectedFiles) {
        await service.uploadFromFileList(selectedFiles, targetPath, (next) => setProgress({ ...next }));
      }

      toast.success(`Uploaded files to /app/${app.appId}`);
      onUploaded();
      onClose();
    } catch (uploadError) {
      console.error('Failed to upload application files', uploadError);
      const message = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
      setError(message);
      toast.error(`Upload failed: ${message}`);
    } finally {
      setIsUploading(false);
    }
  }, [app, onClose, onUploaded, selectedFiles, selectedFolder]);

  const progressPercent = progress.total > 0 ? Math.round((progress.uploaded / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            {app
              ? `Deploy assets to /${APPLICATION_ROOT}/${app.appId}. Upload a build folder or select individual files.`
              : 'Select an application before uploading files.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-muted-foreground/50 bg-muted/40 p-8 text-center"
          >
            <FolderOpen className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium text-sm">Drag-and-drop your project folder</p>
              <p className="text-xs text-muted-foreground">
                {isFileSystemAccessSupported
                  ? 'You can also browse for a directory using the button below.'
                  : 'Browser does not support directory upload. Use the file picker below.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleSelectFolder} disabled={isUploading}>
                <UploadIcon className="mr-2 h-4 w-4" />
                {isFileSystemAccessSupported ? 'Browse folder' : 'Select files'}
              </Button>
              {(selectedFolder || selectedFiles) && (
                <Button type="button" variant="outline" size="sm" onClick={resetSelection} disabled={isUploading}>
                  Clear selection
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
              // @ts-expect-error - webkitdirectory is a non-standard property
              webkitdirectory=""
            />
          </div>

          {filePreview.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Files detected</CardTitle>
                  <Badge variant="secondary">{filePreview.length}+ files</Badge>
                </div>
              </CardHeader>
              <CardContent className="max-h-40 space-y-1 overflow-y-auto p-4 pt-0 text-sm text-muted-foreground">
                {filePreview.map((item) => (
                  <div key={item.id} className="font-mono text-xs">
                    {item.path}
                  </div>
                ))}
                {selectedFiles && selectedFiles.length > filePreview.length && (
                  <div className="text-xs italic text-muted-foreground">…and more files</div>
                )}
              </CardContent>
            </Card>
          )}

          {isUploading && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading files…</span>
                  <span className="text-muted-foreground">
                    {progress.uploaded} / {progress.total}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                {progress.currentFile && (
                  <p className="truncate text-xs text-muted-foreground">{progress.currentFile}</p>
                )}
              </CardContent>
            </Card>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!app || isUploading}>
            {isUploading ? 'Uploading…' : 'Upload files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const statusTimeline: WebVMStatus[] = ['unloaded', 'downloading', 'initializing', 'ready'];

const statusCopy: Record<WebVMStatus, { label: string; description: string }> = {
  unloaded: {
    label: 'Idle',
    description: 'WebVM runtime has not been downloaded yet.',
  },
  downloading: {
    label: 'Downloading runtime',
    description: 'Fetching the WebAssembly bundle and disk image.',
  },
  initializing: {
    label: 'Initializing VM',
    description: 'Booting the WebVM Linux environment with bundled tooling.',
  },
  ready: {
    label: 'Ready',
    description: 'WebVM shell is running. Use the terminal below to interact with it.',
  },
  error: {
    label: 'Error',
    description: 'WebVM failed to start. Review the error and retry.',
  },
};

const badgeVariant: Record<WebVMStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  unloaded: 'secondary',
  downloading: 'warning',
  initializing: 'warning',
  ready: 'success',
  error: 'destructive',
};

function progressForStatus(status: WebVMStatus): number {
  switch (status) {
    case 'unloaded':
      return 0;
    case 'downloading':
      return 35;
    case 'initializing':
      return 70;
    case 'ready':
      return 100;
    case 'error':
      return 0;
    default:
      return 0;
  }
}

function ApplicationServersComponent() {
  const manager = webvmManager;
  const [state, setState] = useState<WebVMState>(manager.getState());
  const [vmInstance, setVmInstance] = useState<WebVMInstance | null>(null);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [isCrossOriginIsolated, setIsCrossOriginIsolated] = useState(() =>
    typeof window === 'undefined' ? true : window.crossOriginIsolated
  );
  const [isSettingUpIsolation, setIsSettingUpIsolation] = useState(() =>
    typeof window === 'undefined' ? false : !window.crossOriginIsolated
  );
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [appFormState, setAppFormState] = useState<ApplicationFormState>(() => createInitialFormState());
  const [appFormMode, setAppFormMode] = useState<'create' | 'edit'>('create');
  const [isAppFormOpen, setIsAppFormOpen] = useState(false);
  const [isSavingApplication, setIsSavingApplication] = useState(false);
  const [appFormError, setAppFormError] = useState<string | null>(null);
  const [editingApplication, setEditingApplication] = useState<ApplicationSummary | null>(null);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadTargetApp, setUploadTargetApp] = useState<ApplicationSummary | null>(null);
  const [hasActiveProject, setHasActiveProject] = useState(() => projectManager.getActiveProject() !== null);

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XtermTerminal | null>(null);
  const fitAddonRef = useRef<XtermFitAddon | null>(null);

  const ensureActiveProject = useCallback(async () => {
    const activeProject = projectManager.getActiveProject();
    if (!activeProject) {
      throw new Error('No active project selected. Create or switch to a project to manage applications.');
    }
    await vfsManager.initialize(activeProject.id);
    return activeProject;
  }, []);

  const loadApplications = useCallback(async () => {
    const activeProject = projectManager.getActiveProject();
    setHasActiveProject(Boolean(activeProject));

    if (!activeProject) {
      setApplications([]);
      return;
    }

    setIsLoadingApplications(true);

    try {
      await vfsManager.initialize(activeProject.id);
      const files = await vfsManager.listFiles({ directory: APPLICATION_ROOT, recursive: true });

      const grouped = new Map<string, VFSFile[]>();
      for (const file of files) {
        const segments = file.path.split('/');
        if (segments.length < 2 || segments[0] !== APPLICATION_ROOT) {
          continue;
        }
        const appId = segments[1];
        if (!grouped.has(appId)) {
          grouped.set(appId, []);
        }
        grouped.get(appId)!.push(file);
      }

      const summaries: ApplicationSummary[] = [];

      for (const [appId, group] of grouped.entries()) {
        const metadataPath = `${APPLICATION_ROOT}/${appId}/${APPLICATION_METADATA_FILENAME}`;
        const metadataFile = group.find((file) => file.path === metadataPath);

        let metadata: ApplicationMetadata | null = null;
        if (metadataFile) {
          try {
            const metadataContent = await vfsManager.readFileContent(metadataPath);
            if (metadataContent) {
              metadata = JSON.parse(metadataContent) as ApplicationMetadata;
            }
          } catch (error) {
            console.warn('Failed to parse application metadata', error, { appId });
          }
        }

        const filesWithoutMetadata = group.filter((file) => file.path !== metadataPath);
        const totalSize = filesWithoutMetadata.reduce((sum, file) => sum + (file.size ?? 0), 0);

        const createdDates = filesWithoutMetadata
          .map((file) => ensureDate(file.createdAt))
          .filter((value): value is Date => Boolean(value));
        const updatedDates = filesWithoutMetadata
          .map((file) => ensureDate(file.updatedAt))
          .filter((value): value is Date => Boolean(value));

        const fallbackCreatedAt = createdDates.length > 0
          ? new Date(Math.min(...createdDates.map((date) => date.getTime())))
          : null;
        const fallbackUpdatedAt = updatedDates.length > 0
          ? new Date(Math.max(...updatedDates.map((date) => date.getTime())))
          : null;

        summaries.push({
          appId,
          runtime: metadata?.runtime ?? DEFAULT_RUNTIME,
          metadataName: metadata?.name,
          metadataDescription: metadata?.description,
          fileCount: filesWithoutMetadata.length,
          totalSize,
          createdAt: metadata?.createdAt ? ensureDate(metadata.createdAt) : fallbackCreatedAt,
          updatedAt: metadata?.updatedAt ? ensureDate(metadata.updatedAt) : fallbackUpdatedAt,
          hasMetadata: Boolean(metadata),
        });
      }

      summaries.sort((a, b) => a.appId.localeCompare(b.appId));
      setApplications(summaries);
    } catch (error) {
      console.error('Failed to load applications', error);
      toast.error('Unable to load applications. Check the console for details.');
    } finally {
      setIsLoadingApplications(false);
    }
  }, []);

  const syncApplicationToWebVM = useCallback(
    async (appId: string) => {
      const normalizedId = normalizeAppId(appId) || 'default';

      await ensureActiveProject().catch(() => {
        throw new Error('No active project is selected.');
      });

      const metadataPath = `${APPLICATION_ROOT}/${appId}/${APPLICATION_METADATA_FILENAME}`;
      const prefix = `${APPLICATION_ROOT}/${appId}/`;
      const files = await vfsManager.listFiles({ directory: `${APPLICATION_ROOT}/${appId}`, recursive: true });
      const payloadFiles = files.filter((file) => file.path !== metadataPath);

      if (payloadFiles.length === 0) {
        if (normalizedId !== 'default') {
          const cleanupInstance = await webvmManager.ensureStarted();
          const baseDirForCleanup = `${WEBVM_STATIC_ROOT}/${normalizedId}`;
          await cleanupInstance.runShellCommand(`rm -rf ${escapeShellArg(baseDirForCleanup)}`);
        }
        return;
      }

      const instance = await webvmManager.ensureStarted();
      const baseDir =
        normalizedId === 'default' ? WEBVM_STATIC_ROOT : `${WEBVM_STATIC_ROOT}/${normalizedId}`;

      if (normalizedId !== 'default') {
        await instance.runShellCommand(
          `mkdir -p ${escapeShellArg(WEBVM_STATIC_ROOT)} && rm -rf ${escapeShellArg(baseDir)} && mkdir -p ${escapeShellArg(baseDir)}`
        );
      } else {
        await instance.runShellCommand(`mkdir -p ${escapeShellArg(baseDir)}`);
      }

      for (const file of payloadFiles) {
        if (!file.path.startsWith(prefix)) {
          continue;
        }

        const relativePath = file.path.slice(prefix.length);
        if (!relativePath) {
          continue;
        }

        const targetPath = `${baseDir}/${relativePath}`;
        const directoryName = targetPath.split('/').slice(0, -1).join('/');
        if (directoryName) {
          await instance.runShellCommand(`mkdir -p ${escapeShellArg(directoryName)}`);
        }

        const fileContent = await vfsManager.readFileContent(file.path);
        if (fileContent === null) {
          continue;
        }

        const base64Payload = file.encoding === 'base64' ? fileContent : encodeStringToBase64(fileContent);
        await writeBase64FileToWebVM(instance, targetPath, base64Payload);
      }

      await instance.runShellCommand(`find ${escapeShellArg(baseDir)} -type d -empty -delete 2>/dev/null || true`);
      await instance.runShellCommand('sync');
    },
    [ensureActiveProject]
  );

  const removeApplicationFromWebVM = useCallback(
    async (appId: string, relativePaths: string[] = []) => {
      const normalizedId = normalizeAppId(appId) || 'default';

      await ensureActiveProject().catch(() => {
        throw new Error('No active project is selected.');
      });

      const instance = await webvmManager.ensureStarted();
      const baseDir =
        normalizedId === 'default' ? WEBVM_STATIC_ROOT : `${WEBVM_STATIC_ROOT}/${normalizedId}`;

      if (normalizedId !== 'default' && relativePaths.length === 0) {
        await instance.runShellCommand(`rm -rf ${escapeShellArg(baseDir)}`);
        return;
      }

      if (relativePaths.length === 0) {
        return;
      }

      const directories = new Set<string>();

      for (const relativePath of relativePaths) {
        if (!relativePath) {
          continue;
        }

        const targetPath = `${baseDir}/${relativePath}`;
        await instance.runShellCommand(`rm -f ${escapeShellArg(targetPath)} 2>/dev/null || true`);
        const directoryName = targetPath.split('/').slice(0, -1).join('/');
        if (directoryName) {
          directories.add(directoryName);
        }
      }

      const sortedDirectories = Array.from(directories).sort((a, b) => b.length - a.length);
      for (const directory of sortedDirectories) {
        await instance.runShellCommand(`rmdir ${escapeShellArg(directory)} 2>/dev/null || true`);
      }

      if (normalizedId !== 'default') {
        await instance.runShellCommand(`rmdir ${escapeShellArg(baseDir)} 2>/dev/null || true`);
      }

      await instance.runShellCommand('sync');
    },
    [ensureActiveProject]
  );

  const handleAppFormChange = useCallback((updates: Partial<ApplicationFormState>) => {
    setAppFormState((previous) => ({ ...previous, ...updates }));
  }, []);

  const handleOpenCreateDialog = useCallback(() => {
    setAppFormMode('create');
    setAppFormState(createInitialFormState());
    setEditingApplication(null);
    setAppFormError(null);
    setIsAppFormOpen(true);
  }, []);

  const handleOpenEditDialog = useCallback((application: ApplicationSummary) => {
    setAppFormMode('edit');
    setEditingApplication(application);
    setAppFormState(
      createInitialFormState({
        appId: application.appId,
        name: application.metadataName ?? '',
        description: application.metadataDescription ?? '',
        runtime: application.runtime,
      })
    );
    setAppFormError(null);
    setIsAppFormOpen(true);
  }, []);

  const handleCloseAppDialog = useCallback(() => {
    setIsAppFormOpen(false);
    setAppFormError(null);
    setIsSavingApplication(false);
    setEditingApplication(null);
    setAppFormState(createInitialFormState());
  }, []);

  const handleAppFormSubmit = useCallback(async () => {
    const normalizedAppId = normalizeAppId(appFormState.appId);
    if (!normalizedAppId) {
      setAppFormError('App ID is required.');
      return;
    }
    if (!APP_ID_PATTERN.test(normalizedAppId)) {
      setAppFormError('App ID can only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    const runtime = runtimeOptions.some((option) => option.value === appFormState.runtime)
      ? appFormState.runtime
      : DEFAULT_RUNTIME;

    const name = appFormState.name.trim();
    const description = appFormState.description.trim();
    const nowIso = new Date().toISOString();

    setIsSavingApplication(true);
    setAppFormError(null);

    try {
      await ensureActiveProject();

      let syncTargetAppId: string | null = null;
      let removalContext: { appId: string; paths: string[] } | null = null;

      if (appFormMode === 'create') {
        const metadataPath = `${APPLICATION_ROOT}/${normalizedAppId}/${APPLICATION_METADATA_FILENAME}`;
        const existingFiles = await vfsManager.listFiles({
          directory: `${APPLICATION_ROOT}/${normalizedAppId}`,
          recursive: true,
        });
        const hasExistingMetadata = await vfsManager.readFile(metadataPath);

        if (existingFiles.length > 0 || hasExistingMetadata) {
          setAppFormError('An application with this app ID already exists.');
          return;
        }

        const metadata: ApplicationMetadata = {
          appId: normalizedAppId,
          runtime,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        if (name) {
          metadata.name = name;
        }
        if (description) {
          metadata.description = description;
        }

        const metadataContent = JSON.stringify(metadata, null, 2);
        await vfsManager.createFile(metadataPath, {
          content: metadataContent,
          mimeType: 'application/json',
          encoding: 'utf-8',
          originalSize: metadataContent.length,
        });

        toast.success(`Application “${metadata.name ?? normalizedAppId}” created.`);
      } else {
        if (!editingApplication) {
          setAppFormError('Select an application to edit.');
          return;
        }

        const originalAppId = editingApplication.appId;
        const newAppId = normalizedAppId;
        const originalMetadataPath = `${APPLICATION_ROOT}/${originalAppId}/${APPLICATION_METADATA_FILENAME}`;

        let createdAtIso = nowIso;
        try {
          const existingMetadataContent = await vfsManager.readFileContent(originalMetadataPath);
          if (existingMetadataContent) {
            const existingMetadata = JSON.parse(existingMetadataContent) as ApplicationMetadata;
            if (existingMetadata.createdAt) {
              createdAtIso = existingMetadata.createdAt;
            }
          } else if (editingApplication.createdAt) {
            createdAtIso = editingApplication.createdAt.toISOString();
          }
        } catch (metadataError) {
          console.warn('Failed to load existing metadata for application', metadataError, {
            appId: originalAppId,
          });
        }

        const metadata: ApplicationMetadata = {
          appId: newAppId,
          runtime,
          createdAt: createdAtIso,
          updatedAt: nowIso,
        };
        if (name) {
          metadata.name = name;
        }
        if (description) {
          metadata.description = description;
        }

        if (newAppId !== originalAppId) {
          const destinationFiles = await vfsManager.listFiles({
            directory: `${APPLICATION_ROOT}/${newAppId}`,
            recursive: true,
          });
          if (destinationFiles.length > 0) {
            setAppFormError('Another application already uses this app ID.');
            return;
          }

          const filesToMove = await vfsManager.listFiles({
            directory: `${APPLICATION_ROOT}/${originalAppId}`,
            recursive: true,
          });

          const relativePathsToRemove = filesToMove
            .filter((file) => file.path !== originalMetadataPath)
            .map((file) => file.path.slice(`${APPLICATION_ROOT}/${originalAppId}/`.length));

          const createdPaths: string[] = [];

          try {
            for (const file of filesToMove) {
              if (file.path === originalMetadataPath) {
                continue;
              }

              const relativePath = file.path.slice(`${APPLICATION_ROOT}/${originalAppId}`.length);
              const targetPath = `${APPLICATION_ROOT}/${newAppId}${relativePath}`;
              const content = await vfsManager.readFileContent(file.path);
              if (content === null) {
                continue;
              }

              await vfsManager.createFile(targetPath, {
                content,
                mimeType: file.mimeType,
                encoding: file.encoding,
                originalSize: file.size,
              });
              createdPaths.push(targetPath);
            }
          } catch (moveError) {
            console.error('Failed to move application files during rename', moveError);
            for (const createdPath of createdPaths) {
              try {
                await vfsManager.deleteFile(createdPath);
              } catch (cleanupError) {
                console.warn('Failed to clean up partially moved file', cleanupError, { path: createdPath });
              }
            }
            throw moveError;
          }

          for (const file of filesToMove) {
            await vfsManager.deleteFile(file.path);
          }

          removalContext = {
            appId: originalAppId,
            paths: relativePathsToRemove,
          };
        }

        const newMetadataPath = `${APPLICATION_ROOT}/${newAppId}/${APPLICATION_METADATA_FILENAME}`;
        const metadataContent = JSON.stringify(metadata, null, 2);
        const existsAtTarget = await vfsManager.readFile(newMetadataPath);

        if (existsAtTarget) {
          await vfsManager.updateFile(newMetadataPath, metadataContent);
        } else {
          await vfsManager.createFile(newMetadataPath, {
            content: metadataContent,
            mimeType: 'application/json',
            encoding: 'utf-8',
            originalSize: metadataContent.length,
          });
        }

        toast.success(`Application “${metadata.name ?? newAppId}” updated.`);

        syncTargetAppId = newAppId;
      }

      if (removalContext) {
        try {
          await removeApplicationFromWebVM(removalContext.appId, removalContext.paths);
        } catch (syncError) {
          console.error('Failed to remove previous application directory from WebVM', syncError);
          toast.warning('Updated metadata, but old WebVM files may remain. Remove them from the VM manually if needed.');
        }
      }

      if (syncTargetAppId) {
        try {
          await syncApplicationToWebVM(syncTargetAppId);
        } catch (syncError) {
          console.error('Failed to sync application to WebVM', syncError);
          toast.warning('Changes saved, but syncing files into the WebVM failed. Boot the VM and retry from the Upload menu.');
        }
      }

      await loadApplications();
      handleCloseAppDialog();
    } catch (error) {
      console.error('Failed to save application', error);
      const message = error instanceof Error ? error.message : 'Unknown error while saving application.';
      setAppFormError(message);
      toast.error(message);
    } finally {
      setIsSavingApplication(false);
    }
  }, [
    appFormMode,
    appFormState,
    editingApplication,
    ensureActiveProject,
    handleCloseAppDialog,
    loadApplications,
    removeApplicationFromWebVM,
    syncApplicationToWebVM,
  ]);

  const handleDeleteApplication = useCallback(
    async (application: ApplicationSummary) => {
      const displayName = getDisplayName(application);
      const confirmed = window.confirm(
        `Delete application "${displayName}"? All deployed files for this app will be removed.`
      );
      if (!confirmed) {
        return;
      }

      setBusyAppId(application.appId);
      try {
        await ensureActiveProject();
        const files = await vfsManager.listFiles({
          directory: `${APPLICATION_ROOT}/${application.appId}`,
          recursive: true,
        });
        const metadataPath = `${APPLICATION_ROOT}/${application.appId}/${APPLICATION_METADATA_FILENAME}`;
        const relativePaths = files
          .filter((file) => file.path !== metadataPath)
          .map((file) => file.path.slice(`${APPLICATION_ROOT}/${application.appId}/`.length));
        for (const file of files) {
          await vfsManager.deleteFile(file.path);
        }
        toast.success(`Application “${displayName}” deleted.`);
        try {
          await removeApplicationFromWebVM(application.appId, relativePaths);
        } catch (syncError) {
          console.error('Failed to remove application from WebVM', syncError);
          toast.warning('Files were removed from storage, but the WebVM may still contain copies. Remove them manually from the VM.');
        }
        await loadApplications();
      } catch (error) {
        console.error('Failed to delete application', error);
        const message = error instanceof Error ? error.message : 'Unknown error while deleting application.';
        toast.error(message);
      } finally {
        setBusyAppId(null);
      }
    },
    [ensureActiveProject, loadApplications, removeApplicationFromWebVM]
  );

  const handleOpenUploadDialog = useCallback((application: ApplicationSummary) => {
    setUploadTargetApp(application);
    setIsUploadDialogOpen(true);
  }, []);

  const handleCloseUploadDialog = useCallback(() => {
    setIsUploadDialogOpen(false);
    setUploadTargetApp(null);
  }, []);

  const handleUploadCompleted = useCallback(() => {
    const target = uploadTargetApp;

    void (async () => {
      await loadApplications();

      if (!target) {
        return;
      }

      setBusyAppId(target.appId);
      try {
        await syncApplicationToWebVM(target.appId);
        toast.success(`Synced “${getDisplayName(target)}” into WebVM.`);
      } catch (syncError) {
        console.error('Failed to sync uploaded application to WebVM', syncError);
        toast.warning('Files uploaded, but syncing them into the WebVM failed. Boot the VM and retry from the Upload menu.');
      } finally {
        setBusyAppId(null);
      }
    })();
  }, [loadApplications, syncApplicationToWebVM, uploadTargetApp]);

  const applicationMetrics = useMemo(() => {
    const totalApps = applications.length;
    const totalFiles = applications.reduce((sum, app) => sum + app.fileCount, 0);
    const totalSize = applications.reduce((sum, app) => sum + app.totalSize, 0);
    return { totalApps, totalFiles, totalSize };
  }, [applications]);

  const runtimeLabelMap = useMemo(() => {
    const map = new Map<ApplicationRuntime, string>();
    runtimeOptions.forEach((option) => {
      const label = option.label.replace(/ \(coming soon\)$/i, '');
      map.set(option.value, label);
    });
    return map;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (window.crossOriginIsolated) {
      setIsCrossOriginIsolated(true);
      setIsSettingUpIsolation(false);
      return;
    }

    if (!window.isSecureContext || !('serviceWorker' in navigator)) {
      setTerminalError(
        'WebVM requires a secure context with service workers enabled. Please serve Supabase Lite over HTTPS.'
      );
      setIsSettingUpIsolation(false);
      return;
    }

    setIsCrossOriginIsolated(false);
    setIsSettingUpIsolation(true);

    let controllerChangeHandler: (() => void) | null = null;
    let isolationCheck: number | null = null;

    controllerChangeHandler = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

    registerServiceWorker(true).catch((error) => {
      console.error('Failed to register service worker for cross-origin isolation', error);
      setTerminalError('Unable to enable WebVM. Service worker registration failed; see console for details.');
      setIsSettingUpIsolation(false);
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      }
      if (isolationCheck) {
        clearInterval(isolationCheck);
        isolationCheck = null;
      }
    });

    isolationCheck = window.setInterval(() => {
      if (window.crossOriginIsolated) {
        setIsCrossOriginIsolated(true);
        setIsSettingUpIsolation(false);
        if (controllerChangeHandler) {
          navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
        }
        if (isolationCheck) {
          clearInterval(isolationCheck);
          isolationCheck = null;
        }
      }
    }, 500);

    return () => {
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
      }
      if (isolationCheck) {
        clearInterval(isolationCheck);
        isolationCheck = null;
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = manager.subscribe((nextState) => {
      setState(nextState);
      if (nextState.status === 'error' && nextState.error) {
        setTerminalError(nextState.error);
      }
    });

    return () => {
      unsubscribe();
      void manager.shutdown();
    };
  }, [manager]);

  useEffect(() => {
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    const initializeTerminal = async () => {
      try {
        const [{ Terminal }, { FitAddon }, { WebLinksAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
          import('@xterm/addon-web-links'),
        ]);

        if (disposed || !terminalContainerRef.current) {
          return;
        }

        const term = new Terminal({
          convertEol: true,
          cursorBlink: true,
          scrollback: 2000,
          fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(terminalContainerRef.current);
        fitAddon.fit();
        term.focus();

        terminalRef.current = term;
        fitAddonRef.current = fitAddon;
        setIsTerminalReady(true);

        resizeObserver = new ResizeObserver(() => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();
          }
        });
        resizeObserver.observe(terminalContainerRef.current);
      } catch (error) {
        console.error('Failed to initialize terminal', error);
        setTerminalError('Failed to initialize terminal emulator. See console for details.');
      }
    };

    initializeTerminal();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;
      fitAddonRef.current?.dispose();
      fitAddonRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      fitAddonRef.current?.fit();
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const handleBoot = useCallback(async () => {
    if (!terminalRef.current) {
      setTerminalError('Terminal is still loading. Please try again in a moment.');
      return;
    }

    if (!isCrossOriginIsolated) {
      setTerminalError('WebVM is preparing a secure, cross-origin isolated environment. The page will reload automatically once ready.');
      return;
    }

    setIsBusy(true);
    setTerminalError(null);

    try {
      const instance = await manager.ensureStarted();
      await instance.attachTerminal(terminalRef.current);
      setVmInstance(instance);
    } catch (error) {
      console.error('Failed to boot WebVM', error);
      setTerminalError('Failed to boot WebVM. Check the browser console for details.');
    } finally {
      setIsBusy(false);
    }
  }, [isCrossOriginIsolated, manager]);

  const handleShutdown = useCallback(async () => {
    setIsBusy(true);
    setTerminalError(null);

    try {
      await manager.shutdown();
      setVmInstance(null);
      if (terminalRef.current) {
        terminalRef.current.reset();
        terminalRef.current.writeln('WebVM session terminated.');
      }
    } catch (error) {
      console.error('Failed to shut down WebVM', error);
      setTerminalError('Failed to shut down WebVM cleanly.');
    } finally {
      setIsBusy(false);
    }
  }, [manager]);

  const isLoading = state.status === 'downloading' || state.status === 'initializing';
  const showRetry = state.status === 'error';
  const isBootDisabled =
    isBusy ||
    isLoading ||
    !isTerminalReady ||
    !isCrossOriginIsolated ||
    isSettingUpIsolation;

  const bootButtonLabel = !isCrossOriginIsolated
    ? isSettingUpIsolation
      ? 'Preparing secure context…'
      : 'Enable isolation'
    : isLoading
    ? 'Starting…'
    : showRetry
    ? 'Retry Boot'
    : 'Boot WebVM';

  return (
    <div className="flex-1 p-6 overflow-y-auto min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Application Servers</h1>
          <p className="text-muted-foreground">
            Boot a WebVM 2.0 virtual machine to run application servers entirely in your browser. The VM
            runs a lightweight Linux environment with common tooling preloaded.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[340px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">WebVM Status</CardTitle>
                <Badge variant={badgeVariant[state.status]}>{statusCopy[state.status].label}</Badge>
              </div>
              <CardDescription>
                {!isCrossOriginIsolated
                  ? 'Setting up cross-origin isolation (COOP/COEP) so WebVM can access SharedArrayBuffer…'
                  : state.message || statusCopy[state.status].description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progressForStatus(state.status)} />
              <ul className="space-y-3 text-sm text-muted-foreground">
                {statusTimeline.map((statusKey) => (
                  <li key={statusKey} className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        state.status === statusKey
                          ? 'bg-primary'
                          : statusTimeline.indexOf(state.status) > statusTimeline.indexOf(statusKey)
                          ? 'bg-primary/40'
                          : 'bg-border'
                      }`}
                    />
                    <div>
                      <p className="font-medium text-foreground">{statusCopy[statusKey].label}</p>
                      <p>{statusCopy[statusKey].description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {showRetry && state.error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {state.error}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">WebVM Terminal</CardTitle>
                <CardDescription>
                  An interactive terminal connected to the WebVM environment. Use it to manage servers running inside the VM.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.status !== 'ready' && (
                  <Button onClick={handleBoot} disabled={isBootDisabled}>
                    {bootButtonLabel}
                  </Button>
                )}
                {state.status === 'ready' && (
                  <Button variant="outline" onClick={handleShutdown} disabled={isBusy || !vmInstance}>
                    Shutdown VM
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-3">
              <div
                ref={terminalContainerRef}
                className="h-72 w-full overflow-hidden rounded-md border border-border bg-black font-mono text-sm text-muted-foreground"
              />
              {!isTerminalReady && !terminalError && (
                <p className="text-xs text-muted-foreground">
                  Initializing terminal emulator…
                </p>
              )}
              {!isCrossOriginIsolated && !terminalError && (
                <p className="text-xs text-muted-foreground">
                  WebVM needs a cross-origin isolated context. A service worker is being registered to add the required COOP/COEP headers.
                </p>
              )}
              {terminalError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {terminalError}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle>Applications</CardTitle>
              <CardDescription>Manage deployments served from /app/&lt;app-id&gt;.</CardDescription>
            </div>
            <Button onClick={handleOpenCreateDialog} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New application
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Applications</p>
                <p className="text-2xl font-semibold text-foreground">{applicationMetrics.totalApps}</p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total files</p>
                <p className="text-2xl font-semibold text-foreground">{applicationMetrics.totalFiles}</p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Storage used</p>
                <p className="text-2xl font-semibold text-foreground">{formatFileSize(applicationMetrics.totalSize)}</p>
              </div>
            </div>

            {!hasActiveProject ? (
              <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-sm text-muted-foreground">
                Create or switch to a project to start deploying applications.
              </div>
            ) : isLoadingApplications ? (
              <div className="space-y-4">
                <div className="h-4 animate-pulse rounded bg-muted" />
                <div className="h-4 animate-pulse rounded bg-muted" />
                <div className="h-4 animate-pulse rounded bg-muted" />
              </div>
            ) : applications.length === 0 ? (
              <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-sm text-muted-foreground">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">No applications yet</p>
                    <p className="text-sm text-muted-foreground">
                      Create an application to reserve an app-id and upload your build artifacts.
                    </p>
                  </div>
                  <Button onClick={handleOpenCreateDialog} size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create application
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {applications.map((app, index) => {
                  const displayName = getDisplayName(app);
                  const runtimeLabel = runtimeLabelMap.get(app.runtime) ?? app.runtime;
                  const description = app.metadataDescription?.trim();
                  return (
                    <div key={app.appId} className="space-y-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold">{displayName}</h3>
                            <Badge variant="secondary">{runtimeLabel}</Badge>
                            <span className="font-mono text-xs text-muted-foreground">/app/{app.appId}</span>
                          </div>
                          {description && <p className="text-sm text-muted-foreground">{description}</p>}
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>Files: {app.fileCount}</span>
                            <span>Storage: {formatFileSize(app.totalSize)}</span>
                            <span>Updated: {formatDateTime(app.updatedAt)}</span>
                            <a
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                              href={`/${APPLICATION_ROOT}/${app.appId}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open app
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenUploadDialog(app)}
                            disabled={busyAppId === app.appId}
                          >
                            <UploadIcon className="mr-2 h-4 w-4" />
                            Upload
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditDialog(app)}
                            disabled={busyAppId === app.appId}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteApplication(app)}
                            disabled={busyAppId === app.appId}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </div>
                      {index < applications.length - 1 && <Separator />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ApplicationFormDialog
        open={isAppFormOpen}
        mode={appFormMode}
        values={appFormState}
        onChange={handleAppFormChange}
        onSubmit={handleAppFormSubmit}
        onClose={handleCloseAppDialog}
        isSubmitting={isSavingApplication}
        error={appFormError}
      />
      <ApplicationUploadDialog
        open={isUploadDialogOpen}
        app={uploadTargetApp}
        onClose={handleCloseUploadDialog}
        onUploaded={handleUploadCompleted}
      />
    </div>
  );
}

const ApplicationServers = ApplicationServersComponent;

export default ApplicationServers;
