/**
 * PostgreSQL Installer for WebVM
 * 
 * This module handles the installation and configuration of PostgreSQL
 * within the WebVM Linux environment for feasibility testing.
 */

import { WebVMManager } from '../WebVMManager'
import { logger } from '../../infrastructure/Logger'

export interface PostgreSQLInstallConfig {
  version: string
  dataDir: string
  port: number
  maxConnections: number
  sharedBuffers: string
  effectiveCacheSize: string
  workMem: string
}

export interface InstallationResult {
  success: boolean
  version: string | null
  installTime: number
  memoryUsage: number
  diskUsage: number
  error?: string
  logs: string[]
}

export class PostgreSQLInstaller {
  private logger = logger
  private webvmManager = WebVMManager.getInstance()
  private installLogs: string[] = []

  /**
   * Default PostgreSQL configuration optimized for WebVM
   */
  private defaultConfig: PostgreSQLInstallConfig = {
    version: '15',
    dataDir: '/var/lib/postgresql/data',
    port: 5432,
    maxConnections: 50,
    sharedBuffers: '128MB',
    effectiveCacheSize: '256MB',
    workMem: '4MB'
  }

  /**
   * Install PostgreSQL in WebVM
   */
  async installPostgreSQL(config?: Partial<PostgreSQLInstallConfig>): Promise<InstallationResult> {
    const startTime = Date.now()
    const finalConfig = { ...this.defaultConfig, ...config }
    
    this.log('Starting PostgreSQL installation in WebVM...')
    this.log(`Target version: PostgreSQL ${finalConfig.version}`)

    try {
      // Step 1: Check WebVM readiness
      const webvmStatus = this.webvmManager.getStatus()
      if (webvmStatus.state !== 'running') {
        throw new Error('WebVM is not running. Please start WebVM first.')
      }

      // Step 2: Measure initial memory usage
      const initialMemory = await this.measureMemoryUsage()
      this.log(`Initial memory usage: ${this.formatBytes(initialMemory)}`)

      // Step 3: Install PostgreSQL via apt-get
      const installCommands = this.getInstallationCommands(finalConfig)
      for (const command of installCommands) {
        await this.executeWebVMCommand(command)
      }

      // Step 4: Configure PostgreSQL
      await this.configurePostgreSQL(finalConfig)

      // Step 5: Initialize database cluster
      await this.initializeDatabase(finalConfig)

      // Step 6: Start PostgreSQL service
      await this.startPostgreSQLService()

      // Step 7: Verify installation
      const version = await this.verifyInstallation()

      // Step 8: Measure final resource usage
      const finalMemory = await this.measureMemoryUsage()
      const diskUsage = await this.measureDiskUsage(finalConfig.dataDir)
      const memoryIncrease = finalMemory - initialMemory

      this.log(`Installation completed successfully!`)
      this.log(`PostgreSQL version: ${version}`)
      this.log(`Memory increase: ${this.formatBytes(memoryIncrease)}`)
      this.log(`Disk usage: ${this.formatBytes(diskUsage)}`)

      return {
        success: true,
        version,
        installTime: Date.now() - startTime,
        memoryUsage: memoryIncrease,
        diskUsage,
        logs: this.installLogs
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Installation failed: ${errorMessage}`)
      
      return {
        success: false,
        version: null,
        installTime: Date.now() - startTime,
        memoryUsage: 0,
        diskUsage: 0,
        error: errorMessage,
        logs: this.installLogs
      }
    }
  }

  /**
   * Get installation commands for PostgreSQL
   */
  private getInstallationCommands(config: PostgreSQLInstallConfig): string[] {
    return [
      // Update package list
      'apt-get update',
      
      // Install PostgreSQL and required packages
      `apt-get install -y postgresql-${config.version} postgresql-client-${config.version} postgresql-contrib-${config.version}`,
      
      // Install additional tools
      'apt-get install -y pgbouncer',
      
      // Create necessary directories
      `mkdir -p ${config.dataDir}`,
      `chown -R postgres:postgres ${config.dataDir}`
    ]
  }

  /**
   * Configure PostgreSQL with optimized settings for WebVM
   */
  private async configurePostgreSQL(config: PostgreSQLInstallConfig): Promise<void> {
    this.log('Configuring PostgreSQL...')

    const configContent = `
# PostgreSQL Configuration for WebVM
# Optimized for browser environment constraints

# Connection Settings
listen_addresses = 'localhost'
port = ${config.port}
max_connections = ${config.maxConnections}

# Memory Settings
shared_buffers = ${config.sharedBuffers}
effective_cache_size = ${config.effectiveCacheSize}
work_mem = ${config.workMem}
maintenance_work_mem = 64MB

# Write Ahead Log
wal_level = minimal
fsync = off  # Disable for better performance in WebVM (not for production!)
synchronous_commit = off
wal_buffers = 4MB
checkpoint_segments = 8

# Query Tuning
random_page_cost = 1.1
effective_io_concurrency = 0
default_statistics_target = 100

# Logging
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'all'
log_duration = on
log_line_prefix = '%m [%p] %q%u@%d '

# Autovacuum
autovacuum = on
autovacuum_naptime = 10min
`

    // Write configuration file
    await this.executeWebVMCommand(`cat > /etc/postgresql/${config.version}/main/postgresql.conf.d/webvm.conf << EOF
${configContent}
EOF`)
  }

  /**
   * Initialize PostgreSQL database cluster
   */
  private async initializeDatabase(config: PostgreSQLInstallConfig): Promise<void> {
    this.log('Initializing database cluster...')
    
    const initCommands = [
      // Stop any existing PostgreSQL service
      'systemctl stop postgresql',
      
      // Initialize the database cluster
      `su - postgres -c "initdb -D ${config.dataDir}"`,
      
      // Create Supabase-specific schemas
      `su - postgres -c "createdb supabase"`,
      
      // Set up initial user and permissions
      `su - postgres -c "psql -c \\"CREATE USER authenticator WITH PASSWORD 'password';\\""`,
      `su - postgres -c "psql -c \\"CREATE USER service_role WITH PASSWORD 'password';\\""`,
      `su - postgres -c "psql -c \\"CREATE USER anon WITH PASSWORD 'password';\\""`,
      
      // Grant necessary permissions
      `su - postgres -c "psql -c \\"GRANT ALL PRIVILEGES ON DATABASE supabase TO authenticator;\\""`,
    ]

    for (const command of initCommands) {
      await this.executeWebVMCommand(command)
    }
  }

  /**
   * Start PostgreSQL service
   */
  private async startPostgreSQLService(): Promise<void> {
    this.log('Starting PostgreSQL service...')
    
    await this.executeWebVMCommand('systemctl start postgresql')
    await this.executeWebVMCommand('systemctl enable postgresql')
    
    // Wait for service to be ready
    await this.waitForPostgreSQL()
  }

  /**
   * Wait for PostgreSQL to be ready
   */
  private async waitForPostgreSQL(maxRetries = 30): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.executeWebVMCommand('su - postgres -c "psql -c \\"SELECT 1;\\""')
        this.log('PostgreSQL is ready!')
        return
      } catch {
        this.log(`Waiting for PostgreSQL to start... (${i + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    throw new Error('PostgreSQL failed to start within timeout period')
  }

  /**
   * Verify PostgreSQL installation
   */
  private async verifyInstallation(): Promise<string> {
    this.log('Verifying PostgreSQL installation...')
    
    const versionCommand = 'su - postgres -c "psql -c \\"SELECT version();\\""'
    const result = await this.executeWebVMCommand(versionCommand)
    
    // Parse version from output
    const versionMatch = result.match(/PostgreSQL (\d+\.\d+)/)
    const version = versionMatch ? versionMatch[1] : 'unknown'
    
    // Test basic functionality
    const testCommands = [
      'su - postgres -c "psql -c \\"CREATE TABLE test (id serial PRIMARY KEY, name text);\\""',
      'su - postgres -c "psql -c \\"INSERT INTO test (name) VALUES (\'WebVM Test\');\\""',
      'su - postgres -c "psql -c \\"SELECT * FROM test;\\""',
      'su - postgres -c "psql -c \\"DROP TABLE test;\\""'
    ]

    for (const command of testCommands) {
      await this.executeWebVMCommand(command)
    }

    return version
  }

  /**
   * Execute command in WebVM
   */
  private async executeWebVMCommand(command: string): Promise<string> {
    // For now, simulate command execution
    // In real implementation, this would send commands to WebVM
    this.log(`Executing: ${command}`)
    
    // Simulate command execution delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Return simulated result
    return 'Command executed successfully'
  }

  /**
   * Measure current memory usage
   */
  private async measureMemoryUsage(): Promise<number> {
    // In real implementation, this would query WebVM for memory stats
    // For now, return simulated value
    return 256 * 1024 * 1024 // 256MB
  }

  /**
   * Measure disk usage of directory
   */
  private async measureDiskUsage(path: string): Promise<number> {
    // In real implementation, this would run du command in WebVM
    // For now, return simulated value
    return 512 * 1024 * 1024 // 512MB
  }

  /**
   * Log message
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message}`
    this.installLogs.push(logEntry)
    this.logger.info('PostgreSQL Installer', message)
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size > 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * Uninstall PostgreSQL from WebVM
   */
  async uninstallPostgreSQL(): Promise<void> {
    this.log('Uninstalling PostgreSQL...')
    
    const uninstallCommands = [
      'systemctl stop postgresql',
      'apt-get remove -y postgresql-* pgbouncer',
      'apt-get purge -y postgresql-* pgbouncer',
      'apt-get autoremove -y',
      'rm -rf /var/lib/postgresql',
      'rm -rf /etc/postgresql',
      'rm -rf /var/log/postgresql'
    ]

    for (const command of uninstallCommands) {
      await this.executeWebVMCommand(command)
    }

    this.log('PostgreSQL uninstalled successfully')
  }
}

// Export singleton instance for easy access
export const postgreSQLInstaller = new PostgreSQLInstaller()