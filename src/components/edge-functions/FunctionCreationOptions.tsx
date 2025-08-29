import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Code2, Bot, Terminal } from 'lucide-react';

interface FunctionCreationOptionsProps {
  onCreateFunction: () => void;
}

export const FunctionCreationOptions: React.FC<FunctionCreationOptionsProps> = ({
  onCreateFunction,
}) => {
  const handleOpenAssistant = () => {
    // TODO: Implement AI Assistant functionality
    alert('AI Assistant feature coming soon!');
  };

  const handleViewCLI = () => {
    // TODO: Implement CLI instructions
    alert('CLI instructions feature coming soon!');
  };

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
    </div>
  );
};