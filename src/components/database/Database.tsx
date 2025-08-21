import { useState, useEffect } from 'react';
import { 
  Database as DatabaseIcon, 
  Table, 
  Plus,
  Search,
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
  List
} from 'lucide-react';
import { useDatabase } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, formatBytes } from '@/lib/utils';
import { SeedDataSection } from './SeedDataSection';

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
      { id: 'seed-data', label: 'TEST SEED DATA', icon: Plus },
      { id: 'replication', label: 'Replication', icon: Database, badge: 'Coming Soon' },
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

export function Database() {
  console.log('🔥 Database component render start');
  
  const { executeQuery, isConnected } = useDatabase();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('public');
  const [activeSection, setActiveSection] = useState('tables');
  
  console.log('🔥 Database component state:', { 
    isConnected, 
    tablesCount: tables.length, 
    loading, 
    selectedSchema 
  });

  useEffect(() => {
    console.log('🔥 Database useEffect triggered:', { isConnected, selectedSchema });
    
    // Only proceed if database is actually connected
    if (!isConnected) {
      console.log('🔥 Database not connected, setting empty state');
      setTables([]);
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    
    const loadTables = async () => {
      console.log('🔥 loadTables called for connected database');
      
      try {
        console.log('🔥 Starting table load for schema:', selectedSchema);
        if (isMounted) {
          setLoading(true);
        }
        
        // Use a simpler query that works reliably with PGlite
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
        
        console.log('🔥 Executing query:', query);
        const result = await executeQuery(query);
        console.log('🔥 Query result:', { rowCount: result.rows.length, rows: result.rows });
        
        if (isMounted) {
          console.log('🔥 Processing query results');
          const tableInfos: TableInfo[] = result.rows.map((row: Record<string, unknown>) => ({
            name: String(row.name),
            description: String(row.description) || 'No description',
            rows: parseInt(String(row.estimated_rows)) || 0,
            size: formatBytes(parseInt(String(row.size_bytes)) || 0),
            columns: parseInt(String(row.column_count)) || 0,
            realtime_enabled: false, // TODO: Check realtime status
          }));
          
          console.log('🔥 Setting tables:', tableInfos);
          setTables(tableInfos);
        }
      } catch (error) {
        console.error('🔥 Error loading tables:', error);
        if (isMounted) {
          setTables([]);
        }
      } finally {
        console.log('🔥 loadTables finally block');
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTables();
    
    return () => {
      console.log('🔥 Database useEffect cleanup');
      isMounted = false;
    };
  }, [isConnected, selectedSchema]);
  
  console.log('🔥 Database component about to render UI');

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Database Tables</h1>
                <Button>
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
                className="border rounded px-3 py-1 text-sm"
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
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
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
    </div>
  );
}