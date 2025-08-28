import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Code2, 
  Play, 
  Settings, 
  Upload, 
  Folder,
  Terminal,
  FileCode,
  Zap
} from 'lucide-react';
import { FileExplorer } from '@/components/edge-functions/FileExplorer';
import { CodeEditor } from '@/components/edge-functions/CodeEditor';
import { DeploymentPanel } from '@/components/edge-functions/DeploymentPanel';
import { FolderSync } from '@/components/edge-functions/FolderSync';
import { DevTools } from '@/components/edge-functions/DevTools';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';

interface EdgeFunction {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  isDeployed: boolean;
}

export function EdgeFunctions() {
  const [functions, setFunctions] = useState<EdgeFunction[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFunctions();
  }, []);

  const loadFunctions = async () => {
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
      
      // List all files in the 'edge-functions' directory
      const files = await vfsManager.listFiles({ 
        directory: 'edge-functions', 
        recursive: true 
      });
      
      // Convert to EdgeFunction interface
      const edgeFunctions: EdgeFunction[] = files.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        lastModified: file.updatedAt,
        isDeployed: false // TODO: Check deployment status
      }));

      setFunctions(edgeFunctions);
    } catch (error) {
      console.error('Failed to load Edge Functions:', error);
      toast.error('Failed to load Edge Functions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    setActiveTab('editor');
  };

  const createNewFunction = async () => {
    try {
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);
      
      // Create a default Edge Function template
      const functionName = 'new-function';
      const functionPath = `edge-functions/${functionName}/index.ts`;
      const templateContent = `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const data = {
    message: "Hello from ${functionName}!",
    timestamp: new Date().toISOString(),
  };
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
});
`;

      await vfsManager.createFile(functionPath, templateContent, {
        mimeType: 'text/typescript'
      });

      toast.success(`Created new function: ${functionName}`);
      await loadFunctions();
      setSelectedFile(functionPath);
    } catch (error) {
      console.error('Failed to create function:', error);
      toast.error('Failed to create new function');
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
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6" />
            <h1 className="text-3xl font-bold">Edge Functions</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={createNewFunction} className="gap-2">
              <FileCode className="h-4 w-4" />
              New Function
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground mt-2">
          Develop and deploy serverless Edge Functions with full TypeScript support and Deno runtime.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="p-6 border-b">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Functions</p>
                  <p className="text-2xl font-bold">{functions.length}</p>
                </div>
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deployed</p>
                  <p className="text-2xl font-bold">
                    {functions.filter(f => f.isDeployed).length}
                  </p>
                </div>
                <Play className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-2xl font-bold">
                    {formatFileSize(functions.reduce((sum, f) => sum + f.size, 0))}
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
                  <p className="text-sm text-muted-foreground">Runtime</p>
                  <p className="text-2xl font-bold">Deno</p>
                </div>
                <Settings className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Explorer */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-medium">Functions</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            <FileExplorer
              functions={functions}
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onRefresh={loadFunctions}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="border-b px-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="editor" className="gap-2">
                  <Code2 className="h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="deploy" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Deploy
                </TabsTrigger>
                <TabsTrigger value="sync" className="gap-2">
                  <Folder className="h-4 w-4" />
                  Sync
                </TabsTrigger>
                <TabsTrigger value="logs" className="gap-2">
                  <Terminal className="h-4 w-4" />
                  Logs
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1">
              <TabsContent value="editor" className="h-full m-0">
                <CodeEditor
                  selectedFile={selectedFile}
                  onFileChange={loadFunctions}
                />
              </TabsContent>

              <TabsContent value="deploy" className="h-full m-0">
                <DeploymentPanel
                  functions={functions}
                  onRefresh={loadFunctions}
                />
              </TabsContent>

              <TabsContent value="sync" className="h-full m-0">
                <FolderSync onRefresh={loadFunctions} />
              </TabsContent>

              <TabsContent value="logs" className="h-full m-0">
                <DevTools functions={functions} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}