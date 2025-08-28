import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Folder,
  FolderOpen,
  Play,
  Pause,
  RefreshCw,
  Upload,
  Download,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  X,
  FileText
} from 'lucide-react';
import { syncManager } from '@/lib/vfs/SyncManager';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SyncStatus, ConflictFile, SyncConfig } from '@/lib/vfs/SyncManager';

interface FolderSyncProps {
  onRefresh?: () => void;
}

export function FolderSync({ onRefresh }: FolderSyncProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<ConflictFile | null>(null);
  const [mergedContent, setMergedContent] = useState('');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(syncManager.getSyncConfig());
  const [ignorePatterns, setIgnorePatterns] = useState(syncConfig.ignorePatterns.join('\n'));
  const [recentActivity, setRecentActivity] = useState<string[]>([]);

  // Check if File System Access API is supported
  const hasFileSystemSupport = syncManager.hasFileSystemSupport();

  useEffect(() => {
    updateSyncStatus();
    
    // Update status periodically
    const interval = setInterval(updateSyncStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateSyncStatus = () => {
    const status = syncManager.getSyncStatus();
    setSyncStatus(status);
  };

  const handleSelectFolder = async () => {
    try {
      setIsLoading(true);
      const granted = await syncManager.requestFolderAccess();
      
      if (granted) {
        toast.success('Folder access granted');
        updateSyncStatus();
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
      toast.error('Failed to select folder: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSync = async () => {
    try {
      setIsLoading(true);
      addActivity('Starting sync...');
      
      await syncManager.startWatching();
      toast.success('Folder sync started');
      updateSyncStatus();
      onRefresh?.();
      
      addActivity('Sync started successfully');
    } catch (error) {
      console.error('Failed to start sync:', error);
      toast.error('Failed to start sync: ' + (error as Error).message);
      addActivity('Sync failed to start: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopSync = () => {
    syncManager.stopWatching();
    toast.success('Folder sync stopped');
    updateSyncStatus();
    addActivity('Sync stopped');
  };

  const handleManualSync = async () => {
    try {
      setIsLoading(true);
      addActivity('Manual sync started...');
      
      const result = await syncManager.syncFolder();
      
      let message = `Sync completed: ${result.filesUploaded} uploaded, ${result.filesDownloaded} downloaded`;
      if (result.conflicts.length > 0) {
        message += `, ${result.conflicts.length} conflicts`;
      }
      
      toast.success(message);
      updateSyncStatus();
      onRefresh?.();
      
      addActivity(message);
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast.error('Manual sync failed: ' + (error as Error).message);
      addActivity('Manual sync failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveConflict = (conflict: ConflictFile) => {
    setSelectedConflict(conflict);
    setMergedContent(conflict.localContent || '');
    setShowConflictDialog(true);
  };

  const handleConflictResolution = async (resolution: 'local' | 'remote' | 'merge') => {
    if (!selectedConflict) return;

    try {
      setIsLoading(true);
      
      await syncManager.resolveConflict(
        selectedConflict.path, 
        resolution,
        resolution === 'merge' ? mergedContent : undefined
      );
      
      toast.success(`Conflict resolved using ${resolution} version`);
      setShowConflictDialog(false);
      setSelectedConflict(null);
      updateSyncStatus();
      onRefresh?.();
      
      addActivity(`Resolved conflict for ${selectedConflict.path} using ${resolution} version`);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      toast.error('Failed to resolve conflict: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = () => {
    try {
      const patterns = ignorePatterns.split('\n').map(p => p.trim()).filter(p => p);
      const newConfig = { ...syncConfig, ignorePatterns: patterns };
      
      syncManager.setSyncConfig(newConfig);
      setSyncConfig(newConfig);
      setShowSettingsDialog(false);
      toast.success('Sync settings saved');
      
      addActivity('Sync settings updated');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    }
  };

  const addActivity = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const activityMessage = `${timestamp}: ${message}`;
    setRecentActivity(prev => [activityMessage, ...prev.slice(0, 9)]); // Keep last 10 items
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getSyncDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'upload': return <Upload className="h-4 w-4" />;
      case 'download': return <Download className="h-4 w-4" />;
      case 'bidirectional': return <ArrowUpDown className="h-4 w-4" />;
      default: return <ArrowUpDown className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Local Folder Sync</h3>
          <p className="text-sm text-muted-foreground">
            Synchronize your Edge Functions with a local development folder
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettingsDialog(true)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {!hasFileSystemSupport && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <h4 className="font-medium text-yellow-800">Limited Browser Support</h4>
                <p className="text-sm text-yellow-700">
                  File System Access API is not supported in this browser. 
                  Please use Chrome, Edge, or Opera for full sync functionality.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folder Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Local Folder
          </CardTitle>
          <CardDescription>
            Select a local folder to synchronize with your Edge Functions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!syncStatus?.folderPath ? (
            <div className="text-center py-8">
              <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium mb-2">No folder selected</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a local folder to start syncing your Edge Functions
              </p>
              <Button 
                onClick={handleSelectFolder} 
                disabled={!hasFileSystemSupport || isLoading}
              >
                <Folder className="h-4 w-4 mr-2" />
                Select Folder
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{syncStatus.folderPath}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{syncStatus.filesTracked} files tracked</span>
                      <span>•</span>
                      <span>{syncStatus.filesIgnored} ignored</span>
                      {syncStatus.pendingChanges > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-orange-600">
                            {syncStatus.pendingChanges} pending
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={syncStatus.isActive ? "default" : "secondary"}
                    className="gap-1"
                  >
                    {syncStatus.isActive ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {syncStatus.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectFolder}
                    disabled={isLoading}
                  >
                    Change
                  </Button>
                </div>
              </div>

              {/* Sync Controls */}
              <div className="flex items-center gap-2">
                {!syncStatus.isActive ? (
                  <Button 
                    onClick={handleStartSync} 
                    disabled={isLoading}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Sync
                  </Button>
                ) : (
                  <Button 
                    onClick={handleStopSync} 
                    variant="outline"
                    className="gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Stop Sync
                  </Button>
                )}
                <Button
                  onClick={handleManualSync}
                  disabled={isLoading}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  Manual Sync
                </Button>
              </div>

              {/* Sync Status */}
              {syncStatus.lastSync && (
                <div className="text-sm text-muted-foreground">
                  Last sync: {formatDate(syncStatus.lastSync)}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conflicts */}
      {syncStatus && syncStatus.conflicts.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              Sync Conflicts ({syncStatus.conflicts.length})
            </CardTitle>
            <CardDescription>
              The following files have conflicts that need to be resolved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncStatus.conflicts.map((conflict, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="font-medium">{conflict.path}</p>
                      <p className="text-sm text-muted-foreground">
                        Local: {formatDate(conflict.localModified)} • 
                        Remote: {formatDate(conflict.remoteModified)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleResolveConflict(conflict)}
                    size="sm"
                    variant="outline"
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                  {activity}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Resolve Conflict: {selectedConflict?.path}</DialogTitle>
          </DialogHeader>
          
          {selectedConflict && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 max-h-96 overflow-hidden">
                <div className="space-y-2">
                  <Label>Local Version</Label>
                  <div className="text-sm text-muted-foreground">
                    Modified: {formatDate(selectedConflict.localModified)}
                  </div>
                  <Textarea
                    value={selectedConflict.localContent || ''}
                    readOnly
                    className="h-64 font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remote Version</Label>
                  <div className="text-sm text-muted-foreground">
                    Modified: {formatDate(selectedConflict.remoteModified)}
                  </div>
                  <Textarea
                    value={selectedConflict.remoteContent || ''}
                    readOnly
                    className="h-64 font-mono text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Merged Version (Edit if needed)</Label>
                <Textarea
                  value={mergedContent}
                  onChange={(e) => setMergedContent(e.target.value)}
                  className="h-32 font-mono text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConflictDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => handleConflictResolution('local')}
              disabled={isLoading}
              variant="outline"
            >
              Use Local
            </Button>
            <Button 
              onClick={() => handleConflictResolution('remote')}
              disabled={isLoading}
              variant="outline"
            >
              Use Remote
            </Button>
            <Button 
              onClick={() => handleConflictResolution('merge')}
              disabled={isLoading}
            >
              Use Merged
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sync Direction</Label>
              <Select 
                value={syncConfig.direction} 
                onValueChange={(value: 'upload' | 'download' | 'bidirectional') => 
                  setSyncConfig(prev => ({ ...prev, direction: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload">Upload Only (Local → Remote)</SelectItem>
                  <SelectItem value="download">Download Only (Remote → Local)</SelectItem>
                  <SelectItem value="bidirectional">Bidirectional (Both ways)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="auto-sync"
                checked={syncConfig.autoSync}
                onCheckedChange={(checked) => 
                  setSyncConfig(prev => ({ ...prev, autoSync: checked }))
                }
              />
              <Label htmlFor="auto-sync">Enable automatic sync</Label>
            </div>

            <div className="space-y-2">
              <Label>Conflict Resolution Strategy</Label>
              <Select 
                value={syncConfig.conflictStrategy} 
                onValueChange={(value: 'local' | 'remote' | 'prompt') => 
                  setSyncConfig(prev => ({ ...prev, conflictStrategy: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prompt">Prompt for resolution</SelectItem>
                  <SelectItem value="local">Always prefer local</SelectItem>
                  <SelectItem value="remote">Always prefer remote</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ignore Patterns (.gitignore style)</Label>
              <Textarea
                value={ignorePatterns}
                onChange={(e) => setIgnorePatterns(e.target.value)}
                placeholder="node_modules/**&#10;.git/**&#10;*.log"
                className="h-32 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                One pattern per line. Use ** for any path, * for any name.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}