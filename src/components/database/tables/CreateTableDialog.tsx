import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, 
  AlertCircle,
  BookOpen,
  Info,
  Key,
  Trash2,
  Eye,
  EyeOff,
  Code
} from 'lucide-react';
import { useDatabase } from '@/hooks/useDatabase';
import { ColumnEditor } from './ColumnEditor';
import { CompactTypeSelector } from '../shared/CompactTypeSelector';
import { DataTypeSelector } from '../shared/DataTypeSelector';
import {
  TooltipProvider
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Column {
  id: string;
  name: string;
  type: string;
  length?: string;
  precision?: string;
  scale?: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string;
}

interface CreateTableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: string;
  onTableCreated?: () => void;
}

export function CreateTableDialog({
  open,
  onOpenChange,
  schema,
  onTableCreated
}: CreateTableDialogProps) {
  console.log('CreateTableDialog rendered, open:', open);
  const { executeQuery } = useDatabase();
  const [tableName, setTableName] = useState('');
  const [description, setDescription] = useState('');
  const [enableRLS, setEnableRLS] = useState(true);
  const [enableRealtime, setEnableRealtime] = useState(false);
  const [showSQL, setShowSQL] = useState(false);
  const [columns, setColumns] = useState<Column[]>([
    {
      id: '1',
      name: 'id',
      type: 'int8',
      nullable: false,
      primaryKey: true,
      unique: false,
      defaultValue: ''
    },
    {
      id: '2',
      name: 'created_at',
      type: 'timestamptz',
      nullable: false,
      primaryKey: false,
      unique: false,
      defaultValue: 'now()'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSQL = () => {
    if (!tableName.trim()) return '';

    let sql = `CREATE TABLE "${schema}"."${tableName}" (\n`;
    
    // Add columns
    const columnDefinitions = columns.map(col => {
      let def = `  "${col.name}" ${col.type}`;
      
      // Add length/precision/scale
      if (col.length && (col.type === 'varchar' || col.type === 'char')) {
        def += `(${col.length})`;
      } else if (col.precision && col.type === 'decimal') {
        def += `(${col.precision}${col.scale ? `, ${col.scale}` : ''})`;
      }
      
      // Add constraints
      if (!col.nullable) {
        def += ' NOT NULL';
      }
      
      if (col.unique && !col.primaryKey) {
        def += ' UNIQUE';
      }
      
      if (col.defaultValue.trim()) {
        def += ` DEFAULT ${col.defaultValue}`;
      }
      
      return def;
    });
    
    sql += columnDefinitions.join(',\n');
    
    // Add primary key constraint
    const primaryKeyColumns = columns.filter(col => col.primaryKey);
    if (primaryKeyColumns.length > 0) {
      sql += `,\n  PRIMARY KEY (${primaryKeyColumns.map(col => `"${col.name}"`).join(', ')})`;
    }
    
    sql += '\n);';
    
    // Add table comment
    if (description.trim()) {
      sql += `\n\nCOMMENT ON TABLE "${schema}"."${tableName}" IS '${description.replace(/'/g, "''")}';`;
    }
    
    // Add RLS
    if (enableRLS) {
      sql += `\n\nALTER TABLE "${schema}"."${tableName}" ENABLE ROW LEVEL SECURITY;`;
    }
    
    // Add Realtime
    if (enableRealtime) {
      sql += `\n\nALTER PUBLICATION supabase_realtime ADD TABLE "${schema}"."${tableName}";`;
    }
    
    return sql;
  };

  const generateSQLStatements = () => {
    if (!tableName.trim()) return [];

    const statements = [];

    // 1. CREATE TABLE statement
    let createTableSQL = `CREATE TABLE "${schema}"."${tableName}" (\n`;
    
    // Add columns
    const columnDefinitions = columns.map(col => {
      let def = `  "${col.name}" ${col.type}`;
      
      // Add length/precision/scale
      if (col.length && (col.type === 'varchar' || col.type === 'char')) {
        def += `(${col.length})`;
      } else if (col.precision && col.type === 'decimal') {
        def += `(${col.precision}${col.scale ? `, ${col.scale}` : ''})`;
      }
      
      // Add constraints
      if (!col.nullable) {
        def += ' NOT NULL';
      }
      
      if (col.unique && !col.primaryKey) {
        def += ' UNIQUE';
      }
      
      if (col.defaultValue.trim()) {
        def += ` DEFAULT ${col.defaultValue}`;
      }
      
      return def;
    });
    
    createTableSQL += columnDefinitions.join(',\n');
    
    // Add primary key constraint
    const primaryKeyColumns = columns.filter(col => col.primaryKey);
    if (primaryKeyColumns.length > 0) {
      createTableSQL += `,\n  PRIMARY KEY (${primaryKeyColumns.map(col => `"${col.name}"`).join(', ')})`;
    }
    
    createTableSQL += '\n);';
    statements.push(createTableSQL);
    
    // 2. Add table comment if provided
    if (description.trim()) {
      statements.push(`COMMENT ON TABLE "${schema}"."${tableName}" IS '${description.replace(/'/g, "''")}';`);
    }
    
    // 3. Add RLS if enabled
    if (enableRLS) {
      statements.push(`ALTER TABLE "${schema}"."${tableName}" ENABLE ROW LEVEL SECURITY;`);
    }
    
    // 4. Add Realtime if enabled
    if (enableRealtime) {
      statements.push(`ALTER PUBLICATION supabase_realtime ADD TABLE "${schema}"."${tableName}";`);
    }
    
    return statements;
  };

  const addColumn = () => {
    const newColumn: Column = {
      id: Date.now().toString(),
      name: '',
      type: 'text',
      nullable: true,
      primaryKey: false,
      unique: false,
      defaultValue: ''
    };
    setColumns(prev => [...prev, newColumn]);
  };

  const updateColumn = (id: string, updates: Partial<Column>) => {
    setColumns(prev => prev.map(col => 
      col.id === id ? { ...col, ...updates } : col
    ));
  };

  const removeColumn = (id: string) => {
    if (columns.length <= 1) return; // Keep at least one column
    setColumns(prev => prev.filter(col => col.id !== id));
  };

  const handleCreate = async () => {
    setError(null);
    
    // Validation
    if (!tableName.trim()) {
      setError('Table name is required');
      return;
    }
    
    if (columns.some(col => !col.name.trim())) {
      setError('All columns must have names');
      return;
    }
    
    // Check for duplicate column names
    const names = columns.map(col => col.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Column names must be unique');
      return;
    }
    
    setLoading(true);
    
    try {
      // Execute statements separately to avoid prepared statement issues
      const statements = generateSQLStatements();
      console.log('🚀 Executing table creation statements:', statements);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`⚡ Executing statement ${i + 1}:`, statement);
        const result = await executeQuery(statement);
        console.log(`✅ Statement ${i + 1} result:`, result);
      }
      
      console.log('🎉 All statements executed successfully');
      // Success
      onTableCreated?.();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      console.error('❌ Error creating table:', err);
      setError(err instanceof Error ? err.message : 'Failed to create table');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTableName('');
    setDescription('');
    setEnableRLS(true);
    setEnableRealtime(false);
    setColumns([
      {
        id: '1',
        name: 'id',
        type: 'int8',
        nullable: false,
        primaryKey: true,
        unique: false,
        defaultValue: ''
      },
      {
        id: '2',
        name: 'created_at',
        type: 'timestamptz',
        nullable: false,
        primaryKey: false,
        unique: false,
        defaultValue: 'now()'
      }
    ]);
    setError(null);
    setShowSQL(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="bg-black/5" />
        <DialogContent className="!fixed !left-auto !right-0 !top-0 !translate-x-0 !translate-y-0 h-screen w-[60vw] max-w-none m-0 p-0 rounded-none border-l border-r-0 border-t-0 border-b-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full overflow-hidden flex flex-col shadow-2xl z-50">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <DialogTitle className="text-lg">Create a new table under {schema}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
          {/* Table Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tableName" className="text-sm font-medium">Name</Label>
              <Input
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder=""
                autoFocus
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="h-9"
              />
            </div>
          </div>

          {/* Security Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="enableRLS"
                checked={enableRLS}
                onCheckedChange={(checked: boolean) => setEnableRLS(checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="enableRLS" className="text-sm">
                Enable Row Level Security (RLS)
              </Label>
              <Badge variant="secondary" className="text-xs px-2 py-0.5">Recommended</Badge>
            </div>
            
            <p className="text-xs text-gray-600 ml-7">
              Restrict access to your table by enabling RLS and writing Postgres policies.
            </p>

            {enableRLS && (
              <div className="ml-7 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">Policies are required to query data</p>
                    <p className="text-xs text-gray-600">
                      You need to create an access policy before you can query data from this table. Without 
                      a policy, querying this table will return an <strong>empty array</strong> of results. You can create 
                      policies after saving this table.
                    </p>
                    <button className="inline-flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded px-2 py-1">
                      <BookOpen className="h-3 w-3" />
                      <span>Documentation</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <Checkbox
                id="enableRealtime"
                checked={enableRealtime}
                onCheckedChange={(checked: boolean) => setEnableRealtime(checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="enableRealtime" className="text-sm">
                Enable Realtime
              </Label>
            </div>
            
            <p className="text-xs text-gray-600 ml-7">
              Broadcast changes on this table to authorized subscribers
            </p>
          </div>

          {/* Columns Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium">Columns</h3>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" className="text-xs">
                  <Info className="h-3 w-3 mr-1" />
                  About data types
                </Button>
                <Button variant="outline" size="sm" className="text-xs">
                  Import data from CSV
                </Button>
              </div>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-2 items-center text-xs text-gray-500 px-3 py-2 bg-gray-50 rounded-t border">
              <div className="col-span-1"></div>
              <div className="col-span-3 flex items-center space-x-1">
                <span>Name</span>
                <Info className="h-3 w-3" />
              </div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2 flex items-center space-x-1">
                <span>Default Value</span>
                <Info className="h-3 w-3" />
              </div>
              <div className="col-span-1 text-center">Primary</div>
              <div className="col-span-1 text-center">Required</div>
              <div className="col-span-1 text-center">Unique</div>
              <div className="col-span-1"></div>
            </div>

            {/* Column Rows */}
            <div className="border border-t-0 rounded-b">
              {columns.map((column, index) => (
                <div key={column.id} className={`${index !== columns.length - 1 ? 'border-b' : ''}`}>
                  <ColumnEditor
                    column={column}
                    onUpdate={updateColumn}
                    onRemove={removeColumn}
                    canRemove={columns.length > 1}
                  />
                </div>
              ))}
            </div>

            <Button onClick={addColumn} variant="outline" size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add column
            </Button>
          </div>

          {/* SQL Preview */}
          <Collapsible open={showSQL} onOpenChange={setShowSQL}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-center text-sm text-gray-600">
                <Eye className="h-4 w-4 mr-2" />
                Show SQL Preview
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4">
                <pre className="p-3 bg-gray-900 text-green-400 rounded text-xs font-mono overflow-x-auto">
                  {generateSQL() || 'Enter table name to see generated SQL...'}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0 flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={loading} size="sm">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={loading || !tableName.trim()}
            className="bg-green-600 hover:bg-green-700 text-white px-4"
            size="sm"
          >
            {loading ? 'Creating...' : 'Save'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}