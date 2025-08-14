import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import type { CellEditProps } from '@/types';

export function CellEditor({ value, column, onSave, onCancel }: CellEditProps) {
  const [editValue, setEditValue] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = () => {
    let processedValue = editValue;
    
    // Process value based on data type
    if (column.data_type.includes('int') || column.data_type.includes('serial')) {
      processedValue = editValue === '' ? null : parseInt(editValue, 10);
    } else if (column.data_type.includes('numeric') || column.data_type.includes('decimal') || column.data_type.includes('float')) {
      processedValue = editValue === '' ? null : parseFloat(editValue);
    } else if (column.data_type.includes('bool')) {
      processedValue = editValue === 'true' || editValue === '1' || editValue === 'yes';
    } else if (column.data_type.includes('timestamp') || column.data_type.includes('date')) {
      if (editValue === '') {
        processedValue = null;
      } else {
        // Validate date format
        const date = new Date(editValue);
        if (isNaN(date.getTime())) {
          alert('Invalid date format');
          return;
        }
        processedValue = editValue;
      }
    }
    
    onSave(processedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const getInputType = () => {
    if (column.data_type.includes('int') || column.data_type.includes('serial') || 
        column.data_type.includes('numeric') || column.data_type.includes('decimal') || 
        column.data_type.includes('float')) {
      return 'number';
    } else if (column.data_type.includes('date')) {
      return 'date';
    } else if (column.data_type.includes('timestamp')) {
      return 'datetime-local';
    } else if (column.data_type.includes('time')) {
      return 'time';
    }
    return 'text';
  };

  const getPlaceholder = () => {
    if (column.data_type.includes('bool')) {
      return 'true/false';
    } else if (column.data_type.includes('timestamp')) {
      return 'YYYY-MM-DD HH:MM:SS';
    } else if (column.data_type.includes('date')) {
      return 'YYYY-MM-DD';
    }
    return `Enter ${column.data_type}...`;
  };

  // Special handling for boolean values
  if (column.data_type.includes('bool')) {
    return (
      <div className="flex items-center gap-1 p-1">
        <select
          ref={inputRef as any}
          value={editValue?.toString() || 'false'}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 text-sm border rounded"
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <Button size="sm" variant="ghost" onClick={handleSave} className="h-6 w-6 p-0">
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 w-6 p-0">
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 p-1">
      <Input
        ref={inputRef}
        type={getInputType()}
        value={editValue?.toString() || ''}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={getPlaceholder()}
        className="flex-1 h-8 text-sm"
      />
      <Button size="sm" variant="ghost" onClick={handleSave} className="h-6 w-6 p-0">
        <Check className="h-3 w-3" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel} className="h-6 w-6 p-0">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}