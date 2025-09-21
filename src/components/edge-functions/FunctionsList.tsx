import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ExternalLink, Code2, Edit3, Trash2, Play, X, Send, Plus } from 'lucide-react';
import { FunctionTemplates } from './FunctionTemplates';
import { FunctionCreationOptions } from './FunctionCreationOptions';
import { vfsManager } from '../../lib/vfs/VFSManager';
import { projectManager } from '../../lib/projects/ProjectManager';
import { toast } from 'sonner';

interface Function {
  id: string;
  name: string;
  lastDeployed: string;
  status: 'active' | 'inactive' | 'error';
  description?: string;
}

interface FunctionsListProps {
  onCreateFunction: (template?: string, functionName?: string) => void;
  onEditFunction: (functionId: string) => void;
  onGoToSecrets?: () => void;
  onGoToRuntime?: () => void;
}

export const FunctionsList: React.FC<FunctionsListProps> = ({
  onCreateFunction,
  onEditFunction,
  onGoToSecrets: _onGoToSecrets,
  onGoToRuntime,
}) => {
  const [functions, setFunctions] = useState<Function[]>([]);
  const [loading, setLoading] = useState(true);
  const [testModal, setTestModal] = useState<{
    open: boolean;
    functionName: string;
    loading: boolean;
    response: unknown;
    error: string | null;
    requestBody: string;
  }>({
    open: false,
    functionName: '',
    loading: false,
    response: null,
    error: null,
    requestBody: '{\n  "message": "Hello World"\n}'
  });

  const [createFunctionModal, setCreateFunctionModal] = useState<{
    open: boolean;
    functionName: string;
    selectedTemplate?: string;
  }>({
    open: false,
    functionName: '',
    selectedTemplate: undefined
  });

  useEffect(() => {
    loadFunctions();
  }, []);

  const loadFunctions = async () => {
    try {
      setLoading(true);
      
      // Get active project and initialize VFS
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        console.warn('No active project found - cannot load functions');
        setFunctions([]);
        return;
      }
      
      // Initialize VFS with the active project ID
      await vfsManager.initialize(activeProject.id);
      
      // Get all files and filter manually since VFS directory filter expects exact match
      const allFiles = await vfsManager.listFiles();
      console.log('ALL files in VFS:', allFiles.length);
      
      // Filter files that are in edge-functions directory
      const files = allFiles.filter(file => file.path.startsWith('edge-functions/'));
      console.log('Edge function files found:', files.length);
      
      // Extract function names from file paths (files like edge-functions/function-name/index.ts)
      const functionNames = new Set<string>();
      
      files.forEach(file => {
        if (file.path.startsWith('edge-functions/') && file.path.includes('/')) {
          const pathParts = file.path.split('/');
          if (pathParts.length >= 2) {
            const functionName = pathParts[1];
            functionNames.add(functionName);
          }
        }
      });

      const functionDirs = Array.from(functionNames).map(functionName => {
        // Find the main file (index.ts) for this function to get metadata
        const mainFile = files.find(f => f.path === `edge-functions/${functionName}/index.ts`);
        
        return {
          id: functionName,
          name: functionName,
          lastDeployed: mainFile?.updatedAt?.toISOString() || new Date().toISOString(),
          status: 'active' as const,
          description: `Edge function: ${functionName}`,
        };
      });

      setFunctions(functionDirs);

      // For testing purposes, add a mock function if no functions exist
      // Temporarily commented out to test CLI instructions
      // if (functionDirs.length === 0) {
      //   setFunctions([{
      //     id: 'function-1756513545100',
      //     name: 'function-1756513545100',
      //     lastDeployed: new Date().toISOString(),
      //     status: 'active' as const,
      //     description: 'Test function for demonstration'
      //   }]);
      // }
    } catch (error) {
      console.error('Failed to load functions:', error);
      setFunctions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFunction = async (functionId: string) => {
    if (confirm(`Are you sure you want to delete the function "${functionId}"?`)) {
      try {
        // Get active project and initialize VFS
        const activeProject = projectManager.getActiveProject();
        if (!activeProject) {
          console.error('No active project found - cannot delete function');
          return;
        }
        
        await vfsManager.initialize(activeProject.id);
        await vfsManager.deleteDirectory(`edge-functions/${functionId}`, true);
        await loadFunctions();
        toast.success(`Function "${functionId}" deleted successfully`);
      } catch (error) {
        console.error('Failed to delete function:', error);
        toast.error(`Failed to delete function: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleTestFunction = (functionName: string) => {
    setTestModal({
      open: true,
      functionName,
      loading: false,
      response: null,
      error: null,
      requestBody: '{\n  "message": "Hello World"\n}'
    });
  };

  const executeTest = async () => {
    setTestModal(prev => ({ ...prev, loading: true, response: null, error: null }));

    try {
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        throw new Error('No active project found');
      }

      const projectId = activeProject.id;
      let requestBody = null;
      
      // Try to parse JSON body
      if (testModal.requestBody.trim()) {
        try {
          requestBody = JSON.parse(testModal.requestBody);
        } catch (e) {
          // If not JSON, send as text
          requestBody = testModal.requestBody;
        }
      }

      const startTime = performance.now();
      
      const response = await fetch(`${window.location.origin}/functions/v1/${testModal.functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${projectId}`,
          'apikey': projectId
        },
        body: requestBody ? JSON.stringify(requestBody) : undefined
      });

      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      const responseData = await response.json();

      setTestModal(prev => ({
        ...prev,
        loading: false,
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: responseData,
          executionTime
        }
      }));

      if (!response.ok) {
        toast.error(`Function test failed: ${response.status} ${response.statusText}`);
      } else {
        toast.success(`Function executed successfully in ${executionTime}ms`);
      }
    } catch (error) {
      console.error('Function test failed:', error);
      setTestModal(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
      toast.error('Function test failed');
    }
  };

  const closeTestModal = () => {
    setTestModal(prev => ({ ...prev, open: false }));
  };

  const handleCreateFunctionClick = (template?: string) => {
    setCreateFunctionModal({
      open: true,
      functionName: '',
      selectedTemplate: template
    });
  };

  const handleCreateFunctionSubmit = () => {
    const name = createFunctionModal.functionName.trim();
    if (!name) {
      toast.error('Function name is required');
      return;
    }

    // Validate function name
    if (!/^[a-z0-9-_]+$/.test(name)) {
      toast.error('Function name can only contain lowercase letters, numbers, hyphens, and underscores');
      return;
    }

    // Check if function already exists
    const existingFunction = functions.find(f => f.name === name);
    if (existingFunction) {
      toast.error(`Function "${name}" already exists`);
      return;
    }

    onCreateFunction(createFunctionModal.selectedTemplate, name);
    setCreateFunctionModal({ open: false, functionName: '', selectedTemplate: undefined });
  };

  const closeCreateFunctionModal = () => {
    setCreateFunctionModal({ open: false, functionName: '', selectedTemplate: undefined });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading functions...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Edge Functions</h1>
            <p className="text-gray-600 dark:text-gray-300">Deploy edge functions to handle complex business logic</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" onClick={onGoToRuntime}>
              <Code2 className="w-4 h-4 mr-2" />
              Runtime
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Docs
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Examples
            </Button>
            <Button
              onClick={() => handleCreateFunctionClick()}
              className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
            >
              Deploy a new function
            </Button>
          </div>
        </div>

        {functions.length === 0 ? (
          // Empty State
          <div className="space-y-12">
            {/* Creation Options */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                Create your first edge function
              </h2>
              <FunctionCreationOptions onCreateFunction={handleCreateFunctionClick} />
            </div>

            {/* Templates */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                Start with a template
              </h2>
              <FunctionTemplates onSelectTemplate={handleCreateFunctionClick} />
            </div>
          </div>
        ) : (
          // Functions List
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Your Functions</h2>
            <div className="grid gap-4">
              {functions.map((func) => (
                <Card key={func.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {func.name}
                          </h3>
                          <Badge className={getStatusColor(func.status)}>
                            {func.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {func.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Last deployed: {formatDate(func.lastDeployed)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestFunction(func.id)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditFunction(func.id)}
                        >
                          <Edit3 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteFunction(func.id)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Add New Function Button */}
            <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500 transition-colors">
              <CardContent className="p-6">
                <Button
                  variant="ghost"
                  className="w-full h-20 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                  onClick={() => handleCreateFunctionClick()}
                >
                  <div className="text-center">
                    <Code2 className="w-8 h-8 mx-auto mb-2" />
                    <div className="font-medium">Create New Function</div>
                    <div className="text-sm">Deploy a new edge function</div>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Test Modal */}
        {testModal.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Test Function: {testModal.functionName}</h2>
                <Button variant="ghost" size="sm" onClick={closeTestModal}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-6">
                {/* Request Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Request Body (JSON)
                  </label>
                  <textarea
                    className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md font-mono text-sm"
                    value={testModal.requestBody}
                    onChange={(e) => setTestModal(prev => ({ ...prev, requestBody: e.target.value }))}
                    placeholder="Enter JSON request body..."
                  />
                </div>

                {/* Test Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={executeTest}
                    disabled={testModal.loading}
                    className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
                  >
                    {testModal.loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Test Function
                      </>
                    )}
                  </Button>
                </div>

                {/* Response */}
                {(testModal.response || testModal.error) && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Response</h3>
                    
                    {testModal.error ? (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                        <div className="text-red-800 dark:text-red-400 font-medium mb-2">Error</div>
                        <div className="text-red-700 dark:text-red-300 text-sm font-mono">{testModal.error}</div>
                      </div>
                    ) : testModal.response ? (
                      <div className="space-y-4">
                        {/* Status */}
                        <div className="flex items-center space-x-4 text-sm">
                          <div className={`px-3 py-1 rounded-full text-white ${
                            testModal.response.status < 300 ? 'bg-green-500' : 
                            testModal.response.status < 400 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}>
                            {testModal.response.status} {testModal.response.statusText}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Execution time: {testModal.response.executionTime}ms
                          </div>
                        </div>

                        {/* Response Data */}
                        <div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response Body</div>
                          <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md p-4 text-sm overflow-x-auto">
                            {JSON.stringify(testModal.response.data, null, 2)}
                          </pre>
                        </div>

                        {/* Headers */}
                        <div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response Headers</div>
                          <pre className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-md p-4 text-sm overflow-x-auto">
                            {JSON.stringify(testModal.response.headers, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Function Modal */}
        {createFunctionModal.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create New Function</h2>
                <Button variant="ghost" size="sm" onClick={closeCreateFunctionModal}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6 space-y-4">
                {createFunctionModal.selectedTemplate && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>Template:</strong> {createFunctionModal.selectedTemplate}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Function Name
                  </label>
                  <input
                    type="text"
                    value={createFunctionModal.functionName}
                    onChange={(e) => setCreateFunctionModal(prev => ({ 
                      ...prev, 
                      functionName: e.target.value 
                    }))}
                    placeholder="my-function"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateFunctionSubmit();
                      }
                    }}
                    autoFocus
                  />
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Use lowercase letters, numbers, hyphens, and underscores only
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={closeCreateFunctionModal}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateFunctionSubmit}
                    disabled={!createFunctionModal.functionName.trim()}
                    className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Function
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
