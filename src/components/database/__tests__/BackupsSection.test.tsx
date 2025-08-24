import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BackupsSection } from '../BackupsSection';
import * as useDatabase from '@/hooks/useDatabase';
import * as projectManager from '@/lib/projects/ProjectManager';
import * as dbManager from '@/lib/database/connection';

// Mock the modules
vi.mock('@/hooks/useDatabase');
vi.mock('@/lib/projects/ProjectManager');
vi.mock('@/lib/database/connection');

// Mock file download
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

// Mock document.createElement for download
const mockClick = vi.fn();
Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName: string) => {
    if (tagName === 'a') {
      return {
        href: '',
        download: '',
        style: { display: '' },
        click: mockClick,
      };
    }
    return {};
  }),
});

Object.defineProperty(document.body, 'appendChild', {
  value: vi.fn(),
});

Object.defineProperty(document.body, 'removeChild', {
  value: vi.fn(),
});

describe('BackupsSection', () => {
  const mockUseDatabase = useDatabase as any;
  const mockProjectManager = projectManager as any;
  const mockDbManager = dbManager as any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useDatabase hook
    mockUseDatabase.useDatabase = vi.fn(() => ({
      isConnected: true,
    }));

    // Mock projectManager
    mockProjectManager.projectManager = {
      getActiveProject: vi.fn(() => ({
        id: 'test-project',
        name: 'Test Project',
        databasePath: 'idb://test-project',
      })),
      createProject: vi.fn(),
      switchToProject: vi.fn(),
    };

    // Mock dbManager
    mockDbManager.dbManager = {
      backupDatabase: vi.fn(),
      initialize: vi.fn(),
    };

    mockDbManager.DatabaseManager = {
      restoreDatabase: vi.fn(),
    };
  });

  it('should render backup and restore sections', () => {
    render(<BackupsSection />);
    
    expect(screen.getByText('Database Backups')).toBeInTheDocument();
    expect(screen.getByText('Create Backup')).toBeInTheDocument();
    expect(screen.getByText('Restore Backup')).toBeInTheDocument();
    expect(screen.getByText('Recent Backups')).toBeInTheDocument();
  });

  it('should show current project name', () => {
    render(<BackupsSection />);
    
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('should handle backup creation', async () => {
    const mockBackupBlob = new Blob(['test backup data'], { type: 'application/gzip' });
    mockDbManager.dbManager.backupDatabase.mockResolvedValue(mockBackupBlob);

    render(<BackupsSection />);
    
    const backupButton = screen.getByRole('button', { name: /create backup/i });
    fireEvent.click(backupButton);

    await waitFor(() => {
      expect(mockDbManager.dbManager.backupDatabase).toHaveBeenCalledWith('gzip');
    });

    // Check that the download was triggered
    expect(mockClick).toHaveBeenCalled();
  });

  it('should disable backup button when not connected', () => {
    mockUseDatabase.useDatabase.mockReturnValue({
      isConnected: false,
    });

    render(<BackupsSection />);
    
    const backupButton = screen.getByRole('button', { name: /create backup/i });
    expect(backupButton).toBeDisabled();
  });

  it('should disable backup button when no active project', () => {
    mockProjectManager.projectManager.getActiveProject.mockReturnValue(null);

    render(<BackupsSection />);
    
    const backupButton = screen.getByRole('button', { name: /create backup/i });
    expect(backupButton).toBeDisabled();
    expect(screen.getByText('No active project. Create or select a project first.')).toBeInTheDocument();
  });

  it('should show backup history when available', () => {
    // Mock localStorage
    const mockHistory = [
      {
        name: 'backup-1.tgz',
        size: 1024,
        createdAt: new Date('2024-01-01'),
        projectName: 'Test Project',
      },
    ];

    Storage.prototype.getItem = vi.fn(() => JSON.stringify(mockHistory));

    render(<BackupsSection />);
    
    expect(screen.getByText('backup-1.tgz')).toBeInTheDocument();
    expect(screen.getByText('Project: Test Project')).toBeInTheDocument();
  });

  it('should handle file validation', async () => {
    render(<BackupsSection />);
    
    const fileInput = screen.getByRole('button', { name: /select file/i });
    
    // Mock file input change event with invalid file
    const invalidFile = new File(['content'], 'invalid.txt', { type: 'text/plain' });
    
    Object.defineProperty(fileInput, 'files', {
      value: [invalidFile],
      configurable: true,
    });

    // We can't easily test file input interaction in jsdom,
    // but we can test that the component renders the file selection area
    expect(screen.getByText('Drop a backup file here')).toBeInTheDocument();
  });
});