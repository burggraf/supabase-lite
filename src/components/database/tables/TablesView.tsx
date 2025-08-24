import { useState, useEffect } from 'react';
import { 
  Database as DatabaseIcon, 
  Table, 
  Plus,
  Search,
  MoreHorizontal,
  Edit3,
  Trash2,
  Eye,
  Settings,
  ExternalLink
} from 'lucide-react';
import { useDatabase } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatBytes } from '@/lib/utils';
import { CreateTableDialog } from './CreateTableDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface TableInfo {
  name: string;
  description: string;
  rows: number;
  size: string;
  columns: number;
  realtime_enabled: boolean;
}

export function TablesView() {
  const { executeQuery, isConnected } = useDatabase();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) {
      setTables([]);
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    
    const loadTables = async () => {
      try {
        if (isMounted) {
          setLoading(true);
        }
        
        const query = `
          SELECT 
            table_name as name,
            'Table description' as description,
            0 as estimated_rows,
            0 as size_bytes,
            (
              SELECT COUNT(*) 
              FROM information_schema.columns 
              WHERE table_name = t.table_name 
              AND table_schema = '${selectedSchema}'
            ) as column_count
          FROM information_schema.tables t
          WHERE t.table_schema = '${selectedSchema}'
          AND t.table_type = 'BASE TABLE'
          ORDER BY t.table_name;
        `;
        
        const result = await executeQuery(query);
        
        if (isMounted) {
          const tableInfos: TableInfo[] = result.rows.map((row: Record<string, unknown>) => ({
            name: String(row.name),
            description: String(row.description) || 'No description',
            rows: parseInt(String(row.estimated_rows)) || 0,
            size: formatBytes(parseInt(String(row.size_bytes)) || 0),
            columns: parseInt(String(row.column_count)) || 0,
            realtime_enabled: false,
          }));
          
          setTables(tableInfos);
        }
      } catch (error) {
        console.error('Error loading tables:', error);
        if (isMounted) {
          setTables([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTables();
    
    return () => {
      isMounted = false;
    };
  }, [isConnected, selectedSchema, executeQuery]);

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewTable = (tableName: string) => {
    // Navigate to table editor
    window.dispatchEvent(new CustomEvent('navigate-to-table', { 
      detail: { schema: selectedSchema, table: tableName } 
    }));
  };

  const handleEditTable = (tableName: string) => {
    console.log('Edit table:', tableName);
    // TODO: Implement table editing
  };

  const handleDeleteTable = (tableName: string) => {
    setTableToDelete(tableName);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!tableToDelete) return;

    try {
      await executeQuery(`DROP TABLE IF EXISTS "${selectedSchema}"."${tableToDelete}" CASCADE;`);
      // Refresh tables list
      const refreshEvent = new CustomEvent('refresh-tables');
      window.dispatchEvent(refreshEvent);
      setTables(prev => prev.filter(t => t.name !== tableToDelete));
    } catch (error) {
      console.error('Error deleting table:', error);
    } finally {
      setShowDeleteDialog(false);
      setTableToDelete(null);
    }
  };

  const handleTableCreated = () => {
    // Refresh tables list after creation
    const refreshEvent = new CustomEvent('refresh-tables');
    window.dispatchEvent(refreshEvent);
    // Re-load tables
    window.location.reload();
  };

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Database Tables</h1>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New table
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-6 border-b">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">schema</span>
            <select 
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading tables...</p>
            </div>
          </div>
        ) : filteredTables.length === 0 ? (
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
                  onClick={() => setShowCreateDialog(true)}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewTable(table.name)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Data
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewTable(table.name)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open in Table Editor
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEditTable(table.name)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit Table
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditTable(table.name)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Manage Columns
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteTable(table.name)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Table
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        schema={selectedSchema}
        onTableCreated={handleTableCreated}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        tableName={tableToDelete}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}