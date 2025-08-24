import { useState } from 'react';
import { 
  Database as DatabaseIcon, 
  Table, 
  Plus,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CreateTableDialog } from './CreateTableDialog';

interface TableInfo {
  name: string;
  description: string;
  rows: number;
  size: string;
  columns: number;
  realtime_enabled: boolean;
}

export function TablesView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Mock data for now
  const tables: TableInfo[] = [
    {
      name: 'users',
      description: 'User accounts table',
      rows: 150,
      size: '2.5 KB',
      columns: 8,
      realtime_enabled: true
    },
    {
      name: 'products',
      description: 'Product catalog',
      rows: 45,
      size: '1.2 KB',
      columns: 6,
      realtime_enabled: false
    }
  ];

  // Simple test handlers
  const handleNewTable = () => {
    console.log('NEW TABLE BUTTON CLICKED!');
    setShowCreateDialog(true);
  };

  const handleTest = () => {
    console.log('TEST BUTTON CLICKED!');
    alert('Test button works! 🎉');
  };


  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  console.log('TablesView rendering', { 
    tables: tables.length, 
    filteredTables: filteredTables.length,
    selectedSchema 
  });

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Database Tables (Simplified)</h1>
          <div className="flex items-center space-x-2">
            <Button onClick={handleTest} variant="outline">
              TEST
            </Button>
            <Button onClick={handleNewTable}>
              <Plus className="h-4 w-4 mr-2" />
              New table
            </Button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-b">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">schema</span>
            <select 
              value={selectedSchema}
              onChange={(e) => {
                console.log('Schema changed to:', e.target.value);
                setSelectedSchema(e.target.value);
              }}
              className="border rounded px-3 py-1 text-sm bg-background"
            >
              <option value="public">public</option>
              <option value="auth">auth</option>
              <option value="storage">storage</option>
              <option value="realtime">realtime</option>
            </select>
          </div>
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search for a table"
                value={searchTerm}
                onChange={(e) => {
                  console.log('Search term:', e.target.value);
                  setSearchTerm(e.target.value);
                }}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto">
        {filteredTables.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <DatabaseIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-lg font-medium">No tables found</p>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'No tables match your search.' : 'Create your first table to get started.'}
              </p>
              {!searchTerm && (
                <Button 
                  className="mt-4" 
                  onClick={handleNewTable}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Table
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-2">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                <div className="col-span-3">Name</div>
                <div className="col-span-4">Description</div>
                <div className="col-span-1 text-center">Rows<br/>(Estimated)</div>
                <div className="col-span-1 text-center">Size<br/>(Estimated)</div>
                <div className="col-span-1 text-center">Realtime<br/>Enabled</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Table Rows */}
              {filteredTables.map((table) => (
                <div
                  key={table.name}
                  className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="col-span-3 flex items-center space-x-2">
                    <Table className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium">{table.name}</span>
                  </div>
                  <div className="col-span-4 text-sm text-muted-foreground">
                    {table.description}
                  </div>
                  <div className="col-span-1 text-center text-sm">
                    {table.rows.toLocaleString()}
                  </div>
                  <div className="col-span-1 text-center text-sm">
                    {table.size}
                  </div>
                  <div className="col-span-1 text-center">
                    <Badge variant={table.realtime_enabled ? "default" : "secondary"}>
                      {table.realtime_enabled ? "✓" : "✗"}
                    </Badge>
                  </div>
                  <div className="col-span-2 flex items-center justify-end space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {table.columns} columns
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        console.log('Table actions clicked:', table.name);
                        alert(`Actions for table: ${table.name}`);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Table Dialog */}
      <CreateTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        schema={selectedSchema}
        onTableCreated={() => {
          console.log('Table created successfully');
          // Refresh tables would go here
        }}
      />
    </>
  );
}