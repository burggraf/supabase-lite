import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Calendar, Clock, Loader2 } from 'lucide-react';
import type { ColumnInfo } from '@/types';

interface RowEditPanelProps {
  isOpen: boolean;
  onClose: () => void;
  row: Record<string, unknown> | null;
  columns: ColumnInfo[];
  tableName: string;
  schema: string;
  onSave: (data: Record<string, unknown>) => Promise<boolean>;
  loading?: boolean;
}

export function RowEditPanel({
  isOpen,
  onClose,
  row,
  columns,
  tableName,
  schema: _schema,
  onSave,
  loading = false,
}: RowEditPanelProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when row changes
  useEffect(() => {
    if (row) {
      setFormData({ ...row });
    }
  }, [row]);

  const handleFieldChange = (columnName: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [columnName]: value,
    }));
  };

  const handleSave = async () => {
    if (!row) return;
    
    setIsSaving(true);
    try {
      const success = await onSave(formData);
      if (success) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (row) {
      setFormData({ ...row });
    }
    onClose();
  };

  const renderFieldInput = (column: ColumnInfo) => {
    const value = formData[column.column_name];

    // Handle different data types
    if (column.data_type.includes('bool')) {
      return (
        <select
          value={value?.toString() || 'false'}
          onChange={(e) => handleFieldChange(column.column_name, e.target.value === 'true')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    if (column.data_type.includes('text') && column.data_type !== 'text') {
      return (
        <Textarea
          value={value?.toString() || ''}
          onChange={(e) => handleFieldChange(column.column_name, e.target.value || null)}
          placeholder={`Enter ${column.data_type}...`}
          rows={3}
        />
      );
    }

    const getInputType = () => {
      if (column.data_type.includes('int') || column.data_type.includes('serial') ||
          column.data_type.includes('numeric') || column.data_type.includes('decimal') ||
          column.data_type.includes('float')) {
        return 'number';
      } else if (column.data_type.includes('date') && !column.data_type.includes('timestamp')) {
        return 'date';
      } else if (column.data_type.includes('timestamp')) {
        return 'datetime-local';
      } else if (column.data_type.includes('time')) {
        return 'time';
      }
      return 'text';
    };

    const getPlaceholder = () => {
      if (column.data_type.includes('timestamp')) {
        return 'YYYY-MM-DD HH:MM:SS';
      } else if (column.data_type.includes('date')) {
        return 'YYYY-MM-DD';
      } else if (column.data_type.includes('time')) {
        return 'HH:MM:SS';
      }
      return `Enter ${column.data_type}...`;
    };

    const handleValueChange = (inputValue: string) => {
      if (inputValue === '') {
        handleFieldChange(column.column_name, null);
        return;
      }

      let processedValue: any = inputValue;
      
      if (column.data_type.includes('int') || column.data_type.includes('serial')) {
        processedValue = parseInt(inputValue, 10);
      } else if (column.data_type.includes('numeric') || column.data_type.includes('decimal') || column.data_type.includes('float')) {
        processedValue = parseFloat(inputValue);
      }
      
      handleFieldChange(column.column_name, processedValue);
    };

    // Format value for display in input
    const formatValueForInput = (val: unknown) => {
      if (val === null || val === undefined) return '';
      if (column.data_type.includes('timestamp')) {
        try {
          const date = new Date(val as string | number | Date);
          return date.toISOString().slice(0, 16); // Format for datetime-local
        } catch {
          return String(val);
        }
      }
      return String(val);
    };

    return (
      <div className="relative">
        <Input
          type={getInputType()}
          value={formatValueForInput(value)}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={getPlaceholder()}
        />
        {(column.data_type.includes('date') || column.data_type.includes('time')) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {column.data_type.includes('time') ? (
              <Clock className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Calendar className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    );
  };

  // Group columns into required and optional
  const requiredColumns = columns.filter(col => col.is_nullable === 'NO' && !col.column_default);
  const optionalColumns = columns.filter(col => col.is_nullable === 'YES' || col.column_default);

  if (!isOpen || !row) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={handleCancel} />
      
      {/* Panel */}
      <div className="relative ml-auto w-[600px] h-full bg-background border-l shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Update row from {tableName}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Edit the values for this row and save your changes
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Required Fields */}
            {requiredColumns.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-medium">Required Fields</h3>
                  <Badge variant="secondary" className="text-xs">
                    {requiredColumns.length} fields
                  </Badge>
                </div>
                <div className="space-y-4">
                  {requiredColumns.map((column) => (
                    <div key={column.column_name} className="space-y-2">
                      <Label htmlFor={column.column_name} className="flex items-center gap-2">
                        <span>{column.column_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {column.data_type}
                        </Badge>
                        {column.is_primary_key && (
                          <Badge variant="default" className="text-xs">
                            PK
                          </Badge>
                        )}
                        <span className="text-red-500">*</span>
                      </Label>
                      {renderFieldInput(column)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Fields */}
            {optionalColumns.length > 0 && (
              <div>
                {requiredColumns.length > 0 && <Separator />}
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-medium">Optional Fields</h3>
                  <Badge variant="secondary" className="text-xs">
                    {optionalColumns.length} fields
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    These are columns that do not need any value
                  </p>
                </div>
                <div className="space-y-4">
                  {optionalColumns.map((column) => (
                    <div key={column.column_name} className="space-y-2">
                      <Label htmlFor={column.column_name} className="flex items-center gap-2">
                        <span>{column.column_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {column.data_type}
                        </Badge>
                        {column.is_primary_key && (
                          <Badge variant="default" className="text-xs">
                            PK
                          </Badge>
                        )}
                        {column.column_default && (
                          <Badge variant="secondary" className="text-xs">
                            Default: {column.column_default}
                          </Badge>
                        )}
                      </Label>
                      {renderFieldInput(column)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || loading}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}