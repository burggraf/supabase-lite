import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  GripVertical, 
  Link, 
  Check, 
  X, 
  Key, 
  Settings 
} from 'lucide-react';
import { CompactTypeSelector } from '../shared/CompactTypeSelector';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface Column {
  id: string;
  name: string;
  type: string;
  defaultValue: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
}

interface ColumnEditorProps {
  column: Column;
  onUpdate: (id: string, updates: Partial<Column>) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export function ColumnEditor({ column, onUpdate, onRemove, canRemove }: ColumnEditorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleUpdate = (field: keyof Column, value: unknown) => {
    onUpdate(column.id, { [field]: value });
  };

  return (
    <TooltipProvider>
      <div 
        className={`grid grid-cols-12 gap-2 items-center py-2 px-3 transition-colors ${
          isHovered ? 'bg-gray-50' : 'bg-white'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Drag Handle */}
        <div className="col-span-1 flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-move p-1 rounded hover:bg-accent">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Drag to reorder</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Column Name */}
        <div className="col-span-3">
          <div className="relative">
            <Input
              value={column.name}
              onChange={(e) => handleUpdate('name', e.target.value)}
              placeholder="column_name"
              className="h-8 text-sm pr-8"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Link className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Data Type */}
        <div className="col-span-2">
          <CompactTypeSelector
            value={column.type}
            onChange={(type) => handleUpdate('type', type)}
          />
        </div>

        {/* Default Value */}
        <div className="col-span-2">
          <Input
            value={column.defaultValue}
            onChange={(e) => handleUpdate('defaultValue', e.target.value)}
            placeholder="NULL, '', now(), etc."
            className="h-8 text-sm"
          />
        </div>

        {/* Primary Key Toggle */}
        <div className="col-span-1 flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${
                  column.primaryKey 
                    ? 'bg-green-100 hover:bg-green-200 text-green-700' 
                    : 'hover:bg-accent'
                }`}
                onClick={() => handleUpdate('primaryKey', !column.primaryKey)}
              >
                {column.primaryKey ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <div className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Primary Key</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nullable Toggle */}
        <div className="col-span-1 flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Checkbox
                  checked={!column.nullable}
                  onCheckedChange={(checked) => handleUpdate('nullable', !checked)}
                  className="h-4 w-4"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Not Null</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Unique Toggle */}
        <div className="col-span-1 flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 w-8 p-0 ${
                  column.unique 
                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-700' 
                    : 'hover:bg-accent'
                }`}
                onClick={() => handleUpdate('unique', !column.unique)}
              >
                {column.unique ? (
                  <Key className="h-3.5 w-3.5" />
                ) : (
                  <div className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Unique</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Settings/Remove */}
        <div className="col-span-1 flex justify-center">
          {canRemove ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                  onClick={() => onRemove(column.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove column</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground/50" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Column settings</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}