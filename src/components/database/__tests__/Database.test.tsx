import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Database } from '../Database';

// Mock the useDatabase hook
const mockExecuteQuery = vi.fn();
const mockIsConnected = vi.fn();

vi.mock('@/hooks/useDatabase', () => ({
  useDatabase: () => ({
    executeQuery: mockExecuteQuery,
    isConnected: mockIsConnected(),
  }),
}));

// Mock formatBytes utility
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return {
    ...actual,
    formatBytes: vi.fn((bytes: number) => {
      if (bytes === 0) return '0 B';
      if (bytes === 1024) return '1 KB';
      if (bytes === 32768) return '32 KB';
      return `${bytes} B`;
    }),
  };
});

describe('Database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConnected.mockReturnValue(true);
  });

  it('should render database management interface', () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    render(<Database />);
    
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Database Tables')).toBeInTheDocument();
    expect(screen.getByText('New table')).toBeInTheDocument();
  });

  it('should render database management sidebar sections', () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    render(<Database />);
    
    expect(screen.getByText('DATABASE MANAGEMENT')).toBeInTheDocument();
    expect(screen.getByText('CONFIGURATION')).toBeInTheDocument();
    expect(screen.getByText('PLATFORM')).toBeInTheDocument();
    expect(screen.getByText('TOOLS')).toBeInTheDocument();
    
    expect(screen.getByText('Schema Visualizer')).toBeInTheDocument();
    expect(screen.getByText('Tables')).toBeInTheDocument();
    expect(screen.getByText('Functions')).toBeInTheDocument();
    expect(screen.getByText('Roles')).toBeInTheDocument();
  });

  it('should display loading state when fetching tables', () => {
    mockExecuteQuery.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<Database />);
    
    expect(screen.getByText('Loading tables...')).toBeInTheDocument();
  });

  it('should display tables when data is loaded', async () => {
    const mockTables = [
      {
        name: 'users',
        description: 'User accounts',
        estimated_rows: '150',
        size_bytes: '32768',
        column_count: '5'
      },
      {
        name: 'identities',
        description: 'User identities',
        estimated_rows: '50',
        size_bytes: '16384',
        column_count: '8'
      }
    ];
    
    mockExecuteQuery.mockResolvedValue({ rows: mockTables });
    
    render(<Database />);
    
    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('identities')).toBeInTheDocument();
      expect(screen.getByText('User accounts')).toBeInTheDocument();
      expect(screen.getByText('User identities')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('5 columns')).toBeInTheDocument();
      expect(screen.getByText('8 columns')).toBeInTheDocument();
    });
  });

  it('should display empty state when no tables exist', async () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    render(<Database />);
    
    await waitFor(() => {
      expect(screen.getByText('No tables found')).toBeInTheDocument();
      expect(screen.getByText('Create your first table to get started.')).toBeInTheDocument();
    });
  });

  it('should filter tables based on search input', async () => {
    const mockTables = [
      {
        name: 'users',
        description: 'User accounts',
        estimated_rows: '150',
        size_bytes: '32768',
        column_count: '5'
      },
      {
        name: 'identities',
        description: 'User identities',
        estimated_rows: '50',
        size_bytes: '16384',
        column_count: '8'
      }
    ];
    
    mockExecuteQuery.mockResolvedValue({ rows: mockTables });
    
    render(<Database />);
    
    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('identities')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search for a table');
    fireEvent.change(searchInput, { target: { value: 'user' } });
    
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.queryByText('identities')).not.toBeInTheDocument();
  });

  it('should display filtered empty state when search has no results', async () => {
    const mockTables = [
      {
        name: 'users',
        description: 'User accounts',
        estimated_rows: '150',
        size_bytes: '32768',
        column_count: '5'
      }
    ];
    
    mockExecuteQuery.mockResolvedValue({ rows: mockTables });
    
    render(<Database />);
    
    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });
    
    const searchInput = screen.getByPlaceholderText('Search for a table');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    expect(screen.getByText('No tables match your search.')).toBeInTheDocument();
    expect(screen.queryByText('users')).not.toBeInTheDocument();
  });

  it('should change schema selection', async () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    render(<Database />);
    
    const schemaSelect = screen.getByDisplayValue('public');
    fireEvent.change(schemaSelect, { target: { value: 'auth' } });
    
    expect(schemaSelect).toHaveValue('auth');
    
    // Should trigger a new query with the auth schema
    await waitFor(() => {
      expect(mockExecuteQuery).toHaveBeenLastCalledWith(
        expect.stringContaining("WHERE t.table_schema = 'auth'")
      );
    });
  });

  it('should handle database connection error gracefully', async () => {
    mockIsConnected.mockReturnValue(false);
    
    render(<Database />);
    
    // Should not attempt to execute queries when not connected
    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  it('should handle query execution errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExecuteQuery.mockRejectedValue(new Error('Database error'));
    
    render(<Database />);
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error loading tables:', expect.any(Error));
    });
    
    // Should display empty state when error occurs
    expect(screen.getByText('No tables found')).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });

  it('should display realtime status correctly', async () => {
    const mockTables = [
      {
        name: 'users',
        description: 'User accounts',
        estimated_rows: '150',
        size_bytes: '32768',
        column_count: '5'
      }
    ];
    
    mockExecuteQuery.mockResolvedValue({ rows: mockTables });
    
    render(<Database />);
    
    await waitFor(() => {
      // Should show realtime disabled (✗) since we don't have realtime implemented yet
      expect(screen.getByText('✗')).toBeInTheDocument();
    });
  });

  it('should render table headers correctly', async () => {
    mockExecuteQuery.mockResolvedValue({ rows: [] });
    
    render(<Database />);
    
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText(/Rows/)).toBeInTheDocument();
      expect(screen.getByText(/Size/)).toBeInTheDocument();
      expect(screen.getByText(/Realtime/)).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });
});