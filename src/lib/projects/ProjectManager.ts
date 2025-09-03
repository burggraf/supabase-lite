import { logger } from '../infrastructure/Logger';
import { createDatabaseError } from '../infrastructure/ErrorHandler';

export interface Project {
  id: string;
  name: string;
  databasePath: string;
  createdAt: Date;
  lastAccessed: Date;
  isActive: boolean;
}

interface ProjectsData {
  projects: Project[];
  activeProjectId: string | null;
}

export class ProjectManager {
  private static instance: ProjectManager;
  private readonly STORAGE_KEY = 'supabase_lite_projects';
  private projectsData: ProjectsData = { projects: [], activeProjectId: null };

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): ProjectManager {
    if (!ProjectManager.instance) {
      ProjectManager.instance = new ProjectManager();
    }
    return ProjectManager.instance;
  }

  public getProjects(): Project[] {
    return [...this.projectsData.projects];
  }

  public getActiveProject(): Project | null {
    if (!this.projectsData.activeProjectId) {
      return null;
    }
    return this.projectsData.projects.find(p => p.id === this.projectsData.activeProjectId) || null;
  }

  public async createProject(name: string): Promise<Project> {
    try {
      logger.info('Creating new project', { name });
      
      // Validate name
      if (!name.trim()) {
        throw new Error('Project name is required');
      }
      
      // Check for duplicate names
      if (this.projectsData.projects.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('A project with this name already exists');
      }

      const projectId = crypto.randomUUID();
      // Use UUID-based database naming to ensure complete isolation between projects
      const databasePath = `idb://project_${projectId}`;
      
      const newProject: Project = {
        id: projectId,
        name: name.trim(),
        databasePath,
        createdAt: new Date(),
        lastAccessed: new Date(),
        isActive: false
      };

      // Deactivate all other projects and activate the new one
      this.projectsData.projects.forEach(p => p.isActive = false);
      newProject.isActive = true;

      this.projectsData.projects.push(newProject);
      this.projectsData.activeProjectId = projectId;
      
      this.saveToStorage();
      
      logger.info('Project created successfully', { 
        projectId, 
        name: newProject.name,
        databasePath: newProject.databasePath 
      });
      
      return newProject;
    } catch (error) {
      logger.error('Failed to create project', error as Error, { name });
      throw createDatabaseError('Failed to create project', error as Error);
    }
  }

  public async deleteProject(projectId: string): Promise<void> {
    try {
      logger.info('Deleting project', { projectId });
      
      const projectIndex = this.projectsData.projects.findIndex(p => p.id === projectId);
      if (projectIndex === -1) {
        throw new Error('Project not found');
      }

      const project = this.projectsData.projects[projectIndex];
      
      // Cannot delete the active project if it's the only one
      if (project.isActive && this.projectsData.projects.length === 1) {
        throw new Error('Cannot delete the only remaining project');
      }

      // If deleting the active project, switch to another one first
      if (project.isActive && this.projectsData.projects.length > 1) {
        const otherProject = this.projectsData.projects.find(p => p.id !== projectId);
        if (otherProject) {
          await this.switchToProject(otherProject.id);
        }
      }

      // Remove from projects list
      this.projectsData.projects.splice(projectIndex, 1);
      
      // Clear active project if this was the last one
      if (this.projectsData.projects.length === 0) {
        this.projectsData.activeProjectId = null;
      }

      this.saveToStorage();

      // Attempt to clean up the IndexedDB database
      try {
        await this.cleanupDatabase(project.databasePath);
        logger.info('Project database cleaned up', { projectId, databasePath: project.databasePath });
      } catch (cleanupError) {
        logger.warn('Failed to cleanup project database', { 
          error: cleanupError as Error,
          projectId, 
          databasePath: project.databasePath 
        });
        // Don't throw error for cleanup failure
      }

      logger.info('Project deleted successfully', { projectId, name: project.name });
    } catch (error) {
      logger.error('Failed to delete project', error as Error, { projectId });
      throw createDatabaseError('Failed to delete project', error as Error);
    }
  }

  public async switchToProject(projectId: string): Promise<Project> {
    try {
      logger.info('Switching to project', { projectId });
      
      const project = this.projectsData.projects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Deactivate all projects
      this.projectsData.projects.forEach(p => p.isActive = false);
      
      // Activate the selected project
      project.isActive = true;
      project.lastAccessed = new Date();
      this.projectsData.activeProjectId = projectId;
      
      this.saveToStorage();
      
      logger.info('Switched to project successfully', { 
        projectId, 
        name: project.name,
        databasePath: project.databasePath 
      });
      
      return project;
    } catch (error) {
      logger.error('Failed to switch project', error as Error, { projectId });
      throw createDatabaseError('Failed to switch project', error as Error);
    }
  }

  public updateProjectName(projectId: string, newName: string): Project {
    try {
      logger.info('Updating project name', { projectId, newName });
      
      if (!newName.trim()) {
        throw new Error('Project name is required');
      }

      const project = this.projectsData.projects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check for duplicate names (excluding current project)
      if (this.projectsData.projects.some(p => p.id !== projectId && p.name.toLowerCase() === newName.toLowerCase())) {
        throw new Error('A project with this name already exists');
      }

      project.name = newName.trim();
      project.lastAccessed = new Date();
      
      this.saveToStorage();
      
      logger.info('Project name updated successfully', { projectId, newName });
      
      return project;
    } catch (error) {
      logger.error('Failed to update project name', error as Error, { projectId, newName });
      throw createDatabaseError('Failed to update project name', error as Error);
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        logger.debug('No projects found in storage, starting with empty list');
        return;
      }

      const data = JSON.parse(stored) as ProjectsData;
      
      // Convert date strings back to Date objects
      data.projects = data.projects.map(project => ({
        ...project,
        createdAt: new Date(project.createdAt),
        lastAccessed: new Date(project.lastAccessed)
      }));

      this.projectsData = data;
      
      logger.debug('Projects loaded from storage', { 
        projectCount: this.projectsData.projects.length,
        activeProjectId: this.projectsData.activeProjectId 
      });
    } catch (error) {
      logger.error('Failed to load projects from storage, starting with empty list', error as Error);
      this.projectsData = { projects: [], activeProjectId: null };
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.projectsData));
      logger.debug('Projects saved to storage', { 
        projectCount: this.projectsData.projects.length,
        activeProjectId: this.projectsData.activeProjectId 
      });
    } catch (error) {
      logger.error('Failed to save projects to storage', error as Error);
    }
  }

  private async cleanupDatabase(databasePath: string): Promise<void> {
    try {
      // Extract the database name from the path (e.g., "project_123" from "idb://project_123")
      const dbName = databasePath.replace('idb://', '');
      
      logger.info('Starting database cleanup', { databasePath, dbName });
      
      // Try to delete the IndexedDB database
      if (typeof indexedDB !== 'undefined') {
        // First, list all databases to see what exists
        const allDatabases = await indexedDB.databases();
        
        // Ensure allDatabases is an array to prevent map errors
        const databasesList = Array.isArray(allDatabases) ? allDatabases : [];
        
        logger.debug('All IndexedDB databases before cleanup', { 
          databases: databasesList.map(db => db.name),
          targetDbName: dbName
        });
        
        // Find databases that match our project
        const matchingDatabases = databasesList.filter(db => 
          db.name === dbName || 
          db.name?.startsWith(dbName) ||
          db.name?.includes(dbName)
        );
        
        logger.debug('Databases to delete', { 
          matchingDatabases: matchingDatabases.map(db => db.name),
          count: matchingDatabases.length
        });
        
        // Delete each matching database
        const deletePromises = matchingDatabases.map(db => {
          return new Promise<void>((resolve, _reject) => {
            if (!db.name) {
              resolve();
              return;
            }
            
            const deleteRequest = indexedDB.deleteDatabase(db.name);
            
            deleteRequest.onsuccess = () => {
              logger.debug('IndexedDB database deleted successfully', { dbName: db.name });
              resolve();
            };
            
            deleteRequest.onerror = () => {
              logger.warn('Failed to delete IndexedDB database', { 
                dbName: db.name, 
                error: deleteRequest.error 
              });
              // Don't reject - continue with other deletions
              resolve();
            };
            
            deleteRequest.onblocked = () => {
              logger.warn('Database deletion blocked - there may be open connections', { dbName: db.name });
              // Resolve anyway as the deletion will complete when connections close
              resolve();
            };
          });
        });
        
        // Wait for all deletions to complete
        await Promise.all(deletePromises);
        
        // Verify deletion
        const remainingDatabases = await indexedDB.databases();
        const remainingDatabasesList = Array.isArray(remainingDatabases) ? remainingDatabases : [];
        const stillExists = remainingDatabasesList.filter(db => 
          db.name === dbName || 
          db.name?.startsWith(dbName) ||
          db.name?.includes(dbName)
        );
        
        if (stillExists.length > 0) {
          logger.warn('Some databases could not be deleted', { 
            stillExists: stillExists.map(db => db.name)
          });
        } else {
          logger.info('All project databases deleted successfully', { dbName });
        }
      }
    } catch (error) {
      logger.error('Database cleanup failed', error as Error, { databasePath });
      // Don't throw error - database deletion is not critical for project deletion
    }
  }

  public exportProjectsData(): string {
    try {
      return JSON.stringify(this.projectsData, null, 2);
    } catch (error) {
      logger.error('Failed to export projects data', error as Error);
      throw createDatabaseError('Failed to export projects data', error as Error);
    }
  }

  public importProjectsData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData) as ProjectsData;
      
      // Validate the data structure
      if (!Array.isArray(data.projects)) {
        throw new Error('Invalid projects data format');
      }

      // Convert date strings to Date objects
      data.projects = data.projects.map(project => ({
        ...project,
        createdAt: new Date(project.createdAt),
        lastAccessed: new Date(project.lastAccessed)
      }));

      this.projectsData = data;
      this.saveToStorage();
      
      logger.info('Projects data imported successfully', { 
        projectCount: this.projectsData.projects.length 
      });
    } catch (error) {
      logger.error('Failed to import projects data', error as Error);
      throw createDatabaseError('Failed to import projects data', error as Error);
    }
  }
}

export const projectManager = ProjectManager.getInstance();