import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectManager, type Project } from '../ProjectManager';

// Mock dependencies
vi.mock('../../../lib/infrastructure/Logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

vi.mock('../../../lib/infrastructure/ErrorHandler', () => ({
  createDatabaseError: vi.fn((message: string, error: Error) => error)
}));

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  let localStorageMock: any;

  beforeEach(() => {
    // Reset singleton instance
    (ProjectManager as any).instance = null;

    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    // Mock crypto.randomUUID
    Object.defineProperty(global, 'crypto', {
      value: {
        randomUUID: vi.fn(() => 'test-uuid-123')
      }
    });

    // Mock indexedDB
    const mockIndexedDB = {
      databases: vi.fn(),
      deleteDatabase: vi.fn(),
    };
    global.indexedDB = mockIndexedDB;

    projectManager = ProjectManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ProjectManager.getInstance();
      const instance2 = ProjectManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize from localStorage on creation', () => {
      expect(localStorageMock.getItem).toHaveBeenCalledWith('supabase_lite_projects');
    });
  });

  describe('Project Creation', () => {
    it('should create a new project successfully', async () => {
      const projectName = 'Test Project';
      
      const project = await projectManager.createProject(projectName);

      expect(project).toEqual({
        id: 'test-uuid-123',
        name: 'Test Project',
        databasePath: 'idb://project_test-uuid-123',
        createdAt: expect.any(Date),
        lastAccessed: expect.any(Date),
        isActive: true
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should trim whitespace from project name', async () => {
      const project = await projectManager.createProject('  Test Project  ');
      expect(project.name).toBe('Test Project');
    });

    it('should throw error for empty project name', async () => {
      await expect(projectManager.createProject('')).rejects.toThrow('Project name is required');
      await expect(projectManager.createProject('   ')).rejects.toThrow('Project name is required');
    });

    it('should throw error for duplicate project names', async () => {
      await projectManager.createProject('Test Project');
      await expect(projectManager.createProject('Test Project')).rejects.toThrow('A project with this name already exists');
    });

    it('should handle case-insensitive duplicate names', async () => {
      await projectManager.createProject('Test Project');
      await expect(projectManager.createProject('TEST PROJECT')).rejects.toThrow('A project with this name already exists');
    });

    it('should deactivate other projects when creating new one', async () => {
      const project1 = await projectManager.createProject('Project 1');
      expect(project1.isActive).toBe(true);

      const project2 = await projectManager.createProject('Project 2');
      expect(project2.isActive).toBe(true);

      const allProjects = projectManager.getProjects();
      const inactiveProject1 = allProjects.find(p => p.id === project1.id);
      expect(inactiveProject1?.isActive).toBe(false);
    });

    it('should set new project as active project', async () => {
      const project = await projectManager.createProject('Test Project');
      const activeProject = projectManager.getActiveProject();
      expect(activeProject?.id).toBe(project.id);
    });
  });

  describe('Project Retrieval', () => {
    beforeEach(async () => {
      await projectManager.createProject('Project 1');
      await projectManager.createProject('Project 2');
    });

    it('should return all projects', () => {
      const projects = projectManager.getProjects();
      expect(projects).toHaveLength(2);
      expect(projects[0].name).toBe('Project 1');
      expect(projects[1].name).toBe('Project 2');
    });

    it('should return copy of projects array', () => {
      const projects1 = projectManager.getProjects();
      const projects2 = projectManager.getProjects();
      expect(projects1).not.toBe(projects2);
      expect(projects1).toEqual(projects2);
    });

    it('should return active project', () => {
      const activeProject = projectManager.getActiveProject();
      expect(activeProject?.name).toBe('Project 2');
      expect(activeProject?.isActive).toBe(true);
    });

    it('should return null when no active project', () => {
      // Reset to empty state
      (ProjectManager as any).instance = null;
      localStorageMock.getItem.mockReturnValue(null);
      
      const newManager = ProjectManager.getInstance();
      const activeProject = newManager.getActiveProject();
      expect(activeProject).toBeNull();
    });
  });

  describe('Project Switching', () => {
    let project1: Project;
    let project2: Project;

    beforeEach(async () => {
      project1 = await projectManager.createProject('Project 1');
      project2 = await projectManager.createProject('Project 2');
    });

    it('should switch to existing project', async () => {
      const switchedProject = await projectManager.switchToProject(project1.id);
      
      expect(switchedProject.id).toBe(project1.id);
      expect(switchedProject.isActive).toBe(true);
      expect(switchedProject.lastAccessed).toBeInstanceOf(Date);
      
      const activeProject = projectManager.getActiveProject();
      expect(activeProject?.id).toBe(project1.id);
    });

    it('should deactivate previous active project', async () => {
      await projectManager.switchToProject(project1.id);
      
      const allProjects = projectManager.getProjects();
      const previousProject = allProjects.find(p => p.id === project2.id);
      expect(previousProject?.isActive).toBe(false);
    });

    it('should update lastAccessed when switching', async () => {
      const originalLastAccessed = project1.lastAccessed;
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const switchedProject = await projectManager.switchToProject(project1.id);
      expect(switchedProject.lastAccessed.getTime()).toBeGreaterThan(originalLastAccessed.getTime());
    });

    it('should throw error for non-existent project', async () => {
      await expect(projectManager.switchToProject('non-existent-id')).rejects.toThrow('Project not found');
    });

    it('should save to storage after switching', async () => {
      await projectManager.switchToProject(project1.id);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('Project Deletion', () => {
    let project1: Project;
    let project2: Project;

    beforeEach(async () => {
      project1 = await projectManager.createProject('Project 1');
      project2 = await projectManager.createProject('Project 2');
    });

    it('should delete non-active project', async () => {
      await projectManager.deleteProject(project1.id);
      
      const remainingProjects = projectManager.getProjects();
      expect(remainingProjects).toHaveLength(1);
      expect(remainingProjects[0].id).toBe(project2.id);
    });

    it('should delete active project and switch to another', async () => {
      await projectManager.deleteProject(project2.id); // project2 is active
      
      const remainingProjects = projectManager.getProjects();
      expect(remainingProjects).toHaveLength(1);
      expect(remainingProjects[0].id).toBe(project1.id);
      
      const activeProject = projectManager.getActiveProject();
      expect(activeProject?.id).toBe(project1.id);
    });

    it('should throw error when deleting non-existent project', async () => {
      await expect(projectManager.deleteProject('non-existent-id')).rejects.toThrow('Project not found');
    });

    it('should throw error when deleting only remaining project', async () => {
      await projectManager.deleteProject(project1.id); // Delete first project
      await expect(projectManager.deleteProject(project2.id)).rejects.toThrow('Cannot delete the only remaining project');
    });

    it('should clear active project when deleting last project', async () => {
      // Delete both projects by forcing the deletion
      (projectManager as any).projectsData.projects = [project2]; // Simulate only one project
      await projectManager.deleteProject(project2.id);
      
      expect(projectManager.getActiveProject()).toBeNull();
    });

    it('should attempt database cleanup on deletion', async () => {
      const mockDatabases = vi.fn().mockResolvedValue([
        { name: 'project_test-uuid-123' }
      ]);
      const mockDeleteDatabase = vi.fn().mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        onblocked: null
      }));
      
      global.indexedDB.databases = mockDatabases;
      global.indexedDB.deleteDatabase = mockDeleteDatabase;

      await projectManager.deleteProject(project1.id);
      
      expect(mockDatabases).toHaveBeenCalled();
    });

    it('should save to storage after deletion', async () => {
      await projectManager.deleteProject(project1.id);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('Project Name Updates', () => {
    let project: Project;

    beforeEach(async () => {
      project = await projectManager.createProject('Original Name');
    });

    it('should update project name successfully', () => {
      const updatedProject = projectManager.updateProjectName(project.id, 'Updated Name');
      
      expect(updatedProject.name).toBe('Updated Name');
      expect(updatedProject.lastAccessed).toBeInstanceOf(Date);
    });

    it('should trim whitespace from new name', () => {
      const updatedProject = projectManager.updateProjectName(project.id, '  Updated Name  ');
      expect(updatedProject.name).toBe('Updated Name');
    });

    it('should throw error for empty name', () => {
      expect(() => projectManager.updateProjectName(project.id, '')).toThrow('Project name is required');
      expect(() => projectManager.updateProjectName(project.id, '   ')).toThrow('Project name is required');
    });

    it('should throw error for non-existent project', () => {
      expect(() => projectManager.updateProjectName('non-existent-id', 'New Name')).toThrow('Project not found');
    });

    it('should throw error for duplicate name', async () => {
      await projectManager.createProject('Another Project');
      
      expect(() => projectManager.updateProjectName(project.id, 'Another Project')).toThrow('A project with this name already exists');
    });

    it('should handle case-insensitive duplicate check', async () => {
      await projectManager.createProject('Another Project');
      
      expect(() => projectManager.updateProjectName(project.id, 'ANOTHER PROJECT')).toThrow('A project with this name already exists');
    });

    it('should allow updating to same name (case changes)', () => {
      const updatedProject = projectManager.updateProjectName(project.id, 'ORIGINAL NAME');
      expect(updatedProject.name).toBe('ORIGINAL NAME');
    });

    it('should save to storage after update', () => {
      projectManager.updateProjectName(project.id, 'Updated Name');
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('Storage Persistence', () => {
    it('should load projects from localStorage on initialization', () => {
      const mockData = {
        projects: [{
          id: 'stored-id',
          name: 'Stored Project',
          databasePath: 'idb://stored_db',
          createdAt: '2023-01-01T00:00:00.000Z',
          lastAccessed: '2023-01-01T01:00:00.000Z',
          isActive: true
        }],
        activeProjectId: 'stored-id'
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockData));
      
      // Create new instance to trigger loading
      (ProjectManager as any).instance = null;
      const newManager = ProjectManager.getInstance();
      
      const projects = newManager.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('stored-id');
      expect(projects[0].createdAt).toBeInstanceOf(Date);
      expect(projects[0].lastAccessed).toBeInstanceOf(Date);
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      // Should not throw and should start with empty projects
      (ProjectManager as any).instance = null;
      const newManager = ProjectManager.getInstance();
      
      const projects = newManager.getProjects();
      expect(projects).toHaveLength(0);
    });

    it('should handle missing localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      (ProjectManager as any).instance = null;
      const newManager = ProjectManager.getInstance();
      
      const projects = newManager.getProjects();
      expect(projects).toHaveLength(0);
    });

    it('should save projects to localStorage', async () => {
      await projectManager.createProject('Test Project');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'supabase_lite_projects',
        expect.stringContaining('Test Project')
      );
    });
  });

  describe('Data Export/Import', () => {
    beforeEach(async () => {
      await projectManager.createProject('Project 1');
      await projectManager.createProject('Project 2');
    });

    it('should export projects data as JSON', () => {
      const exportedData = projectManager.exportProjectsData();
      const parsedData = JSON.parse(exportedData);
      
      expect(parsedData.projects).toHaveLength(2);
      expect(parsedData.activeProjectId).toBeDefined();
    });

    it('should import projects data from JSON', () => {
      const importData = {
        projects: [{
          id: 'imported-id',
          name: 'Imported Project',
          databasePath: 'idb://imported_db',
          createdAt: '2023-01-01T00:00:00.000Z',
          lastAccessed: '2023-01-01T01:00:00.000Z',
          isActive: true
        }],
        activeProjectId: 'imported-id'
      };

      projectManager.importProjectsData(JSON.stringify(importData));
      
      const projects = projectManager.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Imported Project');
      expect(projects[0].createdAt).toBeInstanceOf(Date);
    });

    it('should throw error for invalid import data', () => {
      expect(() => projectManager.importProjectsData('invalid json')).toThrow();
    });

    it('should throw error for invalid data structure', () => {
      expect(() => projectManager.importProjectsData('{"projects": "not an array"}')).toThrow('Invalid projects data format');
    });

    it('should save to storage after import', () => {
      const importData = { projects: [], activeProjectId: null };
      projectManager.importProjectsData(JSON.stringify(importData));
      
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('Database Cleanup', () => {
    it('should handle successful database deletion', async () => {
      const mockDatabases = vi.fn().mockResolvedValue([
        { name: 'project_test-uuid-123' },
        { name: 'other_db' }
      ]);
      
      const deleteRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null
      };
      
      const mockDeleteDatabase = vi.fn().mockReturnValue(deleteRequest);
      
      global.indexedDB.databases = mockDatabases;
      global.indexedDB.deleteDatabase = mockDeleteDatabase;

      const project = await projectManager.createProject('Test Project');
      
      // Trigger cleanup by deleting project
      const cleanupPromise = projectManager.deleteProject(project.id);
      
      // Simulate successful deletion
      if (deleteRequest.onsuccess) {
        deleteRequest.onsuccess();
      }
      
      await cleanupPromise;
      
      expect(mockDeleteDatabase).toHaveBeenCalledWith('project_test-uuid-123');
    });

    it('should handle database deletion errors gracefully', async () => {
      const mockDatabases = vi.fn().mockResolvedValue([
        { name: 'project_test-uuid-123' }
      ]);
      
      const deleteRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null,
        error: new Error('Delete failed')
      };
      
      global.indexedDB.databases = mockDatabases;
      global.indexedDB.deleteDatabase = vi.fn().mockReturnValue(deleteRequest);

      const project = await projectManager.createProject('Test Project');
      
      // Should not throw even if cleanup fails
      await expect(projectManager.deleteProject(project.id)).resolves.not.toThrow();
    });

    it('should handle blocked database deletion', async () => {
      const mockDatabases = vi.fn().mockResolvedValue([
        { name: 'project_test-uuid-123' }
      ]);
      
      const deleteRequest = {
        onsuccess: null,
        onerror: null,
        onblocked: null
      };
      
      global.indexedDB.databases = mockDatabases;
      global.indexedDB.deleteDatabase = vi.fn().mockReturnValue(deleteRequest);

      const project = await projectManager.createProject('Test Project');
      
      const cleanupPromise = projectManager.deleteProject(project.id);
      
      // Simulate blocked deletion
      if (deleteRequest.onblocked) {
        deleteRequest.onblocked();
      }
      
      await expect(cleanupPromise).resolves.not.toThrow();
    });
  });
});