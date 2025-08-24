import { useState } from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Type, 
  Hash, 
  ToggleLeft, 
  Calendar, 
  Clock,
  FileText,
  Braces,
  List,
  Globe
} from 'lucide-react';

export interface PostgresDataType {
  name: string;
  displayName: string;
  category: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  hasLength?: boolean;
  hasPrecision?: boolean;
  hasScale?: boolean;
  defaultLength?: string;
  common?: boolean;
}

const DATA_TYPES: PostgresDataType[] = [
  // Text Types
  {
    name: 'text',
    displayName: 'text',
    category: 'Text',
    description: 'Variable-length character string',
    icon: Type,
    common: true
  },
  {
    name: 'varchar',
    displayName: 'varchar',
    category: 'Text',
    description: 'Variable-length character string with limit',
    icon: Type,
    hasLength: true,
    defaultLength: '255',
    common: true
  },
  {
    name: 'char',
    displayName: 'char',
    category: 'Text',
    description: 'Fixed-length character string',
    icon: Type,
    hasLength: true,
    defaultLength: '1'
  },

  // Numeric Types
  {
    name: 'integer',
    displayName: 'int4',
    category: 'Numeric',
    description: 'Signed 4-byte integer',
    icon: Hash,
    common: true
  },
  {
    name: 'bigint',
    displayName: 'int8',
    category: 'Numeric',
    description: 'Signed 8-byte integer',
    icon: Hash,
    common: true
  },
  {
    name: 'smallint',
    displayName: 'int2',
    category: 'Numeric',
    description: 'Signed 2-byte integer',
    icon: Hash
  },
  {
    name: 'serial',
    displayName: 'serial',
    category: 'Numeric',
    description: 'Auto-incrementing 4-byte integer',
    icon: Hash,
    common: true
  },
  {
    name: 'bigserial',
    displayName: 'bigserial',
    category: 'Numeric',
    description: 'Auto-incrementing 8-byte integer',
    icon: Hash
  },
  {
    name: 'decimal',
    displayName: 'numeric',
    category: 'Numeric',
    description: 'Exact numeric with precision and scale',
    icon: Hash,
    hasPrecision: true,
    hasScale: true
  },
  {
    name: 'real',
    displayName: 'float4',
    category: 'Numeric',
    description: 'Single precision floating-point',
    icon: Hash
  },
  {
    name: 'double precision',
    displayName: 'float8',
    category: 'Numeric',
    description: 'Double precision floating-point',
    icon: Hash
  },

  // Boolean
  {
    name: 'boolean',
    displayName: 'bool',
    category: 'Boolean',
    description: 'Logical boolean (true/false)',
    icon: ToggleLeft,
    common: true
  },

  // Date/Time Types
  {
    name: 'date',
    displayName: 'date',
    category: 'Date/Time',
    description: 'Calendar date (year, month, day)',
    icon: Calendar,
    common: true
  },
  {
    name: 'time',
    displayName: 'time',
    category: 'Date/Time',
    description: 'Time of day (no date)',
    icon: Clock
  },
  {
    name: 'timestamp',
    displayName: 'timestamp',
    category: 'Date/Time',
    description: 'Date and time (no timezone)',
    icon: Clock
  },
  {
    name: 'timestamptz',
    displayName: 'timestamptz',
    category: 'Date/Time',
    description: 'Date and time with timezone',
    icon: Globe,
    common: true
  },
  {
    name: 'interval',
    displayName: 'interval',
    category: 'Date/Time',
    description: 'Time span',
    icon: Clock
  },

  // JSON Types
  {
    name: 'json',
    displayName: 'json',
    category: 'JSON',
    description: 'Textual JSON data',
    icon: Braces,
    common: true
  },
  {
    name: 'jsonb',
    displayName: 'jsonb',
    category: 'JSON',
    description: 'Binary JSON data, decomposed',
    icon: Braces,
    common: true
  },

  // Array Types
  {
    name: 'text[]',
    displayName: 'text[]',
    category: 'Array',
    description: 'Array of text values',
    icon: List
  },
  {
    name: 'integer[]',
    displayName: 'int4[]',
    category: 'Array',
    description: 'Array of integer values',
    icon: List
  },

  // Binary Types
  {
    name: 'bytea',
    displayName: 'bytea',
    category: 'Binary',
    description: 'Binary data (byte array)',
    icon: FileText
  },

  // UUID
  {
    name: 'uuid',
    displayName: 'uuid',
    category: 'UUID',
    description: 'Universally unique identifier',
    icon: Hash,
    common: true
  }
];

const CATEGORIES = Array.from(new Set(DATA_TYPES.map(type => type.category)));

interface DataTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  length?: string;
  onLengthChange?: (length: string) => void;
  precision?: string;
  onPrecisionChange?: (precision: string) => void;
  scale?: string;
  onScaleChange?: (scale: string) => void;
  showCommonOnly?: boolean;
}

export function DataTypeSelector({
  value,
  onChange,
  length,
  onLengthChange,
  precision,
  onPrecisionChange,
  scale,
  onScaleChange,
  showCommonOnly = false
}: DataTypeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const selectedType = DATA_TYPES.find(type => type.name === value);
  
  const filteredTypes = DATA_TYPES.filter(type => {
    if (showCommonOnly && !type.common) return false;
    if (selectedCategory && type.category !== selectedCategory) return false;
    return true;
  });

  const handleTypeChange = (newValue: string) => {
    onChange(newValue);
    
    // Set default length if the type supports it
    const newType = DATA_TYPES.find(type => type.name === newValue);
    if (newType?.hasLength && newType.defaultLength && onLengthChange) {
      onLengthChange(newType.defaultLength);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Data Type</Label>
        
        {!showCommonOnly && (
          <div className="flex flex-wrap gap-1 mb-2">
            <Badge
              variant={selectedCategory === '' ? 'default' : 'outline'}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedCategory('')}
            >
              All
            </Badge>
            {CATEGORIES.map(category => (
              <Badge
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>
        )}

        <Select value={value} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue>
              {selectedType && (
                <div className="flex items-center space-x-2">
                  <selectedType.icon className="h-4 w-4" />
                  <span className="font-mono text-sm">{selectedType.displayName}</span>
                  {selectedType.common && (
                    <Badge variant="secondary" className="text-xs">Common</Badge>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {filteredTypes.map((type) => {
              const Icon = type.icon;
              return (
                <SelectItem key={type.name} value={type.name}>
                  <div className="flex items-center space-x-2 w-full">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm">{type.displayName}</span>
                        {type.common && (
                          <Badge variant="secondary" className="text-xs">Common</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Length/Size Input */}
      {selectedType?.hasLength && onLengthChange && (
        <div className="space-y-2">
          <Label>Length</Label>
          <Input
            type="number"
            value={length || ''}
            onChange={(e) => onLengthChange(e.target.value)}
            placeholder="Enter length"
          />
        </div>
      )}

      {/* Precision and Scale for numeric types */}
      {selectedType?.hasPrecision && onPrecisionChange && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Precision</Label>
            <Input
              type="number"
              value={precision || ''}
              onChange={(e) => onPrecisionChange(e.target.value)}
              placeholder="Precision"
            />
          </div>
          {selectedType?.hasScale && onScaleChange && (
            <div className="space-y-2">
              <Label>Scale</Label>
              <Input
                type="number"
                value={scale || ''}
                onChange={(e) => onScaleChange(e.target.value)}
                placeholder="Scale"
              />
            </div>
          )}
        </div>
      )}

      {/* Type Description */}
      {selectedType && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>{selectedType.displayName}:</strong> {selectedType.description}
          </p>
        </div>
      )}
    </div>
  );
}

export { DATA_TYPES };