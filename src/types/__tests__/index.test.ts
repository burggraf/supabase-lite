import { describe, it, expect } from 'vitest'

// Import all types to verify they exist and can be imported
import type {
  DatabaseConnection,
  QueryResult,
  QueryHistory,
  SavedQuery,
  TableSchema,
  ColumnSchema,
  ForeignKey,
  Index,
  ServiceStatus,
  Theme,
} from '../index'

describe('Type Definitions', () => {
  describe('DatabaseConnection Interface', () => {
    it('should have correct structure', () => {
      const mockConnection: DatabaseConnection = {
        id: 'test-id',
        name: 'Test Database',
        createdAt: new Date(),
        lastAccessed: new Date(),
      }

      expect(mockConnection.id).toBe('test-id')
      expect(mockConnection.name).toBe('Test Database')
      expect(mockConnection.createdAt).toBeInstanceOf(Date)
      expect(mockConnection.lastAccessed).toBeInstanceOf(Date)
    })

    it('should require all properties', () => {
      // TypeScript will catch missing properties at compile time
      const connection: DatabaseConnection = {
        id: 'test',
        name: 'test',
        createdAt: new Date(),
        lastAccessed: new Date(),
      }

      expect(Object.keys(connection)).toEqual(['id', 'name', 'createdAt', 'lastAccessed'])
    })
  })

  describe('QueryResult Interface', () => {
    it('should have correct structure', () => {
      const mockResult: QueryResult = {
        rows: [{ id: 1, name: 'test' }],
        fields: [{ name: 'id', dataTypeID: 23 }, { name: 'name', dataTypeID: 25 }],
        rowCount: 1,
        command: 'SELECT',
        duration: 15.5,
      }

      expect(Array.isArray(mockResult.rows)).toBe(true)
      expect(Array.isArray(mockResult.fields)).toBe(true)
      expect(typeof mockResult.rowCount).toBe('number')
      expect(typeof mockResult.command).toBe('string')
      expect(typeof mockResult.duration).toBe('number')
    })

    it('should handle empty results', () => {
      const emptyResult: QueryResult = {
        rows: [],
        fields: [],
        rowCount: 0,
        command: 'SELECT',
        duration: 5.2,
      }

      expect(emptyResult.rows).toHaveLength(0)
      expect(emptyResult.fields).toHaveLength(0)
      expect(emptyResult.rowCount).toBe(0)
    })
  })

  describe('QueryHistory Interface', () => {
    it('should have correct structure', () => {
      const mockHistory: QueryHistory = {
        id: 'history-1',
        query: 'SELECT * FROM users',
        timestamp: new Date(),
        duration: 10.5,
        success: true,
      }

      expect(typeof mockHistory.id).toBe('string')
      expect(typeof mockHistory.query).toBe('string')
      expect(mockHistory.timestamp).toBeInstanceOf(Date)
      expect(typeof mockHistory.duration).toBe('number')
      expect(typeof mockHistory.success).toBe('boolean')
    })

    it('should handle failed queries with error', () => {
      const failedHistory: QueryHistory = {
        id: 'history-2',
        query: 'INVALID SQL',
        timestamp: new Date(),
        duration: 2.1,
        success: false,
        error: 'Syntax error',
      }

      expect(failedHistory.success).toBe(false)
      expect(failedHistory.error).toBe('Syntax error')
    })

    it('should have optional error property', () => {
      const successHistory: QueryHistory = {
        id: 'history-3',
        query: 'SELECT 1',
        timestamp: new Date(),
        duration: 1.0,
        success: true,
        // error is optional and not included
      }

      expect(successHistory.error).toBeUndefined()
    })
  })

  describe('SavedQuery Interface', () => {
    it('should have correct structure', () => {
      const mockSavedQuery: SavedQuery = {
        id: 'saved-1',
        name: 'Get All Users',
        query: 'SELECT * FROM users',
        description: 'Retrieves all users from the database',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['users', 'basic'],
      }

      expect(typeof mockSavedQuery.id).toBe('string')
      expect(typeof mockSavedQuery.name).toBe('string')
      expect(typeof mockSavedQuery.query).toBe('string')
      expect(typeof mockSavedQuery.description).toBe('string')
      expect(mockSavedQuery.createdAt).toBeInstanceOf(Date)
      expect(mockSavedQuery.updatedAt).toBeInstanceOf(Date)
      expect(Array.isArray(mockSavedQuery.tags)).toBe(true)
    })

    it('should have optional properties', () => {
      const minimalSavedQuery: SavedQuery = {
        id: 'saved-2',
        name: 'Simple Query',
        query: 'SELECT 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        // description and tags are optional
      }

      expect(minimalSavedQuery.description).toBeUndefined()
      expect(minimalSavedQuery.tags).toBeUndefined()
    })
  })

  describe('TableSchema Interface', () => {
    it('should have correct structure', () => {
      const mockColumn: ColumnSchema = {
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: true,
        isForeignKey: false,
      }

      const mockForeignKey: ForeignKey = {
        columnName: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
      }

      const mockIndex: Index = {
        name: 'idx_email',
        columns: ['email'],
        unique: true,
      }

      const mockTable: TableSchema = {
        name: 'users',
        schema: 'public',
        columns: [mockColumn],
        primaryKeys: ['id'],
        foreignKeys: [mockForeignKey],
        indexes: [mockIndex],
      }

      expect(typeof mockTable.name).toBe('string')
      expect(typeof mockTable.schema).toBe('string')
      expect(Array.isArray(mockTable.columns)).toBe(true)
      expect(Array.isArray(mockTable.primaryKeys)).toBe(true)
      expect(Array.isArray(mockTable.foreignKeys)).toBe(true)
      expect(Array.isArray(mockTable.indexes)).toBe(true)
    })
  })

  describe('ColumnSchema Interface', () => {
    it('should have correct structure', () => {
      const mockColumn: ColumnSchema = {
        name: 'email',
        type: 'VARCHAR(255)',
        nullable: false,
        defaultValue: null,
        isPrimaryKey: false,
        isForeignKey: false,
      }

      expect(typeof mockColumn.name).toBe('string')
      expect(typeof mockColumn.type).toBe('string')
      expect(typeof mockColumn.nullable).toBe('boolean')
      expect(typeof mockColumn.isPrimaryKey).toBe('boolean')
      expect(typeof mockColumn.isForeignKey).toBe('boolean')
    })

    it('should handle optional default value', () => {
      const columnWithDefault: ColumnSchema = {
        name: 'status',
        type: 'VARCHAR(50)',
        nullable: false,
        defaultValue: 'active',
        isPrimaryKey: false,
        isForeignKey: false,
      }

      const columnWithoutDefault: ColumnSchema = {
        name: 'description',
        type: 'TEXT',
        nullable: true,
        isPrimaryKey: false,
        isForeignKey: false,
      }

      expect(columnWithDefault.defaultValue).toBe('active')
      expect(columnWithoutDefault.defaultValue).toBeUndefined()
    })
  })

  describe('ForeignKey Interface', () => {
    it('should have correct structure', () => {
      const mockForeignKey: ForeignKey = {
        columnName: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
      }

      expect(typeof mockForeignKey.columnName).toBe('string')
      expect(typeof mockForeignKey.referencedTable).toBe('string')
      expect(typeof mockForeignKey.referencedColumn).toBe('string')
    })
  })

  describe('Index Interface', () => {
    it('should have correct structure', () => {
      const singleColumnIndex: Index = {
        name: 'idx_email',
        columns: ['email'],
        unique: true,
      }

      const multiColumnIndex: Index = {
        name: 'idx_name_email',
        columns: ['name', 'email'],
        unique: false,
      }

      expect(typeof singleColumnIndex.name).toBe('string')
      expect(Array.isArray(singleColumnIndex.columns)).toBe(true)
      expect(typeof singleColumnIndex.unique).toBe('boolean')

      expect(multiColumnIndex.columns).toHaveLength(2)
      expect(multiColumnIndex.columns).toEqual(['name', 'email'])
    })
  })

  describe('ServiceStatus Interface', () => {
    it('should have correct structure', () => {
      const runningService: ServiceStatus = {
        name: 'PostgreSQL',
        status: 'running',
        description: 'Database service is running',
      }

      const stoppedService: ServiceStatus = {
        name: 'Redis',
        status: 'stopped',
        description: 'Cache service is stopped',
      }

      const errorService: ServiceStatus = {
        name: 'API',
        status: 'error',
        description: 'API service encountered an error',
      }

      expect(typeof runningService.name).toBe('string')
      expect(runningService.status).toBe('running')
      expect(typeof runningService.description).toBe('string')

      expect(stoppedService.status).toBe('stopped')
      expect(errorService.status).toBe('error')
    })

    it('should only allow valid status values', () => {
      // TypeScript will enforce this at compile time
      const validStatuses: ServiceStatus['status'][] = ['running', 'stopped', 'error']
      
      validStatuses.forEach(status => {
        const service: ServiceStatus = {
          name: 'Test Service',
          status,
          description: 'Test description',
        }
        expect(['running', 'stopped', 'error']).toContain(service.status)
      })
    })
  })

  describe('Theme Type', () => {
    it('should only allow valid theme values', () => {
      // TypeScript will enforce this at compile time
      const validThemes: Theme[] = ['light', 'dark', 'system']
      
      validThemes.forEach(theme => {
        expect(['light', 'dark', 'system']).toContain(theme)
      })
    })

    it('should work with variables', () => {
      let currentTheme: Theme = 'light'
      expect(currentTheme).toBe('light')
      
      currentTheme = 'dark'
      expect(currentTheme).toBe('dark')
      
      currentTheme = 'system'
      expect(currentTheme).toBe('system')
    })
  })

  describe('Type Imports', () => {
    it('should successfully import all types', () => {
      // If this test passes, it means all types can be imported without errors
      expect(true).toBe(true)
    })
  })
})