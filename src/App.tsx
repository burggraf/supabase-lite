import { Sidebar } from '@/components/dashboard/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { SQLEditor } from '@/components/sql-editor/SQLEditor';
import { TableEditor } from '@/components/table-editor/TableEditor';
import { DatabaseWorking as Database } from '@/components/database/DatabaseWorking';
import { APITester } from '@/components/api-test/APITester';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useRouter } from '@/hooks/useRouter';
import { useEffect, useState } from 'react';
import { initializeInfrastructure, logger } from '@/lib/infrastructure';

function App() {
  const { currentPage, navigate } = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeInfrastructure();
        logger.info('Application initialized successfully');
        setIsInitializing(false);
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('Application initialization failed', error as Error);
        setInitError(errorMessage);
        setIsInitializing(false);
      }
    };

    initialize();
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
      case 'api-test':
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
      <Sidebar currentPage={currentPage} onPageChange={navigate} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderCurrentPage()}
      </div>
    </div>
  );
}

export default App;