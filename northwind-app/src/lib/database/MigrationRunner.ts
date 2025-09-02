import { DatabaseManager } from '../../../src/lib/database/connection'

export interface MigrationInfo {
  name: string
  version: string
  appliedAt?: Date
  checksum?: string
}

export class MigrationRunner {
  private static instance: MigrationRunner
  private dbManager: DatabaseManager

  constructor() {
    this.dbManager = DatabaseManager.getInstance()
  }

  static getInstance(): MigrationRunner {
    if (!MigrationRunner.instance) {
      MigrationRunner.instance = new MigrationRunner()
    }
    return MigrationRunner.instance
  }

  /**
   * Initialize the migration tracking table
   */
  private async createMigrationTable(): Promise<void> {
    await this.dbManager.exec(`
      CREATE TABLE IF NOT EXISTS _northwind_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        version VARCHAR(50) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64)
      )
    `)
  }

  /**
   * Check if a migration has been applied
   */
  private async isMigrationApplied(name: string): Promise<boolean> {
    const result = await this.dbManager.query(
      'SELECT COUNT(*) as count FROM _northwind_migrations WHERE name = $1',
      [name]
    )
    return parseInt(result.rows[0].count) > 0
  }

  /**
   * Record a migration as applied
   */
  private async recordMigration(name: string, version: string, checksum?: string): Promise<void> {
    await this.dbManager.query(
      'INSERT INTO _northwind_migrations (name, version, checksum) VALUES ($1, $2, $3)',
      [name, version, checksum || null]
    )
  }

  /**
   * Check if Northwind tables exist
   */
  async isNorthwindInitialized(): Promise<boolean> {
    try {
      const result = await this.dbManager.query(`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('categories', 'customers', 'products', 'orders', 'suppliers')
      `)
      
      const tableCount = parseInt(result.rows[0].table_count)
      console.log(`Found ${tableCount} Northwind tables`)
      
      // Check if we have data in key tables
      if (tableCount >= 5) {
        const dataCheck = await this.dbManager.query('SELECT COUNT(*) as count FROM categories')
        const categoryCount = parseInt(dataCheck.rows[0].count)
        console.log(`Found ${categoryCount} categories`)
        return categoryCount > 0
      }
      
      return false
    } catch (error) {
      console.log('Northwind tables not found, initialization needed')
      return false
    }
  }

  /**
   * Load and execute the Northwind SQL script
   */
  async initializeNorthwindData(): Promise<void> {
    console.log('🚀 Initializing Northwind database...')
    
    await this.createMigrationTable()

    // Check if already initialized
    if (await this.isMigrationApplied('northwind_init')) {
      console.log('✅ Northwind database already initialized')
      return
    }

    try {
      // Fetch the Northwind SQL script
      const response = await fetch('/sql_scripts/northwind.sql')
      if (!response.ok) {
        throw new Error(`Failed to load Northwind script: ${response.status}`)
      }
      
      const sqlScript = await response.text()
      console.log(`📄 Loaded Northwind SQL script (${sqlScript.length} characters)`)

      // Execute the script in a transaction
      await this.dbManager.transaction(async () => {
        console.log('🔄 Executing Northwind initialization script...')
        await this.dbManager.exec(sqlScript)
        
        // Record the migration
        await this.recordMigration('northwind_init', '1.0.0', this.calculateChecksum(sqlScript))
        
        console.log('✅ Northwind database initialized successfully')
      })

      // Verify the initialization
      await this.verifyNorthwindData()

    } catch (error) {
      console.error('❌ Failed to initialize Northwind database:', error)
      throw new Error(`Northwind initialization failed: ${error.message}`)
    }
  }

  /**
   * Verify that Northwind data was loaded correctly
   */
  private async verifyNorthwindData(): Promise<void> {
    const checks = [
      { table: 'categories', expectedMin: 8 },
      { table: 'suppliers', expectedMin: 25 },
      { table: 'customers', expectedMin: 90 },
      { table: 'products', expectedMin: 75 },
      { table: 'orders', expectedMin: 800 },
      { table: 'order_details', expectedMin: 2000 },
    ]

    for (const check of checks) {
      try {
        const result = await this.dbManager.query(`SELECT COUNT(*) as count FROM ${check.table}`)
        const count = parseInt(result.rows[0].count)
        
        if (count < check.expectedMin) {
          console.warn(`⚠️  ${check.table}: Expected at least ${check.expectedMin} rows, got ${count}`)
        } else {
          console.log(`✅ ${check.table}: ${count} rows loaded`)
        }
      } catch (error) {
        console.error(`❌ Failed to verify ${check.table}:`, error)
      }
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<MigrationInfo[]> {
    await this.createMigrationTable()
    
    const result = await this.dbManager.query(`
      SELECT name, version, applied_at, checksum
      FROM _northwind_migrations 
      ORDER BY applied_at ASC
    `)

    return result.rows.map(row => ({
      name: row.name,
      version: row.version,
      appliedAt: row.applied_at,
      checksum: row.checksum,
    }))
  }

  /**
   * Reset the database (for development/testing)
   */
  async resetDatabase(): Promise<void> {
    console.log('🔄 Resetting Northwind database...')
    
    // Drop all Northwind tables in the correct order (respecting foreign keys)
    const dropTables = [
      'customer_customer_demo',
      'customer_demographics', 
      'employee_territories',
      'order_details',
      'orders',
      'customers',
      'products',
      'shippers',
      'suppliers',
      'territories',
      'us_states',
      'categories',
      'region',
      'employees',
      '_northwind_migrations'
    ]

    for (const table of dropTables) {
      try {
        await this.dbManager.exec(`DROP TABLE IF EXISTS ${table} CASCADE`)
      } catch (error) {
        // Ignore errors for tables that don't exist
        console.log(`Table ${table} not found (this is normal)`)
      }
    }

    console.log('✅ Database reset complete')
  }

  /**
   * Calculate a simple checksum for the SQL content
   */
  private calculateChecksum(content: string): string {
    // Simple hash function for tracking changes
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(16)
  }
}