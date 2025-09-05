import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppHosting } from '../AppHosting';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@/lib/vfs/VFSManager', () => ({
  vfsManager: {
    listFiles: vi.fn(),
    deleteFile: vi.fn(),
    readFile: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the deployment modal
vi.mock('../AppDeploymentModal', () => ({
  AppDeploymentModal: ({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) => (
    open ? (
      <div data-testid="deployment-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={onSuccess}>Deploy Success</button>
      </div>
    ) : null
  ),
}));

describe('AppHosting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders app hosting interface', async () => {
    // Mock empty app list
    vi.mocked(vfsManager.listFiles).mockResolvedValue([]);

    render(<AppHosting />);

    expect(screen.getByText('App Hosting')).toBeInTheDocument();
    expect(screen.getByText(/Host static web applications/)).toBeInTheDocument();
    
    // Check for stats cards
    expect(screen.getByText('Deployed Apps')).toBeInTheDocument();
    expect(screen.getByText('Total Files')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('No apps deployed yet')).toBeInTheDocument();
    });
  });

  it('displays deployed apps correctly', async () => {
    // Mock app files
    const mockFiles = [
      {
        id: 'file1',
        path: 'app/my-todo-app/index.html',
        name: 'index.html',
        size: 1024,
        mimeType: 'text/html',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        directory: 'app/my-todo-app',
        projectId: 'test-project',
        content: '<html></html>',
        chunked: false,
        hash: 'hash1'
      },
      {
        id: 'file2',
        path: 'app/my-todo-app/script.js',
        name: 'script.js',
        size: 512,
        mimeType: 'application/javascript',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        directory: 'app/my-todo-app',
        projectId: 'test-project',
        content: 'console.log("hello");',
        chunked: false,
        hash: 'hash2'
      },
    ];

    vi.mocked(vfsManager.listFiles).mockResolvedValue(mockFiles);

    render(<AppHosting />);

    await waitFor(() => {
      expect(screen.getByText('my-todo-app')).toBeInTheDocument();
      expect(screen.getByText('2 files')).toBeInTheDocument();
    });

    // Check stats are updated
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 deployed app
  });

  it('opens deployment modal when deploy button is clicked', async () => {
    vi.mocked(vfsManager.listFiles).mockResolvedValue([]);

    render(<AppHosting />);

    const deployButton = screen.getByRole('button', { name: /deploy app/i });
    await userEvent.click(deployButton);

    expect(screen.getByTestId('deployment-modal')).toBeInTheDocument();
  });

  it('handles app deletion correctly', async () => {
    const mockFiles = [
      {
        id: 'file1',
        path: 'app/test-app/index.html',
        name: 'index.html',
        size: 1024,
        mimeType: 'text/html',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        directory: 'app/test-app',
        projectId: 'test-project',
        content: '<html></html>',
        chunked: false,
        hash: 'hash1'
      },
    ];

    // First call returns the app, second call returns empty (after deletion)
    vi.mocked(vfsManager.listFiles)
      .mockResolvedValueOnce(mockFiles)
      .mockResolvedValueOnce(mockFiles) // For the delete operation
      .mockResolvedValueOnce([]); // After deletion

    vi.mocked(vfsManager.deleteFile).mockResolvedValue(true);

    render(<AppHosting />);

    await waitFor(() => {
      expect(screen.getByText('test-app')).toBeInTheDocument();
    });

    // Find and click delete button
    const deleteButton = screen.getByRole('button', { name: /trash/i });
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(vfsManager.deleteFile).toHaveBeenCalledWith('app/test-app/index.html');
      expect(toast.success).toHaveBeenCalledWith('App "test-app" deleted successfully');
    });
  });

  it('handles deployment success correctly', async () => {
    vi.mocked(vfsManager.listFiles).mockResolvedValue([]);

    render(<AppHosting />);

    // Open deployment modal
    const deployButton = screen.getByRole('button', { name: /deploy app/i });
    await userEvent.click(deployButton);

    expect(screen.getByTestId('deployment-modal')).toBeInTheDocument();

    // Simulate successful deployment
    const successButton = screen.getByRole('button', { name: /deploy success/i });
    await userEvent.click(successButton);

    // Modal should close and apps should reload
    await waitFor(() => {
      expect(screen.queryByTestId('deployment-modal')).not.toBeInTheDocument();
    });
  });

  it('displays correct file size formatting', async () => {
    const mockFiles = [
      {
        id: 'file1',
        path: 'app/large-app/bundle.js',
        name: 'bundle.js',
        size: 1024 * 1024, // 1MB
        mimeType: 'application/javascript',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        directory: 'app/large-app',
        projectId: 'test-project',
        content: 'large bundle content',
        chunked: false,
        hash: 'hash1'
      },
    ];

    vi.mocked(vfsManager.listFiles).mockResolvedValue(mockFiles);

    render(<AppHosting />);

    await waitFor(() => {
      expect(screen.getByText('1 MB')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(vfsManager.listFiles).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<AppHosting />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});