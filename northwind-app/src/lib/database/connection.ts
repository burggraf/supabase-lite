import { PGlite } from '@electric-sql/pglite'

export interface QueryResult {
  rows: any[]
  rowCount: number
  command: string
  fields: Array<{ name: string; dataTypeID: number }>
}

export class DatabaseManager {
  private static instance: DatabaseManager
  private db: PGlite | null = null
  private isInitialized = false
  private initializationPromise: Promise<void> | null = null

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

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this._initialize()
    return this.initializationPromise
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing PGlite database...')
      
      this.db = new PGlite({
        dataDir: 'idb://northwind-business-db',
        extensions: {
          // Add any extensions needed
        }
      })

      // Test connection
      await this.db.query('SELECT 1')
      
      this.isInitialized = true
      console.log('✅ Database initialized successfully')
      
    } catch (error) {
      console.error('❌ Failed to initialize database:', error)
      throw error
    }
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const result = await this.db.query(sql, params)
      return {
        rows: result.rows,
        rowCount: result.affectedRows || result.rows.length,
        command: sql.trim().split(' ')[0].toUpperCase(),
        fields: result.fields || []
      }
    } catch (error) {
      console.error('Query error:', error)
      throw error
    }
  }

  async exec(sql: string): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      await this.db.exec(sql)
    } catch (error) {
      console.error('Exec error:', error)
      throw error
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return this.db.transaction(fn)
  }

  isConnected(): boolean {
    return this.isInitialized && this.db !== null
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
      this.isInitialized = false
      this.initializationPromise = null
    }
  }

  // Get database size
  async getDatabaseSize(): Promise<number> {
    if (!this.db) {
      return 0
    }

    try {
      const result = await this.query(`
        SELECT pg_database_size(current_database()) as size
      `)
      return parseInt(result.rows[0]?.size || '0')
    } catch (error) {
      console.warn('Could not get database size:', error)
      return 0
    }
  }

  // List tables
  async listTables(): Promise<string[]> {
    if (!this.db) {
      return []
    }

    try {
      const result = await this.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `)
      return result.rows.map(row => row.table_name)
    } catch (error) {
      console.warn('Could not list tables:', error)
      return []
    }
  }
}