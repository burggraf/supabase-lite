import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Table, 
  Plus,
  Database,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import type { TableInfo } from '@/types';

interface TableSidebarProps {
  tables: TableInfo[];
  selectedTable: string;
  selectedSchema: string;
  onTableSelect: (tableName: string, schema: string) => void;
  loading?: boolean;
}

export function TableSidebar({
  tables,
  selectedTable,
  selectedSchema,
  onTableSelect,
  loading = false,
}: TableSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set(['public']));

  // Group tables by schema
  const tablesBySchema = tables.reduce((acc, table) => {
    if (!acc[table.schema]) {
      acc[table.schema] = [];
    }
    acc[table.schema].push(table);
    return acc;
  }, {} as Record<string, TableInfo[]>);

  // Filter tables based on search
  const filteredTablesBySchema = Object.entries(tablesBySchema).reduce((acc, [schema, schemaTables]) => {
    const filtered = schemaTables.filter(table => 
      table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      schema.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[schema] = filtered;
    }
    return acc;
  }, {} as Record<string, TableInfo[]>);

  const toggleSchema = (schema: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schema)) {
      newExpanded.delete(schema);
    } else {
      newExpanded.add(schema);
    }
    setExpandedSchemas(newExpanded);
  };

  const isSelected = (table: TableInfo) => {
    return table.name === selectedTable && table.schema === selectedSchema;
  };

  return (
    <div className="w-80 border-r bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Table className="h-5 w-5" />
            Table Editor
          </h2>
          <Button variant="ghost" size="sm" disabled>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading tables...
          </div>
        ) : Object.keys(filteredTablesBySchema).length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? 'No tables found' : 'No tables available'}
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(filteredTablesBySchema).map(([schema, schemaTables]) => (
              <div key={schema} className="mb-1">
                {/* Schema Header */}
                <button
                  onClick={() => toggleSchema(schema)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                >
                  {expandedSchemas.has(schema) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Database className="h-4 w-4" />
                  <span>{schema}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {schemaTables.length}
                  </Badge>
                </button>

                {/* Tables in Schema */}
                {expandedSchemas.has(schema) && (
                  <div className="ml-6">
                    {schemaTables.map((table) => (
                      <button
                        key={`${table.schema}.${table.name}`}
                        onClick={() => onTableSelect(table.name, table.schema)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors group ${
                          isSelected(table)
                            ? 'bg-primary/10 text-primary border-r-2 border-primary'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Table className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{table.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {table.rows} rows
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground">
          {tables.length} table{tables.length !== 1 ? 's' : ''} total
        </div>
      </div>
    </div>
  );
}