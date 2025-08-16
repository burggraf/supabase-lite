import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDatabase, useQueryHistory } from '@/hooks/useDatabase';
import { useSQLSnippets } from '@/hooks/useSQLSnippets';
import { Play, Save, History, Plus, X } from 'lucide-react';
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
  const { history, addToHistory } = useQueryHistory();
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
    const startTime = performance.now();

    try {
      // Detect if this is a multi-statement script by counting meaningful semicolons
      const statements = query.split(';').map(s => s.trim()).filter(s => s.length > 0);
      const isMultiStatement = statements.length > 1;

      if (isMultiStatement) {
        // Execute as script using exec method
        const scriptResult = await executeScript(query);
        setScriptResult(scriptResult);
        addToHistory(query, scriptResult.totalDuration, scriptResult.errorCount === 0);
      } else {
        // Execute as single query
        const result = await executeQuery(query);
        setResult(result);
        addToHistory(query, result.duration, true);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Query execution failed';
      setError(errorMessage);
      const duration = performance.now() - startTime;
      addToHistory(query, duration, false, errorMessage);
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
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-2xl font-bold">SQL Editor</h2>
          <p className="text-sm text-muted-foreground">
            Write and execute SQL queries against your local database
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
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
      
      {/* Tabs */}
      <div className="border-b">
        <Tabs value={activeTabId} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center px-4 pt-2">
            <TabsList className="h-8 p-0 bg-transparent">
              {tabs.map((tab) => (
                <div key={tab.id} className="flex items-center group">
                  <TabsTrigger 
                    value={tab.id} 
                    className="relative px-3 py-1 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <div className="flex items-center space-x-2">
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
                      {tabs.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(tab.id);
                          }}
                          className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </TabsTrigger>
                </div>
              ))}
            </TabsList>
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
        </Tabs>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar with Snippets and History */}
        <div className="w-80 border-r bg-gray-50">
          <Tabs defaultValue="snippets" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 m-4">
              <TabsTrigger value="snippets">Snippets</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="snippets" className="flex-1 overflow-hidden">
              <div className="p-4 border-b bg-white">
                <h3 className="font-medium flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  Saved Snippets
                </h3>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto">
                {snippets.length === 0 && (
                  <p className="text-sm text-gray-500">No saved snippets yet</p>
                )}
                {snippets.map((snippet) => (
                  <Card 
                    key={snippet.id} 
                    className="cursor-pointer hover:bg-white transition-colors group"
                    onClick={() => loadSnippet(snippet.id)}
                  >
                    <CardContent className="p-3">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="history" className="flex-1 overflow-hidden">
              <div className="p-4 border-b bg-white">
                <h3 className="font-medium flex items-center">
                  <History className="h-4 w-4 mr-2" />
                  Query History
                </h3>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto">
                {history.length === 0 && (
                  <p className="text-sm text-gray-500">No queries executed yet</p>
                )}
                {history.map((item: any) => (
                  <Card 
                    key={item.id} 
                    className="cursor-pointer hover:bg-white transition-colors"
                    onClick={() => {
                      const activeTab = getActiveTab();
                      if (activeTab) {
                        updateTabQuery(activeTab.id, item.query);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant={item.success ? 'success' : 'destructive'}>
                          {item.success ? 'Success' : 'Error'}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs font-mono truncate mb-1">
                        {item.query.split('\n')[0]}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.duration.toFixed(2)}ms
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Editor Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
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