import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InfrastructureConfigManager } from '../ConfigManager';
import type { AppConfig, DatabaseConfig, APIConfig, AuthConfig } from '@/types/infrastructure';

describe('InfrastructureConfigManager', () => {
  let configManager: InfrastructureConfigManager;
  let localStorageMock: any;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    configManager = new InfrastructureConfigManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic configuration operations', () => {
    it('should get configuration values', () => {
      const dbName = configManager.get<string>('database.name');
      expect(dbName).toBe('supabase_lite_db');
    });

    it('should get nested configuration values', () => {
      const logLevel = configManager.get<string>('logLevel');
      expect(logLevel).toBe('info');
    });

    it('should return undefined for non-existent keys', () => {
      const nonExistent = configManager.get('non.existent.key');
      expect(nonExistent).toBeUndefined();
    });

    it('should set configuration values', () => {
      configManager.set('database.name', 'test_db');
      const dbName = configManager.get<string>('database.name');
      expect(dbName).toBe('test_db');
    });

    it('should set nested configuration values', () => {
      configManager.set('api.timeout', 5000);
      const timeout = configManager.get<number>('api.timeout');
      expect(timeout).toBe(5000);
    });

    it('should create nested objects when setting deep keys', () => {
      configManager.set('new.nested.key', 'value');
      const value = configManager.get<string>('new.nested.key');
      expect(value).toBe('value');
    });
  });

  describe('Configuration sections', () => {
    it('should get database configuration', () => {
      const dbConfig = configManager.getDatabaseConfig();
      expect(dbConfig.name).toBe('supabase_lite_db');
      expect(dbConfig.dataDir).toBe('idb://supabase_lite_db');
      expect(dbConfig.maxConnections).toBe(10);
    });

    it('should get API configuration', () => {
      const apiConfig = configManager.getAPIConfig();
      // baseUrl should be dynamic - either configured or current window origin
      expect(typeof apiConfig.baseUrl).toBe('string');
      expect(apiConfig.baseUrl.length).toBeGreaterThan(0);
      expect(apiConfig.timeout).toBe(10000);
      expect(apiConfig.retryAttempts).toBe(3);
    });

    it('should get auth configuration', () => {
      const authConfig = configManager.getAuthConfig();
      expect(authConfig.jwtSecret).toBe('supabase-lite-local-secret');
      expect(authConfig.jwtExpiresIn).toBe(3600);
      expect(authConfig.enableSignup).toBe(true);
    });

    it('should update database configuration', () => {
      const updates: Partial<DatabaseConfig> = {
        name: 'new_db',
        maxConnections: 20,
      };

      configManager.updateDatabaseConfig(updates);

      const dbConfig = configManager.getDatabaseConfig();
      expect(dbConfig.name).toBe('new_db');
      expect(dbConfig.maxConnections).toBe(20);
      expect(dbConfig.dataDir).toBe('idb://supabase_lite_db'); // unchanged
    });

    it('should update API configuration', () => {
      const updates: Partial<APIConfig> = {
        baseUrl: 'http://localhost:4000',
        timeout: 15000,
      };

      configManager.updateAPIConfig(updates);

      const apiConfig = configManager.getAPIConfig();
      expect(apiConfig.baseUrl).toBe('http://localhost:4000');
      expect(apiConfig.timeout).toBe(15000);
    });

    it('should update auth configuration', () => {
      const updates: Partial<AuthConfig> = {
        jwtExpiresIn: 7200,
        enableSignup: false,
      };

      configManager.updateAuthConfig(updates);

      const authConfig = configManager.getAuthConfig();
      expect(authConfig.jwtExpiresIn).toBe(7200);
      expect(authConfig.enableSignup).toBe(false);
    });
  });

  describe('Configuration loading and saving', () => {
    it('should load partial configuration', () => {
      const partialConfig: Partial<AppConfig> = {
        logLevel: 'debug',
        database: {
          name: 'test_db',
        } as DatabaseConfig,
      };

      configManager.load(partialConfig);

      expect(configManager.get('logLevel')).toBe('debug');
      expect(configManager.get('database.name')).toBe('test_db');
      // Other values should remain unchanged
      expect(configManager.get('api.timeout')).toBe(10000);
    });

    it('should reset to default configuration', () => {
      configManager.set('logLevel', 'debug');
      configManager.set('database.name', 'custom_db');

      configManager.reset();

      expect(configManager.get('logLevel')).toBe('info');
      expect(configManager.get('database.name')).toBe('supabase_lite_db');
    });

    it('should get all configuration', () => {
      const allConfig = configManager.getAll();
      
      expect(allConfig).toHaveProperty('database');
      expect(allConfig).toHaveProperty('api');
      expect(allConfig).toHaveProperty('auth');
      expect(allConfig).toHaveProperty('logLevel');
    });
  });

  describe('Configuration validation', () => {
    it('should validate database configuration', () => {
      expect(() => {
        configManager.updateDatabaseConfig({
          name: '', // Invalid
        });
      }).toThrow('Database name is required and must be a string');
    });

    it('should validate API configuration', () => {
      expect(() => {
        configManager.updateAPIConfig({
          baseUrl: 'invalid-url', // Invalid URL
        });
      }).toThrow('API baseUrl must be a valid URL');
    });

    it('should validate auth configuration', () => {
      expect(() => {
        configManager.updateAuthConfig({
          jwtSecret: 'short', // Too short
        });
      }).toThrow('JWT secret must be at least 10 characters long');
    });

    it('should validate log level', () => {
      expect(() => {
        configManager.set('logLevel', 'invalid-level');
      }).toThrow('Log level must be one of: debug, info, warn, error');
    });

    it('should validate timeout ranges', () => {
      expect(() => {
        configManager.updateAPIConfig({
          timeout: 500, // Too low
        });
      }).toThrow('API timeout must be between 1000ms and 60000ms');
    });

    it('should validate retry attempts', () => {
      expect(() => {
        configManager.updateAPIConfig({
          retryAttempts: 15, // Too high
        });
      }).toThrow('API retryAttempts must be between 0 and 10');
    });
  });

  describe('Export and import', () => {
    it('should export configuration as JSON', () => {
      configManager.set('logLevel', 'debug');
      const exported = configManager.exportConfig();
      
      const parsed = JSON.parse(exported);
      expect(parsed.logLevel).toBe('debug');
      expect(parsed).toHaveProperty('database');
      expect(parsed).toHaveProperty('api');
      expect(parsed).toHaveProperty('auth');
    });

    it('should import configuration from JSON', () => {
      const configJson = JSON.stringify({
        logLevel: 'warn',
        database: {
          name: 'imported_db',
        },
      });

      configManager.importConfig(configJson);

      expect(configManager.get('logLevel')).toBe('warn');
      expect(configManager.get('database.name')).toBe('imported_db');
    });

    it('should handle invalid JSON during import', () => {
      expect(() => {
        configManager.importConfig('invalid json');
      }).toThrow('Failed to import configuration');
    });
  });

  describe('Environment variable loading', () => {
    it('should load configuration from environment variables', () => {
      // Mock environment variables
      const originalEnv = import.meta.env;
      (import.meta.env as any) = {
        ...originalEnv,
        VITE_DB_NAME: 'env_db',
        VITE_API_BASE_URL: 'http://env-api.com',
        VITE_LOG_LEVEL: 'debug',
      };

      configManager.loadFromEnvironment();

      expect(configManager.get('database.name')).toBe('env_db');
      expect(configManager.get('api.baseUrl')).toBe('http://env-api.com');
      expect(configManager.get('logLevel')).toBe('debug');

      // Restore original env
      (import.meta.env as any) = originalEnv;
    });

    it('should skip loading if no environment variables are set', () => {
      const originalLogLevel = configManager.get('logLevel');
      
      // Mock empty environment
      const originalEnv = import.meta.env;
      (import.meta.env as any) = { ...originalEnv };

      configManager.loadFromEnvironment();

      // Should remain unchanged
      expect(configManager.get('logLevel')).toBe(originalLogLevel);

      // Restore original env
      (import.meta.env as any) = originalEnv;
    });
  });

  describe('localStorage persistence', () => {
    it('should save to localStorage when configuration changes', () => {
      configManager.set('logLevel', 'debug');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'supabase_lite_config',
        expect.stringContaining('"logLevel":"debug"')
      );
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      // Should not throw
      expect(() => {
        configManager.set('logLevel', 'debug');
      }).not.toThrow();
    });

    it('should load from localStorage on initialization', () => {
      const storedConfig = JSON.stringify({
        logLevel: 'debug',
        database: { name: 'stored_db' },
        api: { baseUrl: 'http://localhost:3001' },
        auth: { jwtSecret: 'stored-secret-key-value' },
      });

      localStorageMock.getItem.mockReturnValue(storedConfig);

      const newConfigManager = new InfrastructureConfigManager();
      
      expect(newConfigManager.get('logLevel')).toBe('debug');
      expect(newConfigManager.get('database.name')).toBe('stored_db');
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      // Should not throw and use defaults
      const newConfigManager = new InfrastructureConfigManager();
      expect(newConfigManager.get('logLevel')).toBe('info'); // default
    });
  });

  describe('Deep merge functionality', () => {
    it('should deep merge nested configuration objects', () => {
      const partialConfig: Partial<AppConfig> = {
        database: {
          name: 'merged_db',
          maxConnections: 15,
          // dataDir should remain unchanged
        } as DatabaseConfig,
      };

      configManager.load(partialConfig);

      const dbConfig = configManager.getDatabaseConfig();
      expect(dbConfig.name).toBe('merged_db');
      expect(dbConfig.maxConnections).toBe(15);
      expect(dbConfig.dataDir).toBe('idb://supabase_lite_db'); // unchanged
    });

    it('should handle array values in merge', () => {
      const config: Partial<AppConfig> = {
        database: {
          name: 'test_db',
        } as DatabaseConfig,
      };

      configManager.load(config);
      
      // Should not affect other sections
      const authConfig = configManager.getAuthConfig();
      expect(authConfig.jwtSecret).toBe('supabase-lite-local-secret');
    });
  });

  describe('Error handling', () => {
    it('should throw on invalid configuration key', () => {
      expect(() => {
        configManager.set('', 'value');
      }).toThrow('Invalid config key');
    });

    it('should handle validation errors when setting individual values', () => {
      expect(() => {
        configManager.set('database.maxConnections', 200);
      }).toThrow('maxConnections must be between 1 and 100');
    });

    it('should handle errors during configuration load', () => {
      const invalidConfig = {
        database: {
          name: '', // Invalid
        },
      };

      expect(() => {
        configManager.load(invalidConfig as any);
      }).toThrow();
    });
  });
});