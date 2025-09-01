import { useEffect, useState, useRef } from 'react';
import { getAppNameFromPath } from '@/lib/routes';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { projectManager } from '@/lib/projects/ProjectManager';
import { logger } from '@/lib/infrastructure/Logger';

interface HostedAppViewerProps {
  appPath: string;
}

export function HostedAppViewer({ appPath }: HostedAppViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appContent, setAppContent] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const loadHostedApp = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Extract app name from path
        const appName = getAppNameFromPath(appPath);
        if (!appName) {
          throw new Error('Invalid app path');
        }

        // Get current project
        const activeProject = projectManager.getActiveProject();
        if (!activeProject) {
          throw new Error('No active project found');
        }

        // Initialize VFS
        await vfsManager.initialize(activeProject.id);

        // Try to load the app's index.html
        const indexPath = `app/${appName}/index.html`;
        const indexFile = await vfsManager.readFile(indexPath);
        
        if (!indexFile) {
          throw new Error(`App "${appName}" not found. Make sure it has been deployed.`);
        }

        // Get the HTML content
        let htmlContent = indexFile.content;

        // Create a base URL for the app
        const baseUrl = `/app/${appName}/`;
        
        // Inject base tag if not already present
        if (!htmlContent.includes('<base')) {
          htmlContent = htmlContent.replace(
            '<head>',
            `<head>\n    <base href="${baseUrl}">`
          );
        }

        // Create blob URL for the iframe
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);

        setAppContent(blobUrl);
        logger.info(`Loaded hosted app: ${appName}`, { appPath, indexPath });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        logger.error('Failed to load hosted app', error as Error, { appPath });
      } finally {
        setIsLoading(false);
      }
    };

    loadHostedApp();

    // Cleanup blob URL when component unmounts
    return () => {
      if (appContent && appContent.startsWith('blob:')) {
        URL.revokeObjectURL(appContent);
      }
    };
  }, [appPath]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading app...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">App Not Found</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!appContent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Content</h2>
          <p className="text-sm text-muted-foreground">Unable to load app content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <iframe
        ref={iframeRef}
        src={appContent}
        className="flex-1 border-0 w-full h-full"
        title="Hosted App"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}