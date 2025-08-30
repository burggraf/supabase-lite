import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { executeCreateProject, executeDeleteProject, executeListProjects } from '../src/commands/admin.js';
import { AdminClient } from '../src/lib/admin-client.js';
import { ResultFormatter } from '../src/lib/result-formatter.js';
import { UrlParser } from '../src/lib/url-parser.js';
import readline from 'readline/promises';

// Mock dependencies
vi.mock('../src/lib/admin-client.js');
vi.mock('../src/lib/result-formatter.js');
vi.mock('../src/lib/url-parser.js');
vi.mock('readline/promises');

const mockedAdminClient = vi.mocked(AdminClient);
const mockedResultFormatter = vi.mocked(ResultFormatter);
const mockedUrlParser = vi.mocked(UrlParser);
const mockedReadline = vi.mocked(readline);

describe('Admin Commands', () => {
  const mockConsole = {
    log: vi.fn(),
    error: vi.fn()
  };

  const mockProcess = {
    exit: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock console
    vi.stubGlobal('console', mockConsole);
    
    // Mock process
    vi.stubGlobal('process', mockProcess);

    // Default mocks
    mockedUrlParser.validate.mockReturnValue({ valid: true });
    mockedResultFormatter.formatGeneralError.mockImplementation((msg) => `Error: ${msg}`);
    mockedResultFormatter.formatProjectList.mockReturnValue('Formatted project list');
    mockedResultFormatter.formatProjectCreated.mockReturnValue('Project created');
    mockedResultFormatter.formatProjectDeleted.mockReturnValue('Project deleted');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  describe('executeListProjects', () => {
    it('should list projects successfully', async () => {
      const mockProjects = [
        {
          id: 'abc123',
          name: 'Test Project',
          createdAt: '2023-01-01T00:00:00.000Z',
          lastAccessed: '2023-01-02T00:00:00.000Z',
          isActive: true
        }
      ];

      const mockAdminClientInstance = {
        listProjects: vi.fn().mockResolvedValue(mockProjects)
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      await executeListProjects({ url: 'http://localhost:5173' });

      expect(mockedUrlParser.validate).toHaveBeenCalledWith('http://localhost:5173');
      expect(mockAdminClientInstance.listProjects).toHaveBeenCalled();
      expect(mockedResultFormatter.formatProjectList).toHaveBeenCalledWith(mockProjects);
      expect(mockConsole.log).toHaveBeenCalledWith('📋 Fetching projects...');
      expect(mockConsole.log).toHaveBeenCalledWith('Formatted project list');
    });

    it('should handle invalid URL', async () => {
      mockedUrlParser.validate.mockReturnValue({ 
        valid: false, 
        error: 'Invalid URL format' 
      });

      await executeListProjects({ url: 'invalid-url' });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Invalid URL: Invalid URL format');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle API errors', async () => {
      const mockAdminClientInstance = {
        listProjects: vi.fn().mockRejectedValue(new Error('Connection failed'))
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      await executeListProjects({ url: 'http://localhost:5173' });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Connection failed');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('executeCreateProject', () => {
    it('should create project successfully', async () => {
      const mockProject = {
        id: 'abc123',
        name: 'New Project',
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-01T00:00:00.000Z',
        isActive: true
      };

      const mockAdminClientInstance = {
        createProject: vi.fn().mockResolvedValue(mockProject)
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      await executeCreateProject({ 
        url: 'http://localhost:5173', 
        projectName: 'New Project' 
      });

      expect(mockedUrlParser.validate).toHaveBeenCalledWith('http://localhost:5173');
      expect(mockAdminClientInstance.createProject).toHaveBeenCalledWith('New Project');
      expect(mockedResultFormatter.formatProjectCreated).toHaveBeenCalledWith(mockProject);
      expect(mockConsole.log).toHaveBeenCalledWith('🚀 Creating project...');
      expect(mockConsole.log).toHaveBeenCalledWith('Project created');
    });

    it('should handle empty project name', async () => {
      await executeCreateProject({ 
        url: 'http://localhost:5173', 
        projectName: '  ' 
      });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Project name cannot be empty');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle short project name', async () => {
      await executeCreateProject({ 
        url: 'http://localhost:5173', 
        projectName: 'A' 
      });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Project name must be at least 2 characters long');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle long project name', async () => {
      const longName = 'A'.repeat(51);
      
      await executeCreateProject({ 
        url: 'http://localhost:5173', 
        projectName: longName 
      });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Project name must be less than 50 characters long');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle invalid characters in project name', async () => {
      await executeCreateProject({ 
        url: 'http://localhost:5173', 
        projectName: 'Invalid@Name!' 
      });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Project name can only contain letters, numbers, spaces, hyphens, and underscores');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle API errors', async () => {
      const mockAdminClientInstance = {
        createProject: vi.fn().mockRejectedValue(new Error('Project already exists'))
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      await executeCreateProject({ 
        url: 'http://localhost:5173', 
        projectName: 'Duplicate Project' 
      });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Project already exists');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('executeDeleteProject', () => {
    it('should delete project with confirmation', async () => {
      const mockProject = {
        id: 'abc123def456',
        name: 'Test Project',
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-02T00:00:00.000Z',
        isActive: false
      };

      const mockAdminClientInstance = {
        listProjects: vi.fn().mockResolvedValue([mockProject]),
        deleteProject: vi.fn().mockResolvedValue(undefined)
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      // Mock readline interface
      const mockRl = {
        question: vi.fn().mockResolvedValue('y'),
        close: vi.fn()
      };

      mockedReadline.createInterface.mockReturnValue(mockRl as any);

      await executeDeleteProject({ 
        url: 'http://localhost:5173', 
        projectId: 'abc123def456',
        yes: false 
      });

      expect(mockAdminClientInstance.listProjects).toHaveBeenCalled();
      expect(mockRl.question).toHaveBeenCalledWith('Are you sure you want to delete this project? (y/N): ');
      expect(mockAdminClientInstance.deleteProject).toHaveBeenCalledWith('abc123def456');
      expect(mockedResultFormatter.formatProjectDeleted).toHaveBeenCalledWith(mockProject);
      expect(mockConsole.log).toHaveBeenCalledWith('🗑️  Deleting project...');
      expect(mockConsole.log).toHaveBeenCalledWith('Project deleted');
    });

    it('should delete project without confirmation when -y flag is used', async () => {
      const mockProject = {
        id: 'abc123def456',
        name: 'Test Project',
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-02T00:00:00.000Z',
        isActive: false
      };

      const mockAdminClientInstance = {
        listProjects: vi.fn().mockResolvedValue([mockProject]),
        deleteProject: vi.fn().mockResolvedValue(undefined)
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      await executeDeleteProject({ 
        url: 'http://localhost:5173', 
        projectId: 'abc123def456',
        yes: true 
      });

      expect(mockAdminClientInstance.deleteProject).toHaveBeenCalledWith('abc123def456');
      expect(mockedReadline.createInterface).not.toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith('Project deleted');
    });

    it('should cancel deletion when user says no', async () => {
      const mockProject = {
        id: 'abc123def456',
        name: 'Test Project',
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-02T00:00:00.000Z',
        isActive: false
      };

      const mockAdminClientInstance = {
        listProjects: vi.fn().mockResolvedValue([mockProject]),
        deleteProject: vi.fn()
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      // Mock readline interface to simulate user saying 'no'
      const mockRl = {
        question: vi.fn().mockResolvedValue('no'), // Use 'no' instead of 'n'
        close: vi.fn()
      };

      mockedReadline.createInterface.mockReturnValue(mockRl as any);

      // Track all process.exit calls
      const exitCalls: number[] = [];
      mockProcess.exit.mockImplementation((code) => {
        exitCalls.push(code);
        throw new Error(`Process exit called with code ${code}`);
      });

      // Test should handle the process exit gracefully
      let thrownError: Error | null = null;
      try {
        await executeDeleteProject({ 
          url: 'http://localhost:5173', 
          projectId: 'abc123def456',
          yes: false 
        });
      } catch (error) {
        thrownError = error as Error;
      }

      // Verify the function exited correctly
      expect(thrownError).not.toBeNull();
      expect(exitCalls).toContain(0); // Should have called process.exit(0)
      expect(mockConsole.log).toHaveBeenCalledWith('❌ Project deletion cancelled');
      expect(mockAdminClientInstance.deleteProject).not.toHaveBeenCalled();
    });

    it('should handle project not found', async () => {
      const mockAdminClientInstance = {
        listProjects: vi.fn().mockResolvedValue([])
      };

      mockedAdminClient.mockImplementation(() => mockAdminClientInstance as any);

      await executeDeleteProject({ 
        url: 'http://localhost:5173', 
        projectId: 'nonexistent',
        yes: false 
      });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Project with ID \'nonexistent\' not found');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });

    it('should handle empty project ID', async () => {
      await executeDeleteProject({ 
        url: 'http://localhost:5173', 
        projectId: '  ',
        yes: false 
      });

      expect(mockConsole.error).toHaveBeenCalledWith('Error: Project ID cannot be empty');
      expect(mockProcess.exit).toHaveBeenCalledWith(1);
    });
  });
});