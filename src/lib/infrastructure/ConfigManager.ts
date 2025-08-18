import type { ConfigManager, AppConfig, DatabaseConfig, APIConfig, AuthConfig, LogLevel } from '@/types/infrastructure';
import { logger } from './Logger';
import { errorHandler } from './ErrorHandler';

const DEFAULT_CONFIG: AppConfig = {
  database: {
    name: 'supabase_lite_db',
    dataDir: 'idb://supabase_lite_db',
    maxConnections: 10,
    queryTimeout: 30000, // 30 seconds
    enableQueryLogging: true,
  },
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 10000, // 10 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },
  auth: {
    jwtSecret: 'supabase-lite-local-secret',
    jwtExpiresIn: 3600, // 1 hour
    refreshTokenExpiresIn: 86400 * 30, // 30 days
    enableSignup: true,
    requireEmailConfirmation: false,
  },
  logLevel: 'info',
  enablePerformanceTracking: true,
  enableQueryCaching: false,
};

export class InfrastructureConfigManager implements ConfigManager {
  private config: AppConfig;
  private readonly STORAGE_KEY = 'supabase_lite_config';

  constructor() {
    this.config = this.loadFromStorage() || { ...DEFAULT_CONFIG };
  }

  get<T = any>(key: string): T | undefined {
    const keys = key.split('.');
    let current: any = this.config;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        logger.debug(`Config key not found: ${key}`);
        return undefined;
      }
    }

    return current as T;
  }

  set(key: string, value: any): void {
    try {
      const keys = key.split('.');
      const lastKey = keys.pop();
      
      if (!lastKey) {
        throw errorHandler.createConfigError('Invalid config key', `Key cannot be empty`);
      }

      let current: any = this.config;
      
      // Navigate to the parent object
      for (const k of keys) {
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }

      // Validate value based on key
      this.validateConfigValue(key, value);

      current[lastKey] = value;
      this.saveToStorage();
      
      logger.info(`Config updated: ${key}`, { value });
    } catch (error) {
      logger.error(`Failed to set config: ${key}`, error as Error, { value });
      throw error;
    }
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  reset(): void {
    try {
      this.config = { ...DEFAULT_CONFIG };
      this.saveToStorage();
      logger.info('Configuration reset to defaults');
    } catch (error) {
      logger.error('Failed to reset configuration', error as Error);
      throw errorHandler.createConfigError('Failed to reset configuration', (error as Error).message);
    }
  }

  load(config: Partial<AppConfig>): void {
    try {
      // Merge with existing config
      this.config = this.deepMerge(this.config, config);
      this.validateConfig();
      this.saveToStorage();
      
      logger.info('Configuration loaded', { 
        keys: Object.keys(config),
        logLevel: this.config.logLevel 
      });

      // Update logger level if it changed
      if (config.logLevel) {
        logger.setLogLevel(config.logLevel);
      }
    } catch (error) {
      logger.error('Failed to load configuration', error as Error);
      throw errorHandler.createConfigError('Failed to load configuration', (error as Error).message);
    }
  }

  // Get typed configuration sections
  getDatabaseConfig(): DatabaseConfig {
    return { ...this.config.database };
  }

  getAPIConfig(): APIConfig {
    return { ...this.config.api };
  }

  getAuthConfig(): AuthConfig {
    return { ...this.config.auth };
  }

  // Update specific configuration sections
  updateDatabaseConfig(config: Partial<DatabaseConfig>): void {
    const updated = { ...this.config.database, ...config };
    this.validateDatabaseConfig(updated);
    this.config.database = updated;
    this.saveToStorage();
    logger.info('Database configuration updated', config);
  }

  updateAPIConfig(config: Partial<APIConfig>): void {
    const updated = { ...this.config.api, ...config };
    this.validateAPIConfig(updated);
    this.config.api = updated;
    this.saveToStorage();
    logger.info('API configuration updated', config);
  }

  updateAuthConfig(config: Partial<AuthConfig>): void {
    const updated = { ...this.config.auth, ...config };
    this.validateAuthConfig(updated);
    this.config.auth = updated;
    this.saveToStorage();
    logger.info('Auth configuration updated', config);
  }

  // Environment-based configuration loading
  loadFromEnvironment(): void {
    const envConfig: Partial<AppConfig> = {};

    // Safe environment access
    const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

    // Database config from environment
    if (env.VITE_DB_NAME) {
      envConfig.database = {
        ...this.config.database,
        name: env.VITE_DB_NAME,
      };
    }

    // API config from environment
    if (env.VITE_API_BASE_URL) {
      envConfig.api = {
        ...this.config.api,
        baseUrl: env.VITE_API_BASE_URL,
      };
    }

    // Auth config from environment
    if (env.VITE_JWT_SECRET) {
      envConfig.auth = {
        ...this.config.auth,
        jwtSecret: env.VITE_JWT_SECRET,
      };
    }

    // Log level from environment
    if (env.VITE_LOG_LEVEL) {
      envConfig.logLevel = env.VITE_LOG_LEVEL as LogLevel;
    }

    if (Object.keys(envConfig).length > 0) {
      this.load(envConfig);
      logger.info('Configuration loaded from environment variables');
    }
  }

  // Export/Import configuration
  exportConfig(): string {
    try {
      return JSON.stringify(this.config, null, 2);
    } catch (error) {
      logger.error('Failed to export configuration', error as Error);
      throw errorHandler.createConfigError('Failed to export configuration', (error as Error).message);
    }
  }

  importConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson) as Partial<AppConfig>;
      this.load(config);
      logger.info('Configuration imported from JSON');
    } catch (error) {
      logger.error('Failed to import configuration', error as Error);
      throw errorHandler.createConfigError('Failed to import configuration', 'Invalid JSON format');
    }
  }

  private loadFromStorage(): AppConfig | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const config = JSON.parse(stored) as AppConfig;
      this.validateConfig(config);
      
      logger.debug('Configuration loaded from storage');
      return config;
    } catch (error) {
      logger.warn('Failed to load configuration from storage, using defaults', error as Error);
      return null;
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
      logger.debug('Configuration saved to storage');
    } catch (error) {
      logger.error('Failed to save configuration to storage', error as Error);
      // Don't throw error - continue with in-memory config
    }
  }

  private validateConfig(config: AppConfig = this.config): void {
    this.validateDatabaseConfig(config.database);
    this.validateAPIConfig(config.api);
    this.validateAuthConfig(config.auth);
    this.validateLogLevel(config.logLevel);
  }

  private validateDatabaseConfig(config: DatabaseConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw errorHandler.createValidationError('Database name is required and must be a string');
    }

    if (!config.dataDir || typeof config.dataDir !== 'string') {
      throw errorHandler.createValidationError('Database dataDir is required and must be a string');
    }

    if (config.maxConnections !== undefined && (config.maxConnections < 1 || config.maxConnections > 100)) {
      throw errorHandler.createValidationError('maxConnections must be between 1 and 100');
    }

    if (config.queryTimeout !== undefined && (config.queryTimeout < 1000 || config.queryTimeout > 300000)) {
      throw errorHandler.createValidationError('queryTimeout must be between 1000ms and 300000ms');
    }
  }

  private validateAPIConfig(config: APIConfig): void {
    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      throw errorHandler.createValidationError('API baseUrl is required and must be a string');
    }

    try {
      new URL(config.baseUrl);
    } catch {
      throw errorHandler.createValidationError('API baseUrl must be a valid URL');
    }

    if (config.timeout < 1000 || config.timeout > 60000) {
      throw errorHandler.createValidationError('API timeout must be between 1000ms and 60000ms');
    }

    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      throw errorHandler.createValidationError('API retryAttempts must be between 0 and 10');
    }

    if (config.retryDelay < 100 || config.retryDelay > 10000) {
      throw errorHandler.createValidationError('API retryDelay must be between 100ms and 10000ms');
    }
  }

  private validateAuthConfig(config: AuthConfig): void {
    if (!config.jwtSecret || typeof config.jwtSecret !== 'string' || config.jwtSecret.length < 10) {
      throw errorHandler.createValidationError('JWT secret must be at least 10 characters long');
    }

    if (config.jwtExpiresIn < 60 || config.jwtExpiresIn > 86400 * 7) {
      throw errorHandler.createValidationError('JWT expiration must be between 60 seconds and 7 days');
    }

    if (config.refreshTokenExpiresIn < 3600 || config.refreshTokenExpiresIn > 86400 * 365) {
      throw errorHandler.createValidationError('Refresh token expiration must be between 1 hour and 1 year');
    }
  }

  private validateLogLevel(level: LogLevel): void {
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(level)) {
      throw errorHandler.createValidationError(`Log level must be one of: ${validLevels.join(', ')}`);
    }
  }

  private validateConfigValue(key: string, value: any): void {
    // Validate specific config keys
    if (key === 'logLevel') {
      this.validateLogLevel(value);
    } else if (key.startsWith('database.')) {
      // Validate database config values individually
      const dbKey = key.replace('database.', '');
      const tempConfig = { ...this.config.database, [dbKey]: value };
      this.validateDatabaseConfig(tempConfig);
    } else if (key.startsWith('api.')) {
      // Validate API config values individually
      const apiKey = key.replace('api.', '');
      const tempConfig = { ...this.config.api, [apiKey]: value };
      this.validateAPIConfig(tempConfig);
    } else if (key.startsWith('auth.')) {
      // Validate auth config values individually
      const authKey = key.replace('auth.', '');
      const tempConfig = { ...this.config.auth, [authKey]: value };
      this.validateAuthConfig(tempConfig);
    }
  }

  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this.deepMerge(result[key] || {}, value);
        } else {
          result[key] = value as T[Extract<keyof T, string>];
        }
      }
    }

    return result;
  }
}

// Singleton instance
export const configManager = new InfrastructureConfigManager();

// Load configuration from environment on startup
configManager.loadFromEnvironment();