import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ExternalLink, Code2, Bot, Terminal, Edit3, Trash2, Play } from 'lucide-react';
import { FunctionTemplates } from './FunctionTemplates';
import { FunctionCreationOptions } from './FunctionCreationOptions';
import { vfsManager } from '../../lib/vfs/VFSManager';

interface Function {
  id: string;
  name: string;
  lastDeployed: string;
  status: 'active' | 'inactive' | 'error';
  description?: string;
}

interface FunctionsListProps {
  onCreateFunction: (template?: string) => void;
  onEditFunction: (functionId: string) => void;
  onGoToSecrets?: () => void;
}

export const FunctionsList: React.FC<FunctionsListProps> = ({
  onCreateFunction,
  onEditFunction,
  onGoToSecrets,
}) => {
  const [functions, setFunctions] = useState<Function[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFunctions();
  }, []);

  const loadFunctions = async () => {
    try {
      setLoading(true);
      const files = await vfsManager.listFiles({ directory: 'edge-functions' });
      
      const functionDirs = files
        .filter(file => file.type === 'directory' && file.path.startsWith('edge-functions/'))
        .map(dir => {
          const functionName = dir.path.split('/')[1];
          return {
            id: functionName,
            name: functionName,
            lastDeployed: dir.lastModified?.toISOString() || new Date().toISOString(),
            status: 'active' as const,
            description: `Edge function: ${functionName}`,
          };
        });

      setFunctions(functionDirs);
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
        await vfsManager.deleteFile(`edge-functions/${functionId}`);
        await loadFunctions();
      } catch (error) {
        console.error('Failed to delete function:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading functions...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Edge Functions</h1>
            <p className="text-gray-600">Deploy edge functions to handle complex business logic</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Docs
            </Button>
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              Examples
            </Button>
            <Button
              onClick={() => onCreateFunction()}
              className="bg-green-600 hover:bg-green-700"
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
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Create your first edge function
              </h2>
              <FunctionCreationOptions onCreateFunction={onCreateFunction} />
            </div>

            {/* Templates */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Start with a template
              </h2>
              <FunctionTemplates onSelectTemplate={onCreateFunction} />
            </div>
          </div>
        ) : (
          // Functions List
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Your Functions</h2>
            <div className="grid gap-4">
              {functions.map((func) => (
                <Card key={func.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {func.name}
                          </h3>
                          <Badge className={getStatusColor(func.status)}>
                            {func.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {func.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last deployed: {formatDate(func.lastDeployed)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {}}
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
                          className="text-red-600 hover:text-red-700"
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
            <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
              <CardContent className="p-6">
                <Button
                  variant="ghost"
                  className="w-full h-20 text-gray-600 hover:text-gray-900"
                  onClick={() => onCreateFunction()}
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
    </div>
  );
};