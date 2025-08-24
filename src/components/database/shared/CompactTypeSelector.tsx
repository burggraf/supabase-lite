import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Hash, Type, ToggleLeft, Calendar, Globe, Braces } from 'lucide-react';

// Common PostgreSQL data types with Supabase-style naming
const COMMON_DATA_TYPES = [
  { name: 'int8', displayName: 'int8', icon: Hash },
  { name: 'text', displayName: 'text', icon: Type },
  { name: 'varchar', displayName: 'varchar', icon: Type },
  { name: 'bool', displayName: 'bool', icon: ToggleLeft },
  { name: 'timestamptz', displayName: 'timestamptz', icon: Globe },
  { name: 'timestamp', displayName: 'timestamp', icon: Calendar },
  { name: 'date', displayName: 'date', icon: Calendar },
  { name: 'uuid', displayName: 'uuid', icon: Hash },
  { name: 'jsonb', displayName: 'jsonb', icon: Braces },
  { name: 'json', displayName: 'json', icon: Braces },
  { name: 'int4', displayName: 'int4', icon: Hash },
  { name: 'int2', displayName: 'int2', icon: Hash },
  { name: 'float4', displayName: 'float4', icon: Hash },
  { name: 'float8', displayName: 'float8', icon: Hash },
  { name: 'numeric', displayName: 'numeric', icon: Hash },
  { name: 'serial', displayName: 'serial', icon: Hash },
  { name: 'bigserial', displayName: 'bigserial', icon: Hash },
];

interface CompactTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CompactTypeSelector({
  value,
  onChange,
  placeholder = "Select type..."
}: CompactTypeSelectorProps) {
  // Map legacy names to display names
  const getDisplayValue = (val: string) => {
    const mappings: Record<string, string> = {
      'integer': 'int4',
      'bigint': 'int8',
      'smallint': 'int2',
      'real': 'float4',
      'double precision': 'float8',
      'boolean': 'bool',
      'character varying': 'varchar',
      'decimal': 'numeric'
    };
    return mappings[val] || val;
  };

  const selectedType = COMMON_DATA_TYPES.find(type => 
    type.name === value || type.name === getDisplayValue(value)
  );

  return (
    <Select 
      value={getDisplayValue(value)} 
      onValueChange={onChange}
    >
      <SelectTrigger className="h-9 text-sm font-mono">
        <SelectValue>
          {selectedType ? (
            <div className="flex items-center space-x-2">
              <selectedType.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{selectedType.displayName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {COMMON_DATA_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <SelectItem key={type.name} value={type.name} className="text-sm">
              <div className="flex items-center space-x-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">{type.displayName}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}