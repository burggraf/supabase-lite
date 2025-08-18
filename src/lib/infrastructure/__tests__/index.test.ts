import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  infrastructure, 
  initializeInfrastructure, 
  checkInfrastructureHealth,
  logger,
  configManager,
  dbManager
} from '../index';

// Mock the database manager
vi.mock('../../database/connection', () => ({
  DatabaseManager: {
    getInstance: () => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      getDatabaseSize: vi.fn().mockResolvedValue('1 MB'),
      getCacheStats: vi.fn().mockReturnValue({ size: 10, hitRate: 85 }),
    }),
  },
  dbManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    getDatabaseSize: vi.fn().mockResolvedValue('1 MB'),
    getCacheStats: vi.fn().mockReturnValue({ size: 10, hitRate: 85 }),
  },
}));

describe('Infrastructure module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logger.clear();
  });

  describe('Infrastructure object', () => {
    it('should expose all infrastructure components', () => {
      expect(infrastructure).toHaveProperty('logger');
      expect(infrastructure).toHaveProperty('errorHandler');
      expect(infrastructure).toHaveProperty('configManager');
      expect(infrastructure).toHaveProperty('apiBridge');
      expect(infrastructure).toHaveProperty('migrationManager');
      expect(infrastructure).toHaveProperty('typeGenerator');
      expect(infrastructure).toHaveProperty('dbManager');
    });

    it('should expose singleton instances', () => {
      expect(infrastructure.logger).toBeTruthy();
      expect(infrastructure.configManager).toBeTruthy();
      expect(infrastructure.dbManager).toBeTruthy();
    });
  });

  describe('Infrastructure initialization', () => {
    it('should initialize all components successfully', async () => {
      // Mock successful migration results
      vi.spyOn(infrastructure.migrationManager, 'runAll').mockResolvedValue([
        { version: '001', success: true, duration: 10 },
        { version: '002', success: true, duration: 15 },
      ]);

      await initializeInfrastructure();

      expect(infrastructure.dbManager.initialize).toHaveBeenCalled();
      expect(infrastructure.migrationManager.runAll).toHaveBeenCalled();

      // Check that initialization was logged
      const entries = logger.getEntries();
      const initStart = entries.find(e => e.message === 'Initializing Supabase Lite infrastructure');
      const initComplete = entries.find(e => e.message === 'Infrastructure initialization completed');
      const migrationsApplied = entries.find(e => e.message === 'Applied 2 migrations');

      expect(initStart).toBeTruthy();
      expect(initComplete).toBeTruthy();
      expect(migrationsApplied).toBeTruthy();
    });

    it('should handle initialization errors', async () => {
      const initError = new Error('Initialization failed');
      vi.spyOn(infrastructure.dbManager, 'initialize').mockRejectedValue(initError);

      await expect(initializeInfrastructure()).rejects.toThrow('Initialization failed');

      // Check that error was logged
      const entries = logger.getEntries();
      const errorEntry = entries.find(e => 
        e.level === 'error' && 
        e.message === 'Infrastructure initialization failed'
      );
      expect(errorEntry).toBeTruthy();
    });

    it('should skip migrations if none are pending', async () => {
      vi.spyOn(infrastructure.migrationManager, 'runAll').mockResolvedValue([]);

      await initializeInfrastructure();

      expect(infrastructure.dbManager.initialize).toHaveBeenCalled();
      expect(infrastructure.migrationManager.runAll).toHaveBeenCalled();

      // Should not log about migrations
      const entries = logger.getEntries();
      const migrationsApplied = entries.find(e => e.message.includes('Applied'));
      expect(migrationsApplied).toBeFalsy();
    });
  });

  describe('Infrastructure health check', () => {
    it('should return healthy status when all components are working', async () => {
      vi.spyOn(infrastructure.migrationManager, 'getMigrationStatus').mockResolvedValue({
        total: 3,
        applied: 3,
        pending: 0,
        lastApplied: '003',
      });

      const health = await checkInfrastructureHealth();

      expect(health.status).toBe('healthy');
      expect(health.details).toHaveProperty('database', 'connected');
      expect(health.details).toHaveProperty('databaseSize', '1 MB');
      expect(health.details).toHaveProperty('migrations');
      expect(health.details).toHaveProperty('cache');
      expect(health.details).toHaveProperty('config');
    });

    it('should return degraded status when some components have issues', async () => {
      vi.spyOn(infrastructure.dbManager, 'getDatabaseSize').mockRejectedValue(new Error('Size error'));
      vi.spyOn(infrastructure.migrationManager, 'getMigrationStatus').mockResolvedValue({
        total: 3,
        applied: 3,
        pending: 0,
        lastApplied: '003',
      });

      const health = await checkInfrastructureHealth();

      expect(health.status).toBe('degraded');
      expect(health.details.database).toBe('connected_with_issues');
    });

    it('should return unhealthy status when database is disconnected', async () => {
      vi.spyOn(infrastructure.dbManager, 'isConnected').mockReturnValue(false);

      const health = await checkInfrastructureHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.details.database).toBe('disconnected');
    });

    it('should handle migration status errors', async () => {
      vi.spyOn(infrastructure.migrationManager, 'getMigrationStatus').mockRejectedValue(new Error('Migration error'));

      const health = await checkInfrastructureHealth();

      expect(health.details.migrations).toBe('error');
      // Status should still be healthy if only migrations have issues
      expect(['healthy', 'degraded']).toContain(health.status);
    });

    it('should handle cache stats errors', async () => {
      vi.spyOn(infrastructure.dbManager, 'getCacheStats').mockImplementation(() => {
        throw new Error('Cache error');
      });

      const health = await checkInfrastructureHealth();

      expect(health.details.cache).toBe('error');
    });

    it('should handle configuration errors', async () => {
      vi.spyOn(configManager, 'getAll').mockImplementation(() => {
        throw new Error('Config error');
      });

      const health = await checkInfrastructureHealth();

      expect(health.details.config).toBe('error');
      expect(['degraded', 'unhealthy']).toContain(health.status);
    });

    it('should return unhealthy status on complete failure', async () => {
      vi.spyOn(infrastructure.dbManager, 'isConnected').mockImplementation(() => {
        throw new Error('Complete failure');
      });

      const health = await checkInfrastructureHealth();

      expect(health.status).toBe('unhealthy');
      expect(health.details).toHaveProperty('error');
    });
  });

  describe('Component integration', () => {
    it('should use configuration manager in other components', () => {
      const dbConfig = configManager.getDatabaseConfig();
      expect(dbConfig).toHaveProperty('name');
      expect(dbConfig).toHaveProperty('dataDir');
    });

    it('should log operations across components', () => {
      logger.info('Test integration message');
      
      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test integration message');
    });

    it('should handle errors consistently', () => {
      const testError = new Error('Test error');
      const infraError = infrastructure.errorHandler.handleError(testError);
      
      expect(infraError).toHaveProperty('code');
      expect(infraError).toHaveProperty('message');
      expect(infraError.message).toBe('Test error');
    });
  });

  describe('Module exports', () => {
    it('should export all required components', () => {
      expect(logger).toBeTruthy();
      expect(configManager).toBeTruthy();
      expect(dbManager).toBeTruthy();
    });

    it('should export convenience functions', () => {
      expect(typeof initializeInfrastructure).toBe('function');
      expect(typeof checkInfrastructureHealth).toBe('function');
    });
  });
});