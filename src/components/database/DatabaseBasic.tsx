import { useState, useEffect } from 'react';
import { useDatabase } from '@/hooks/useDatabase';

interface TableInfo {
  name: string;
}

export function DatabaseBasic() {
  const { executeQuery, isConnected } = useDatabase();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTables = async () => {
      if (!isConnected) {
        setTables([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Use a simple query that should work with PGlite
        const query = `
          SELECT table_name as name
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          ORDER BY table_name;
        `;
        
        const result = await executeQuery(query);
        
        const tableInfos: TableInfo[] = result.rows.map((row: any) => ({
          name: String(row.name),
        }));
        
        setTables(tableInfos);
      } catch (err) {
        console.error('Error loading tables:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tables');
        setTables([]);
      } finally {
        setLoading(false);
      }
    };

    loadTables();
  }, [isConnected, executeQuery]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading tables...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Database Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 p-6 overflow-y-auto min-h-full">
        <h1 className="text-2xl font-bold mb-6">Database Tables</h1>
        
        {!isConnected ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-2">Database Not Connected</p>
            <p className="text-sm text-muted-foreground">Initializing database connection...</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-2">No Tables Found</p>
            <p className="text-sm text-muted-foreground">Create your first table to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Found {tables.length} table(s)</p>
            <div className="grid gap-4">
              {tables.map((table) => (
                <div
                  key={table.name}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <h3 className="font-medium">{table.name}</h3>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}