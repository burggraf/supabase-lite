import { render, screen, waitFor } from '@testing-library/react';
import { Storage } from '../Storage';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock VFS Manager
vi.mock('@/lib/vfs/VFSManager', () => ({
  vfsManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    initializeDefaultBuckets: vi.fn().mockResolvedValue(undefined),
    listBuckets: vi.fn().mockResolvedValue([
      {
        id: 'bucket-1',
        name: 'public',
        projectId: 'test-project',
        isPublic: true,
        maxFileSize: 50 * 1024 * 1024,
        allowedMimeTypes: ['*/*'],
        fileCount: 5,
        totalSize: 1024000,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'bucket-2',
        name: 'private',
        projectId: 'test-project',
        isPublic: false,
        maxFileSize: 100 * 1024 * 1024,
        allowedMimeTypes: ['image/*'],
        fileCount: 3,
        totalSize: 512000,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ])
  }
}));

// Mock logger
vi.mock('@/lib/infrastructure/Logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('Storage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<Storage />);
    expect(screen.getByText('Loading storage...')).toBeInTheDocument();
  });

  it('renders bucket list after loading', async () => {
    render(<Storage />);
    
    await waitFor(() => {
      expect(screen.getByText('Storage')).toBeInTheDocument();
    });

    // Check that VFS manager methods were called
    expect(vfsManager.initialize).toHaveBeenCalled();
    expect(vfsManager.initializeDefaultBuckets).toHaveBeenCalled();
    expect(vfsManager.listBuckets).toHaveBeenCalled();
  });

  it('displays bucket list with public and private buckets', async () => {
    render(<Storage />);
    
    await waitFor(() => {
      expect(screen.getAllByText('public')).toHaveLength(2); // Appears in bucket list and breadcrumb
      expect(screen.getByText('private')).toBeInTheDocument();
    });
  });

  it('shows empty state when no buckets exist', async () => {
    // Mock empty bucket list
    vi.mocked(vfsManager.listBuckets).mockResolvedValue([]);
    
    render(<Storage />);
    
    await waitFor(() => {
      expect(screen.getByText('No buckets available')).toBeInTheDocument();
      expect(screen.getByText('Buckets that you create will appear here')).toBeInTheDocument();
    });
  });

  it('renders new bucket button', async () => {
    render(<Storage />);
    
    await waitFor(() => {
      expect(screen.getByText('New bucket')).toBeInTheDocument();
    });
  });

  it('renders configuration section', async () => {
    render(<Storage />);
    
    await waitFor(() => {
      expect(screen.getByText('CONFIGURATION')).toBeInTheDocument();
      expect(screen.getByText('Policies')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });
});