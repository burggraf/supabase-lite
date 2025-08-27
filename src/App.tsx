import { Sidebar } from '@/components/dashboard/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { SQLEditor } from '@/components/sql-editor/SQLEditor';
import { TableEditor } from '@/components/table-editor/TableEditor';
import { DatabaseWorking as Database } from '@/components/database/DatabaseWorking';
import { APITester } from '@/components/api-test/APITester';
import { AuthTestPanel } from '@/components/auth/AuthTestPanel';
import { Storage } from '@/components/storage/Storage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useRouter } from '@/hooks/useRouter';
import { useEffect, useState } from 'react';
import { initializeInfrastructure, logger } from '@/lib/infrastructure';
import { projectManager } from '@/lib/projects/ProjectManager';

function App() {
  const { currentPage, navigate } = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    
    const initialize = async () => {
      try {
        await initializeInfrastructure();
        
        // Only update state if the effect hasn't been cancelled
        if (!isCancelled) {
          logger.info('Application initialized successfully');
          setIsInitializing(false);
        }
      } catch (error) {
        // Only update state if the effect hasn't been cancelled
        if (!isCancelled) {
          const errorMessage = (error as Error).message;
          logger.error('Application initialization failed', error as Error);
          setInitError(errorMessage);
          setIsInitializing(false);
        }
      }
    };

    initialize();
    
    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isCancelled = true;
    };
  }, []);

  // Track current project name
  useEffect(() => {
    const updateCurrentProject = () => {
      const activeProject = projectManager.getActiveProject();
      setCurrentProjectName(activeProject?.name || null);
    };

    // Initial load
    updateCurrentProject();

    // Listen for storage changes to update when projects change
    const handleStorageChange = () => {
      updateCurrentProject();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically in case of same-tab changes
    const interval = setInterval(updateCurrentProject, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Initializing Supabase Lite...</p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Initialization Failed</h2>
          <p className="text-sm text-muted-foreground mb-4">{initError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'sql-editor':
        return (
          <ErrorBoundary>
            <SQLEditor />
          </ErrorBoundary>
        );
      case 'table-editor':
        return (
          <ErrorBoundary>
            <TableEditor />
          </ErrorBoundary>
        );
      case 'database':
        return (
          <ErrorBoundary>
            <Database />
          </ErrorBoundary>
        );
      case 'auth':
        return (
          <ErrorBoundary>
            <div className="flex-1 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold">Authentication</h1>
                  <p className="text-muted-foreground mt-2">
                    Test and manage authentication features including signup, signin, MFA, and user management.
                  </p>
                </div>
                <AuthTestPanel />
              </div>
            </div>
          </ErrorBoundary>
        );
      case 'storage':
        return (
          <ErrorBoundary>
            <Storage />
          </ErrorBoundary>
        );
      case 'api-test':
      case 'api':
        return (
          <ErrorBoundary>
            <div className="flex-1 p-6">
              <APITester />
            </div>
          </ErrorBoundary>
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">{currentPage}</h2>
              <p className="text-muted-foreground">This feature is coming soon!</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={currentPage} onPageChange={navigate} currentProjectName={currentProjectName || undefined} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderCurrentPage()}
      </div>
    </div>
  );
}

export default App;