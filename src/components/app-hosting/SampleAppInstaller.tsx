import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Globe, Sparkles, CheckCircle } from 'lucide-react';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';

interface SampleApp {
  id: string;
  name: string;
  title: string;
  description: string;
  tags: string[];
  path: string;
}

const SAMPLE_APPS: SampleApp[] = [
  {
    id: 'test-app',
    name: 'test-app',
    title: 'React + Vite Test App',
    description: 'A sample React application built with Vite and TypeScript. Perfect for testing Supabase integration and demonstrating modern web app features.',
    tags: ['React', 'TypeScript', 'Vite'],
    path: '/apps/test-app'
  }
];

interface SampleAppInstallerProps {
  onAppInstalled?: () => void;
}

export function SampleAppInstaller({ onAppInstalled }: SampleAppInstallerProps) {
  const [selectedApp, setSelectedApp] = useState<SampleApp | null>(null);
  const [appName, setAppName] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleInstallApp = async (sampleApp: SampleApp) => {
    setSelectedApp(sampleApp);
    setAppName(sampleApp.name);
    setIsDialogOpen(true);
  };

  const validateAppName = (name: string): boolean => {
    return /^[a-z0-9-]+$/.test(name) && name.length >= 2 && name.length <= 50;
  };

  const handleConfirmInstall = async () => {
    if (!selectedApp || !appName.trim()) {
      toast.error('Please enter an app name');
      return;
    }

    if (!validateAppName(appName)) {
      toast.error('App name must contain only lowercase letters, numbers, and hyphens');
      return;
    }

    setIsInstalling(true);

    try {
      // Get current project
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      // Ensure VFS is initialized
      await vfsManager.initialize(activeProject.id);

      // Fetch files from public/apps/{app-id} and copy to app/{appName}
      await copyPublicAppToVFS(selectedApp.id, appName);

      toast.success(`Sample app "${appName}" installed successfully!`);
      onAppInstalled?.();
      setIsDialogOpen(false);
      setSelectedApp(null);
      setAppName('');
    } catch (error) {
      console.error('Failed to install sample app:', error);
      toast.error(`Failed to install sample app: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const copyPublicAppToVFS = async (appId: string, targetAppName: string) => {
    // List of files to copy from the public/apps/{appId} directory
    const filesToCopy = [
      { src: '/apps/test-app/index.html', dest: `app/${targetAppName}/index.html`, mimeType: 'text/html' },
      { src: '/apps/test-app/vite.svg', dest: `app/${targetAppName}/vite.svg`, mimeType: 'image/svg+xml' },
      { src: '/apps/test-app/assets/index-lf7rQcQT.js', dest: `app/${targetAppName}/assets/index-lf7rQcQT.js`, mimeType: 'application/javascript' },
      { src: '/apps/test-app/assets/index-DvUIxfFc.css', dest: `app/${targetAppName}/assets/index-DvUIxfFc.css`, mimeType: 'text/css' }
    ];

    for (const file of filesToCopy) {
      try {
        // Fetch file from public folder
        const response = await fetch(file.src);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${file.src}: ${response.statusText}`);
        }

        // Determine if file is text or binary
        const isTextFile = file.mimeType.startsWith('text/') || file.mimeType === 'application/javascript' || file.mimeType === 'image/svg+xml';
        
        let content: string;
        let encoding: 'utf-8' | 'base64' = 'utf-8';
        
        if (isTextFile) {
          // For text files, get as text
          content = await response.text();
        } else {
          // For binary files, get as base64
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          content = btoa(String.fromCharCode(...bytes));
          encoding = 'base64';
        }

        // Store in VFS using createFile
        await vfsManager.createFile(file.dest, {
          content,
          mimeType: file.mimeType,
          encoding,
          createDirectories: true
        });
      } catch (error) {
        console.error(`Failed to copy ${file.src}:`, error);
        throw new Error(`Failed to copy ${file.src}`);
      }
    }
  };

  const handleDialogClose = () => {
    if (!isInstalling) {
      setIsDialogOpen(false);
      setSelectedApp(null);
      setAppName('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Sample Apps</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Install pre-built sample applications to get started quickly
        </p>
      </div>

      <div className="grid gap-4">
        {SAMPLE_APPS.map((app) => (
          <Card key={app.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    {app.title}
                  </CardTitle>
                  <CardDescription>{app.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {app.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleInstallApp(app)}
                  disabled={isInstalling}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Install App
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Install Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Sample App</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">{selectedApp?.title}</h4>
              <p className="text-sm text-muted-foreground">
                {selectedApp?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-name">App Name</Label>
              <Input
                id="app-name"
                placeholder="my-sample-app"
                value={appName}
                onChange={(e) => setAppName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                disabled={isInstalling}
              />
              <p className="text-sm text-muted-foreground">
                Your app will be available at: <code>/app/{appName || 'your-app-name'}</code>
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleDialogClose}
                disabled={isInstalling}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmInstall}
                disabled={!appName || !validateAppName(appName) || isInstalling}
                className="flex-1"
              >
                {isInstalling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Installing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Install App
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}