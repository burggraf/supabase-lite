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
  Trash2, 
  Key, 
  AlertCircle,
  Code,
  Eye,
  EyeOff
} from 'lucide-react';
import { useDatabase } from '@/hooks/useDatabase';
import { DataTypeSelector } from '../shared/DataTypeSelector';
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
  const [columns, setColumns] = useState<Column[]>([
    {
      id: '1',
      name: 'id',
      type: 'bigserial',
      nullable: false,
      primaryKey: true,
      unique: false,
      defaultValue: ''
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSQL, setShowSQL] = useState(false);

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
    
    return sql;
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
      const sql = generateSQL();
      await executeQuery(sql);
      
      // Success
      onTableCreated?.();
      onOpenChange(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTableName('');
    setDescription('');
    setEnableRLS(true);
    setColumns([
      {
        id: '1',
        name: 'id',
        type: 'bigserial',
        nullable: false,
        primaryKey: true,
        unique: false,
        defaultValue: ''
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
          <div className="space-y-2">
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
            <p className="text-xs text-muted-foreground">
              RLS ensures that users can only access rows they're authorized to see
            </p>
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

            <div className="space-y-3">
              {columns.map((column, index) => (
                <div key={column.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">Column {index + 1}</span>
                      {column.primaryKey && (
                        <Badge variant="default" className="text-xs">
                          <Key className="h-3 w-3 mr-1" />
                          Primary Key
                        </Badge>
                      )}
                    </div>
                    {columns.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(column.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Column Name *</Label>
                      <Input
                        value={column.name}
                        onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                        placeholder="column_name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Value</Label>
                      <Input
                        value={column.defaultValue}
                        onChange={(e) => updateColumn(column.id, { defaultValue: e.target.value })}
                        placeholder="NULL, '', now(), etc."
                      />
                    </div>
                  </div>

                  <DataTypeSelector
                    value={column.type}
                    onChange={(type) => updateColumn(column.id, { type })}
                    length={column.length}
                    onLengthChange={(length) => updateColumn(column.id, { length })}
                    precision={column.precision}
                    onPrecisionChange={(precision) => updateColumn(column.id, { precision })}
                    scale={column.scale}
                    onScaleChange={(scale) => updateColumn(column.id, { scale })}
                    showCommonOnly={true}
                  />

                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`nullable-${column.id}`}
                        checked={!column.nullable}
                        onCheckedChange={(checked: boolean) => updateColumn(column.id, { nullable: !checked })}
                      />
                      <Label htmlFor={`nullable-${column.id}`} className="text-sm">
                        Not NULL
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`primaryKey-${column.id}`}
                        checked={column.primaryKey}
                        onCheckedChange={(checked: boolean) => updateColumn(column.id, { primaryKey: checked })}
                      />
                      <Label htmlFor={`primaryKey-${column.id}`} className="text-sm">
                        Primary Key
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`unique-${column.id}`}
                        checked={column.unique}
                        onCheckedChange={(checked: boolean) => updateColumn(column.id, { unique: checked })}
                      />
                      <Label htmlFor={`unique-${column.id}`} className="text-sm">
                        Unique
                      </Label>
                    </div>
                  </div>
                </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading || !tableName.trim()}>
            {loading ? 'Creating...' : 'Create Table'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}