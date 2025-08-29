import { useState } from 'react';
import { FunctionsList } from '@/components/edge-functions/FunctionsList';
import { SecretsManager } from '@/components/edge-functions/SecretsManager';
import { FunctionEditor } from '@/components/edge-functions/FunctionEditor';
import { templates } from '@/components/edge-functions/FunctionTemplates';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';

export function EdgeFunctions() {
  const [currentView, setCurrentView] = useState<'functions' | 'secrets' | 'editor'>('functions');
  const [currentFunctionName, setCurrentFunctionName] = useState<string | null>(null);

  const handleCreateFunction = async (templateId?: string) => {
    try {
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);

      // Generate function name
      const functionName = 'new-function';
      
      // Get template content
      let templateContent = '';
      if (templateId) {
        const template = templates.find(t => t.id === templateId);
        if (template) {
          templateContent = template.code;
        }
      }

      // Default template if none specified
      if (!templateContent) {
        templateContent = `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  const data = {
    message: "Hello from ${functionName}!",
    timestamp: new Date().toISOString(),
  };
  
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive'
    }
  });
});`;
      }

      // Create function file
      const functionPath = `edge-functions/${functionName}/index.ts`;
      await vfsManager.createFile(functionPath, {
        content: templateContent,
        mimeType: 'text/typescript'
      });

      toast.success(`Created new function: ${functionName}`);
      
      // Navigate to editor
      handleEditFunction(functionName);
    } catch (error) {
      console.error('Failed to create function:', error);
      toast.error('Failed to create new function');
    }
  };

  const handleEditFunction = (functionName: string) => {
    setCurrentView('editor');
    setCurrentFunctionName(functionName);
  };

  const handleBackToFunctions = () => {
    setCurrentView('functions');
    setCurrentFunctionName(null);
  };

  const handleGoToSecrets = () => {
    setCurrentView('secrets');
    setCurrentFunctionName(null);
  };

  const handleGoToFunctions = () => {
    setCurrentView('functions');
    setCurrentFunctionName(null);
  };

  if (currentView === 'editor' && currentFunctionName) {
    return (
      <FunctionEditor
        functionName={currentFunctionName}
        onBack={handleBackToFunctions}
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <div className="w-48 bg-gray-50 border-r border-gray-200 p-4">
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Manage
          </div>
          <div 
            className={`text-sm px-3 py-2 cursor-pointer rounded-md ${
              currentView === 'functions' 
                ? 'font-medium text-gray-900 bg-gray-200' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={handleGoToFunctions}
          >
            Functions
          </div>
          <div 
            className={`text-sm px-3 py-2 cursor-pointer rounded-md ${
              currentView === 'secrets' 
                ? 'font-medium text-gray-900 bg-gray-200' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={handleGoToSecrets}
          >
            Secrets
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {currentView === 'functions' ? (
          <FunctionsList
            onCreateFunction={handleCreateFunction}
            onEditFunction={handleEditFunction}
            onGoToSecrets={handleGoToSecrets}
          />
        ) : (
          <SecretsManager projectId={projectManager.getActiveProject()?.id} />
        )}
      </div>
    </div>
  );
}