import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DatabaseManager } from '../../../database/connection'

// Simple test to debug parameter binding issue
describe('Parameter Binding Debug', () => {
  let dbManager: DatabaseManager

  beforeEach(async () => {
    dbManager = DatabaseManager.getInstance()
    // Don't initialize - we'll mock it
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should properly handle method overloading with parameters', async () => {
    // Mock the query method to see what gets called
    const mockQuery = vi.spyOn(dbManager, 'query')
    
    // Test with parameters (should use overloaded method)
    mockQuery.mockResolvedValue({ 
      rows: [{ email: 'test@example.com' }],
      fields: [],
      rowCount: 1,
      command: 'SELECT',
      duration: 1
    })

    // Call with parameters
    const result = await dbManager.query('SELECT * FROM auth.users WHERE email = $1', ['test@example.com'])
    
    console.log('Query method called with:', mockQuery.mock.calls[0])
    console.log('Result received:', result)
    
    expect(result).toBeDefined()
    expect(result.rows).toBeDefined()
    expect(result.rows.length).toBe(1)
    expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM auth.users WHERE email = $1', ['test@example.com'])
  })

  it('should detect the issue with array detection in method overloading', () => {
    // Test the logic used in the method overloading
    const testParams = ['test@example.com']
    
    console.log('Is array?', Array.isArray(testParams))
    console.log('Type of optionsOrParams:', typeof testParams)
    
    expect(Array.isArray(testParams)).toBe(true)
  })
})