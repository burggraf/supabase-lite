import { DatabaseManager } from '../lib/database/connection';
import { projectManager } from '../lib/projects/ProjectManager';
import { logger } from '../lib/infrastructure/Logger';

export interface ProjectResolutionResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  error?: string;
}

// Cache for project resolution to avoid repeated lookups
const projectResolutionCache = new Map<string, { projectId: string; projectName: string; timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds cache TTL

// Metrics for tracking cache performance
interface ProjectCacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
}

const cacheMetrics: ProjectCacheMetrics = {
  hits: 0,
  misses: 0,
  totalRequests: 0
};

// Function to get cache performance metrics
export function getProjectCacheMetrics(): ProjectCacheMetrics & { hitRate: string } {
  const hitRate = cacheMetrics.totalRequests > 0 
    ? ((cacheMetrics.hits / cacheMetrics.totalRequests) * 100).toFixed(1) + '%'
    : '0%';
  
  return {
    ...cacheMetrics,
    hitRate
  };
}

/**
 * Extract project identifier from URL path and switch to that project's database
 * Supports both project IDs and project names in the URL
 */
export async function resolveAndSwitchToProject(url: URL): Promise<ProjectResolutionResult> {
  try {
    cacheMetrics.totalRequests++;
    
    const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
    const dbManager = DatabaseManager.getInstance();
    
    // If no project identifier in path, use the active project
    // Check for direct API endpoints (no project prefix) or debug endpoint at root level
    const isDirectApiCall = pathSegments.length === 0 || !pathSegments[0] || 
      pathSegments[0] === 'rest' || pathSegments[0] === 'auth' || 
      pathSegments[0] === 'storage' || pathSegments[0] === 'app' ||
      pathSegments[0] === 'functions' || pathSegments[0] === 'debug';
      
    if (isDirectApiCall) {
      // Check cache for active project
      const cacheKey = '__active__';
      const cached = projectResolutionCache.get(cacheKey);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        // Use cached resolution if database is still connected to the right project
        if (dbManager.isConnected() && dbManager.getConnectionInfo()?.id?.includes(cached.projectId)) {
          cacheMetrics.hits++;
          logger.debug('Using cached active project resolution', { 
            projectId: cached.projectId,
            cacheHitRate: getProjectCacheMetrics().hitRate
          });
          return {
            success: true,
            projectId: cached.projectId,
            projectName: cached.projectName
          };
        }
      }
      
      cacheMetrics.misses++;
      
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        return {
          success: false,
          error: 'No active project found and no project specified in URL'
        };
      }

      // Ensure we're using the active project's database
      if (!dbManager.isConnected() || dbManager.getConnectionInfo()?.id !== activeProject.databasePath) {
        logger.debug('Switching to active project database', { 
          projectId: activeProject.id, 
          databasePath: activeProject.databasePath 
        });
        await dbManager.switchDatabase(activeProject.databasePath);
      }

      // Update cache
      projectResolutionCache.set(cacheKey, {
        projectId: activeProject.id,
        projectName: activeProject.name,
        timestamp: now
      });

      return {
        success: true,
        projectId: activeProject.id,
        projectName: activeProject.name
      };
    }

    const projectIdentifier = pathSegments[0];
    
    return await switchToProjectById(projectIdentifier, dbManager);
  } catch (error) {
    logger.error('Failed to resolve and switch to project', error as Error, {
      url: url.pathname
    });
    
    return {
      success: false,
      error: `Failed to switch to project database: ${(error as Error).message}`
    };
  }
}

/**
 * Helper function to switch to a project by its ID or name
 */
async function switchToProjectById(projectIdentifier: string, dbManager: any): Promise<ProjectResolutionResult> {
  try {
    // Check cache for this project identifier
    const cacheKey = projectIdentifier;
    const cached = projectResolutionCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      // Use cached resolution if database is still connected to the right project
      if (dbManager.isConnected() && dbManager.getConnectionInfo()?.id?.includes(cached.projectId)) {
        cacheMetrics.hits++;
        logger.debug('Using cached project resolution', { 
          projectIdentifier, 
          projectId: cached.projectId,
          cacheHitRate: getProjectCacheMetrics().hitRate
        });
        return {
          success: true,
          projectId: cached.projectId,
          projectName: cached.projectName
        };
      }
    }
    
    cacheMetrics.misses++;
    
    // Try to find project by ID first, then by name
    const projects = projectManager.getProjects();
    let targetProject = projects.find(p => p.id === projectIdentifier);
    
    if (!targetProject) {
      // Try to find by name (case-insensitive)
      targetProject = projects.find(p => 
        p.name.toLowerCase() === projectIdentifier.toLowerCase()
      );
    }

    if (!targetProject) {
      return {
        success: false,
        error: `Project not found: ${projectIdentifier}`
      };
    }

    // Only switch if we're not already connected to this database
    if (!dbManager.isConnected() || dbManager.getConnectionInfo()?.id !== targetProject.databasePath) {
      logger.info('Switching to project database for API request', {
        projectId: targetProject.id,
        projectName: targetProject.name,
        databasePath: targetProject.databasePath,
        projectIdentifier
      });
      
      await dbManager.switchDatabase(targetProject.databasePath);
    } else {
      logger.debug('Skipping database switch - already connected to target project', {
        projectId: targetProject.id,
        currentConnection: dbManager.getConnectionInfo()?.id
      });
    }

    // Update cache
    projectResolutionCache.set(cacheKey, {
      projectId: targetProject.id,
      projectName: targetProject.name,
      timestamp: now
    });

    return {
      success: true,
      projectId: targetProject.id,
      projectName: targetProject.name
    };
  } catch (error) {
    logger.error('Failed to switch to project by ID', error as Error, {
      projectIdentifier
    });
    
    return {
      success: false,
      error: `Failed to switch to project database: ${(error as Error).message}`
    };
  }
}

/**
 * Normalize URL by removing project identifier to get standard API path
 * Example: /project-123/rest/v1/users -> /rest/v1/users
 */
export function normalizeApiPath(url: URL): URL {
  const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
  
  // If no segments or starts with API paths, return as-is
  if (pathSegments.length === 0 || pathSegments[0] === 'rest' || pathSegments[0] === 'auth' || pathSegments[0] === 'storage' || pathSegments[0] === 'app' || pathSegments[0] === 'functions') {
    return url;
  }

  // Remove the first segment (project identifier) and reconstruct
  const normalizedPath = '/' + pathSegments.slice(1).join('/');
  const normalizedUrl = new URL(url);
  normalizedUrl.pathname = normalizedPath;
  
  return normalizedUrl;
}

/**
 * Check if URL contains a project identifier
 */
export function hasProjectInPath(url: URL): boolean {
  const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
  
  // If no segments or starts with API paths, no project identifier
  if (pathSegments.length === 0 || pathSegments[0] === 'rest' || pathSegments[0] === 'auth' || pathSegments[0] === 'storage' || pathSegments[0] === 'app' || pathSegments[0] === 'functions') {
    return false;
  }

  // Check if first segment could be a project identifier
  const firstSegment = pathSegments[0];
  const projects = projectManager.getProjects();
  
  return projects.some(p => 
    p.id === firstSegment || 
    p.name.toLowerCase() === firstSegment.toLowerCase()
  );
}
