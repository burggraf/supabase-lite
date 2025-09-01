import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Code2, Bot, Terminal, X, Copy, Check } from 'lucide-react';

interface FunctionCreationOptionsProps {
  onCreateFunction: (template?: string) => void;
}

export const FunctionCreationOptions: React.FC<FunctionCreationOptionsProps> = ({
  onCreateFunction,
}) => {
  const [showCLIModal, setShowCLIModal] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleOpenAssistant = () => {
    // TODO: Implement AI Assistant functionality
    alert('AI Assistant feature coming soon!');
  };

  const handleViewCLI = () => {
    setShowCLIModal(true);
  };

  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(commandId);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const cliCommands = [
    {
      id: 'install',
      title: 'Install Supabase CLI',
      description: 'Install the Supabase CLI globally on your system',
      command: 'npm install -g supabase'
    },
    {
      id: 'login',
      title: 'Login to Supabase',
      description: 'Authenticate with your Supabase account',
      command: 'supabase login'
    },
    {
      id: 'init',
      title: 'Initialize Project',
      description: 'Initialize a new Supabase project in your directory',
      command: 'supabase init'
    },
    {
      id: 'create',
      title: 'Create New Function',
      description: 'Create a new edge function with the given name',
      command: 'supabase functions new my-function'
    },
    {
      id: 'serve',
      title: 'Serve Functions Locally',
      description: 'Start local development server for edge functions',
      command: 'supabase functions serve'
    },
    {
      id: 'deploy',
      title: 'Deploy Function',
      description: 'Deploy your function to Supabase',
      command: 'supabase functions deploy my-function'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Via Editor */}
      <Card className="text-center">
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Code2 className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Via Editor</h3>
            <p className="text-sm text-gray-600 mb-4">
              Create and edit functions directly in the browser. Download to local at any time.
            </p>
          </div>
          <Button
            onClick={onCreateFunction}
            className="w-full"
            variant="outline"
          >
            Open Editor
          </Button>
        </CardContent>
      </Card>

      {/* AI Assistant */}
      <Card className="text-center">
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Bot className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI Assistant</h3>
            <p className="text-sm text-gray-600 mb-4">
              Let our AI assistant help you create functions. Perfect for kickstarting a function.
            </p>
          </div>
          <Button
            onClick={handleOpenAssistant}
            className="w-full"
            variant="outline"
          >
            Open Assistant
          </Button>
        </CardContent>
      </Card>

      {/* Via CLI */}
      <Card className="text-center">
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Terminal className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Via CLI</h3>
            <p className="text-sm text-gray-600 mb-4">
              Create and deploy functions using the Supabase CLI. Ideal for local development and version control.
            </p>
          </div>
          <Button
            onClick={handleViewCLI}
            className="w-full"
            variant="outline"
          >
            View CLI Instructions
          </Button>
        </CardContent>
      </Card>

      {/* CLI Instructions Modal */}
      {showCLIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-semibold">Supabase CLI Instructions</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCLIModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <p className="text-gray-600">
                  Use the Supabase CLI to create and deploy edge functions from your local development environment. 
                  This approach provides the best development experience with version control, local testing, and CI/CD integration.
                </p>
              </div>

              <div className="space-y-6">
                {cliCommands.map((cmd, index) => (
                  <div key={cmd.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-6 h-6 bg-green-100 text-green-700 rounded-full text-sm font-semibold flex items-center justify-center">
                            {index + 1}
                          </div>
                          <h3 className="font-medium text-gray-900">{cmd.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600">{cmd.description}</p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-900 text-gray-100 rounded-md p-3 flex items-center justify-between">
                      <code className="text-sm font-mono">{cmd.command}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(cmd.command, cmd.id)}
                        className="text-gray-300 hover:text-white hover:bg-gray-800"
                      >
                        {copiedCommand === cmd.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">💡 Pro Tips</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Use <code className="bg-blue-200 px-1 rounded">supabase functions serve --debug</code> for detailed logs</li>
                  <li>• Functions are deployed to <code className="bg-blue-200 px-1 rounded">supabase/functions/</code> directory</li>
                  <li>• Set environment variables with <code className="bg-blue-200 px-1 rounded">supabase secrets set KEY=value</code></li>
                  <li>• Test functions locally at <code className="bg-blue-200 px-1 rounded">http://localhost:[PORT]/functions/v1/function-name</code></li>
                </ul>
              </div>

              <div className="mt-6 flex justify-between items-center">
                <a
                  href="https://supabase.com/docs/guides/functions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  📖 View Full Documentation →
                </a>
                <Button onClick={() => setShowCLIModal(false)}>
                  Got it, thanks!
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};