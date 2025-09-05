/**
 * Data Exporter for Offline Data Transfer
 * Handles project export/import in multiple formats (JSON, SQL, CSV)
 */

import { DatabaseManager } from '../database/connection'
import { projectManager } from '../projects/ProjectManager'

export interface ExportResult {
  success: boolean
  data?: any
  size?: number
  error?: string
  warnings?: string[]
}

export interface ImportResult {
  success: boolean
  projectId?: string
  error?: string
  warnings?: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

export type ExportFormat = 'json' | 'sql' | 'csv'

interface ProjectMetadata {
  exportedAt: string
  version: string
  format: ExportFormat
  source: string
}

export class DataExporter {
  private static instance: DataExporter
  private dbManager: DatabaseManager

  private constructor() {
    this.dbManager = DatabaseManager.getInstance()
  }

  static getInstance(): DataExporter {
    if (!DataExporter.instance) {
      DataExporter.instance = new DataExporter()
    }
    return DataExporter.instance
  }

  getExportFormats(): ExportFormat[] {
    return ['json', 'sql', 'csv']
  }

  async exportProject(projectId?: string, format: ExportFormat = 'json'): Promise<ExportResult> {
    try {
      const project = projectId 
        ? projectManager.getProjects().find((p: any) => p.id === projectId)
        : projectManager.getActiveProject()

      if (!project) {
        return { success: false, error: 'Project not found' }
      }

      const tables = await this.dbManager.getTableList()
      const tableData: Record<string, any[]> = {}

      // Export table data
      for (const table of tables) {
        try {
          const result = await this.dbManager.query(`SELECT * FROM ${table.name}`)
          tableData[table.name] = result.rows
        } catch (error: unknown) {
          const err = error as Error
          console.warn(`Failed to export table ${table.name}:`, err)
        }
      }

      return this.formatExportData(project, tableData, format)

    } catch (error) {
      return { 
        success: false, 
        error: (error as Error).message 
      }
    }
  }

  async exportAllProjects(format: ExportFormat = 'json'): Promise<ExportResult> {
    try {
      const allProjects = projectManager.getProjects()
      
      if (allProjects.length === 0) {
        return {
          success: true,
          data: { projects: [] },
          size: this.calculateSize(JSON.stringify({ projects: [] }))
        }
      }

      const exportedProjects = []
      const warnings = []

      for (const project of allProjects) {
        try {
          const projectExport = await this.exportProject(project.id, format)
          if (projectExport.success) {
            exportedProjects.push(projectExport.data)
          } else {
            warnings.push(`Failed to export ${project.id}: ${projectExport.error}`)
          }
        } catch (error) {
          warnings.push(`Failed to export ${project.id}: ${(error as Error).message}`)
        }
      }

      const result = { projects: exportedProjects }
      
      return {
        success: true,
        data: result,
        size: this.calculateSize(JSON.stringify(result)),
        warnings: warnings.length > 0 ? warnings : undefined
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async importProject(importData: any, format: ExportFormat): Promise<ImportResult> {
    try {
      // Validate data first
      const validation = await this.validateImportData(importData, format)
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid import data: ${validation.errors.join(', ')}`
        }
      }

      switch (format) {
        case 'json':
          return this.importFromJSON(importData)
        case 'sql':
          return this.importFromSQL(importData)
        case 'csv':
          return this.importFromCSV(importData)
        default:
          return { success: false, error: `Unsupported format: ${format}` }
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  async validateImportData(data: any, format: ExportFormat): Promise<ValidationResult> {
    const errors: string[] = []

    try {
      switch (format) {
        case 'json':
          if (!data || typeof data !== 'object') {
            errors.push('Invalid JSON structure')
          } else if (!data.project) {
            errors.push('Missing project information')
          } else if (!data.tables) {
            errors.push('Missing table data')
          }
          break

        case 'sql':
          if (typeof data !== 'string') {
            errors.push('SQL data must be a string')
          } else if (!data.includes('CREATE TABLE') && !data.includes('INSERT INTO')) {
            errors.push('No valid SQL statements found')
          }
          // Basic SQL syntax validation
          if (data.includes('CREATE TABEL')) { // Common typo
            errors.push('SQL syntax error detected')
          }
          break

        case 'csv':
          if (typeof data !== 'string') {
            errors.push('CSV data must be a string')
          } else {
            const lines = data.split('\n').filter(line => line.trim())
            if (lines.length < 2) {
              errors.push('CSV must have at least header and one data row')
            } else {
              // Check column consistency
              const headerCols = lines[0].split(',').length
              for (let i = 1; i < lines.length; i++) {
                const rowCols = lines[i].split(',').length
                if (rowCols !== headerCols) {
                  errors.push('Inconsistent column count')
                  break
                }
              }
            }
          }
          break
      }
    } catch (error) {
      errors.push(`Validation error: ${(error as Error).message}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private formatExportData(project: any, tableData: Record<string, any[]>, format: ExportFormat): ExportResult {
    const metadata: ProjectMetadata = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      format,
      source: 'Supabase Lite'
    }

    switch (format) {
      case 'json':
        const jsonData = {
          project,
          tables: tableData,
          metadata
        }
        return {
          success: true,
          data: jsonData,
          size: this.calculateSize(JSON.stringify(jsonData))
        }

      case 'sql':
        let sqlContent = `-- Exported from Supabase Lite\n-- ${metadata.exportedAt}\n\n`
        
        // Generate CREATE TABLE and INSERT statements
        for (const [tableName, rows] of Object.entries(tableData)) {
          if (rows.length === 0) continue

          // Simple table creation (would need proper schema in real implementation)
          const firstRow = rows[0]
          const columns = Object.keys(firstRow).map(col => 
            `${col} TEXT` // Simplified - would need proper type detection
          ).join(', ')
          
          sqlContent += `CREATE TABLE ${tableName} (${columns});\n\n`

          // Generate INSERT statements
          for (const row of rows) {
            const values = Object.values(row).map(val => 
              val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`
            ).join(', ')
            sqlContent += `INSERT INTO ${tableName} VALUES (${values});\n`
          }
          sqlContent += '\n'
        }

        return {
          success: true,
          data: sqlContent,
          size: this.calculateSize(sqlContent)
        }

      case 'csv':
        let csvContent = ''
        
        for (const [tableName, rows] of Object.entries(tableData)) {
          if (rows.length === 0) continue

          csvContent += `-- Table: ${tableName}\n`
          
          // Headers
          const headers = Object.keys(rows[0])
          csvContent += headers.join(',') + '\n'

          // Rows
          for (const row of rows) {
            const values = headers.map(header => {
              const value = row[header]
              if (value === null || value === undefined) return ''
              
              const stringValue = String(value)
              // Quote if contains comma, newline, or quotes
              if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            })
            csvContent += values.join(',') + '\n'
          }
          csvContent += '\n'
        }

        return {
          success: true,
          data: csvContent,
          size: this.calculateSize(csvContent)
        }

      default:
        return { success: false, error: `Unsupported format: ${format}` }
    }
  }

  private async importFromJSON(data: any): Promise<ImportResult> {
    try {
      const project = data.project
      const tables = data.tables

      // Create new project
      const projectId = await projectManager.createProject(project.name || 'Imported Project')

      // Import table data
      for (const [tableName, rows] of Object.entries(tables as Record<string, any[]>)) {
        if (!Array.isArray(rows) || rows.length === 0) continue

        try {
          // Simple table creation and data insertion
          // In real implementation, would need proper schema handling
          for (const row of rows) {
            const columns = Object.keys(row).join(', ')
            const values = Object.values(row).map(v => `'${v}'`).join(', ')
            await this.dbManager.query(`INSERT INTO ${tableName} (${columns}) VALUES (${values})`)
          }
        } catch (error: unknown) {
          const err = error as Error
          console.warn(`Failed to import table ${tableName}:`, err)
        }
      }

      return { success: true, projectId: (projectId as any)?.name || projectId }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async importFromSQL(sqlData: string): Promise<ImportResult> {
    try {
      // Create new project
      const projectId = await projectManager.createProject('Imported SQL Project')

      // Execute SQL statements
      const statements = sqlData
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      for (const statement of statements) {
        if (statement.startsWith('--') || statement.startsWith('/*')) {
          continue // Skip comments
        }
        
        try {
          await this.dbManager.query(statement)
        } catch (error: unknown) {
          const err = error as Error
          console.warn(`Failed to execute SQL statement: ${statement}`, err)
        }
      }

      return { success: true, projectId: (projectId as any)?.name || projectId }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async importFromCSV(csvData: string): Promise<ImportResult> {
    try {
      // Create new project
      const projectId = await projectManager.createProject('Imported CSV Project')

      // Parse CSV (simplified - would need proper CSV parser)
      const lines = csvData.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        throw new Error('Invalid CSV format')
      }

      const headers = lines[0].split(',')
      const tableName = 'imported_data' // Simplified table name

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        if (values.length === headers.length) {
          try {
            const columns = headers.join(', ')
            const vals = values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ')
            await this.dbManager.query(`INSERT INTO ${tableName} (${columns}) VALUES (${vals})`)
          } catch (error: unknown) {
            const err = error as Error
            console.warn(`Failed to import CSV row ${i}:`, err)
          }
        }
      }

      return { success: true, projectId: (projectId as any)?.name || projectId }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private calculateSize(data: string): number {
    return new Blob([data]).size
  }
}