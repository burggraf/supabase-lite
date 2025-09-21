import { useState } from 'react';
import { FunctionsList } from '@/components/edge-functions/FunctionsList';
import { SecretsManager } from '@/components/edge-functions/SecretsManager';
import { FunctionEditor } from '@/components/edge-functions/FunctionEditor';
import { templates } from '@/components/edge-functions/FunctionTemplates';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';
import { EdgeFunctionRuntimeManager } from '@/components/edge-functions/EdgeFunctionRuntimeManager';

export function EdgeFunctions() {
  const [currentView, setCurrentView] = useState<'functions' | 'secrets' | 'runtime'>('functions');
  const [currentFunctionName, setCurrentFunctionName] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const generateUniqueFunctionName = async (): Promise<string> => {
    try {
      const files = await vfsManager.listFiles({ directory: 'edge-functions' });
      console.log('All files in edge-functions for name generation:', files);
      
      const existingNames = new Set<string>();
      
      // Check for index.ts files which indicate function directories
      files.forEach(file => {
        if (file.path.match(/^edge-functions\/([^\/]+)\/index\.ts$/)) {
          const functionName = file.path.split('/')[1];
          existingNames.add(functionName);
        }
      });

      console.log('Existing function names:', Array.from(existingNames));

      let counter = 1;
      let functionName = `function-${counter}`;
      
      while (existingNames.has(functionName)) {
        counter++;
        functionName = `function-${counter}`;
      }
      
      console.log('Generated unique function name:', functionName);
      return functionName;
    } catch (error) {
      console.error('Failed to generate unique function name:', error);
      // Use timestamp to ensure uniqueness
      return `function-${Date.now()}`;
    }
  };

  const handleCreateFunction = async (templateId?: string, functionName?: string) => {
    try {
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        toast.error('No active project found');
        return;
      }

      await vfsManager.initialize(activeProject.id);

      // Use provided function name or generate unique one
      let finalFunctionName: string;
      if (functionName && functionName.trim()) {
        finalFunctionName = functionName.trim();
        // Validate the provided name doesn't already exist
        const files = await vfsManager.listFiles({ directory: 'edge-functions' });
        const existingNames = new Set<string>();
        
        files.forEach(file => {
          if (file.path.match(/^edge-functions\/([^\/]+)\/index\.ts$/)) {
            const existingName = file.path.split('/')[1];
            existingNames.add(existingName);
          }
        });

        if (existingNames.has(finalFunctionName)) {
          toast.error(`Function "${finalFunctionName}" already exists`);
          return;
        }
      } else {
        // Generate unique function name
        finalFunctionName = await generateUniqueFunctionName();
      }
      
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
    message: "Hello from ${finalFunctionName}!",
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
      const functionPath = `edge-functions/${finalFunctionName}/index.ts`;
      
      // Double-check if file exists before creating
      try {
        const existingFile = await vfsManager.readFile(functionPath);
        if (existingFile) {
          console.warn(`File ${functionPath} already exists, using timestamp-based name`);
          const timestampName = `function-${Date.now()}`;
          const timestampPath = `edge-functions/${timestampName}/index.ts`;
          await vfsManager.createFile(timestampPath, {
            content: templateContent,
            mimeType: 'text/typescript'
          });
          toast.success(`Created new function: ${timestampName}`);
          handleEditFunction(timestampName);
          return;
        }
      } catch (error) {
        // File doesn't exist, which is what we want
        console.log(`File ${functionPath} does not exist, proceeding with creation`);
      }
      
      await vfsManager.createFile(functionPath, {
        content: templateContent,
        mimeType: 'text/typescript'
      });

      toast.success(`Created new function: ${finalFunctionName}`);
      
      // Navigate to inline editor
      handleEditFunction(finalFunctionName);
    } catch (error) {
      console.error('Failed to create function:', error);
      toast.error('Failed to create new function');
    }
  };

  const handleEditFunction = (functionName: string) => {
    setCurrentFunctionName(functionName);
    setIsCreating(true);
  };

  const handleBackToFunctions = () => {
    setCurrentFunctionName(null);
    setIsCreating(false);
    setCurrentView('functions');
  };

  const handleGoToSecrets = () => {
    setCurrentView('secrets');
    setCurrentFunctionName(null);
    setIsCreating(false);
  };

  const handleGoToFunctions = () => {
    setCurrentView('functions');
    setCurrentFunctionName(null);
    setIsCreating(false);
  };

  const handleGoToRuntime = () => {
    setCurrentView('runtime');
    setCurrentFunctionName(null);
    setIsCreating(false);
  };

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
          <div
            className={`text-sm px-3 py-2 cursor-pointer rounded-md ${
              currentView === 'runtime'
                ? 'font-medium text-gray-900 bg-gray-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            onClick={handleGoToRuntime}
          >
            Runtime
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {currentView === 'runtime' ? (
          <div className="p-6">
            <EdgeFunctionRuntimeManager />
          </div>
        ) : isCreating && currentFunctionName ? (
          <FunctionEditor
            functionName={currentFunctionName}
            onBack={handleBackToFunctions}
          />
        ) : currentView === 'functions' ? (
          <FunctionsList
            onCreateFunction={handleCreateFunction}
            onEditFunction={handleEditFunction}
            onGoToSecrets={handleGoToSecrets}
            onGoToRuntime={handleGoToRuntime}
          />
        ) : (
          <SecretsManager projectId={projectManager.getActiveProject()?.id} />
        )}
      </div>
    </div>
  );
}
