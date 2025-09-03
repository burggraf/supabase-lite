// import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FunctionsList } from '../FunctionsList';
import { vfsManager } from '../../../lib/vfs/VFSManager';
import { projectManager } from '../../../lib/projects/ProjectManager';

// Mock dependencies
vi.mock('../../../lib/vfs/VFSManager');
vi.mock('../../../lib/projects/ProjectManager');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockVfsManager = vi.mocked(vfsManager);
const mockProjectManager = vi.mocked(projectManager);

const mockProps = {
  onCreateFunction: vi.fn(),
  onEditFunction: vi.fn(),
  onGoToSecrets: vi.fn(),
};

describe('FunctionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectManager.getActiveProject.mockReturnValue({
      id: 'test-project-id',
      name: 'Test Project',
      createdAt: new Date(),
      databasePath: 'test-db-path',
      lastAccessed: new Date(),
      isActive: true,
    });
    mockVfsManager.initialize.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should display empty state when no functions exist', async () => {
      mockVfsManager.listFiles.mockResolvedValue([]);

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create your first edge function')).toBeInTheDocument();
      });

      expect(screen.getByText('Via Editor')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.getByText('Via CLI')).toBeInTheDocument();
      expect(screen.getByText('Start with a template')).toBeInTheDocument();
    });

    it('should call onCreateFunction when Deploy a new function button is clicked', async () => {
      mockVfsManager.listFiles.mockResolvedValue([]);

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Deploy a new function')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Deploy a new function'));
      expect(mockProps.onCreateFunction).toHaveBeenCalledWith();
    });
  });

  describe('Functions List', () => {
    const mockFunctions = [
      {
        path: 'edge-functions/hello-world/index.ts',
        name: 'index.ts',
        directory: 'edge-functions/hello-world',
        lastModified: new Date('2025-01-01'),
        size: 1024,
        mimeType: 'text/typescript',
      },
      {
        path: 'edge-functions/api-handler/index.ts',
        name: 'index.ts',
        directory: 'edge-functions/api-handler',
        lastModified: new Date('2025-01-02'),
        size: 2048,
        mimeType: 'text/typescript',
      },
    ];

    it('should display functions list when functions exist', async () => {
      mockVfsManager.listFiles.mockResolvedValue(mockFunctions as any);

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Your Functions')).toBeInTheDocument();
      });

      expect(screen.getByText('hello-world')).toBeInTheDocument();
      expect(screen.getByText('api-handler')).toBeInTheDocument();
      expect(screen.getAllByText('active')).toHaveLength(2);
    });

    it('should call onEditFunction when Edit button is clicked', async () => {
      mockVfsManager.listFiles.mockResolvedValue(mockFunctions as any);

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('hello-world')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);

      expect(mockProps.onEditFunction).toHaveBeenCalledWith('hello-world');
    });

    it('should open test modal when Test button is clicked', async () => {
      mockVfsManager.listFiles.mockResolvedValue(mockFunctions as any);

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('hello-world')).toBeInTheDocument();
      });

      const testButtons = screen.getAllByText('Test');
      fireEvent.click(testButtons[0]);

      expect(screen.getByText('Test Function: hello-world')).toBeInTheDocument();
      expect(screen.getByText('Request Body (JSON)')).toBeInTheDocument();
      expect(screen.getByText('Test Function')).toBeInTheDocument();
    });

    it('should handle function deletion with confirmation', async () => {
      mockVfsManager.listFiles.mockResolvedValue(mockFunctions as any);
      mockVfsManager.deleteFile.mockResolvedValue(true);

      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('hello-world')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button');
      const deleteButton = deleteButtons.find(btn => 
        btn.querySelector('svg') && btn.className.includes('text-red-600')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
        expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete the function "hello-world"?');
        expect(mockVfsManager.deleteFile).toHaveBeenCalledWith('edge-functions/hello-world');
      }

      confirmSpy.mockRestore();
    });
  });

  describe('Function Testing', () => {
    const mockFunctions = [
      {
        path: 'edge-functions/test-function/index.ts',
        name: 'index.ts',
        directory: 'edge-functions/test-function',
        lastModified: new Date(),
        size: 1024,
        mimeType: 'text/typescript',
      },
    ];

    it('should execute function test with proper request', async () => {
      mockVfsManager.listFiles.mockResolvedValue(mockFunctions as any);

      // Mock fetch for function execution
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: () => Promise.resolve({ message: 'Success' }),
      });

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('test-function')).toBeInTheDocument();
      });

      // Open test modal
      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      // Execute test
      const executeButton = screen.getByText('Test Function');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          `${window.location.origin}/functions/v1/test-function`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-project-id',
              'apikey': 'test-project-id',
            }),
          })
        );
      });
    });

    it('should handle test errors gracefully', async () => {
      mockVfsManager.listFiles.mockResolvedValue(mockFunctions as any);

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('test-function')).toBeInTheDocument();
      });

      const testButton = screen.getByText('Test');
      fireEvent.click(testButton);

      const executeButton = screen.getByText('Test Function');
      fireEvent.click(executeButton);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle VFS initialization failure gracefully', async () => {
      mockVfsManager.initialize.mockRejectedValue(new Error('VFS Error'));
      mockVfsManager.listFiles.mockResolvedValue([]);

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create your first edge function')).toBeInTheDocument();
      });
    });

    it('should handle missing active project', async () => {
      mockProjectManager.getActiveProject.mockReturnValue(null);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<FunctionsList {...mockProps} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No active project found - cannot load functions');
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('should display loading state initially', () => {
      mockVfsManager.listFiles.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<FunctionsList {...mockProps} />);

      expect(screen.getByText('Loading functions...')).toBeInTheDocument();
    });
  });
});