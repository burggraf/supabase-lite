export interface DatabaseConnection {
  id: string;
  name: string;
  createdAt: Date;
  lastAccessed: Date;
}

export interface QueryResult {
  rows: any[];
  fields: Array<{ name: string; dataTypeID: number }>;
  rowCount: number;
  command: string;
  duration: number;
}

export interface ScriptResult {
  results: QueryResult[];
  totalDuration: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ statement: number; error: string }>;
}

export interface QueryHistory {
  id: string;
  query: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface TableSchema {
  name: string;
  schema: string;
  columns: ColumnSchema[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
  indexes: Index[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error';
  description: string;
}

export type Theme = 'light' | 'dark' | 'system';

// Table Editor Types
export interface TableInfo {
  name: string;
  schema: string;
  rows: number;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}

export interface TableDataResponse {
  rows: any[];
  totalCount: number;
}

export interface CellEditProps {
  value: any;
  column: ColumnInfo;
  onSave: (value: any) => void;
  onCancel: () => void;
}

// Filter Types
export type FilterOperator = 
  | 'equals' 
  | 'not_equal' 
  | 'greater_than' 
  | 'less_than' 
  | 'greater_than_or_equal' 
  | 'less_than_or_equal' 
  | 'like' 
  | 'ilike' 
  | 'in' 
  | 'is';

export interface FilterRule {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
}

export interface FilterState {
  rules: FilterRule[];
  isActive: boolean;
}

// SQL Snippets and Tabs Types
export interface SQLSnippet {
  id: string;
  name: string;
  query: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TabState {
  id: string;
  name: string;
  query: string;
  isDirty: boolean;
  snippetId?: string; // null for unsaved snippets
}