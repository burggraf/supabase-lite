import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OfflineBackup } from '../OfflineBackup'

// Mock DataExporter
const mockDataExporter = vi.hoisted(() => ({
  getInstance: vi.fn(() => ({
    exportProject: vi.fn(),
    importProject: vi.fn(),
    exportAllProjects: vi.fn(),
    validateImportData: vi.fn(),
    getExportFormats: vi.fn(() => ['json', 'sql', 'csv'])
  }))
}))

vi.mock('@/lib/offline/DataExporter', () => ({
  DataExporter: mockDataExporter
}))

// Mock file system access
Object.defineProperty(global, 'showSaveFilePicker', {
  value: vi.fn(),
  writable: true
})

Object.defineProperty(global, 'showOpenFilePicker', {
  value: vi.fn(),
  writable: true
})

describe('OfflineBackup', () => {
  let mockExporter: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockExporter = {
      exportProject: vi.fn(),
      importProject: vi.fn(),
      exportAllProjects: vi.fn(),
      validateImportData: vi.fn(),
      getExportFormats: vi.fn(() => ['json', 'sql', 'csv'])
    }
    mockDataExporter.getInstance.mockReturnValue(mockExporter)
  })

  describe('Component Rendering', () => {
    it('should render backup and restore interface', () => {
      render(<OfflineBackup />)
      
      expect(screen.getByText('Offline Backup & Restore')).toBeInTheDocument()
      expect(screen.getByText('Export Project')).toBeInTheDocument()
      expect(screen.getByText('Import Project')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument()
    })

    it('should show export format options', () => {
      render(<OfflineBackup />)
      
      expect(screen.getByText('JSON (Complete)')).toBeInTheDocument()
      expect(screen.getByText('SQL (Database)')).toBeInTheDocument()
      expect(screen.getByText('CSV (Tables)')).toBeInTheDocument()
    })

    it('should display project selection when multiple projects exist', () => {
      const mockProjects = [
        { id: '1', name: 'Project A' },
        { id: '2', name: 'Project B' }
      ]

      render(<OfflineBackup projects={mockProjects} />)
      
      expect(screen.getByText('Select Project')).toBeInTheDocument()
      expect(screen.getByText('Project A')).toBeInTheDocument()
      expect(screen.getByText('Project B')).toBeInTheDocument()
    })
  })

  describe('Export Functionality', () => {
    it('should export project in selected format', async () => {
      const mockFileHandle = {
        createWritable: vi.fn(() => ({
          write: vi.fn(),
          close: vi.fn()
        }))
      } as any

      (global as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockFileHandle)
      mockExporter.exportProject.mockResolvedValue({
        success: true,
        data: { project: 'test-data' },
        size: 1024
      })

      render(<OfflineBackup />)
      
      // Select JSON format
      const jsonOption = screen.getByLabelText('JSON (Complete)')
      fireEvent.click(jsonOption)
      
      // Click export
      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)
      
      await waitFor(() => {
        expect(mockExporter.exportProject).toHaveBeenCalledWith(
          undefined, // no project selected
          'json'
        )
      })
    })

    it('should handle export errors gracefully', async () => {
      (global as any).showSaveFilePicker = vi.fn().mockRejectedValue(new Error('Save cancelled'))
      
      render(<OfflineBackup />)
      
      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)
      
      await waitFor(() => {
        expect(screen.getByText(/export cancelled/i)).toBeInTheDocument()
      })
    })

    it('should show export progress and completion', async () => {
      const mockFileHandle = {
        createWritable: vi.fn(() => ({
          write: vi.fn(),
          close: vi.fn()
        }))
      } as any

      (global as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockFileHandle)
      mockExporter.exportProject.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            data: { project: 'test-data' },
            size: 2048
          }), 100)
        })
      )

      render(<OfflineBackup />)
      
      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)
      
      // Should show progress
      await waitFor(() => {
        expect(screen.getByText(/exporting/i)).toBeInTheDocument()
      })
      
      // Should show completion
      await waitFor(() => {
        expect(screen.getByText(/export completed/i)).toBeInTheDocument()
        expect(screen.getByText('2.0 KB')).toBeInTheDocument()
      }, { timeout: 2000 })
    })

    it('should export all projects when requested', async () => {
      const mockFileHandle = {
        createWritable: vi.fn(() => ({
          write: vi.fn(),
          close: vi.fn()
        }))
      } as any

      (global as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockFileHandle)
      mockExporter.exportAllProjects.mockResolvedValue({
        success: true,
        data: { projects: ['project1', 'project2'] },
        size: 4096
      })

      render(<OfflineBackup />)
      
      // Select "Export All" option
      const exportAllCheckbox = screen.getByLabelText('Export all projects')
      fireEvent.click(exportAllCheckbox)
      
      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)
      
      await waitFor(() => {
        expect(mockExporter.exportAllProjects).toHaveBeenCalledWith('json')
      })
    })
  })

  describe('Import Functionality', () => {
    it('should import project from file', async () => {
      const mockFile = new File(['{"project": "test"}'], 'backup.json', {
        type: 'application/json'
      })
      
      const mockFileHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile)
      } as any

      (global as any).showOpenFilePicker = vi.fn().mockResolvedValue([mockFileHandle])
      mockExporter.validateImportData.mockResolvedValue({ valid: true })
      mockExporter.importProject.mockResolvedValue({
        success: true,
        projectId: 'imported-project-123'
      })

      render(<OfflineBackup />)
      
      const importButton = screen.getByRole('button', { name: /import/i })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(mockExporter.validateImportData).toHaveBeenCalled()
        expect(mockExporter.importProject).toHaveBeenCalled()
      })
      
      await waitFor(() => {
        expect(screen.getByText(/import completed/i)).toBeInTheDocument()
      })
    })

    it('should validate import data before importing', async () => {
      const mockFile = new File(['invalid json'], 'backup.json', {
        type: 'application/json'
      })
      
      const mockFileHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile)
      } as any

      (global as any).showOpenFilePicker = vi.fn().mockResolvedValue([mockFileHandle])
      mockExporter.validateImportData.mockResolvedValue({ 
        valid: false, 
        errors: ['Invalid JSON format'] 
      })

      render(<OfflineBackup />)
      
      const importButton = screen.getByRole('button', { name: /import/i })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/invalid json format/i)).toBeInTheDocument()
      })
    })

    it('should handle import errors gracefully', async () => {
      (global as any).showOpenFilePicker = vi.fn().mockRejectedValue(new Error('File selection cancelled'))
      
      render(<OfflineBackup />)
      
      const importButton = screen.getByRole('button', { name: /import/i })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/import cancelled/i)).toBeInTheDocument()
      })
    })

    it('should show import progress', async () => {
      const mockFile = new File(['{"project": "test"}'], 'backup.json', {
        type: 'application/json'
      })
      
      const mockFileHandle = {
        getFile: vi.fn().mockResolvedValue(mockFile)
      } as any

      (global as any).showOpenFilePicker = vi.fn().mockResolvedValue([mockFileHandle])
      mockExporter.validateImportData.mockResolvedValue({ valid: true })
      mockExporter.importProject.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            projectId: 'imported-project-123'
          }), 100)
        })
      )

      render(<OfflineBackup />)
      
      const importButton = screen.getByRole('button', { name: /import/i })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/importing/i)).toBeInTheDocument()
      })
    })
  })

  describe('Format Selection', () => {
    it('should update export format when selection changes', () => {
      render(<OfflineBackup />)
      
      const sqlOption = screen.getByLabelText('SQL (Database)')
      fireEvent.click(sqlOption)
      
      // Verify the radio button is selected
      expect(sqlOption).toBeChecked()
    })

    it('should show format descriptions', () => {
      render(<OfflineBackup />)
      
      expect(screen.getByText(/complete project data/i)).toBeInTheDocument()
      expect(screen.getByText(/database schema and data/i)).toBeInTheDocument()
      expect(screen.getByText(/table data only/i)).toBeInTheDocument()
    })
  })

  describe('File System Integration', () => {
    it('should use appropriate file extensions for formats', async () => {
      const mockFileHandle = {
        createWritable: vi.fn(() => ({
          write: vi.fn(),
          close: vi.fn()
        }))
      } as any

      (global as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockFileHandle)
      mockExporter.exportProject.mockResolvedValue({
        success: true,
        data: { project: 'test-data' },
        size: 1024
      })

      render(<OfflineBackup />)
      
      // Test JSON export
      const jsonOption = screen.getByLabelText('JSON (Complete)')
      fireEvent.click(jsonOption)
      
      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)
      
      await waitFor(() => {
        expect((global as any).showSaveFilePicker).toHaveBeenCalledWith({
          suggestedName: expect.stringContaining('.json'),
          types: expect.arrayContaining([
            expect.objectContaining({
              description: 'JSON files',
              accept: { 'application/json': ['.json'] }
            })
          ])
        })
      })
    })

    it('should handle file system access not supported', async () => {
      // Mock unsupported browser
      delete (global as any).showSaveFilePicker
      delete (global as any).showOpenFilePicker

      render(<OfflineBackup />)
      
      expect(screen.getByText(/file system access not supported/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<OfflineBackup />)
      
      expect(screen.getByRole('group', { name: /export format/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /export project/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /import project/i })).toBeInTheDocument()
    })

    it('should announce status updates to screen readers', async () => {
      const mockFileHandle = {
        createWritable: vi.fn(() => ({
          write: vi.fn(),
          close: vi.fn()
        }))
      } as any

      (global as any).showSaveFilePicker = vi.fn().mockResolvedValue(mockFileHandle)
      mockExporter.exportProject.mockResolvedValue({
        success: true,
        data: { project: 'test-data' },
        size: 1024
      })

      render(<OfflineBackup />)
      
      const exportButton = screen.getByRole('button', { name: /export/i })
      fireEvent.click(exportButton)
      
      await waitFor(() => {
        const statusElement = screen.getByRole('status')
        expect(statusElement).toBeInTheDocument()
      })
    })
  })
})