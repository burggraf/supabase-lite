import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown,
  File, 
  Folder, 
  FolderOpen,
  Plus,
  Search,
  MoreVertical,
  FileText,
  Code2,
  Trash2,
  Edit3,
  Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EdgeFunction {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  isDeployed: boolean;
}

interface FileExplorerProps {
  functions: EdgeFunction[];
  selectedFile: string | null;
  onFileSelect: (filePath: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  size?: number;
  lastModified?: Date;
  isExpanded?: boolean;
}

export function FileExplorer({ 
  functions, 
  selectedFile, 
  onFileSelect, 
  onRefresh, 
  isLoading 
}: FileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['edge-functions']));
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [contextMenuPath, setContextMenuPath] = useState('');

  // Build tree structure from flat list of functions
  const buildTree = (functions: EdgeFunction[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Create root node
    const rootNode: TreeNode = {
      name: 'edge-functions',
      path: 'edge-functions',
      type: 'folder',
      children: [],
      isExpanded: expandedFolders.has('edge-functions')
    };
    tree.push(rootNode);
    nodeMap.set('edge-functions', rootNode);

    functions.forEach(func => {
      const parts = func.path.split('/').slice(1); // Remove 'edge-functions' prefix
      let currentPath = 'edge-functions';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = parentPath + '/' + part;
        
        if (!nodeMap.has(currentPath)) {
          const isFile = index === parts.length - 1;
          const node: TreeNode = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            size: isFile ? func.size : undefined,
            lastModified: isFile ? func.lastModified : undefined,
            isExpanded: expandedFolders.has(currentPath)
          };

          const parentNode = nodeMap.get(parentPath);
          if (parentNode && parentNode.children) {
            parentNode.children.push(node);
          }
          nodeMap.set(currentPath, node);
        }
      });
    });

    // Sort children: folders first, then files, both alphabetically
    const sortChildren = (node: TreeNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };
    tree.forEach(sortChildren);

    return tree;
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (['ts', 'js'].includes(ext || '')) {
      return <Code2 className="h-4 w-4 text-blue-600" />;
    }
    if (['json', 'md', 'txt'].includes(ext || '')) {
      return <FileText className="h-4 w-4 text-gray-600" />;
    }
    
    return <File className="h-4 w-4 text-gray-600" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleCreateFile = async () => {
    try {
      if (!newFileName.trim()) {
        toast.error('Please enter a file name');
        return;
      }

      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);

      // Determine the parent path for new file
      const parentPath = contextMenuPath || 'edge-functions';
      const fileName = newFileName.endsWith('.ts') ? newFileName : `${newFileName}.ts`;
      const filePath = `${parentPath}/${fileName}`;

      // Create default template for new Edge Function
      const templateContent = `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const data = {
    message: "Hello from ${newFileName}!",
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

      await vfsManager.createFile(filePath, templateContent, {
        mimeType: 'text/typescript'
      });

      toast.success(`Created ${fileName}`);
      setShowNewFileDialog(false);
      setNewFileName('');
      setContextMenuPath('');
      onRefresh();
    } catch (error) {
      console.error('Failed to create file:', error);
      toast.error('Failed to create file');
    }
  };

  const handleCreateFolder = async () => {
    try {
      if (!newFolderName.trim()) {
        toast.error('Please enter a folder name');
        return;
      }

      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);

      // Create a placeholder file to ensure folder exists
      const parentPath = contextMenuPath || 'edge-functions';
      const folderPath = `${parentPath}/${newFolderName.trim()}`;
      const placeholderPath = `${folderPath}/.gitkeep`;

      await vfsManager.createFile(placeholderPath, '', {
        mimeType: 'text/plain'
      });

      toast.success(`Created folder ${newFolderName}`);
      setShowNewFolderDialog(false);
      setNewFolderName('');
      setContextMenuPath('');
      
      // Expand the parent folder to show the new folder
      setExpandedFolders(prev => new Set(prev).add(parentPath));
      onRefresh();
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleDeleteFile = async (filePath: string) => {
    try {
      if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
        return;
      }

      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);
      await vfsManager.deleteFile(filePath);

      toast.success('File deleted successfully');
      onRefresh();
    } catch (error) {
      console.error('Failed to delete file:', error);
      toast.error('Failed to delete file');
    }
  };

  const filteredTree = (nodes: TreeNode[]): TreeNode[] => {
    if (!searchQuery) return nodes;

    const filterNode = (node: TreeNode): TreeNode | null => {
      const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (node.type === 'file') {
        return matchesSearch ? node : null;
      }

      // For folders, include if any children match
      const filteredChildren = node.children?.map(filterNode).filter(Boolean) as TreeNode[] || [];
      
      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
          isExpanded: true // Expand folders when searching
        };
      }

      return null;
    };

    return nodes.map(filterNode).filter(Boolean) as TreeNode[];
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isSelected = selectedFile === node.path;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center gap-1 py-1 px-2 rounded text-sm cursor-pointer hover:bg-accent transition-colors",
            isSelected && "bg-accent font-medium",
            depth > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          onClick={() => {
            if (node.type === 'file') {
              onFileSelect(node.path);
            } else {
              toggleFolder(node.path);
            }
          }}
        >
          {node.type === 'folder' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.path);
              }}
              className="p-0.5 hover:bg-accent-foreground/10 rounded"
            >
              {node.isExpanded || expandedFolders.has(node.path) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {node.type === 'folder' ? (
              node.isExpanded || expandedFolders.has(node.path) ? (
                <FolderOpen className="h-4 w-4 text-blue-600 flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 text-blue-600 flex-shrink-0" />
              )
            ) : (
              getFileIcon(node.name)
            )}
            
            <span className="truncate">{node.name}</span>
            
            {node.type === 'file' && node.size && (
              <span className="text-xs text-muted-foreground ml-auto">
                {formatFileSize(node.size)}
              </span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {node.type === 'folder' && (
                <>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenuPath(node.path);
                      setShowNewFileDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New File
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenuPath(node.path);
                      setShowNewFolderDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(node.path)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Path
              </DropdownMenuItem>
              {node.type === 'file' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => handleDeleteFile(node.path)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {node.type === 'folder' && 
         (node.isExpanded || expandedFolders.has(node.path)) && 
         hasChildren && (
          <div>
            {node.children!.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(functions);
  const displayTree = filteredTree(tree);

  return (
    <div className="flex flex-col h-full">
      {/* Search and Actions */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search functions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setContextMenuPath('edge-functions');
              setShowNewFileDialog(true);
            }}
            className="flex-1 h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            File
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setContextMenuPath('edge-functions');
              setShowNewFolderDialog(true);
            }}
            className="flex-1 h-8"
          >
            <Plus className="h-3 w-3 mr-1" />
            Folder
          </Button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        ) : displayTree.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {searchQuery ? 'No functions found' : 'No Edge Functions yet'}
          </div>
        ) : (
          <div className="p-2 space-y-0.5 group">
            {displayTree.map(node => renderTreeNode(node))}
          </div>
        )}
      </div>

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Function</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fileName">Function Name</Label>
              <Input
                id="fileName"
                placeholder="my-function"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFile()}
              />
              <p className="text-xs text-muted-foreground">
                Will create {newFileName.endsWith('.ts') ? newFileName : `${newFileName}.ts`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile} disabled={!newFileName.trim()}>
              Create Function
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                placeholder="utils"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}