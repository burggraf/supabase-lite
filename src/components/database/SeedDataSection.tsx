import { useState } from 'react';
import { Database, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDatabase } from '@/hooks/useDatabase';

interface SeedDataOption {
  id: string;
  name: string;
  description: string;
  filename: string;
  tables: string[];
}

const seedOptions: SeedDataOption[] = [
  {
    id: 'northwind',
    name: 'Northwind Database',
    description: 'Classic sample database with customers, orders, products, employees, and suppliers',
    filename: 'northwind.sql',
    tables: ['categories', 'customers', 'employees', 'order_details', 'orders', 'products', 'shippers', 'suppliers', 'territories', 'region']
  },
  {
    id: 'chinook',
    name: 'Chinook Database',
    description: 'Digital media store database with artists, albums, tracks, customers, and invoices',
    filename: 'chinook.sql',
    tables: ['Artist', 'Album', 'Track', 'MediaType', 'Genre', 'Customer', 'Employee', 'Invoice', 'InvoiceLine', 'Playlist', 'PlaylistTrack']
  },
  {
    id: 'sample-app',
    name: 'Sample App Setup',
    description: 'Complete setup for the Sample App including Northwind data and user profiles table with RLS',
    filename: 'setup-sample-app.sql',
    tables: ['profiles', 'plus all Northwind tables']
  }
];

export function SeedDataSection() {
  const { executeScript, isConnected } = useDatabase();
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; message: string; executedAt: Date }>>({});

  const loadSeedData = async (option: SeedDataOption) => {
    if (!isConnected) {
      alert('Database not connected');
      return;
    }

    setLoading(option.id);
    
    try {
      // Fetch the SQL script from the public folder
      const response = await fetch(`/sql_scripts/${option.filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load ${option.filename}: ${response.statusText}`);
      }
      
      const sqlScript = await response.text();
      
      // Execute the script
      const result = await executeScript(sqlScript);
      
      setResults(prev => ({
        ...prev,
        [option.id]: {
          success: true,
          message: `Successfully executed ${result.successCount} statements`,
          executedAt: new Date()
        }
      }));
      
    } catch (error) {
      console.error('Error loading seed data:', error);
      setResults(prev => ({
        ...prev,
        [option.id]: {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          executedAt: new Date()
        }
      }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Seed Data</h1>
        <p className="text-muted-foreground mt-2">
          Load sample data into your database to get started with development and testing.
        </p>
      </div>

      <div className="grid gap-4">
        {seedOptions.map((option) => {
          const result = results[option.id];
          const isLoading = loading === option.id;
          
          return (
            <Card key={option.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{option.name}</CardTitle>
                      <CardDescription>{option.description}</CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {result && (
                      result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )
                    )}
                    
                    <Button
                      onClick={() => loadSeedData(option)}
                      disabled={!isConnected || isLoading}
                      size="sm"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Load Data
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tables to be created:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {option.tables.map((table) => (
                        <span
                          key={table}
                          className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded"
                        >
                          {table}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {result && (
                    <div className="mt-3 p-3 rounded-md border">
                      <div className="flex items-center space-x-2">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                            {result.success ? 'Success!' : 'Error'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {result.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.executedAt.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {!isConnected && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-yellow-800">
              <Database className="h-5 w-5" />
              <p className="text-sm font-medium">
                Database not connected. Please ensure your database connection is active before loading seed data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}