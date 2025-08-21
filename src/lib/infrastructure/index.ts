// Common Infrastructure Module
// This module provides shared database and API handling patterns for all modules

// Core infrastructure components
export { InfrastructureLogger, logger, logQuery, logError, logPerformance } from './Logger';
export { InfrastructureErrorHandler, errorHandler, ERROR_CODES, createDatabaseError, createAPIError, createValidationError, handleError } from './ErrorHandler';
export { InfrastructureConfigManager, configManager } from './ConfigManager';
export { InfrastructureAPIBridge, apiBridge } from './APIBridge';
export { InfrastructureMigrationManager, migrationManager, createMigrationManager } from './MigrationManager';
export { InfrastructureTypeGenerator, typeGenerator, createTypeGenerator } from './TypeGenerator';

// Types
export type * from '@/types/infrastructure';

// Re-export enhanced DatabaseManager
export { DatabaseManager } from '../database/connection';

// Import everything we need for the convenience object
import { logger } from './Logger';
import { errorHandler } from './ErrorHandler';
import { configManager } from './ConfigManager';
import { apiBridge } from './APIBridge';
import { migrationManager } from './MigrationManager';
import { typeGenerator } from './TypeGenerator';
import { DatabaseManager } from '../database/connection';

// Create database manager instance
const dbManager = DatabaseManager.getInstance();

// Export the database manager instance
export { dbManager };

// Convenience utilities
export const infrastructure = {
  logger,
  errorHandler,
  configManager,
  apiBridge,
  migrationManager,
  typeGenerator,
  dbManager,
} as const;

// Singleton pattern for infrastructure initialization
let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

// Infrastructure initialization
export async function initializeInfrastructure(): Promise<void> {
  // If already initialized, return immediately
  if (isInitialized) {
    logger.debug('Infrastructure already initialized, skipping');
    return;
  }

  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    logger.debug('Infrastructure initialization already in progress, waiting');
    return initializationPromise;
  }

  // Start initialization and store the promise
  initializationPromise = doInitializeInfrastructure();
  
  try {
    await initializationPromise;
    isInitialized = true;
  } finally {
    // Clear the promise once done (success or failure)
    initializationPromise = null;
  }
}

async function doInitializeInfrastructure(): Promise<void> {
  try {
    logger.info('Initializing Supabase Lite infrastructure');
    
    // Load configuration from environment
    configManager.loadFromEnvironment();
    
    // NOTE: Database initialization is now handled by useDatabase hook
    // to ensure proper project-aware initialization
    
    // Migrations will be run by DatabaseManager after initialization
    // when the database is actually connected with the correct project context
    
    logger.info('Infrastructure initialization completed');
  } catch (error) {
    logger.error('Infrastructure initialization failed', error as Error);
    throw error;
  }
}

// Infrastructure health check
export async function checkInfrastructureHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}> {
  const details: Record<string, any> = {};
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  try {
    // Check database connection
    if (dbManager.isConnected()) {
      details.database = 'connected';
      
      // Check database size
      try {
        details.databaseSize = await dbManager.getDatabaseSize();
      } catch {
        details.database = 'connected_with_issues';
        status = 'degraded';
      }
    } else {
      details.database = 'disconnected';
      status = 'unhealthy';
    }
    
    // Check migration status
    try {
      const migrationStatus = await migrationManager.getMigrationStatus();
      details.migrations = migrationStatus;
    } catch {
      details.migrations = 'error';
      status = status === 'healthy' ? 'degraded' : status;
    }
    
    // Check cache statistics
    try {
      details.cache = dbManager.getCacheStats();
    } catch {
      details.cache = 'error';
    }
    
    // Check configuration
    try {
      const config = configManager.getAll();
      details.config = {
        logLevel: config.logLevel,
        enablePerformanceTracking: config.enablePerformanceTracking,
        enableQueryCaching: config.enableQueryCaching,
      };
    } catch {
      details.config = 'error';
      status = status === 'healthy' ? 'degraded' : status;
    }
    
    logger.debug('Infrastructure health check completed', { status, details });
    
    return { status, details };
  } catch (error) {
    logger.error('Infrastructure health check failed', error as Error);
    return {
      status: 'unhealthy',
      details: { error: (error as Error).message },
    };
  }
}