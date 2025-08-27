import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateBucketDialog } from '../CreateBucketDialog';
import { vfsManager } from '@/lib/vfs/VFSManager';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock VFS Manager
vi.mock('@/lib/vfs/VFSManager', () => ({
  vfsManager: {
    createBucket: vi.fn().mockResolvedValue({
      id: 'bucket-123',
      name: 'test-bucket',
      projectId: 'test-project',
      isPublic: false,
      maxFileSize: 50 * 1024 * 1024,
      allowedMimeTypes: ['*/*'],
      fileCount: 0,
      totalSize: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }
}));

// Mock logger
vi.mock('@/lib/infrastructure/Logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

const mockOnBucketCreated = vi.fn();
const mockOnOpenChange = vi.fn();

describe('CreateBucketDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog when open', () => {
    render(
      <CreateBucketDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onBucketCreated={mockOnBucketCreated}
      />
    );

    expect(screen.getByText('Create a new bucket')).toBeInTheDocument();
    expect(screen.getByLabelText('Bucket name')).toBeInTheDocument();
    expect(screen.getByText('Make bucket public')).toBeInTheDocument();
  });

  it('does not render dialog when closed', () => {
    render(
      <CreateBucketDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        onBucketCreated={mockOnBucketCreated}
      />
    );

    expect(screen.queryByText('Create a new bucket')).not.toBeInTheDocument();
  });

  it('validates bucket name requirement', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateBucketDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onBucketCreated={mockOnBucketCreated}
      />
    );

    const createButton = screen.getByText('Create bucket');
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Bucket name is required')).toBeInTheDocument();
    });
  });

  it('creates bucket with valid input', async () => {
    const user = userEvent.setup();
    
    render(
      <CreateBucketDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onBucketCreated={mockOnBucketCreated}
      />
    );

    const bucketNameInput = screen.getByLabelText('Bucket name');
    const createButton = screen.getByText('Create bucket');

    await user.type(bucketNameInput, 'test-bucket');
    await user.click(createButton);

    await waitFor(() => {
      expect(vfsManager.createBucket).toHaveBeenCalledWith('test-bucket', {
        isPublic: false,
        maxFileSize: 50 * 1024 * 1024,
        allowedMimeTypes: ['*/*']
      });
    });

    expect(mockOnBucketCreated).toHaveBeenCalled();
  });

  it('shows cancel button', () => {
    render(
      <CreateBucketDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onBucketCreated={mockOnBucketCreated}
      />
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('includes file size and mime type options', () => {
    render(
      <CreateBucketDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onBucketCreated={mockOnBucketCreated}
      />
    );

    expect(screen.getByText('Maximum file size')).toBeInTheDocument();
    expect(screen.getByText('Allowed file types')).toBeInTheDocument();
  });
});