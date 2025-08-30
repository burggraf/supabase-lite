import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AdminClient } from '../src/lib/admin-client.js';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('AdminClient', () => {
  let adminClient: AdminClient;
  const testUrl = 'http://localhost:5173';

  beforeEach(() => {
    adminClient = new AdminClient(testUrl);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('listProjects', () => {
    it('should list projects successfully', async () => {
      const mockProjects = [
        {
          id: 'abc123def456',
          name: 'Test Project 1',
          createdAt: '2023-01-01T00:00:00.000Z',
          lastAccessed: '2023-01-02T00:00:00.000Z',
          isActive: true
        },
        {
          id: 'xyz789uvw012',
          name: 'Test Project 2',
          createdAt: '2023-01-03T00:00:00.000Z',
          lastAccessed: '2023-01-04T00:00:00.000Z',
          isActive: false
        }
      ];

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { projects: mockProjects }
      });

      const result = await adminClient.listProjects();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:5173/admin/projects',
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );
      expect(result).toEqual(mockProjects);
    });

    it('should handle empty project list', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { projects: [] }
      });

      const result = await adminClient.listProjects();

      expect(result).toEqual([]);
    });

    it('should handle connection errors', async () => {
      const axiosError = new Error('Connection refused');
      (axiosError as any).code = 'ECONNREFUSED';
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.listProjects()).rejects.toThrow(
        'Connection refused. Make sure Supabase Lite is running at http://localhost:5173'
      );
    });

    it('should handle 404 errors', async () => {
      const axiosError = new Error('Not found');
      (axiosError as any).response = { status: 404 };
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.listProjects()).rejects.toThrow(
        'Admin endpoint not found. Make sure you\'re connecting to a valid Supabase Lite instance'
      );
    });

    it('should handle server errors', async () => {
      const axiosError = new Error('Internal server error');
      (axiosError as any).response = { status: 500 };
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.get.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.listProjects()).rejects.toThrow(
        'Server error (500). The Supabase Lite instance may be experiencing issues'
      );
    });

    it('should handle admin-specific errors', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          error: 'ADMIN_ERROR',
          message: 'Failed to access projects'
        }
      });

      await expect(adminClient.listProjects()).rejects.toThrow(
        'Failed to access projects'
      );
    });
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      const mockProject = {
        id: 'abc123def456',
        name: 'New Test Project',
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-01T00:00:00.000Z',
        isActive: true
      };

      mockedAxios.post.mockResolvedValue({
        status: 201,
        data: { project: mockProject }
      });

      const result = await adminClient.createProject('New Test Project');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5173/admin/projects',
        { name: 'New Test Project' },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
      expect(result).toEqual(mockProject);
    });

    it('should trim project name', async () => {
      const mockProject = {
        id: 'abc123def456',
        name: 'Trimmed Project',
        createdAt: '2023-01-01T00:00:00.000Z',
        lastAccessed: '2023-01-01T00:00:00.000Z',
        isActive: true
      };

      mockedAxios.post.mockResolvedValue({
        status: 201,
        data: { project: mockProject }
      });

      await adminClient.createProject('  Trimmed Project  ');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5173/admin/projects',
        { name: 'Trimmed Project' },
        expect.any(Object)
      );
    });

    it('should handle duplicate name errors', async () => {
      const axiosError = new Error('Duplicate name');
      (axiosError as any).response = {
        status: 409,
        data: {
          error: 'DUPLICATE_NAME',
          message: 'A project with this name already exists'
        }
      };
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.post.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.createProject('Existing Project')).rejects.toThrow(
        'A project with this name already exists'
      );
    });

    it('should handle validation errors', async () => {
      const axiosError = new Error('Validation error');
      (axiosError as any).response = {
        status: 400,
        data: {
          error: 'VALIDATION_ERROR',
          message: 'Project name is invalid'
        }
      };
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.post.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.createProject('')).rejects.toThrow(
        'Project name is invalid'
      );
    });

    it('should handle connection errors', async () => {
      const axiosError = new Error('Connection refused');
      (axiosError as any).code = 'ECONNREFUSED';
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.post.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.createProject('Test Project')).rejects.toThrow(
        'Connection refused. Make sure Supabase Lite is running at http://localhost:5173'
      );
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      mockedAxios.delete.mockResolvedValue({
        status: 200,
        data: { message: 'Project deleted successfully' }
      });

      await adminClient.deleteProject('abc123def456');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'http://localhost:5173/admin/projects/abc123def456',
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
    });

    it('should handle successful deletion with 204 status', async () => {
      mockedAxios.delete.mockResolvedValue({
        status: 204,
        data: null
      });

      await expect(adminClient.deleteProject('abc123def456')).resolves.not.toThrow();
    });

    it('should handle project not found errors', async () => {
      const axiosError = new Error('Not found');
      (axiosError as any).response = { status: 404 };
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.delete.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.deleteProject('nonexistent')).rejects.toThrow(
        'Project not found'
      );
    });

    it('should handle connection errors', async () => {
      const axiosError = new Error('Connection refused');
      (axiosError as any).code = 'ECONNREFUSED';
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.delete.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.deleteProject('abc123def456')).rejects.toThrow(
        'Connection refused. Make sure Supabase Lite is running at http://localhost:5173'
      );
    });

    it('should handle server errors', async () => {
      const axiosError = new Error('Internal server error');
      (axiosError as any).response = { status: 500 };
      (axiosError as any).isAxiosError = true;
      
      mockedAxios.delete.mockRejectedValue(axiosError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      await expect(adminClient.deleteProject('abc123def456')).rejects.toThrow(
        'Server error (500). The Supabase Lite instance may be experiencing issues'
      );
    });
  });

  describe('ping', () => {
    it('should return true when connection is successful', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { projects: [] }
      });

      const result = await adminClient.ping();

      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNREFUSED'
      });

      const result = await adminClient.ping();

      expect(result).toBe(false);
    });
  });

  describe('getConnectionInfo', () => {
    it('should return connection configuration', () => {
      const info = adminClient.getConnectionInfo();

      expect(info).toEqual({
        url: testUrl,
        projectId: undefined,
        baseUrl: testUrl
      });
    });

    it('should handle URLs with project IDs', () => {
      const clientWithProject = new AdminClient('http://localhost:5173/abc123');
      const info = clientWithProject.getConnectionInfo();

      expect(info).toEqual({
        url: 'http://localhost:5173/abc123',
        projectId: 'abc123',
        baseUrl: 'http://localhost:5173'
      });
    });
  });
});