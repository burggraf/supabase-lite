import { supabase } from '@/lib/supabase'

export interface QueryResult {
  rows: any[]
  rowCount: number
  command: string
  fields: Array<{ name: string; dataTypeID: number }>
}

export class DatabaseManager {
  private static instance: DatabaseManager
  private isInitialized = false

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager()
    }
    return DatabaseManager.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('🔄 Testing Supabase connection...')
      
      // Test connection by trying to fetch a simple query
      const { error } = await supabase
        .from('customers')
        .select('customer_id')
        .limit(1)

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Supabase connection test failed: ${error.message}`)
      }
      
      this.isInitialized = true
      console.log('✅ Supabase connection established')
      
    } catch (error) {
      console.error('❌ Failed to connect to Supabase:', error)
      throw error
    }
  }

  // This method should not be used - all queries should go through Supabase.js
  async query(_sql: string, _params: any[] = []): Promise<QueryResult> {
    throw new Error('Raw SQL queries are not allowed. Use Supabase client methods instead.')
  }

  // This method should not be used - all queries should go through Supabase.js
  async exec(_sql: string): Promise<void> {
    throw new Error('Raw SQL execution is not allowed. Use Supabase client methods instead.')
  }

  // This method should not be used - transactions should go through Supabase.js
  async transaction<T>(_fn: () => Promise<T>): Promise<T> {
    throw new Error('Transactions should be handled through Supabase client methods.')
  }

  isConnected(): boolean {
    return this.isInitialized
  }

  async close(): Promise<void> {
    // Nothing to close with Supabase.js
    this.isInitialized = false
  }

  // Database size is not relevant with Supabase
  async getDatabaseSize(): Promise<number> {
    console.warn('Database size is not available with Supabase')
    return 0
  }

  // Table listing should use Supabase introspection if needed
  async listTables(): Promise<string[]> {
    console.warn('Table listing should be done through Supabase client if needed')
    return []
  }
}