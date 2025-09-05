import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  X, 
  Plus,
  Code2,
  FileText,
  RotateCcw
} from 'lucide-react';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  selectedFile: string | null;
  onFileChange?: () => void;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
  originalContent: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.js': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.txt': 'plaintext',
  '.html': 'html',
  '.css': 'css',
  '.sql': 'sql'
};

const getLanguageFromFileName = (fileName: string): string => {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  return LANGUAGE_MAP[ext] || 'plaintext';
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (['ts', 'js'].includes(ext || '')) {
    return <Code2 className="h-3 w-3" />;
  }
  if (['json', 'md', 'txt', 'html', 'css'].includes(ext || '')) {
    return <FileText className="h-3 w-3" />;
  }
  
  return <FileText className="h-3 w-3" />;
};

export function CodeEditor({ selectedFile, onFileChange }: CodeEditorProps) {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load file function
  const loadFile = useCallback(async (filePath: string) => {
    try {
      setIsLoading(true);

      // Check if file is already open
      const existingIndex = openFiles.findIndex(f => f.path === filePath);
      if (existingIndex >= 0) {
        setActiveFileIndex(existingIndex);
        return;
      }

      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);
      const file = await vfsManager.readFile(filePath);
      
      if (!file) {
        toast.error('File not found');
        return;
      }

      const fileName = file.path.split('/').pop() || 'untitled';
      const language = getLanguageFromFileName(fileName);

      const openFile: OpenFile = {
        path: filePath,
        name: fileName,
        content: file.content || '',
        language,
        isDirty: false,
        originalContent: file.content || ''
      };

      const newOpenFiles = [...openFiles, openFile];
      setOpenFiles(newOpenFiles);
      setActiveFileIndex(newOpenFiles.length - 1);
    } catch (error) {
      console.error('Failed to load file:', error);
      toast.error('Failed to load file');
    } finally {
      setIsLoading(false);
    }
  }, [openFiles]);

  // Load file content when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      loadFile(selectedFile);
    }
  }, [selectedFile, loadFile]);

  // Save file function  
  const handleSaveFile = async (fileIndex: number) => {
    try {
      const file = openFiles[fileIndex];
      if (!file || !file.isDirty) return;

      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);
      await vfsManager.updateFile(file.path, file.content);

      // Update the file as clean
      setOpenFiles(prev => prev.map((f, i) => 
        i === fileIndex 
          ? { ...f, isDirty: false, originalContent: f.content }
          : f
      ));

      toast.success(`Saved ${file.name}`);
      onFileChange?.();
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error(`Failed to save ${openFiles[fileIndex]?.name}`);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && activeFileIndex >= 0) {
      const activeFile = openFiles[activeFileIndex];
      if (activeFile?.isDirty) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        
        autoSaveTimeoutRef.current = setTimeout(() => {
          handleSaveFile(activeFileIndex);
        }, 2000);
      }
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [openFiles, activeFileIndex, autoSave, handleSaveFile]);

  const handleSaveAllFiles = async () => {
    const dirtyFiles = openFiles
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.isDirty);

    if (dirtyFiles.length === 0) {
      toast.info('No unsaved changes');
      return;
    }

    for (const { index } of dirtyFiles) {
      await handleSaveFile(index);
    }
  };

  const handleCloseFile = (fileIndex: number) => {
    const file = openFiles[fileIndex];
    
    if (file.isDirty) {
      const confirmed = confirm(`"${file.name}" has unsaved changes. Close anyway?`);
      if (!confirmed) return;
    }

    const newOpenFiles = openFiles.filter((_, i) => i !== fileIndex);
    setOpenFiles(newOpenFiles);

    // Adjust active file index
    if (fileIndex === activeFileIndex) {
      if (newOpenFiles.length === 0) {
        setActiveFileIndex(-1);
      } else if (fileIndex >= newOpenFiles.length) {
        setActiveFileIndex(newOpenFiles.length - 1);
      }
    } else if (fileIndex < activeFileIndex) {
      setActiveFileIndex(activeFileIndex - 1);
    }
  };

  const handleEditorChange = (value: string | undefined, fileIndex: number) => {
    if (value === undefined) return;

    setOpenFiles(prev => prev.map((file, i) => 
      i === fileIndex 
        ? { ...file, content: value, isDirty: value !== file.originalContent }
        : file
    ));
  };

  const handleResetFile = (fileIndex: number) => {
    const file = openFiles[fileIndex];
    if (!file.isDirty) return;

    const confirmed = confirm(`Reset "${file.name}" to last saved version?`);
    if (!confirmed) return;

    setOpenFiles(prev => prev.map((f, i) => 
      i === fileIndex 
        ? { ...f, content: f.originalContent, isDirty: false }
        : f
    ));

    // Update editor content if this is the active file
    if (fileIndex === activeFileIndex && editorRef.current) {
      editorRef.current.setValue(file.originalContent);
    }
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Configure editor settings
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 14,
      lineHeight: 20,
      tabSize: 2,
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: true,
      renderWhitespace: 'selection',
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible'
      }
    });

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFileIndex >= 0) {
        handleSaveFile(activeFileIndex);
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      handleSaveAllFiles();
    });
  };

  const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
  const dirtyFileCount = openFiles.filter(f => f.isDirty).length;

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="border-b">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Code Editor</h3>
            {dirtyFileCount > 0 && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                {dirtyFileCount} unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoSave(!autoSave)}
              className={cn(
                "text-xs",
                autoSave && "bg-green-50 text-green-700"
              )}
            >
              Auto-save {autoSave ? 'ON' : 'OFF'}
            </Button>
            {activeFile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSaveFile(activeFileIndex)}
                disabled={!activeFile.isDirty}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
            )}
            {dirtyFileCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSaveAllFiles}
              >
                Save All
              </Button>
            )}
          </div>
        </div>

        {/* File Tabs */}
        {openFiles.length > 0 && (
          <div className="flex overflow-x-auto">
            <Tabs value={activeFileIndex.toString()} onValueChange={(value) => setActiveFileIndex(parseInt(value))}>
              <TabsList className="h-auto p-0 bg-transparent border-0">
                {openFiles.map((file, index) => (
                  <TabsTrigger
                    key={file.path}
                    value={index.toString()}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-2 border-r data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none",
                      file.isDirty && "italic"
                    )}
                  >
                    {getFileIcon(file.name)}
                    <span className="text-xs">{file.name}</span>
                    {file.isDirty && <div className="w-1 h-1 bg-orange-500 rounded-full" />}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseFile(index);
                      }}
                      className="ml-1 hover:bg-accent-foreground/10 rounded p-0.5 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCloseFile(index);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </div>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}
      </div>

      {/* Editor Content */}
      <div className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : !activeFile ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Code2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No file selected</h3>
              <p className="text-muted-foreground mb-4">
                Select a file from the explorer to start editing
              </p>
              <Button variant="outline" onClick={() => {
                // Create a new file
                const newContent = `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const data = {
    message: "Hello from Edge Function!",
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
                const newFile: OpenFile = {
                  path: 'edge-functions/untitled.ts',
                  name: 'untitled.ts',
                  content: newContent,
                  language: 'typescript',
                  isDirty: true,
                  originalContent: ''
                };
                setOpenFiles([newFile]);
                setActiveFileIndex(0);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Function
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full relative overflow-auto">
            <Editor
              height="100%"
              language={activeFile.language}
              value={activeFile.content}
              onChange={(value) => handleEditorChange(value, activeFileIndex)}
              onMount={handleEditorDidMount}
              theme="vs-light"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 20,
                tabSize: 2,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: true,
                renderWhitespace: 'selection',
                bracketPairColorization: { enabled: true },
                suggest: {
                  showKeywords: true,
                  showSnippets: true
                }
              }}
            />
            
            {/* File Actions Overlay */}
            {activeFile.isDirty && (
              <div className="absolute top-2 right-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResetFile(activeFileIndex)}
                  className="bg-white/90 backdrop-blur-sm"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      {activeFile && (
        <div className="border-t px-4 py-2 bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>{activeFile.language}</span>
              <span>{activeFile.content.split('\n').length} lines</span>
              <span>{activeFile.content.length} characters</span>
            </div>
            <div className="flex items-center gap-2">
              {activeFile.isDirty ? (
                <span className="text-orange-600">Unsaved changes</span>
              ) : (
                <span className="text-green-600">Saved</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}