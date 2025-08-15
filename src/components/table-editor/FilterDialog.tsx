import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, X } from 'lucide-react';
import type { FilterRule, FilterOperator, ColumnInfo } from '@/types';

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnInfo[];
  filters: FilterRule[];
  onFiltersChange: (filters: FilterRule[]) => void;
  onApplyFilters: () => void;
}

const operatorOptions: { value: FilterOperator; label: string; symbol: string }[] = [
  { value: 'equals', label: 'equals', symbol: '=' },
  { value: 'not_equal', label: 'not equal', symbol: '<>' },
  { value: 'greater_than', label: 'greater than', symbol: '>' },
  { value: 'less_than', label: 'less than', symbol: '<' },
  { value: 'greater_than_or_equal', label: 'greater than or equal', symbol: '>=' },
  { value: 'less_than_or_equal', label: 'less than or equal', symbol: '<=' },
  { value: 'like', label: 'like operator', symbol: '~~' },
  { value: 'ilike', label: 'ilike operator', symbol: '~~*' },
  { value: 'in', label: 'one of a list of values', symbol: 'in' },
  { value: 'is', label: 'checking for (null,not null,true,false)', symbol: 'is' },
];

export function FilterDialog({
  open,
  onOpenChange,
  columns,
  filters,
  onFiltersChange,
  onApplyFilters,
}: FilterDialogProps) {
  const [localFilters, setLocalFilters] = useState<FilterRule[]>(filters);

  const addFilter = () => {
    const newFilter: FilterRule = {
      id: Math.random().toString(36).slice(2, 11),
      column: columns[0]?.column_name || '',
      operator: 'equals',
      value: '',
    };
    setLocalFilters([...localFilters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    setLocalFilters(localFilters.map(filter => 
      filter.id === id ? { ...filter, ...updates } : filter
    ));
  };

  const removeFilter = (id: string) => {
    setLocalFilters(localFilters.filter(filter => filter.id !== id));
  };

  const handleApply = () => {
    // Only apply filters that have both column and value
    const validFilters = localFilters.filter(f => f.column && f.value);
    onFiltersChange(validFilters);
    onApplyFilters();
    onOpenChange(false);
  };

  const handleCancel = () => {
    // Reset to original filters
    setLocalFilters(filters);
    onOpenChange(false);
  };

  const handleClearAll = () => {
    setLocalFilters([]);
    onFiltersChange([]);
    onApplyFilters();
    onOpenChange(false);
  };

  // Update local filters when dialog opens and filters prop changes
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter rows</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {localFilters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg font-medium mb-2">No filters applied</p>
              <p className="text-sm">Add a filter to start filtering your data</p>
            </div>
          ) : (
            localFilters.map((filter) => (
              <div key={filter.id} className="grid grid-cols-12 gap-3 items-center w-full">
                {/* Column Select */}
                <div className="col-span-4">
                  <Select
                    value={filter.column}
                    onValueChange={(value) => updateFilter(filter.id, { column: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column.column_name} value={column.column_name}>
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{column.column_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {column.data_type}
                              {column.is_primary_key && ' (PK)'}
                              {column.is_nullable === 'NO' && ' *'}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Operator Select */}
                <div className="col-span-3">
                  <Select
                    value={filter.operator}
                    onValueChange={(value: FilterOperator) => updateFilter(filter.id, { operator: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operatorOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">[{option.symbol}]</span>
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Value Input */}
                <div className="col-span-4">
                  <Input
                    placeholder="Enter a value"
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                    className="w-full"
                  />
                </div>

                {/* Remove Filter */}
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(filter.id)}
                    className="w-full h-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Add Filter Button */}
          <Button
            variant="outline"
            onClick={addFilter}
            className="w-full"
            disabled={columns.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add filter
          </Button>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="ghost"
            onClick={handleClearAll}
            disabled={localFilters.length === 0}
          >
            Clear all
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              onClick={handleApply}
              disabled={localFilters.length === 0 || localFilters.some(f => !f.column || !f.value)}
            >
              Apply filter
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}