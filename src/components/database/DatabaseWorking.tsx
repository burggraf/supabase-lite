import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Database as DatabaseIcon, 
  Table,
  MoreHorizontal,
  Users,
  Settings,
  Shield,
  FolderOpen,
  Zap,
  Code,
  BarChart3,
  Key,
  Link,
  List,
  Eye,
  Edit,
  Trash2,
  Copy,
  Upload
} from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';
import { SeedDataSection } from './SeedDataSection';
import { LoadDataSection } from './LoadDataSection';
import { BackupsSection } from './BackupsSection';
import { CreateTableDialog } from './tables/CreateTableDialog';

interface TableInfo {
  name: string;
  description: string;
  rows: number;
  size: string;
  columns: number;
  realtime_enabled: boolean;
}

const sidebarSections = [
  {
    title: 'DATABASE MANAGEMENT',
    items: [
      { id: 'schema', label: 'Schema Visualizer', icon: BarChart3 },
      { id: 'tables', label: 'Tables', icon: Table },
      { id: 'functions', label: 'Functions', icon: Code },
      { id: 'triggers', label: 'Triggers', icon: Zap },
      { id: 'types', label: 'Enumerated Types', icon: List },
      { id: 'extensions', label: 'Extensions', icon: Plus },
      { id: 'indexes', label: 'Indexes', icon: Key },
      { id: 'publications', label: 'Publications', icon: Link },
      { id: 'seed-data', label: 'Seed Data', icon: Plus },
      { id: 'load-data', label: 'Load Data', icon: Upload },
      { id: 'replication', label: 'Replication', icon: DatabaseIcon, badge: 'Coming Soon' },
    ]
  },
  {
    title: 'CONFIGURATION',
    items: [
      { id: 'roles', label: 'Roles', icon: Users },
      { id: 'policies', label: 'Policies', icon: Shield },
      { id: 'settings', label: 'Settings', icon: Settings },
    ]
  },
  {
    title: 'PLATFORM',
    items: [
      { id: 'backups', label: 'Backups', icon: FolderOpen },
      { id: 'migrations', label: 'Migrations', icon: BarChart3 },
      { id: 'wrappers', label: 'Wrappers', icon: Code },
      { id: 'webhooks', label: 'Webhooks', icon: Link },
    ]
  },
  {
    title: 'TOOLS',
    items: [
      { id: 'security', label: 'Security Advisor', icon: Shield },
      { id: 'performance', label: 'Performance Advisor', icon: BarChart3 },
      { id: 'query-perf', label: 'Query Performance', icon: BarChart3 },
    ]
  }
];

export function DatabaseWorking() {
  const { executeQuery, isConnected } = useDatabase();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [activeSection, setActiveSection] = useState('tables');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadTables = useCallback(async () => {
    if (!isConnected) {
      setTables([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
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
      
      const tableInfos: TableInfo[] = result.rows.map((row: any) => ({
        name: String(row.name),
        description: String(row.description) || 'No description',
        rows: parseInt(String(row.estimated_rows)) || 0,
        size: formatBytes(parseInt(String(row.size_bytes)) || 0),
        columns: parseInt(String(row.column_count)) || 0,
        realtime_enabled: false,
      }));
      
      // Don't show mock tables anymore - show real tables or empty list
      setTables(tableInfos);
    } catch (err) {
      console.error('Error loading tables:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tables');
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [isConnected, selectedSchema, executeQuery]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <DatabaseIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Database Not Connected</h2>
          <p className="text-sm text-muted-foreground">Waiting for database to initialize...</p>
        </div>
      </div>
    );
  }

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
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Database Management Sidebar */}
      <div className="w-64 bg-card border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Database</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {sidebarSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                        activeSection === item.id 
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        item.badge === 'Coming Soon' && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => {
                        if (item.badge !== 'Coming Soon') {
                          setActiveSection(item.id);
                        }
                      }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {activeSection === 'seed-data' ? (
          <SeedDataSection />
        ) : activeSection === 'load-data' ? (
          <LoadDataSection />
        ) : activeSection === 'backups' ? (
          <BackupsSection />
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Database Tables</h1>
            <Button onClick={() => {
              console.log('NEW TABLE BUTTON CLICKED!');
              setShowCreateDialog(true);
            }}>
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
              <Select value={selectedSchema} onValueChange={setSelectedSchema}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">public</SelectItem>
                  <SelectItem value="auth">auth</SelectItem>
                  <SelectItem value="storage">storage</SelectItem>
                  <SelectItem value="realtime">realtime</SelectItem>
                </SelectContent>
              </Select>
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
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <h2 className="text-lg font-medium mb-2">Error</h2>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => window.location.reload()}>
                  Reload
                </Button>
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
                          <Button 
                            variant="ghost" 
                            size="sm"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            console.log('View table:', table.name);
                            alert(`👀 View table: ${table.name}`);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View table
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            console.log('Edit table:', table.name);
                            alert(`✏️ Edit table: ${table.name}`);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit table
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            console.log('Duplicate table:', table.name);
                            alert(`📋 Duplicate table: ${table.name}`);
                          }}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate table
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              console.log('Delete table:', table.name);
                              alert(`🗑️ Delete table: ${table.name}`);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete table
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
          </>
        )}
      </div>

      {/* Create Table Dialog */}
      <CreateTableDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        schema={selectedSchema}
        onTableCreated={() => {
          console.log('🔄 onTableCreated callback triggered');
          console.log('🔍 isConnected:', isConnected);
          console.log('📊 current selectedSchema:', selectedSchema);
          // Refresh tables after creation
          if (isConnected) {
            console.log('🔄 Calling loadTables() to refresh table list');
            loadTables();
          } else {
            console.log('❌ Not connected, skipping table refresh');
          }
        }}
      />
    </div>
  );
}