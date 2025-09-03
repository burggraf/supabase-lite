import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Upload, 
  FileArchive, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Trash2,
  RefreshCw,
  Database,
  HardDrive
} from 'lucide-react';
import { useDatabase } from '@/hooks/useDatabase';
import { dbManager } from '@/lib/database/connection';
import { DatabaseManager } from '@/lib/database/connection';
import { projectManager } from '@/lib/projects/ProjectManager';
import { 
  downloadFile, 
  generateBackupFilename, 
  formatFileSize,
  readUploadedFile,
  validateBackupFile,
  storeBackupHistory,
  getBackupHistory,
  clearBackupHistory,
  type BackupFile
} from '@/lib/utils/fileUtils';
import { cn } from '@/lib/utils';

export function BackupsSection() {
  const { isConnected } = useDatabase();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupHistory, setBackupHistory] = useState<BackupFile[]>(getBackupHistory());
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentProject = projectManager.getActiveProject();

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleBackup = async () => {
    if (!isConnected || !currentProject) {
      showMessage('error', 'No database connection or active project found.');
      return;
    }

    try {
      setIsBackingUp(true);
      
      // Create backup using DatabaseManager
      const backupBlob = await dbManager.backupDatabase('gzip');
      
      // Generate filename
      const filename = generateBackupFilename(currentProject.name);
      
      // Download the backup file
      downloadFile(backupBlob, filename);
      
      // Store backup metadata
      const backupInfo: BackupFile = {
        name: filename,
        size: backupBlob.size,
        createdAt: new Date(),
        projectName: currentProject.name
      };
      
      storeBackupHistory(backupInfo);
      setBackupHistory(getBackupHistory());
      
      showMessage('success', `Backup created successfully: ${filename}`);
    } catch (error) {
      console.error('Backup failed:', error);
      showMessage('error', `Backup failed: ${(error as Error).message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (file: File) => {
    try {
      setIsRestoring(true);
      
      // Validate the file
      const validation = validateBackupFile(file);
      if (!validation.valid) {
        showMessage('error', validation.error!);
        return;
      }

      // Read the backup file
      const backupBlob = await readUploadedFile(file);
      
      // Create a new project for the restored database
      const restoreProjectName = `Restored from ${file.name}`;
      const newProject = await projectManager.createProject(restoreProjectName);
      
      // Restore the database
      await DatabaseManager.restoreDatabase(backupBlob, newProject.databasePath);
      
      // Switch to the restored project
      await projectManager.switchToProject(newProject.id);
      
      // Reinitialize the database manager with the restored project
      await dbManager.initialize(newProject.databasePath);
      
      showMessage('success', `Database restored successfully as project: ${restoreProjectName}`);
    } catch (error) {
      console.error('Restore failed:', error);
      showMessage('error', `Restore failed: ${(error as Error).message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleRestore(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleRestore(e.target.files[0]);
    }
  };

  const refreshHistory = () => {
    setBackupHistory(getBackupHistory());
  };

  const clearHistory = () => {
    clearBackupHistory();
    setBackupHistory([]);
    showMessage('info', 'Backup history cleared.');
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Database Backups</h1>
          <p className="text-muted-foreground mt-1">
            Create and restore database backups for your projects
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {currentProject && (
            <Badge variant="outline" className="flex items-center space-x-1">
              <Database className="h-3 w-3" />
              <span>{currentProject.name}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={cn(
          "p-4 rounded-lg border",
          message.type === 'success' && "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300",
          message.type === 'error' && "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300",
          message.type === 'info' && "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
        )}>
          <div className="flex items-start space-x-2">
            {message.type === 'success' && <CheckCircle className="h-5 w-5 mt-0.5" />}
            {message.type === 'error' && <AlertTriangle className="h-5 w-5 mt-0.5" />}
            {message.type === 'info' && <Database className="h-5 w-5 mt-0.5" />}
            <span className="text-sm">{message.text}</span>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Create Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Download className="h-5 w-5" />
              <span>Create Backup</span>
            </CardTitle>
            <CardDescription>
              Export your current database to a compressed backup file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-start space-x-3">
                <HardDrive className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">What gets backed up:</p>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    <li>• All tables and data</li>
                    <li>• Database schema and structure</li>
                    <li>• Indexes, constraints, and triggers</li>
                    <li>• User-defined functions and types</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleBackup}
              disabled={!isConnected || !currentProject || isBackingUp}
              className="w-full"
            >
              {isBackingUp ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Create Backup
                </>
              )}
            </Button>

            {!currentProject && (
              <p className="text-sm text-muted-foreground text-center">
                No active project. Create or select a project first.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Restore Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Restore Backup</span>
            </CardTitle>
            <CardDescription>
              Import a database backup file to create a new project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  <p className="font-medium">Important:</p>
                  <p>Restoring will create a new project. Your current data won't be affected.</p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-muted-foreground/50",
                isRestoring && "opacity-50 pointer-events-none"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {isRestoring ? (
                <div className="space-y-2">
                  <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Restoring backup...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <FileArchive className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Drop a backup file here</p>
                    <p className="text-xs text-muted-foreground">or click to select</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleFileSelect}>
                    <Upload className="h-4 w-4 mr-2" />
                    Select File
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".tgz,.tar.gz,.tar"
              onChange={handleFileChange}
              className="hidden"
            />
          </CardContent>
        </Card>
      </div>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Recent Backups</span>
              </CardTitle>
              <CardDescription>
                History of recently created backup files
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={refreshHistory}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={clearHistory}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {backupHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileArchive className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No backups found</p>
              <p className="text-sm">Create your first backup to see it listed here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backupHistory.map((backup, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileArchive className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{backup.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Project: {backup.projectName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{formatFileSize(backup.size)}</p>
                    <p>{backup.createdAt.toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}