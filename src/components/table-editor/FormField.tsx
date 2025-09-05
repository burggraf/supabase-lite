import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ColumnInfo } from '@/types';

interface FormFieldProps {
  column: ColumnInfo;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export function FormField({ column, value, onChange, error, disabled = false }: FormFieldProps) {
  const [localValue, setLocalValue] = useState(value || '');

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    
    // Process value based on column type
    let processedValue: unknown = newValue;
    
    if (newValue === '' || newValue === null) {
      processedValue = column.is_nullable === 'YES' ? null : '';
    } else {
      const dataType = column.data_type.toLowerCase();
      
      if (dataType.includes('int') || dataType.includes('serial')) {
        const intValue = parseInt(newValue, 10);
        processedValue = isNaN(intValue) ? null : intValue;
      } else if (dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('float')) {
        const floatValue = parseFloat(newValue);
        processedValue = isNaN(floatValue) ? null : floatValue;
      } else if (dataType.includes('bool')) {
        processedValue = newValue === 'true';
      } else if (dataType.includes('timestamp') || dataType.includes('date')) {
        processedValue = newValue || null;
      } else {
        processedValue = newValue;
      }
    }
    
    onChange(processedValue);
  };

  const getInputType = () => {
    const dataType = column.data_type.toLowerCase();
    
    if (dataType.includes('int') || dataType.includes('serial') || dataType.includes('numeric') || dataType.includes('decimal') || dataType.includes('float')) {
      return 'number';
    } else if (dataType.includes('date')) {
      return 'date';
    } else if (dataType.includes('timestamp')) {
      return 'datetime-local';
    } else if (dataType.includes('time')) {
      return 'time';
    } else {
      return 'text';
    }
  };

  const getPlaceholder = () => {
    const dataType = column.data_type.toLowerCase();
    
    if (column.column_default) {
      if (column.column_default.includes('gen_random_uuid')) {
        return 'Default: gen_random_uuid()';
      } else if (column.column_default.includes('now')) {
        return 'Default: now()';
      } else {
        return `Default: ${column.column_default}`;
      }
    }
    
    if (dataType.includes('uuid')) {
      return 'Enter UUID or leave empty for auto-generation';
    } else if (dataType.includes('timestamp')) {
      return 'YYYY-MM-DD HH:MM:SS';
    } else if (dataType.includes('date')) {
      return 'YYYY-MM-DD';
    } else if (dataType.includes('time')) {
      return 'HH:MM:SS';
    } else if (dataType.includes('bool')) {
      return 'true or false';
    } else {
      return `Enter ${column.data_type}`;
    }
  };

  const renderField = () => {
    const dataType = column.data_type.toLowerCase();
    
    if (dataType.includes('bool')) {
      return (
        <Select value={localValue?.toString() || ''} onValueChange={handleChange} disabled={disabled}>
          <SelectTrigger className={cn(error && "border-destructive")}>
            <SelectValue placeholder="Select boolean value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">NULL</SelectItem>
            <SelectItem value="true">true</SelectItem>
            <SelectItem value="false">false</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    
    return (
      <Input
        type={getInputType()}
        value={localValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(e.target.value)}
        placeholder={getPlaceholder()}
        disabled={disabled}
        className={cn(error && "border-destructive")}
        step={dataType.includes('float') || dataType.includes('numeric') ? "any" : undefined}
      />
    );
  };

  const isRequired = column.is_nullable === 'NO' && !column.column_default;

  return (
    <div className="space-y-2">
      <Label htmlFor={column.column_name} className={cn(isRequired && "after:content-['*'] after:ml-0.5 after:text-destructive")}>
        {column.column_name}
        <span className="ml-2 text-xs text-muted-foreground">
          {column.data_type}
          {column.is_primary_key && ' (PK)'}
        </span>
      </Label>
      {renderField()}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {column.is_nullable === 'YES' && !column.is_primary_key && (
        <p className="text-xs text-muted-foreground">Optional field</p>
      )}
    </div>
  );
}