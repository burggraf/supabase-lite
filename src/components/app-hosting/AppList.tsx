import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Globe, 
  ExternalLink, 
  Trash2, 
  MoreVertical, 
  Download, 
  RefreshCw,
  Calendar,
  Files,
  HardDrive
} from 'lucide-react';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { toast } from 'sonner';

export interface DeployedApp {
  name: string;
  path: string;
  fileCount: number;
  totalSize: number;
  deployedAt: Date;
  lastUpdated: Date;
}

interface AppListProps {
  apps: DeployedApp[];
  onAppDeleted: () => void;
  onAppUpdated: () => void;
}

export function AppList({ apps, onAppDeleted, onAppUpdated }: AppListProps) {
  const [deletingApp, setDeletingApp] = useState<string | null>(null);

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

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  };

  const handleDeleteApp = async (appName: string) => {
    setDeletingApp(appName);
    
    try {
      // Get all files for this app
      const files = await vfsManager.listFiles({ 
        directory: `app/${appName}`, 
        recursive: true 
      });
      
      // Delete all files
      for (const file of files) {
        await vfsManager.deleteFile(file.path);
      }

      toast.success(`App "${appName}" deleted successfully`);
      onAppDeleted();
    } catch (error) {
      console.error('Failed to delete app:', error);
      toast.error(`Failed to delete app "${appName}"`);
    } finally {
      setDeletingApp(null);
    }
  };

  const handleOpenApp = (appName: string) => {
    window.open(`/app/${appName}`, '_blank');
  };

  const handleExportApp = async (_appName: string) => {
    try {
      // This would export the app as a zip file
      // For now, just show a toast
      toast.info('Export feature coming soon!');
    } catch (error) {
      toast.error('Failed to export app');
    }
  };

  if (apps.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Globe className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No apps deployed yet</h3>
          <p className="text-muted-foreground text-center mb-4 max-w-md">
            Deploy your first static web application to get started. Your apps will have direct access to all Supabase APIs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {apps.map((app) => (
        <Card key={app.name} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              {/* App Info */}
              <div className="flex items-start gap-4 flex-1">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Globe className="h-6 w-6 text-blue-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold truncate">{app.name}</h3>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      /app/{app.name}
                    </code>
                  </p>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Files className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Files:</span>
                      <span className="font-medium">{app.fileCount}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Size:</span>
                      <span className="font-medium">{formatFileSize(app.totalSize)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Updated:</span>
                      <span className="font-medium">{formatRelativeTime(app.lastUpdated)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenApp(app.name)}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenApp(app.name)}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open App
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={() => handleExportApp(app.name)}>
                      <Download className="h-4 w-4 mr-2" />
                      Export App
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={onAppUpdated}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Redeploy
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={() => handleDeleteApp(app.name)}
                      className="text-red-600"
                      disabled={deletingApp === app.name}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingApp === app.name ? 'Deleting...' : 'Delete App'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}