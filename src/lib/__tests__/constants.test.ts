import { describe, it, expect } from 'vitest'
import {
  APP_NAME,
  APP_VERSION,
  DATABASE_CONFIG,
  NAVIGATION_ITEMS,
  QUERY_EXAMPLES,
} from '../constants'

describe('Constants', () => {
  describe('App Constants', () => {
    it('should have correct app name', () => {
      expect(APP_NAME).toBe('Supabase Lite')
    })

    it('should have correct app version', () => {
      expect(APP_VERSION).toBe('0.1.0')
    })
  })

  describe('Database Configuration', () => {
    it('should have correct database name', () => {
      expect(DATABASE_CONFIG.DEFAULT_DB_NAME).toBe('supabase_lite_db')
    })

    it('should have correct storage keys', () => {
      expect(DATABASE_CONFIG.STORAGE_KEY).toBe('supabase_lite_storage')
      expect(DATABASE_CONFIG.HISTORY_KEY).toBe('supabase_lite_query_history')
      expect(DATABASE_CONFIG.SAVED_QUERIES_KEY).toBe('supabase_lite_saved_queries')
    })

    it('should have all required configuration keys', () => {
      expect(DATABASE_CONFIG).toHaveProperty('DEFAULT_DB_NAME')
      expect(DATABASE_CONFIG).toHaveProperty('STORAGE_KEY')
      expect(DATABASE_CONFIG).toHaveProperty('HISTORY_KEY')
      expect(DATABASE_CONFIG).toHaveProperty('SAVED_QUERIES_KEY')
    })
  })

  describe('Navigation Items', () => {
    it('should have dashboard navigation item', () => {
      const dashboard = NAVIGATION_ITEMS.find(item => item.id === 'dashboard')
      expect(dashboard).toEqual({
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        path: '/',
      })
    })

    it('should have sql-editor navigation item', () => {
      const sqlEditor = NAVIGATION_ITEMS.find(item => item.id === 'sql-editor')
      expect(sqlEditor).toEqual({
        id: 'sql-editor',
        label: 'SQL Editor',
        icon: 'FileText',
        path: '/sql-editor',
      })
    })

    it('should have table-editor navigation item', () => {
      const tableEditor = NAVIGATION_ITEMS.find(item => item.id === 'table-editor')
      expect(tableEditor).toEqual({
        id: 'table-editor',
        label: 'Table Editor',
        icon: 'Table',
        path: '/table-editor',
      })
    })

    it('should have disabled auth navigation item', () => {
      const auth = NAVIGATION_ITEMS.find(item => item.id === 'auth')
      expect(auth).toEqual({
        id: 'auth',
        label: 'Authentication',
        icon: 'Shield',
        path: '/auth',
        disabled: true,
      })
    })

    it('should have disabled storage navigation item', () => {
      const storage = NAVIGATION_ITEMS.find(item => item.id === 'storage')
      expect(storage).toEqual({
        id: 'storage',
        label: 'Storage',
        icon: 'FolderOpen',
        path: '/storage',
        disabled: true,
      })
    })

    it('should have disabled realtime navigation item', () => {
      const realtime = NAVIGATION_ITEMS.find(item => item.id === 'realtime')
      expect(realtime).toEqual({
        id: 'realtime',
        label: 'Realtime',
        icon: 'Zap',
        path: '/realtime',
        disabled: true,
      })
    })

    it('should have disabled edge-functions navigation item', () => {
      const edgeFunctions = NAVIGATION_ITEMS.find(item => item.id === 'edge-functions')
      expect(edgeFunctions).toEqual({
        id: 'edge-functions',
        label: 'Edge Functions',
        icon: 'Code',
        path: '/edge-functions',
        disabled: true,
      })
    })

    it('should have disabled api navigation item', () => {
      const api = NAVIGATION_ITEMS.find(item => item.id === 'api')
      expect(api).toEqual({
        id: 'api',
        label: 'API Docs',
        icon: 'BookOpen',
        path: '/api',
        disabled: true,
      })
    })

    it('should have correct number of navigation items', () => {
      expect(NAVIGATION_ITEMS).toHaveLength(8)
    })

    it('should have unique IDs for all navigation items', () => {
      const ids = NAVIGATION_ITEMS.map(item => item.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have unique paths for all navigation items', () => {
      const paths = NAVIGATION_ITEMS.map(item => item.path)
      const uniquePaths = new Set(paths)
      expect(uniquePaths.size).toBe(paths.length)
    })

    it('should have enabled items without disabled property', () => {
      const dashboard = NAVIGATION_ITEMS.find(item => item.id === 'dashboard')
      const sqlEditor = NAVIGATION_ITEMS.find(item => item.id === 'sql-editor')
      
      expect(dashboard).not.toHaveProperty('disabled')
      expect(sqlEditor).not.toHaveProperty('disabled')
    })

    it('should have correct disabled items', () => {
      const disabledItems = NAVIGATION_ITEMS.filter(item => item.disabled === true)
      const expectedDisabledIds = ['auth', 'storage', 'realtime', 'edge-functions', 'api']
      
      expect(disabledItems).toHaveLength(5)
      expect(disabledItems.map(item => item.id)).toEqual(expectedDisabledIds)
    })
  })

  describe('Query Examples', () => {
    it('should have create table example', () => {
      const createTable = QUERY_EXAMPLES.find(example => example.name === 'Create Table')
      expect(createTable).toBeDefined()
      expect(createTable?.query).toContain('CREATE TABLE users')
      expect(createTable?.query).toContain('id SERIAL PRIMARY KEY')
      expect(createTable?.query).toContain('email VARCHAR(255) UNIQUE NOT NULL')
    })

    it('should have insert data example', () => {
      const insertData = QUERY_EXAMPLES.find(example => example.name === 'Insert Data')
      expect(insertData).toBeDefined()
      expect(insertData?.query).toContain('INSERT INTO users')
      expect(insertData?.query).toContain('john@example.com')
      expect(insertData?.query).toContain('jane@example.com')
    })

    it('should have select all example', () => {
      const selectAll = QUERY_EXAMPLES.find(example => example.name === 'Select All')
      expect(selectAll).toBeDefined()
      expect(selectAll?.query).toBe('SELECT * FROM users ORDER BY created_at DESC;')
    })

    it('should have join query example', () => {
      const joinQuery = QUERY_EXAMPLES.find(example => example.name === 'Join Query')
      expect(joinQuery).toBeDefined()
      expect(joinQuery?.query).toContain('LEFT JOIN posts p ON u.id = p.user_id')
    })

    it('should have correct number of query examples', () => {
      expect(QUERY_EXAMPLES).toHaveLength(4)
    })

    it('should have unique names for all query examples', () => {
      const names = QUERY_EXAMPLES.map(example => example.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should have valid SQL queries', () => {
      QUERY_EXAMPLES.forEach(example => {
        expect(example.query).toBeTruthy()
        expect(typeof example.query).toBe('string')
        expect(example.query.length).toBeGreaterThan(0)
      })
    })

    it('should have all required properties for each example', () => {
      QUERY_EXAMPLES.forEach(example => {
        expect(example).toHaveProperty('name')
        expect(example).toHaveProperty('query')
        expect(typeof example.name).toBe('string')
        expect(typeof example.query).toBe('string')
      })
    })
  })

  describe('Data Types and Structure', () => {
    it('should export constants as expected types', () => {
      expect(typeof APP_NAME).toBe('string')
      expect(typeof APP_VERSION).toBe('string')
      expect(typeof DATABASE_CONFIG).toBe('object')
      expect(Array.isArray(NAVIGATION_ITEMS)).toBe(true)
      expect(Array.isArray(QUERY_EXAMPLES)).toBe(true)
    })

    it('should have readonly constant values', () => {
      // Constants should be defined and not undefined
      expect(APP_NAME).toBeDefined()
      expect(APP_VERSION).toBeDefined()
      expect(DATABASE_CONFIG).toBeDefined()
      expect(NAVIGATION_ITEMS).toBeDefined()
      expect(QUERY_EXAMPLES).toBeDefined()
    })
  })
})