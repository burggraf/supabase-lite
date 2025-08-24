import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Table</DialogTitle>
          <DialogDescription>
            Create a new table in the <code>{schema}</code> schema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Table Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tableName">Table Name *</Label>
              <Input
                id="tableName"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="users, products, orders..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this table"
              />
            </div>
          </div>

          {/* Security Options */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enableRLS"
                  checked={enableRLS}
                  onCheckedChange={(checked: boolean) => setEnableRLS(checked)}
                />
                <Label htmlFor="enableRLS" className="text-sm font-medium">
                  Enable Row Level Security (RLS)
                </Label>
                <Badge variant="secondary" className="text-xs">Recommended</Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="enableRealtime"
                  checked={enableRealtime}
                  onCheckedChange={(checked: boolean) => setEnableRealtime(checked)}
                />
                <Label htmlFor="enableRealtime" className="text-sm font-medium">
                  Enable Realtime
                </Label>
              </div>
            </div>

            {enableRLS && (
              <Alert className="bg-amber-50 border-amber-200">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Row Level Security is enabled</p>
                    <p className="text-xs">
                      Your table is protected by RLS. Only data your users are authorized to see will be returned from queries.
                      You can configure access in Authentication {'>'} Policies after creating this table.
                    </p>
                    <a 
                      href="https://supabase.com/docs/guides/auth/row-level-security" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>Learn more about RLS</span>
                    </a>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Columns Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Columns</h3>
              <Button onClick={addColumn} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Column
              </Button>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-3 items-center text-xs font-medium text-muted-foreground px-3 py-2 border-b">
              <div className="col-span-1"></div>
              <div className="col-span-3">Name</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Default Value</div>
              <div className="col-span-1 text-center">Primary</div>
              <div className="col-span-1 text-center">Required</div>
              <div className="col-span-1 text-center">Unique</div>
              <div className="col-span-1"></div>
            </div>

            {/* Column Rows */}
            <div className="space-y-1">
              {columns.map((column) => (
                <ColumnEditor
                  key={column.id}
                  column={column}
                  onUpdate={updateColumn}
                  onRemove={removeColumn}
                  canRemove={columns.length > 1}
                />
              ))}
            </div>
          </div>

          {/* SQL Preview */}
          <Collapsible open={showSQL} onOpenChange={setShowSQL}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full">
                {showSQL ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showSQL ? 'Hide' : 'Show'} SQL Preview
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Code className="h-4 w-4" />
                  <Label>Generated SQL</Label>
                </div>
                <pre className="p-3 bg-muted rounded-lg text-sm font-mono overflow-x-auto">
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={loading || !tableName.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Creating...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}