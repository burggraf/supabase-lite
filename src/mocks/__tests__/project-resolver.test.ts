import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { 
  resolveAndSwitchToProject,
  normalizeApiPath,
  hasProjectInPath,
  getProjectCacheMetrics
} from '../project-resolver'
import { DatabaseManager } from '../../lib/database/connection'
import { projectManager } from '../../lib/projects/ProjectManager'
import * as Logger from '../../lib/infrastructure/Logger'

// Mock the dependencies
vi.mock('../../lib/database/connection', () => ({
  DatabaseManager: {
    getInstance: vi.fn()
  }
}))

vi.mock('../../lib/projects/ProjectManager', () => ({
  projectManager: {
    getActiveProject: vi.fn(),
    getProjects: vi.fn()
  }
}))

vi.mock('../../lib/infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}))

describe('project-resolver', () => {
  let mockDbManager: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock database manager
    mockDbManager = {
      isConnected: vi.fn(),
      getConnectionInfo: vi.fn(),
      switchDatabase: vi.fn()
    }
    
    vi.mocked(DatabaseManager.getInstance).mockReturnValue(mockDbManager)
    
    // Clear cache before each test
    const cache = (global as any).__projectResolutionCache
    if (cache) {
      cache.clear()
    }
  })

  afterEach(() => {
    // Clean up any global state
    const cache = (global as any).__projectResolutionCache
    if (cache) {
      cache.clear()
    }
  })

  describe('resolveAndSwitchToProject', () => {
    it('should use active project for direct API calls', async () => {
      const mockProject = {
        id: 'active-project-id',
        name: 'Active Project',
        databasePath: 'path/to/active'
      }
      
      vi.mocked(projectManager.getActiveProject).mockReturnValue(mockProject)
      mockDbManager.isConnected.mockReturnValue(true)
      mockDbManager.getConnectionInfo.mockReturnValue({ id: 'path/to/active' })

      const url = new URL('http://localhost:5173/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result).toEqual({
        success: true,
        projectId: 'active-project-id',
        projectName: 'Active Project'
      })

      expect(projectManager.getActiveProject).toHaveBeenCalled()
      expect(mockDbManager.switchDatabase).not.toHaveBeenCalled()
    })

    it('should switch database if not connected to active project', async () => {
      const mockProject = {
        id: 'active-project-id',
        name: 'Active Project',
        databasePath: 'path/to/active'
      }
      
      vi.mocked(projectManager.getActiveProject).mockReturnValue(mockProject)
      mockDbManager.isConnected.mockReturnValue(true)
      mockDbManager.getConnectionInfo.mockReturnValue({ id: 'different/path' })
      mockDbManager.switchDatabase.mockResolvedValue(undefined)

      const url = new URL('http://localhost:5173/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result.success).toBe(true)
      expect(mockDbManager.switchDatabase).toHaveBeenCalledWith('path/to/active')
      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Switching to active project database',
        expect.objectContaining({
          projectId: 'active-project-id',
          databasePath: 'path/to/active'
        })
      )
    })

    it('should handle no active project for direct API calls', async () => {
      vi.mocked(projectManager.getActiveProject).mockReturnValue(null)

      const url = new URL('http://localhost:5173/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result).toEqual({
        success: false,
        error: 'No active project found and no project specified in URL'
      })
    })

    it('should resolve project by ID from URL path', async () => {
      const mockProjects = [
        { id: 'project-123', name: 'Test Project', databasePath: 'path/to/project' }
      ]
      
      vi.mocked(projectManager.getProjects).mockReturnValue(mockProjects)
      mockDbManager.isConnected.mockReturnValue(false)
      mockDbManager.switchDatabase.mockResolvedValue(undefined)

      const url = new URL('http://localhost:5173/project-123/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result).toEqual({
        success: true,
        projectId: 'project-123',
        projectName: 'Test Project'
      })

      expect(mockDbManager.switchDatabase).toHaveBeenCalledWith('path/to/project')
      expect(Logger.logger.info).toHaveBeenCalledWith(
        'Switching to project database for API request',
        expect.objectContaining({
          projectId: 'project-123',
          projectName: 'Test Project',
          projectIdentifier: 'project-123'
        })
      )
    })

    it('should resolve project by name from URL path', async () => {
      const mockProjects = [
        { id: 'project-123', name: 'My Project', databasePath: 'path/to/project' }
      ]
      
      vi.mocked(projectManager.getProjects).mockReturnValue(mockProjects)
      mockDbManager.isConnected.mockReturnValue(false)
      mockDbManager.switchDatabase.mockResolvedValue(undefined)

      const url = new URL('http://localhost:5173/my-project/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result).toEqual({
        success: true,
        projectId: 'project-123',
        projectName: 'My Project'
      })

      expect(mockDbManager.switchDatabase).toHaveBeenCalledWith('path/to/project')
    })

    it('should handle case-insensitive project name matching', async () => {
      const mockProjects = [
        { id: 'project-123', name: 'My Project', databasePath: 'path/to/project' }
      ]
      
      vi.mocked(projectManager.getProjects).mockReturnValue(mockProjects)
      mockDbManager.switchDatabase.mockResolvedValue(undefined)

      const url = new URL('http://localhost:5173/MY-PROJECT/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result.success).toBe(true)
      expect(result.projectId).toBe('project-123')
    })

    it('should return error if project not found', async () => {
      vi.mocked(projectManager.getProjects).mockReturnValue([])

      const url = new URL('http://localhost:5173/nonexistent-project/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result).toEqual({
        success: false,
        error: 'Project not found: nonexistent-project'
      })
    })

    it('should skip database switch if already connected to target project', async () => {
      const mockProjects = [
        { id: 'project-123', name: 'Test Project', databasePath: 'path/to/project' }
      ]
      
      vi.mocked(projectManager.getProjects).mockReturnValue(mockProjects)
      mockDbManager.isConnected.mockReturnValue(true)
      mockDbManager.getConnectionInfo.mockReturnValue({ id: 'path/to/project' })

      const url = new URL('http://localhost:5173/project-123/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result.success).toBe(true)
      expect(mockDbManager.switchDatabase).not.toHaveBeenCalled()
      expect(Logger.logger.debug).toHaveBeenCalledWith(
        'Skipping database switch - already connected to target project',
        expect.objectContaining({
          projectId: 'project-123',
          currentConnection: 'path/to/project'
        })
      )
    })

    it('should handle database switch errors', async () => {
      const mockProjects = [
        { id: 'project-123', name: 'Test Project', databasePath: 'path/to/project' }
      ]
      
      vi.mocked(projectManager.getProjects).mockReturnValue(mockProjects)
      mockDbManager.isConnected.mockReturnValue(false)
      mockDbManager.switchDatabase.mockRejectedValue(new Error('Switch failed'))

      const url = new URL('http://localhost:5173/project-123/rest/v1/users')
      const result = await resolveAndSwitchToProject(url)

      expect(result).toEqual({
        success: false,
        error: 'Failed to switch to project database: Switch failed'
      })

      expect(Logger.logger.error).toHaveBeenCalledWith(
        'Failed to resolve and switch to project',
        expect.any(Error),
        { url: '/project-123/rest/v1/users' }
      )
    })

    it('should handle direct API paths correctly', async () => {
      const directPaths = [
        'http://localhost:5173/',
        'http://localhost:5173/rest/v1/users',
        'http://localhost:5173/auth/v1/signup',
        'http://localhost:5173/storage/v1/buckets',
        'http://localhost:5173/app/test',
        'http://localhost:5173/debug/sql'
      ]

      const mockProject = {
        id: 'active-id',
        name: 'Active',
        databasePath: 'active/path'
      }

      vi.mocked(projectManager.getActiveProject).mockReturnValue(mockProject)
      mockDbManager.isConnected.mockReturnValue(true)
      mockDbManager.getConnectionInfo.mockReturnValue({ id: 'active/path' })

      for (const path of directPaths) {
        const url = new URL(path)
        const result = await resolveAndSwitchToProject(url)
        expect(result.success).toBe(true)
        expect(result.projectId).toBe('active-id')
      }
    })
  })

  describe('normalizeApiPath', () => {
    it('should remove project identifier from path', () => {
      const testCases = [
        {
          input: 'http://localhost:5173/project-123/rest/v1/users',
          expected: 'http://localhost:5173/rest/v1/users'
        },
        {
          input: 'http://localhost:5173/my-project/auth/v1/signup',
          expected: 'http://localhost:5173/auth/v1/signup'
        },
        {
          input: 'http://localhost:5173/test-project/storage/v1/objects',
          expected: 'http://localhost:5173/storage/v1/objects'
        }
      ]

      testCases.forEach(({ input, expected }) => {
        const inputUrl = new URL(input)
        const result = normalizeApiPath(inputUrl)
        expect(result.href).toBe(expected)
      })
    })

    it('should return unchanged URLs for direct API paths', () => {
      const directPaths = [
        'http://localhost:5173/',
        'http://localhost:5173/rest/v1/users',
        'http://localhost:5173/auth/v1/signup',
        'http://localhost:5173/storage/v1/buckets',
        'http://localhost:5173/app/test'
      ]

      directPaths.forEach(path => {
        const url = new URL(path)
        const result = normalizeApiPath(url)
        expect(result.href).toBe(path)
      })
    })

    it('should handle URLs with query parameters', () => {
      const url = new URL('http://localhost:5173/project-123/rest/v1/users?limit=10&offset=0')
      const result = normalizeApiPath(url)
      expect(result.href).toBe('http://localhost:5173/rest/v1/users?limit=10&offset=0')
    })

    it('should handle URLs with hash fragments', () => {
      const url = new URL('http://localhost:5173/project-123/rest/v1/users#section')
      const result = normalizeApiPath(url)
      expect(result.href).toBe('http://localhost:5173/rest/v1/users#section')
    })

    it('should handle empty project path segments', () => {
      const url = new URL('http://localhost:5173//')
      const result = normalizeApiPath(url)
      expect(result.href).toBe('http://localhost:5173//')
    })
  })

  describe('hasProjectInPath', () => {
    it('should return false for direct API paths', () => {
      const directPaths = [
        'http://localhost:5173/',
        'http://localhost:5173/rest/v1/users',
        'http://localhost:5173/auth/v1/signup',
        'http://localhost:5173/storage/v1/buckets',
        'http://localhost:5173/app/test'
      ]

      directPaths.forEach(path => {
        const url = new URL(path)
        expect(hasProjectInPath(url)).toBe(false)
      })
    })

    it('should return true for URLs with valid project identifiers', () => {
      const mockProjects = [
        { id: 'project-123', name: 'Test Project', databasePath: 'path1' },
        { id: 'another-id', name: 'My Project', databasePath: 'path2' }
      ]

      vi.mocked(projectManager.getProjects).mockReturnValue(mockProjects)

      const pathsWithProjects = [
        'http://localhost:5173/project-123/rest/v1/users',
        'http://localhost:5173/another-id/auth/v1/signup',
        'http://localhost:5173/test-project/storage/v1/objects',
        'http://localhost:5173/my-project/app/test'
      ]

      pathsWithProjects.forEach(path => {
        const url = new URL(path)
        expect(hasProjectInPath(url)).toBe(true)
      })
    })

    it('should return false for URLs with non-existent project identifiers', () => {
      vi.mocked(projectManager.getProjects).mockReturnValue([])

      const url = new URL('http://localhost:5173/nonexistent-project/rest/v1/users')
      expect(hasProjectInPath(url)).toBe(false)
    })

    it('should handle case-insensitive project name matching', () => {
      const mockProjects = [
        { id: 'project-123', name: 'My Project', databasePath: 'path' }
      ]

      vi.mocked(projectManager.getProjects).mockReturnValue(mockProjects)

      const url = new URL('http://localhost:5173/MY-PROJECT/rest/v1/users')
      expect(hasProjectInPath(url)).toBe(true)
    })

    it('should return false for empty path segments', () => {
      const urls = [
        'http://localhost:5173//',
        'http://localhost:5173//rest/v1/users'
      ]

      urls.forEach(path => {
        const url = new URL(path)
        expect(hasProjectInPath(url)).toBe(false)
      })
    })
  })

  describe('getProjectCacheMetrics', () => {
    it('should return cache metrics with hit rate', () => {
      const metrics = getProjectCacheMetrics()
      
      expect(metrics).toHaveProperty('hits')
      expect(metrics).toHaveProperty('misses')
      expect(metrics).toHaveProperty('totalRequests')
      expect(metrics).toHaveProperty('hitRate')
      expect(typeof metrics.hits).toBe('number')
      expect(typeof metrics.misses).toBe('number')
      expect(typeof metrics.totalRequests).toBe('number')
      expect(typeof metrics.hitRate).toBe('string')
      expect(metrics.hitRate).toMatch(/%$/)
    })

    it('should calculate hit rate correctly', () => {
      // This test would require accessing internal cache state
      // For now, we just verify the structure is correct
      const metrics = getProjectCacheMetrics()
      
      if (metrics.totalRequests === 0) {
        expect(metrics.hitRate).toBe('0%')
      } else {
        const expectedRate = ((metrics.hits / metrics.totalRequests) * 100).toFixed(1) + '%'
        expect(metrics.hitRate).toBe(expectedRate)
      }
    })
  })
})