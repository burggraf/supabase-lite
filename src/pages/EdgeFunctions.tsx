import { useState, useEffect } from 'react';
import { FunctionsList } from '@/components/edge-functions/FunctionsList';
import { SecretsManager } from '@/components/edge-functions/SecretsManager';
import { FunctionEditor } from '@/components/edge-functions/FunctionEditor';
import { getFunctionNameFromPath, buildFunctionEditorPath } from '@/lib/routes';
import { templates } from '@/components/edge-functions/FunctionTemplates';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { toast } from 'sonner';

export function EdgeFunctions() {
  const [currentView, setCurrentView] = useState<'functions' | 'secrets' | 'editor'>('functions');
  const [currentFunctionName, setCurrentFunctionName] = useState<string | null>(null);

  useEffect(() => {
    // Determine current view from URL
    const path = window.location.pathname;
    const functionName = getFunctionNameFromPath(path);
    
    if (path === '/edge-functions/secrets') {
      setCurrentView('secrets');
      setCurrentFunctionName(null);
    } else if (functionName) {
      setCurrentView('editor');
      setCurrentFunctionName(functionName);
    } else {
      setCurrentView('functions');
      setCurrentFunctionName(null);
    }
  }, []);

  // Listen for popstate events to handle browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const functionName = getFunctionNameFromPath(path);
      
      if (path === '/edge-functions/secrets') {
        setCurrentView('secrets');
        setCurrentFunctionName(null);
      } else if (functionName) {
        setCurrentView('editor');
        setCurrentFunctionName(functionName);
      } else {
        setCurrentView('functions');
        setCurrentFunctionName(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    const path = buildFunctionEditorPath(functionName);
    window.history.pushState(null, '', path);
    setCurrentView('editor');
    setCurrentFunctionName(functionName);
  };

  const handleBackToFunctions = () => {
    window.history.pushState(null, '', '/edge-functions');
    setCurrentView('functions');
    setCurrentFunctionName(null);
  };

  const handleGoToSecrets = () => {
    window.history.pushState(null, '', '/edge-functions/secrets');
    setCurrentView('secrets');
    setCurrentFunctionName(null);
  };

  if (currentView === 'secrets') {
    return <SecretsManager projectId={projectManager.getActiveProject()?.id} />;
  }

  if (currentView === 'editor' && currentFunctionName) {
    return (
      <FunctionEditor
        functionName={currentFunctionName}
        onBack={handleBackToFunctions}
      />
    );
  }

  return (
    <FunctionsList
      onCreateFunction={handleCreateFunction}
      onEditFunction={handleEditFunction}
      onGoToSecrets={handleGoToSecrets}
    />
  );
}