import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Upload, Folder, ExternalLink, Trash2, Settings } from 'lucide-react';
import { AppDeploymentModal } from './AppDeploymentModal';
import { SampleAppInstaller } from './SampleAppInstaller';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';

interface DeployedApp {
  name: string;
  path: string;
  fileCount: number;
  totalSize: number;
  deployedAt: Date;
  lastUpdated: Date;
}

export function AppHosting() {
  const [deployedApps, setDeployedApps] = useState<DeployedApp[]>([]);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load deployed apps on component mount
  useEffect(() => {
    loadDeployedApps();
  }, []);

  const loadDeployedApps = async () => {
    try {
      setIsLoading(true);
      
      // Get current project
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }
      
      // Ensure VFS is initialized
      await vfsManager.initialize(activeProject.id);
      
      // List all files in the 'app' bucket to discover deployed apps
      const files = await vfsManager.listFiles({ directory: 'app', recursive: true });
      
      // Group files by app name (first directory level after 'app/')
      const appGroups = new Map<string, typeof files>();
      
      files.forEach(file => {
        // Extract app name from path like 'app/my-todo-app/index.html'
        const pathParts = file.path.split('/');
        if (pathParts.length >= 3 && pathParts[0] === 'app') {
          const appName = pathParts[1];
          if (!appGroups.has(appName)) {
            appGroups.set(appName, []);
          }
          appGroups.get(appName)!.push(file);
        }
      });

      // Convert groups to app metadata
      const apps: DeployedApp[] = Array.from(appGroups.entries()).map(([appName, appFiles]) => {
        const totalSize = appFiles.reduce((sum, file) => sum + file.size, 0);
        const deployedAt = new Date(Math.min(...appFiles.map(f => f.createdAt.getTime())));
        const lastUpdated = new Date(Math.max(...appFiles.map(f => f.updatedAt.getTime())));

        return {
          name: appName,
          path: `app/${appName}`,
          fileCount: appFiles.length,
          totalSize,
          deployedAt,
          lastUpdated
        };
      });

      setDeployedApps(apps);
    } catch (error) {
      console.error('Failed to load deployed apps:', error);
      toast.error('Failed to load deployed apps');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteApp = async (appName: string) => {
    try {
      // Get current project
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }
      
      // Ensure VFS is initialized
      await vfsManager.initialize(activeProject.id);
      
      // Delete all files for this app
      const files = await vfsManager.listFiles({ directory: `app/${appName}`, recursive: true });
      
      for (const file of files) {
        await vfsManager.deleteFile(file.path);
      }

      // Reload the app list
      await loadDeployedApps();
      toast.success(`App "${appName}" deleted successfully`);
    } catch (error) {
      console.error('Failed to delete app:', error);
      toast.error(`Failed to delete app "${appName}"`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto min-h-full">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-6 w-6" />
            <h1 className="text-3xl font-bold">App Hosting</h1>
          </div>
          <p className="text-muted-foreground">
            Host static web applications directly within Supabase Lite. Your apps will have direct access to all Supabase APIs without CORS restrictions.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deployed Apps</p>
                  <p className="text-2xl font-bold">{deployedApps.length}</p>
                </div>
                <Globe className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Files</p>
                  <p className="text-2xl font-bold">
                    {deployedApps.reduce((sum, app) => sum + app.fileCount, 0)}
                  </p>
                </div>
                <Folder className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold">
                    {formatFileSize(deployedApps.reduce((sum, app) => sum + app.totalSize, 0))}
                  </p>
                </div>
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deployed Applications Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Deployed Applications</CardTitle>
                  <CardDescription>
                    Manage your hosted static web applications. Each app is accessible at /app/[app-name].
                  </CardDescription>
                </div>
                <Button onClick={() => setIsDeployModalOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Deploy App
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : deployedApps.length === 0 ? (
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No apps deployed yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Deploy your first static web application to get started.
                  </p>
                  <Button onClick={() => setIsDeployModalOpen(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Deploy Your First App
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {deployedApps.map((app) => (
                    <div
                      key={app.name}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Globe className="h-8 w-8 text-blue-500" />
                        <div>
                          <h3 className="font-medium">{app.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>{app.fileCount} files</span>
                            <span>{formatFileSize(app.totalSize)}</span>
                            <span>Updated {formatDate(app.lastUpdated)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Active</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/app/${app.name}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteApp(app.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deploy New App Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Upload className="h-6 w-6" />
              <h2 className="text-2xl font-bold">Deploy New App</h2>
            </div>
            
            {/* Sample Apps Section */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Apps</CardTitle>
                <CardDescription>
                  Install pre-built sample applications to get started quickly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SampleAppInstaller onAppInstalled={loadDeployedApps} />
              </CardContent>
            </Card>

          </div>

          {/* Settings Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6" />
              <h2 className="text-2xl font-bold">Settings</h2>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>App Hosting Settings</CardTitle>
                <CardDescription>
                  Configure app hosting preferences and defaults.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Default Configuration</h4>
                    <p className="text-sm text-muted-foreground">
                      Apps are served from the same origin as Supabase Lite, eliminating CORS issues.
                      Your apps can access APIs directly using <code>window.location.origin</code> as the Supabase URL.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Supported Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Static HTML, CSS, JavaScript files</li>
                      <li>• Single Page Applications (SPA routing)</li>
                      <li>• Binary assets (images, fonts, etc.)</li>
                      <li>• Direct Supabase API access</li>
                      <li>• Multiple apps per project</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Deploy Modal */}
        <AppDeploymentModal
          open={isDeployModalOpen}
          onClose={() => setIsDeployModalOpen(false)}
          onSuccess={() => {
            loadDeployedApps();
            setIsDeployModalOpen(false);
          }}
        />
      </div>
    </div>
  );
}