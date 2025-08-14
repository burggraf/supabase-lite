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