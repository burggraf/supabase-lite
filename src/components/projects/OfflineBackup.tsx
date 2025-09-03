/**
 * Offline Backup Component
 * Enhanced import/export interface for offline data transfer
 */

import { useState, useCallback } from 'react'
import { Download, Upload, FileDown, FileUp, AlertCircle, CheckCircle, Clock, HardDrive } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// RadioGroup component not available - using Select instead
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { DataExporter, type ExportFormat } from '@/lib/offline/DataExporter'

interface Project {
  id: string
  name: string
  description?: string
}

interface OfflineBackupProps {
  projects?: Project[]
  onImportComplete?: (projectId: string) => void
  onExportComplete?: (filename: string, size: number) => void
}

interface OperationStatus {
  type: 'idle' | 'exporting' | 'importing' | 'success' | 'error'
  message: string
  progress?: number
  details?: string
}

const formatDescriptions = {
  json: 'Complete project data including tables, schema, and metadata',
  sql: 'Database schema and data as SQL statements',
  csv: 'Table data only in comma-separated format'
}

const fileTypeMap = {
  json: { description: 'JSON files', accept: { 'application/json': ['.json'] } },
  sql: { description: 'SQL files', accept: { 'text/sql': ['.sql'] } },
  csv: { description: 'CSV files', accept: { 'text/csv': ['.csv'] } }
}

export function OfflineBackup({ 
  projects = [], 
  onImportComplete,
  onExportComplete 
}: OfflineBackupProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [exportAll, setExportAll] = useState(false)
  const [status, setStatus] = useState<OperationStatus>({ type: 'idle', message: '' })
  const [supportsFileSystem] = useState(() => 
    'showSaveFilePicker' in window && 'showOpenFilePicker' in window
  )

  const dataExporter = DataExporter.getInstance()

  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }, [])

  const generateFileName = useCallback((format: ExportFormat, projectName?: string): string => {
    const timestamp = new Date().toISOString().split('T')[0]
    const name = exportAll ? 'all-projects' : (projectName || 'project')
    return `${name}-${timestamp}.${format}`
  }, [exportAll])

  const handleExport = useCallback(async () => {
    try {
      setStatus({ type: 'exporting', message: 'Preparing export...', progress: 0 })

      const result = exportAll 
        ? await dataExporter.exportAllProjects(selectedFormat)
        : await dataExporter.exportProject(selectedProject || undefined, selectedFormat)

      if (!result.success) {
        setStatus({
          type: 'error',
          message: 'Export failed',
          details: result.error
        })
        return
      }

      setStatus({ type: 'exporting', message: 'Saving file...', progress: 50 })

      if (supportsFileSystem) {
        await saveWithFileSystemAPI(result.data!, result.size!)
      } else {
        saveWithDownloadAPI(result.data!, result.size!)
      }

      setStatus({
        type: 'success',
        message: 'Export completed successfully',
        details: `Exported ${formatBytes(result.size!)} of data`
      })

      onExportComplete?.(generateFileName(selectedFormat), result.size!)

    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Export cancelled or failed',
        details: (error as Error).message
      })
    }
  }, [selectedFormat, selectedProject, exportAll, supportsFileSystem, onExportComplete, dataExporter, formatBytes, generateFileName])

  const saveWithFileSystemAPI = async (data: any, _size: number) => {
    const filename = generateFileName(selectedFormat)
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName: filename,
      types: [fileTypeMap[selectedFormat]]
    })

    const writable = await fileHandle.createWritable()
    const content = selectedFormat === 'json' ? JSON.stringify(data, null, 2) : data
    await writable.write(content)
    await writable.close()
  }

  const saveWithDownloadAPI = (data: any, _size: number) => {
    const content = selectedFormat === 'json' ? JSON.stringify(data, null, 2) : data
    const formatKey = selectedFormat as keyof typeof fileTypeMap
    const acceptTypes = fileTypeMap[formatKey].accept
    const mimeType = Object.values(acceptTypes)[0][0]
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = generateFileName(selectedFormat)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = useCallback(async () => {
    try {
      setStatus({ type: 'importing', message: 'Selecting file...', progress: 0 })

      let file: File
      if (supportsFileSystem) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [fileTypeMap[selectedFormat]],
          multiple: false
        })
        file = await fileHandle.getFile()
      } else {
        // Fallback for browsers without File System Access API
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = Object.keys(fileTypeMap[selectedFormat].accept).join(',')
        
        return new Promise((resolve, reject) => {
          input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files
            if (files && files[0]) {
              file = files[0]
              await processImportFile(file)
              resolve(undefined)
            } else {
              reject(new Error('No file selected'))
            }
          }
          input.click()
        })
      }

      await processImportFile(file)

    } catch (error) {
      setStatus({
        type: 'error',
        message: 'Import cancelled or failed',
        details: (error as Error).message
      })
    }
  }, [selectedFormat, supportsFileSystem])

  const processImportFile = async (file: File) => {
    setStatus({ type: 'importing', message: 'Reading file...', progress: 25 })

    const content = selectedFormat === 'json' 
      ? JSON.parse(await file.text())
      : await file.text()

    setStatus({ type: 'importing', message: 'Validating data...', progress: 50 })

    const validation = await dataExporter.validateImportData(content, selectedFormat)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    setStatus({ type: 'importing', message: 'Importing project...', progress: 75 })

    const result = await dataExporter.importProject(content, selectedFormat)
    if (!result.success) {
      throw new Error(result.error!)
    }

    setStatus({
      type: 'success',
      message: 'Import completed successfully',
      details: `Project imported with ID: ${result.projectId}`
    })

    onImportComplete?.(result.projectId!)
  }

  const getStatusIcon = () => {
    switch (status.type) {
      case 'exporting':
      case 'importing':
        return <Clock className="w-4 h-4 animate-spin" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Offline Backup & Restore
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!supportsFileSystem && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                File System Access not supported. Using download/upload fallback.
              </span>
            </div>
          )}

          {/* Export Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              Export Project
            </h3>

            {/* Format Selection */}
            <div>
              <Label className="text-sm font-medium">Export Format</Label>
              <Select value={selectedFormat} onValueChange={(value: string) => setSelectedFormat(value as ExportFormat)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON (Complete)</SelectItem>
                  <SelectItem value="sql">SQL (Database)</SelectItem>
                  <SelectItem value="csv">CSV (Tables)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDescriptions[selectedFormat]}
              </p>
            </div>

            {/* Project Selection */}
            {projects.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="export-all"
                    checked={exportAll}
                    onCheckedChange={(checked) => setExportAll(checked as boolean)}
                  />
                  <Label htmlFor="export-all">Export all projects</Label>
                </div>

                {!exportAll && (
                  <div>
                    <Label htmlFor="project-select">Select Project</Label>
                    <Select value={selectedProject} onValueChange={setSelectedProject}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose project to export" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={handleExport}
              disabled={status.type === 'exporting' || status.type === 'importing'}
              className="w-full"
            >
              {status.type === 'exporting' ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : supportsFileSystem ? (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export Project
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download Export
                </>
              )}
            </Button>
          </div>

          {/* Import Section */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileUp className="w-4 h-4" />
              Import Project
            </h3>

            <p className="text-sm text-muted-foreground">
              Import a previously exported project in {selectedFormat.toUpperCase()} format.
            </p>

            <Button 
              onClick={handleImport}
              disabled={status.type === 'exporting' || status.type === 'importing'}
              variant="outline"
              className="w-full"
            >
              {status.type === 'importing' ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : supportsFileSystem ? (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Project
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </>
              )}
            </Button>
          </div>

          {/* Status Display */}
          {status.type !== 'idle' && (
            <div className="space-y-2">
              <div 
                className="flex items-center gap-2 p-3 rounded-md"
                role="status"
                aria-live="polite"
              >
                {getStatusIcon()}
                <span className="text-sm font-medium">{status.message}</span>
                {(status.type === 'exporting' || status.type === 'importing') && (
                  <Badge variant="secondary">
                    {status.type === 'exporting' ? 'Exporting' : 'Importing'}
                  </Badge>
                )}
              </div>

              {status.progress !== undefined && (
                <Progress value={status.progress} className="w-full" />
              )}

              {status.details && (
                <p className="text-xs text-muted-foreground">{status.details}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}