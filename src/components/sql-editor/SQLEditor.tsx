import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDatabase } from '@/hooks/useDatabase';
import { useSQLSnippets } from '@/hooks/useSQLSnippets';
import { Play, Save, Plus, X } from 'lucide-react';
import type { QueryResult, ScriptResult } from '@/types';


export function SQLEditor() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  
  // Split pane state - using fixed pixel heights instead of percentages
  const [editorHeight, setEditorHeight] = useState(400); // Fixed pixel height
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);
  
  const { executeQuery, executeScript } = useDatabase();
  const {
    tabs,
    activeTabId,
    snippets,
    createTab,
    closeTab,
    setActiveTab,
    updateTabQuery,
    updateTabName,
    saveSnippet,
    loadSnippet,
    deleteSnippet,
    getActiveTab
  } = useSQLSnippets();

  // Resizable split pane handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = editorHeight;
  }, [editorHeight]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const deltaY = e.clientY - dragStartY.current;
    const newHeight = dragStartHeight.current + deltaY;
    
    // Set minimum and maximum pixel heights
    const minHeight = 200;
    const maxHeight = window.innerHeight - 300; // Leave space for header and results
    
    const constrainedHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);
    setEditorHeight(constrainedHeight);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Trigger Monaco Editor layout recalculation after resize
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 100);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleExecuteQuery = async () => {
    const activeTab = getActiveTab();
    if (!activeTab?.query.trim()) return;
    
    const query = activeTab.query;

    setIsExecuting(true);
    setError(null);
    setResult(null);
    setScriptResult(null);

    try {
      // Detect if this is a multi-statement script by counting meaningful semicolons
      const statements = query.split(';').map(s => s.trim()).filter(s => s.length > 0);
      const isMultiStatement = statements.length > 1;

      if (isMultiStatement) {
        // Execute as script using exec method
        const scriptResult = await executeScript(query);
        setScriptResult(scriptResult);
      } else {
        // Execute as single query
        const result = await executeQuery(query);
        setResult(result);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Query execution failed';
      setError(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveQuery = () => {
    const activeTab = getActiveTab();
    if (activeTab) {
      saveSnippet(activeTab.id);
    }
  };
  
  const handleTabNameEdit = (tabId: string, currentName: string) => {
    setEditingTabId(tabId);
    setEditingTabName(currentName);
  };
  
  const handleTabNameSave = () => {
    if (editingTabId && editingTabName.trim()) {
      updateTabName(editingTabId, editingTabName.trim());
    }
    setEditingTabId(null);
    setEditingTabName('');
  };
  
  const handleTabNameCancel = () => {
    setEditingTabId(null);
    setEditingTabName('');
  };
  
  const handleQueryChange = (value: string | undefined) => {
    const activeTab = getActiveTab();
    if (activeTab) {
      updateTabQuery(activeTab.id, value || '');
    }
  };
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 't') {
      e.preventDefault();
      createTab();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
      e.preventDefault();
      const activeTab = getActiveTab();
      if (activeTab) {
        closeTab(activeTab.id);
      }
    }
  }, [createTab, closeTab, getActiveTab]);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const formatValue = (value: any): string => {
    if (value === null) return 'NULL';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="flex-1 flex flex-col h-full" ref={containerRef}>
      

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Saved Snippets */}
        <div className="w-80 border-r bg-white">
          <div className="h-full flex flex-col">
            <div className="px-4 border-b" style={{height: '38px', display: 'flex', alignItems: 'center'}}>
              <h3 className="font-medium text-sm text-gray-600 uppercase tracking-wide">
                Saved Snippets
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {snippets.length === 0 && (
                <div className="p-4">
                  <p className="text-sm text-gray-500">No saved snippets yet</p>
                </div>
              )}
              {snippets.map((snippet) => (
                <div
                  key={snippet.id}
                  className="px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors group"
                  onClick={() => loadSnippet(snippet.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium truncate flex-1">
                      {snippet.name}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSnippet(snippet.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs font-mono truncate mb-1 text-gray-600">
                    {snippet.query.split('\n')[0]}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(snippet.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs and Header */}
          <div className="bg-white">
            <div className="flex items-center justify-between px-4 border-b" style={{height: '38px'}}>
              <div className="flex items-center flex-1">
                <Tabs value={activeTabId} onValueChange={setActiveTab} className="flex-1">
                  <div className="flex items-center">
                    <TabsList className="h-8 p-0 bg-transparent">
                      {tabs.map((tab) => (
                        <div key={tab.id} className="flex items-center group relative">
                          <TabsTrigger 
                            value={tab.id} 
                            className="relative px-3 py-1 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                          >
                            {editingTabId === tab.id ? (
                              <input
                                className="w-24 px-1 py-0 text-xs border rounded"
                                value={editingTabName}
                                onChange={(e) => setEditingTabName(e.target.value)}
                                onBlur={handleTabNameSave}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleTabNameSave();
                                  if (e.key === 'Escape') handleTabNameCancel();
                                }}
                                autoFocus
                              />
                            ) : (
                              <span 
                                className="cursor-pointer"
                                onDoubleClick={() => handleTabNameEdit(tab.id, tab.name)}
                              >
                                {tab.name}
                                {tab.isDirty && <span className="ml-1 text-orange-500">•</span>}
                              </span>
                            )}
                          </TabsTrigger>
                          {tabs.length > 1 && (
                            <div
                              onClick={() => closeTab(tab.id)}
                              className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded p-0.5 cursor-pointer z-10"
                            >
                              <X className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      ))}
                    </TabsList>
                  </div>
                </Tabs>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => createTab()}
                  className="ml-2 h-8 w-8 p-0"
                  disabled={tabs.length >= 10}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleSaveQuery}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleExecuteQuery}
                  disabled={isExecuting || !getActiveTab()?.query.trim()}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isExecuting ? 'Running...' : 'Run'}
                </Button>
              </div>
            </div>
          </div>

          {/* SQL Editor Section */}
          <div 
            className="flex-shrink-0"
            style={{ height: `${editorHeight}px` }}
          >
            <Editor
              height={`${editorHeight}px`}
              defaultLanguage="sql"
              value={getActiveTab()?.query || ''}
              onChange={handleQueryChange}
              theme="vs-light"
              onMount={(editor) => {
                editorRef.current = editor;
                // Force layout after mount
                setTimeout(() => {
                  editor.layout();
                }, 100);
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
                tabSize: 2,
                placeholder: 'Enter SQL code here...',
              }}
            />
          </div>

          {/* Resizable Divider */}
          <div 
            className={`border-t border-b h-2 bg-gray-100 hover:bg-gray-200 cursor-row-resize flex items-center justify-center transition-colors flex-shrink-0 ${
              isDragging ? 'bg-gray-300' : ''
            }`}
            onMouseDown={handleMouseDown}
          >
            <div className="w-8 h-0.5 bg-gray-400 rounded"></div>
          </div>

          {/* Results Panel */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto">
            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-400">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Query Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Results</h3>
                  <div className="flex space-x-2">
                    <Badge variant="secondary">
                      {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="secondary">
                      {result.duration}ms
                    </Badge>
                  </div>
                </div>

                {result.rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          {result.fields.map((field: any, index: number) => (
                            <th
                              key={index}
                              className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
                            >
                              {field.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {result.rows.map((row: any, rowIndex: number) => (
                          <tr key={rowIndex} className="hover:bg-gray-50">
                            {result.fields.map((field: any, colIndex: number) => (
                              <td
                                key={colIndex}
                                className="px-4 py-2 text-sm text-gray-900 border-r last:border-r-0"
                              >
                                {formatValue(row[field.name])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {result.rows.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>Query executed successfully but returned no rows.</p>
                  </div>
                )}
              </div>
            )}

            {scriptResult && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Script Results</h3>
                  <div className="flex space-x-2">
                    <Badge variant="secondary">
                      {scriptResult.successCount} statement{scriptResult.successCount !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="secondary">
                      {scriptResult.totalDuration}ms
                    </Badge>
                    {scriptResult.errorCount > 0 && (
                      <Badge variant="destructive">
                        {scriptResult.errorCount} error{scriptResult.errorCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                </div>

                {scriptResult.results.map((statementResult, index) => (
                  <Card key={index} className="mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Statement {index + 1}: {statementResult.command}</h4>
                        <div className="flex space-x-2">
                          <Badge variant="secondary">
                            {statementResult.rowCount} row{statementResult.rowCount !== 1 ? 's' : ''}
                          </Badge>
                          <Badge variant="secondary">
                            {statementResult.duration}ms
                          </Badge>
                        </div>
                      </div>

                      {statementResult.rows.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                {statementResult.fields.map((field: any, fieldIndex: number) => (
                                  <th
                                    key={fieldIndex}
                                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
                                  >
                                    {field.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {statementResult.rows.map((row: any, rowIndex: number) => (
                                <tr key={rowIndex} className="hover:bg-gray-50">
                                  {statementResult.fields.map((field: any, colIndex: number) => (
                                    <td
                                      key={colIndex}
                                      className="px-4 py-2 text-sm text-gray-900 border-r last:border-r-0"
                                    >
                                      {formatValue(row[field.name])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {statementResult.rows.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          <p>Statement executed successfully but returned no rows.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!result && !scriptResult && !error && !isExecuting && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Run a query to see results</p>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}