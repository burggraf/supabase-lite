import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FormField } from './FormField';
import { Loader2 } from 'lucide-react';
import type { ColumnInfo } from '@/types';

interface InsertRowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnInfo[];
  tableName: string;
  schema: string;
  onInsert: (data: Record<string, any>) => Promise<boolean>;
  loading?: boolean;
}

export function InsertRowDialog({
  open,
  onOpenChange,
  columns,
  tableName,
  onInsert,
  loading = false,
}: InsertRowDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      const initialData: Record<string, any> = {};
      columns.forEach(column => {
        // Set default values for columns that have them
        if (column.column_default) {
          if (column.column_default.includes('now()')) {
            const now = new Date();
            if (column.data_type.includes('timestamp')) {
              initialData[column.column_name] = now.toISOString().slice(0, 19);
            } else if (column.data_type.includes('date')) {
              initialData[column.column_name] = now.toISOString().split('T')[0];
            }
          }
          // For UUID with gen_random_uuid(), we'll let the database handle it
        } else {
          initialData[column.column_name] = null;
        }
      });
      setFormData(initialData);
      setErrors({});
    }
  }, [open, columns]);

  const handleFieldChange = (columnName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [columnName]: value,
    }));
    
    // Clear error for this field
    if (errors[columnName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[columnName];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    columns.forEach(column => {
      // Skip validation for auto-generated primary keys
      if (column.is_primary_key && column.column_default) {
        return;
      }
      
      const value = formData[column.column_name];
      const isEmpty = value === null || value === undefined || value === '';
      
      // Check required fields
      if (column.is_nullable === 'NO' && !column.column_default && isEmpty) {
        newErrors[column.column_name] = `${column.column_name} is required`;
      }
      
      // Type-specific validation
      if (!isEmpty) {
        const dataType = column.data_type.toLowerCase();
        
        if (dataType.includes('int') || dataType.includes('serial')) {
          if (isNaN(Number(value))) {
            newErrors[column.column_name] = 'Must be a valid integer';
          }
        } else if (dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('float')) {
          if (isNaN(Number(value))) {
            newErrors[column.column_name] = 'Must be a valid number';
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Prepare data for insertion - exclude null values for columns with defaults
      const insertData: Record<string, any> = {};
      
      columns.forEach(column => {
        const value = formData[column.column_name];
        
        // Skip auto-generated columns if they're empty
        if (column.column_default && (value === null || value === undefined || value === '')) {
          return;
        }
        
        insertData[column.column_name] = value;
      });
      
      const success = await onInsert(insertData);
      
      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Failed to insert row:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Separate required and optional fields
  const requiredFields = columns.filter(col => 
    col.is_nullable === 'NO' && !col.column_default
  );
  const optionalFields = columns.filter(col => 
    col.is_nullable === 'YES' || col.column_default
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add new row to {tableName}</DialogTitle>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-y-auto pr-4">
          <div className="space-y-6">
            {/* Required Fields Section */}
            {requiredFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-4">Required Fields</h3>
                <div className="space-y-4">
                  {requiredFields.map((column) => (
                    <FormField
                      key={column.column_name}
                      column={column}
                      value={formData[column.column_name]}
                      onChange={(value) => handleFieldChange(column.column_name, value)}
                      error={errors[column.column_name]}
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Optional Fields Section */}
            {optionalFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-4">
                  Optional Fields
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    These are columns that do not need any value
                  </span>
                </h3>
                <div className="space-y-4">
                  {optionalFields.map((column) => (
                    <FormField
                      key={column.column_name}
                      column={column}
                      value={formData[column.column_name]}
                      onChange={(value) => handleFieldChange(column.column_name, value)}
                      error={errors[column.column_name]}
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}