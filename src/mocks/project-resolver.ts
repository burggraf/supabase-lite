import { DatabaseManager } from '../lib/database/connection';
import { projectManager } from '../lib/projects/ProjectManager';
import { logger } from '../lib/infrastructure/Logger';

export interface ProjectResolutionResult {
  success: boolean;
  projectId?: string;
  projectName?: string;
  error?: string;
}

/**
 * Extract project identifier from URL path and switch to that project's database
 * Supports both project IDs and project names in the URL
 */
export async function resolveAndSwitchToProject(url: URL): Promise<ProjectResolutionResult> {
  try {
    const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
    
    // If no project identifier in path, use the active project
    if (pathSegments.length === 0 || !pathSegments[0] || pathSegments[0] === 'rest' || pathSegments[0] === 'auth') {
      const activeProject = projectManager.getActiveProject();
      if (!activeProject) {
        return {
          success: false,
          error: 'No active project found and no project specified in URL'
        };
      }

      // Ensure we're using the active project's database
      const dbManager = DatabaseManager.getInstance();
      if (!dbManager.isConnected() || dbManager.getConnectionInfo()?.id !== activeProject.databasePath) {
        logger.debug('Switching to active project database', { 
          projectId: activeProject.id, 
          databasePath: activeProject.databasePath 
        });
        await dbManager.switchDatabase(activeProject.databasePath);
      }

      return {
        success: true,
        projectId: activeProject.id,
        projectName: activeProject.name
      };
    }

    const projectIdentifier = pathSegments[0];
    
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

    // Switch to the target project's database
    const dbManager = DatabaseManager.getInstance();
    
    // Only switch if we're not already connected to this database
    if (!dbManager.isConnected() || dbManager.getConnectionInfo()?.id !== targetProject.databasePath) {
      logger.info('Switching to project database for API request', {
        projectId: targetProject.id,
        projectName: targetProject.name,
        databasePath: targetProject.databasePath,
        requestUrl: url.pathname
      });
      
      await dbManager.switchDatabase(targetProject.databasePath);
    }

    return {
      success: true,
      projectId: targetProject.id,
      projectName: targetProject.name
    };
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
 * Normalize URL by removing project identifier to get standard API path
 * Example: /project-123/rest/v1/users -> /rest/v1/users
 */
export function normalizeApiPath(url: URL): URL {
  const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
  
  // If no segments or starts with API paths, return as-is
  if (pathSegments.length === 0 || pathSegments[0] === 'rest' || pathSegments[0] === 'auth') {
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
  if (pathSegments.length === 0 || pathSegments[0] === 'rest' || pathSegments[0] === 'auth') {
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