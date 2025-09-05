import { http } from 'msw'
import { projectManager } from '../../lib/projects/ProjectManager'
import { 
  createErrorResponse, 
  createSuccessResponse,
  safeJsonParse
} from './shared/common-handlers'

// Projects handlers
export const projectsHandlers = [
  // List projects (user endpoint)
  http.get('/projects', () => {
    try {
      const projects = projectManager.getProjects();
      const activeProject = projectManager.getActiveProject();
      
      return createSuccessResponse({
        projects: projects.map(project => ({
          id: project.id,
          name: project.name,
          isActive: project.isActive,
          createdAt: project.createdAt.toISOString(),
          lastAccessed: project.lastAccessed.toISOString()
        })),
        activeProjectId: activeProject?.id || null,
        totalCount: projects.length
      });
    } catch (error) {
      console.error('❌ MSW: Error listing projects:', error);
      return createErrorResponse(
        'Failed to list projects',
        (error as Error).message,
        500
      );
    }
  }),

  // ==== ADMIN ENDPOINTS (server-level) ====

  // List all projects (admin endpoint)
  http.get('/admin/projects', async ({ request: _request }: any) => {
    try {
      console.log('🔧 MSW: Admin - List projects');
      
      const projects = projectManager.getProjects();
      
      // Convert to admin-friendly format
      const adminProjects = projects.map(project => ({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt.toISOString(),
        lastAccessed: project.lastAccessed.toISOString(),
        isActive: project.isActive
      }));

      return createSuccessResponse({
        projects: adminProjects
      });
    } catch (error: any) {
      console.error('❌ MSW: Admin list projects error:', error);
      return createErrorResponse(
        'ADMIN_ERROR',
        error.message || 'Failed to list projects',
        500
      );
    }
  }),

  // Create a new project (admin endpoint)
  http.post('/admin/projects', async ({ request }: any) => {
    try {
      const body = await safeJsonParse(request);
      const { name } = body;
      
      if (!name || typeof name !== 'string') {
        return createErrorResponse(
          'VALIDATION_ERROR',
          'Project name is required and must be a string',
          400
        );
      }

      console.log('🔧 MSW: Admin - Create project:', name);
      
      const newProject = await projectManager.createProject(name.trim());
      
      // Convert to admin-friendly format
      const adminProject = {
        id: newProject.id,
        name: newProject.name,
        createdAt: newProject.createdAt.toISOString(),
        lastAccessed: newProject.lastAccessed.toISOString(),
        isActive: newProject.isActive
      };

      return createSuccessResponse({
        project: adminProject
      }, 201);
    } catch (error: any) {
      console.error('❌ MSW: Admin create project error:', error);
      
      // Check for duplicate name error
      if (error.message && error.message.includes('already exists')) {
        return createErrorResponse(
          'DUPLICATE_NAME',
          error.message,
          409
        );
      }
      
      return createErrorResponse(
        'ADMIN_ERROR',
        error.message || 'Failed to create project',
        500
      );
    }
  }),

  // Delete a project (admin endpoint)
  http.delete('/admin/projects/:projectId', async ({ params, request: _request }: any) => {
    try {
      const projectId = params.projectId;
      
      if (!projectId || typeof projectId !== 'string') {
        return createErrorResponse(
          'VALIDATION_ERROR',
          'Project ID is required',
          400
        );
      }

      console.log('🔧 MSW: Admin - Delete project:', projectId);
      
      // Check if project exists first
      const projects = projectManager.getProjects();
      const project = projects.find(p => p.id === projectId);
      
      if (!project) {
        return createErrorResponse(
          'NOT_FOUND',
          'Project not found',
          404
        );
      }
      
      await projectManager.deleteProject(projectId);

      return createSuccessResponse({
        message: 'Project deleted successfully'
      });
    } catch (error: any) {
      console.error('❌ MSW: Admin delete project error:', error);
      return createErrorResponse(
        'ADMIN_ERROR',
        error.message || 'Failed to delete project',
        500
      );
    }
  }),
]