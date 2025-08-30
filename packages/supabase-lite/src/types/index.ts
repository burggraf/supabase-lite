export interface ConnectionConfig {
  url: string;
  projectId?: string;
  baseUrl: string;
}

export interface QueryResult {
  data: any[];
  rowCount: number;
  fields: QueryField[];
  executionTime?: number;
}

export interface QueryField {
  name: string;
  type: string;
}

export interface QueryError {
  error: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface MetaCommandResult {
  type: 'success' | 'error' | 'exit';
  message?: string;
  data?: any[];
  fields?: QueryField[];
}

export interface ReplOptions {
  prompt: string;
  multiline: boolean;
  history: boolean;
}

export type MetaCommand = 
  | 'quit'
  | 'help' 
  | 'list_tables'
  | 'describe_table'
  | 'list_databases'
  | 'list_schemas'
  | 'list_users';

export interface FileExecutionSummary {
  totalStatements: number;
  successfulStatements: number;
  failedStatements: number;
  totalExecutionTime: number;
  filePath: string;
}