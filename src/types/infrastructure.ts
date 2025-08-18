// Infrastructure types for Common Infrastructure Module

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  duration?: number;
}

export interface Logger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
  getEntries(): LogEntry[];
  clear(): void;
}

export interface InfrastructureError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
  originalError?: Error;
  context?: Record<string, any>;
}

export interface ErrorHandler {
  handleError(error: unknown, context?: Record<string, any>): InfrastructureError;
  formatError(error: InfrastructureError): string;
  isRecoverable(error: InfrastructureError): boolean;
}

export interface DatabaseConfig {
  name: string;
  dataDir: string;
  maxConnections?: number;
  queryTimeout?: number;
  enableQueryLogging?: boolean;
}

export interface APIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: number;
  refreshTokenExpiresIn: number;
  enableSignup: boolean;
  requireEmailConfirmation: boolean;
}

export interface AppConfig {
  database: DatabaseConfig;
  api: APIConfig;
  auth: AuthConfig;
  logLevel: LogLevel;
  enablePerformanceTracking: boolean;
  enableQueryCaching: boolean;
}

export interface ConfigManager {
  get<T = any>(key: string): T | undefined;
  set(key: string, value: any): void;
  getAll(): AppConfig;
  reset(): void;
  load(config: Partial<AppConfig>): void;
}

export interface Migration {
  version: string;
  name: string;
  up: string;
  down?: string;
  checksum?: string;
  appliedAt?: Date;
}

export interface MigrationResult {
  version: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface MigrationManager {
  getMigrations(): Promise<Migration[]>;
  getAppliedMigrations(): Promise<Migration[]>;
  getPendingMigrations(): Promise<Migration[]>;
  runMigration(migration: Migration): Promise<MigrationResult>;
  rollbackMigration(version: string): Promise<MigrationResult>;
  runAll(): Promise<MigrationResult[]>;
}

export interface DatabaseSchema {
  tables: TableMetadata[];
  views: ViewMetadata[];
  functions: FunctionMetadata[];
  schemas: string[];
}

export interface TableMetadata {
  name: string;
  schema: string;
  columns: ColumnMetadata[];
  primaryKeys: string[];
  foreignKeys: ForeignKeyMetadata[];
  indexes: IndexMetadata[];
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
}

export interface ForeignKeyMetadata {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface IndexMetadata {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
}

export interface ViewMetadata {
  name: string;
  schema: string;
  definition: string;
  columns: ColumnMetadata[];
}

export interface FunctionMetadata {
  name: string;
  schema: string;
  returnType: string;
  parameters: ParameterMetadata[];
  language: string;
  body?: string;
}

export interface ParameterMetadata {
  name: string;
  type: string;
  defaultValue?: string;
  mode: 'IN' | 'OUT' | 'INOUT';
}

export interface TypeGenerator {
  generateTableTypes(tables: TableMetadata[]): string;
  generateFunctionTypes(functions: FunctionMetadata[]): string;
  generateDatabaseTypes(schema: DatabaseSchema): string;
  saveTypes(types: string, filePath: string): Promise<void>;
}

export interface TransactionOptions {
  isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  timeout?: number;
  readOnly?: boolean;
}

export interface QueryOptions {
  timeout?: number;
  cache?: boolean;
  explain?: boolean;
}

export interface QueryMetrics {
  query: string;
  duration: number;
  rowsAffected: number;
  cached: boolean;
  timestamp: Date;
}

export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: any;
  timeout?: number;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  success: boolean;
  error?: InfrastructureError;
}

export interface RequestInterceptor {
  (request: APIRequest): Promise<APIRequest> | APIRequest;
}

export interface ResponseInterceptor {
  (response: APIResponse): Promise<APIResponse> | APIResponse;
}

export interface APIBridge {
  request<T = any>(request: APIRequest): Promise<APIResponse<T>>;
  addRequestInterceptor(interceptor: RequestInterceptor): void;
  addResponseInterceptor(interceptor: ResponseInterceptor): void;
  validateRequest(request: APIRequest): boolean;
  formatResponse<T>(data: T, status: number, headers?: Record<string, string>): APIResponse<T>;
}