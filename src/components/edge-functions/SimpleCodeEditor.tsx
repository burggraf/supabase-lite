import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';
import * as monaco from 'monaco-editor';

interface SimpleCodeEditorProps {
  selectedFile: string | null;
  onFileChange?: () => void;
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

export const SimpleCodeEditor: React.FC<SimpleCodeEditorProps> = ({
  selectedFile,
  onFileChange,
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (selectedFile) {
      loadFile(selectedFile);
    } else {
      setContent('');
      setOriginalContent('');
      setIsDirty(false);
    }
  }, [selectedFile]);

  const loadFile = async (filePath: string) => {
    try {
      setLoading(true);
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) return;

      await vfsManager.initialize(activeProject.id);
      const file = await vfsManager.readFile(filePath);
      const fileContent = file.content || '';
      
      setContent(fileContent);
      setOriginalContent(fileContent);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to load file:', error);
      toast.error('Failed to load file');
      setContent('');
      setOriginalContent('');
      setIsDirty(false);
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async (fileContent: string) => {
    if (!selectedFile) return;

    try {
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) return;

      await vfsManager.initialize(activeProject.id);
      await vfsManager.updateFile(selectedFile, fileContent);
      
      setOriginalContent(fileContent);
      setIsDirty(false);
      onFileChange?.();
    } catch (error) {
      console.error('Failed to save file:', error);
      toast.error('Failed to save file');
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setContent(newContent);
    
    const dirty = newContent !== originalContent;
    setIsDirty(dirty);

    // Auto-save after 2 seconds of inactivity
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    if (dirty) {
      saveTimeoutRef.current = setTimeout(() => {
        saveFile(newContent);
      }, 2000);
    }
  };

  const handleManualSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveFile(content);
  };

  const handleRevert = () => {
    setContent(originalContent);
    setIsDirty(false);
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Configure TypeScript for Edge Functions
    const fileName = selectedFile?.split('/').pop() || 'index.ts';
    if (fileName.endsWith('.ts')) {
      // Add Deno and Edge Functions type definitions
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        `
        declare namespace Deno {
          export function serve(handler: (req: Request) => Response | Promise<Response>): void;
          export namespace env {
            export function get(key: string): string | undefined;
          }
        }
        `,
        'file:///lib.deno.d.ts'
      );
    }

    // Keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleManualSave();
    });
  };

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">📝</div>
          <h3 className="text-lg font-medium mb-2">No file selected</h3>
          <p className="text-sm">Select a file from the file explorer to start editing</p>
        </div>
      </div>
    );
  }

  const fileName = selectedFile.split('/').pop() || '';
  const language = getLanguageFromFileName(fileName);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* File Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-sm text-gray-900">{fileName}</span>
          {isDirty && <span className="w-2 h-2 bg-orange-500 rounded-full" title="Unsaved changes" />}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevert}
            disabled={!isDirty}
            title="Revert changes"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualSave}
            disabled={!isDirty}
            title="Save (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            value={content}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            theme="vs-light"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              lineNumbers: 'on',
              rulers: [80],
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              fixedOverflowWidgets: true,
              suggest: {
                showKeywords: true,
                showSnippets: true,
              },
              quickSuggestions: {
                other: true,
                comments: true,
                strings: true,
              },
            }}
          />
        )}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-1 border-t bg-gray-50 text-xs text-gray-600 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span>{language}</span>
          <span>{content.split('\n').length} lines</span>
        </div>
        <div className="flex items-center space-x-2">
          {isDirty && <span className="text-orange-600">Auto-saving...</span>}
        </div>
      </div>
    </div>
  );
};