import { useState } from 'react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { SQLEditor } from '@/components/sql-editor/SQLEditor';
import { TableEditor } from '@/components/table-editor/TableEditor';
import { DatabaseWorking as Database } from '@/components/database/DatabaseWorking';
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
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {renderCurrentPage()}
      </div>
    </div>
  );
}

export default App;