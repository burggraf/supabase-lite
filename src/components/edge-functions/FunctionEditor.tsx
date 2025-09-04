import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
// Card imports removed - not used in this component
import { ChevronLeft, ChevronDown, Bot, FileText, Plus } from 'lucide-react';
import { SimpleCodeEditor } from './SimpleCodeEditor';
import NetworkRequirementsAnalyzer from './NetworkRequirementsAnalyzer';
import { templates } from './FunctionTemplates';
import { vfsManager } from '../../lib/vfs/VFSManager';
import { projectManager } from '../../lib/projects/ProjectManager';
import { WebVMManager } from '../../lib/webvm/WebVMManager';
import { toast } from 'sonner';

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
  const [currentCode, setCurrentCode] = useState('');

  useEffect(() => {
    loadFunctionFiles();
  }, [functionName]);

  // Load template code when template changes
  const loadTemplate = (templateId: string) => {
    const templateObj = templates.find(t => t.id === templateId);
    if (templateObj) {
      setCurrentCode(templateObj.code);
      toast.success(`Loaded ${templateObj.name} template`);
    }
  };

  const loadFunctionFiles = async () => {
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
  };

  const buildFileTree = (files: any[], _basePath: string): FileNode[] => {
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
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      // Get the main function file (index.ts or similar)
      const mainFilePath = `edge-functions/${currentFunctionName}/index.ts`;
      
      try {
        // Get function code from VFS
        const file = await vfsManager.readFile(mainFilePath);
        const functionCode = file?.content;
        
        if (!functionCode) {
          toast.error(`Function file not found at ${mainFilePath}`);
          return;
        }
        
        // Get WebVMManager and deploy the function
        const webvmManager = WebVMManager.getInstance();
        
        // Check if WebVM is running
        if (webvmManager.getStatus().state !== 'running') {
          toast.error('WebVM is not running. Please start WebVM first.');
          return;
        }
        
        // Deploy to WebVM
        const deployment = await webvmManager.deployFunction(currentFunctionName, functionCode);
        
        if (deployment.success) {
          toast.success(`Function "${currentFunctionName}" deployed successfully to WebVM!`);
        } else {
          toast.error(`Deployment failed: ${deployment.error}`);
        }
        
      } catch (vfsError) {
        console.error('Failed to read function code:', vfsError);
        toast.error(`Failed to read function code from ${mainFilePath}`);
      }
      
    } catch (error) {
      console.error('Failed to deploy function:', error);
      toast.error('Failed to deploy function');
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
              <optgroup label="Networking Tests">
                <option value="external-api-test">🌐 External API Test</option>
                <option value="network-health-check">🏥 Network Health Check</option>
                <option value="api-playground">🎮 API Playground</option>
              </optgroup>
              <optgroup label="Frameworks & APIs">
                <option value="node-api">Node Built-in API</option>
                <option value="express">Express Server</option>
                <option value="openai-completion">OpenAI Text Completion</option>
                <option value="stripe-webhook">Stripe Webhook</option>
                <option value="resend-email">Send Emails</option>
              </optgroup>
              <optgroup label="Advanced">
                <option value="image-transform">Image Transformation</option>
                <option value="websocket-server">WebSocket Server</option>
              </optgroup>
            </select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadTemplate(template)}
              disabled={template === 'hello-world'}
              className="text-xs"
            >
              <FileText className="w-3 w-3 mr-1" />
              Load Template
            </Button>
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
            onCodeChange={setCurrentCode}
          />
        </div>

        {/* Right Panel - Network Requirements */}
        <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="p-4">
            <NetworkRequirementsAnalyzer
              functionCode={currentCode}
              functionName={currentFunctionName}
            />
          </div>
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
          >
            Deploy function
          </Button>
        </div>
      </div>
    </div>
  );
};