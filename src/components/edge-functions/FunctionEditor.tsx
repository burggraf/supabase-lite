import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
// Card imports removed - not used in this component
import { ChevronLeft, ChevronDown, Bot, FileText, Plus } from 'lucide-react';
import { SimpleCodeEditor } from './SimpleCodeEditor';
import { vfsManager } from '../../lib/vfs/VFSManager';
import { projectManager } from '../../lib/projects/ProjectManager';
import { toast } from 'sonner';
import { edgeFunctionsWebvmManager, EDGE_FUNCTIONS_VM_ROOT } from '@/lib/webvm';
import { encodeStringToBase64, escapeShellArg, writeBase64FileToWebVM } from '@/lib/webvm/fileTransfer';

interface FunctionEditorProps {
  functionName: string;
  onBack: () => void;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export const FunctionEditor: React.FC<FunctionEditorProps> = ({
  functionName,
  onBack,
}) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentFunctionName, setCurrentFunctionName] = useState(functionName);
  const [template, setTemplate] = useState('hello-world');
  const [loading, setLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);

  const loadFunctionFiles = useCallback(async () => {
    try {
      setLoading(true);
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) return;

      await vfsManager.initialize(activeProject.id);
      
      const functionDir = `edge-functions/${functionName}`;
      const allFiles = await vfsManager.listFiles({ directory: functionDir, recursive: true });
      
      // Build file tree
      const tree = buildFileTree(allFiles, functionDir);
      setFiles(tree);
      
      // Auto-select index.ts if it exists
      const indexFile = allFiles.find(f => f.name === 'index.ts');
      if (indexFile) {
        setSelectedFile(indexFile.path);
      } else if (allFiles.length > 0) {
        setSelectedFile(allFiles[0].path);
      }
    } catch (error) {
      console.error('Failed to load function files:', error);
      toast.error('Failed to load function files');
    } finally {
      setLoading(false);
    }
  }, [functionName]);

  useEffect(() => {
    loadFunctionFiles();
  }, [functionName, loadFunctionFiles]);

  const buildFileTree = (files: unknown[], _basePath: string): FileNode[] => {
    const tree: FileNode[] = [];
    
    files.forEach(file => {
      if (file.type === 'file') {
        tree.push({
          name: file.name,
          path: file.path,
          type: 'file',
        });
      }
    });
    
    return tree.sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  };

  const handleAddFile = async () => {
    const fileName = prompt('Enter file name:');
    if (!fileName) return;

    try {
      const filePath = `edge-functions/${functionName}/${fileName}`;
      await vfsManager.createFile(filePath, { content: '', mimeType: 'text/plain' });
      await loadFunctionFiles();
      setSelectedFile(filePath);
      toast.success(`Created file: ${fileName}`);
    } catch (error) {
      console.error('Failed to create file:', error);
      toast.error('Failed to create file');
    }
  };

  const handleDeploy = async () => {
    try {
      setIsDeploying(true);

      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);

      const functionDirectory = `edge-functions/${functionName}`;
      const filesToDeploy = await vfsManager.listFiles({ directory: functionDirectory, recursive: true });

      if (!filesToDeploy || filesToDeploy.length === 0) {
        toast.error('No function files found to deploy');
        return;
      }

      const instance = await edgeFunctionsWebvmManager.ensureStarted();
      const deploymentRoot = `${EDGE_FUNCTIONS_VM_ROOT}/${currentFunctionName}`;

      await instance.runShellCommand(`rm -rf ${escapeShellArg(deploymentRoot)} 2>/dev/null || true`);
      await instance.runShellCommand(`mkdir -p ${escapeShellArg(deploymentRoot)}`);

      for (const file of filesToDeploy) {
        const relativePath = file.path.slice(functionDirectory.length + 1);
        if (!relativePath) {
          continue;
        }

        const targetPath = `${deploymentRoot}/${relativePath}`;
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

      await instance.runShellCommand(`find ${escapeShellArg(deploymentRoot)} -type d -empty -delete 2>/dev/null || true`);
      await instance.runShellCommand('sync');

      toast.success(`Function "${currentFunctionName}" deployed to Edge Functions runtime`);
    } catch (error) {
      console.error('Failed to deploy function:', error);
      toast.error('Failed to deploy function');
    } finally {
      setIsDeploying(false);
    }
  };

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.path} style={{ paddingLeft: `${level * 12}px` }}>
        <div
          className={`flex items-center py-1 px-2 text-sm cursor-pointer hover:bg-gray-100 rounded ${
            selectedFile === node.path ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
          }`}
          onClick={() => node.type === 'file' && setSelectedFile(node.path)}
        >
          {node.type === 'directory' ? (
            <ChevronDown className="w-4 h-4 mr-1" />
          ) : (
            <FileText className="w-4 h-4 mr-2 text-gray-500" />
          )}
          <span>{node.name}</span>
        </div>
        {node.children && renderFileTree(node.children, level + 1)}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading function...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-gray-200 px-6 py-4">
        <nav className="flex items-center space-x-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Edge Functions
          </Button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900">Create new edge function</span>
        </nav>
      </div>

      {/* Top Bar */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="hello-world">Templates</option>
              <option value="database-access">Database Access</option>
              <option value="storage-upload">Storage Upload</option>
            </select>
          </div>
          <Button variant="outline" size="sm">
            <Bot className="w-4 h-4 mr-2" />
            Chat
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Files */}
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Files</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFile}
                className="text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add File
              </Button>
            </div>
          </div>
          <div className="p-2">
            {files.length > 0 ? (
              renderFileTree(files)
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No files found</p>
              </div>
            )}
          </div>
        </div>

        {/* Center Panel - Code Editor */}
        <div className="flex-1 flex flex-col">
          <SimpleCodeEditor
            selectedFile={selectedFile}
            onFileChange={loadFunctionFiles}
          />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-sm">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Function name
            </label>
            <Input
              value={currentFunctionName}
              onChange={(e) => setCurrentFunctionName(e.target.value)}
              placeholder="function-name"
              className="font-mono text-sm"
            />
          </div>
          <Button
            onClick={handleDeploy}
            className="bg-green-600 hover:bg-green-700 ml-4"
            disabled={isDeploying}
          >
            {isDeploying ? 'Deploying…' : 'Deploy function'}
          </Button>
        </div>
      </div>
    </div>
  );
};
