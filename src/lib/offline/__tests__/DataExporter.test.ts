import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataExporter } from '../DataExporter'

// Mock project manager
const mockProjectManager = vi.hoisted(() => ({
  getActiveProject: vi.fn(),
  getAllProjects: vi.fn(),
  createProject: vi.fn(),
  switchToProject: vi.fn()
}))

vi.mock('@/lib/projects/ProjectManager', () => ({
  projectManager: mockProjectManager
}))

// Mock database manager
const mockDatabaseManager = vi.hoisted(() => ({
  getInstance: vi.fn(() => ({
    query: vi.fn(),
    getDatabase: vi.fn(),
    getTables: vi.fn(),
    getTableSchema: vi.fn()
  }))
}))

vi.mock('@/lib/database/connection', () => ({
  DatabaseManager: mockDatabaseManager
}))

describe('DataExporter', () => {
  let dataExporter: DataExporter
  let mockDatabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockDatabase = {
      query: vi.fn(),
      getDatabase: vi.fn(),
      getTables: vi.fn(),
      getTableSchema: vi.fn()
    }
    mockDatabaseManager.getInstance.mockReturnValue(mockDatabase)
    dataExporter = DataExporter.getInstance()
  })

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DataExporter.getInstance()
      const instance2 = DataExporter.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('Export Formats', () => {
    it('should return supported export formats', () => {
      const formats = dataExporter.getExportFormats()
      expect(formats).toContain('json')
      expect(formats).toContain('sql')
      expect(formats).toContain('csv')
      expect(formats).toHaveLength(3)
    })
  })

  describe('Single Project Export', () => {
    it('should export project in JSON format', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        database: 'test-db'
      }
      
      mockProjectManager.getActiveProject.mockReturnValue(mockProject)
      mockDatabase.getTables.mockResolvedValue([
        { name: 'users', schema: 'public' },
        { name: 'posts', schema: 'public' }
      ])
      
      mockDatabase.query.mockImplementation((sql: string) => {
        if (sql.includes('users')) {
          return Promise.resolve({ rows: [{ id: 1, name: 'John' }] })
        }
        if (sql.includes('posts')) {
          return Promise.resolve({ rows: [{ id: 1, title: 'Test Post' }] })
        }
        return Promise.resolve({ rows: [] })
      })

      const result = await dataExporter.exportProject('project-1', 'json')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('project')
      expect(result.data.project).toEqual(mockProject)
      expect(result.data).toHaveProperty('tables')
      expect(result.data.tables).toHaveProperty('users')
      expect(result.data.tables).toHaveProperty('posts')
      expect(result.size).toBeGreaterThan(0)
    })

    it('should export project in SQL format', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        database: 'test-db'
      }
      
      mockProjectManager.getActiveProject.mockReturnValue(mockProject)
      mockDatabase.getTables.mockResolvedValue([
        { name: 'users', schema: 'public' }
      ])
      
      mockDatabase.getTableSchema.mockResolvedValue({
        columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'name', type: 'varchar', nullable: true }
        ]
      })
      
      mockDatabase.query.mockResolvedValue({
        rows: [{ id: 1, name: 'John' }]
      })

      const result = await dataExporter.exportProject('project-1', 'sql')
      
      expect(result.success).toBe(true)
      expect(result.data).toContain('CREATE TABLE')
      expect(result.data).toContain('INSERT INTO')
      expect(result.data).toContain('users')
      expect(result.size).toBeGreaterThan(0)
    })

    it('should export project in CSV format', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        database: 'test-db'
      }
      
      mockProjectManager.getActiveProject.mockReturnValue(mockProject)
      mockDatabase.getTables.mockResolvedValue([
        { name: 'users', schema: 'public' }
      ])
      
      mockDatabase.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'John', email: 'john@example.com' },
          { id: 2, name: 'Jane', email: 'jane@example.com' }
        ]
      })

      const result = await dataExporter.exportProject('project-1', 'csv')
      
      expect(result.success).toBe(true)
      expect(result.data).toContain('id,name,email')
      expect(result.data).toContain('1,John,john@example.com')
      expect(result.data).toContain('2,Jane,jane@example.com')
      expect(result.size).toBeGreaterThan(0)
    })

    it('should handle export errors gracefully', async () => {
      mockProjectManager.getActiveProject.mockReturnValue(null)

      const result = await dataExporter.exportProject('nonexistent', 'json')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Project not found')
    })

    it('should handle database query errors', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        database: 'test-db'
      }
      
      mockProjectManager.getActiveProject.mockReturnValue(mockProject)
      mockDatabase.getTables.mockRejectedValue(new Error('Database connection failed'))

      const result = await dataExporter.exportProject('project-1', 'json')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Database connection failed')
    })
  })

  describe('Multiple Projects Export', () => {
    it('should export all projects', async () => {
      const mockProjects = [
        { id: 'project-1', name: 'Project A', database: 'db-a' },
        { id: 'project-2', name: 'Project B', database: 'db-b' }
      ]
      
      mockProjectManager.getAllProjects.mockReturnValue(mockProjects)
      mockDatabase.getTables.mockResolvedValue([])
      mockDatabase.query.mockResolvedValue({ rows: [] })

      const result = await dataExporter.exportAllProjects('json')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('projects')
      expect(result.data.projects).toHaveLength(2)
      expect(result.data.projects[0]).toHaveProperty('project')
      expect(result.data.projects[0].project.id).toBe('project-1')
      expect(result.data.projects[1].project.id).toBe('project-2')
    })

    it('should handle empty project list', async () => {
      mockProjectManager.getAllProjects.mockReturnValue([])

      const result = await dataExporter.exportAllProjects('json')
      
      expect(result.success).toBe(true)
      expect(result.data.projects).toHaveLength(0)
    })

    it('should continue export even if one project fails', async () => {
      const mockProjects = [
        { id: 'project-1', name: 'Project A', database: 'db-a' },
        { id: 'project-2', name: 'Project B', database: 'db-b' }
      ]
      
      mockProjectManager.getAllProjects.mockReturnValue(mockProjects)
      
      // First project succeeds, second fails
      mockDatabase.getTables.mockImplementation((projectId: string) => {
        if (projectId === 'project-1') return Promise.resolve([])
        throw new Error('Failed to get tables')
      })
      
      mockDatabase.query.mockResolvedValue({ rows: [] })

      const result = await dataExporter.exportAllProjects('json')
      
      expect(result.success).toBe(true)
      expect(result.data.projects).toHaveLength(1) // Only successful project
      expect(result.warnings).toContain('project-2')
    })
  })

  describe('Data Import', () => {
    it('should import project from valid JSON data', async () => {
      const importData = {
        project: { id: 'imported-1', name: 'Imported Project', database: 'imported-db' },
        tables: {
          users: [{ id: 1, name: 'John' }],
          posts: [{ id: 1, title: 'Test Post' }]
        }
      }
      
      mockProjectManager.createProject.mockResolvedValue('imported-1')
      mockDatabase.query.mockResolvedValue({ rows: [] })

      const result = await dataExporter.importProject(importData, 'json')
      
      expect(result.success).toBe(true)
      expect(result.projectId).toBe('imported-1')
      expect(mockProjectManager.createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Imported Project'
        })
      )
    })

    it('should import project from SQL data', async () => {
      const sqlData = `
        CREATE TABLE users (id INTEGER, name VARCHAR(255));
        INSERT INTO users (id, name) VALUES (1, 'John');
        INSERT INTO users (id, name) VALUES (2, 'Jane');
      `
      
      mockProjectManager.createProject.mockResolvedValue('imported-sql-1')
      mockDatabase.query.mockResolvedValue({ rows: [] })

      const result = await dataExporter.importProject(sqlData, 'sql')
      
      expect(result.success).toBe(true)
      expect(result.projectId).toBe('imported-sql-1')
      expect(mockDatabase.query).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'))
      expect(mockDatabase.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'))
    })

    it('should validate import data before importing', async () => {
      const invalidData = { invalid: 'structure' }

      const result = await dataExporter.importProject(invalidData, 'json')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid import data')
    })

    it('should handle import errors gracefully', async () => {
      const importData = {
        project: { id: 'imported-1', name: 'Imported Project', database: 'imported-db' },
        tables: { users: [{ id: 1, name: 'John' }] }
      }
      
      mockProjectManager.createProject.mockRejectedValue(new Error('Project creation failed'))

      const result = await dataExporter.importProject(importData, 'json')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Project creation failed')
    })
  })

  describe('Data Validation', () => {
    it('should validate JSON import data structure', async () => {
      const validData = {
        project: { id: 'test', name: 'Test', database: 'test-db' },
        tables: { users: [{ id: 1 }] }
      }
      
      const result = await dataExporter.validateImportData(validData, 'json')
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should identify validation errors in JSON data', async () => {
      const invalidData = { missing: 'project property' }
      
      const result = await dataExporter.validateImportData(invalidData, 'json')
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing project information')
    })

    it('should validate SQL import data syntax', async () => {
      const validSQL = 'CREATE TABLE test (id INTEGER); INSERT INTO test VALUES (1);'
      
      const result = await dataExporter.validateImportData(validSQL, 'sql')
      
      expect(result.valid).toBe(true)
    })

    it('should identify SQL syntax errors', async () => {
      const invalidSQL = 'CREATE TABEL test (id; -- Invalid SQL'
      
      const result = await dataExporter.validateImportData(invalidSQL, 'sql')
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should validate CSV data format', async () => {
      const validCSV = 'id,name\n1,John\n2,Jane'
      
      const result = await dataExporter.validateImportData(validCSV, 'csv')
      
      expect(result.valid).toBe(true)
    })

    it('should detect CSV formatting issues', async () => {
      const invalidCSV = 'id,name\n1,John,extra,column\n2' // Inconsistent columns
      
      const result = await dataExporter.validateImportData(invalidCSV, 'csv')
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Inconsistent column count')
    })
  })

  describe('File Size Calculation', () => {
    it('should calculate accurate file sizes', async () => {

      mockProjectManager.getActiveProject.mockReturnValue({
        id: 'test', name: 'Test', database: 'test-db'
      })
      mockDatabase.getTables.mockResolvedValue([])

      const result = await dataExporter.exportProject('test', 'json')
      
      expect(result.success).toBe(true)
      expect(result.size).toBeGreaterThan(0)
      expect(typeof result.size).toBe('number')
    })
  })

  describe('Format-specific Features', () => {
    it('should include metadata in JSON exports', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        database: 'test-db'
      }
      
      mockProjectManager.getActiveProject.mockReturnValue(mockProject)
      mockDatabase.getTables.mockResolvedValue([])

      const result = await dataExporter.exportProject('project-1', 'json')
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('metadata')
      expect(result.data.metadata).toHaveProperty('exportedAt')
      expect(result.data.metadata).toHaveProperty('version')
      expect(result.data.metadata).toHaveProperty('format')
    })

    it('should generate valid SQL with proper escaping', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        database: 'test-db'
      }
      
      mockProjectManager.getActiveProject.mockReturnValue(mockProject)
      mockDatabase.getTables.mockResolvedValue([
        { name: 'users', schema: 'public' }
      ])
      
      mockDatabase.getTableSchema.mockResolvedValue({
        columns: [
          { name: 'name', type: 'varchar', nullable: true }
        ]
      })
      
      mockDatabase.query.mockResolvedValue({
        rows: [{ name: "John's Data" }] // Contains single quote
      })

      const result = await dataExporter.exportProject('project-1', 'sql')
      
      expect(result.success).toBe(true)
      expect(result.data).toContain("'John''s Data'") // Properly escaped
    })

    it('should handle CSV special characters correctly', async () => {
      const mockProject = {
        id: 'project-1',
        name: 'Test Project',
        database: 'test-db'
      }
      
      mockProjectManager.getActiveProject.mockReturnValue(mockProject)
      mockDatabase.getTables.mockResolvedValue([
        { name: 'users', schema: 'public' }
      ])
      
      mockDatabase.query.mockResolvedValue({
        rows: [
          { name: 'John, Jr.', description: 'Line1\nLine2' } // Comma and newline
        ]
      })

      const result = await dataExporter.exportProject('project-1', 'csv')
      
      expect(result.success).toBe(true)
      expect(result.data).toContain('"John, Jr."') // Quoted due to comma
      expect(result.data).toContain('"Line1\nLine2"') // Quoted due to newline
    })
  })
})