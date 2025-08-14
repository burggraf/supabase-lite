import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { SQLEditor } from '@/components/sql-editor/SQLEditor';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Table Editor</h2>
              <p className="text-muted-foreground">Coming soon...</p>
            </div>
          </div>
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
      <div className="w-64 flex-shrink-0">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderCurrentPage()}
      </div>
    </div>
  );
}

export default App;