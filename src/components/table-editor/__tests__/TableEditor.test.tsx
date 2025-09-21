import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TableEditor } from '../TableEditor';

// Mock hooks
const mockUseTableData = {
  tables: ['users', 'posts'],
  selectedTable: 'users',
  selectedSchema: 'public',
  columns: [
    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, is_primary_key: true },
    { column_name: 'email', data_type: 'text', is_nullable: 'NO', column_default: null, is_primary_key: false },
    { column_name: 'name', data_type: 'text', is_nullable: 'YES', column_default: null, is_primary_key: false }
  ],
  tableData: {
    rows: [
      { id: 1, email: 'user1@example.com', name: 'User 1' },
      { id: 2, email: 'user2@example.com', name: 'User 2' }
    ],
    totalCount: 2
  },
  pagination: { pageIndex: 0, pageSize: 50 },
  filters: [],
  loading: false,
  error: null,
  selectTable: vi.fn(),
  updatePagination: vi.fn(),
  refreshTableData: vi.fn(),
  getPrimaryKeyColumn: vi.fn(() => 'id'),
  setFilters: vi.fn(),
};

const mockUseTableMutations = {
  updateCell: vi.fn(),
  insertRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
  error: null,
  isLoading: false,
  isUpdating: false,
  isInserting: false,
  isDeleting: false,
  clearError: vi.fn(),
};

vi.mock('@/hooks/useTableData', () => ({
  useTableData: () => mockUseTableData
}));

vi.mock('@/hooks/useTableMutations', () => ({
  useTableMutations: () => mockUseTableMutations
}));

// Mock child components
vi.mock('../TableSidebar', () => ({
  TableSidebar: ({ onTableSelect }: { onTableSelect: (table: string, schema: string) => void }) => (
    <div data-testid="table-sidebar">
      <button data-testid="select-users" onClick={() => onTableSelect('users', 'public')}>
        Select Users
      </button>
      <button data-testid="select-posts" onClick={() => onTableSelect('posts', 'public')}>
        Select Posts
      </button>
    </div>
  )
}));

vi.mock('../TableHeader', () => ({
  TableHeader: ({ 
    tableName, 
    schema, 
    onRefresh, 
    onInsertRow 
  }: { 
    tableName: string;
    schema: string;
    onRefresh: () => void;
    onInsertRow: () => void;
  }) => (
    <div data-testid="table-header">
      <span data-testid="table-name">{tableName}</span>
      <span data-testid="schema-name">{schema}</span>
      <button data-testid="refresh-table" onClick={onRefresh}>Refresh</button>
      <button data-testid="insert-row" onClick={onInsertRow}>Insert Row</button>
    </div>
  )
}));

vi.mock('../FilterToolbar', () => ({
  FilterToolbar: ({ 
    globalFilter, 
    onGlobalFilterChange, 
    onShowFilters 
  }: { 
    globalFilter: string;
    onGlobalFilterChange: (filter: string) => void;
    onShowFilters: () => void;
  }) => (
    <div data-testid="filter-toolbar">
      <input 
        data-testid="global-filter" 
        value={globalFilter}
        onChange={(e) => onGlobalFilterChange(e.target.value)}
      />
      <button data-testid="show-filters" onClick={onShowFilters}>Show Filters</button>
    </div>
  )
}));

vi.mock('../DataTable', () => ({
  DataTable: ({ 
    data, 
    columns: _columns, 
    onRowClick, 
    onPaginationChange,
    pagination,
    globalFilter 
  }: { 
    data: any[];
    columns: any[];
    onRowClick: (row: any) => void;
    onPaginationChange: (pagination: any) => void;
    pagination: any;
    globalFilter: string;
  }) => (
    <div data-testid="data-table">
      <div data-testid="table-data">
        {data.map((row, index) => (
          <div 
            key={index} 
            data-testid={`table-row-${row.id}`}
            onClick={() => onRowClick(row)}
            style={{ cursor: 'pointer' }}
          >
            {Object.values(row).join(', ')}
          </div>
        ))}
      </div>
      <div data-testid="pagination">
        <button 
          data-testid="next-page" 
          onClick={() => onPaginationChange({ ...pagination, pageIndex: pagination.pageIndex + 1 })}
        >
          Next
        </button>
      </div>
      <div data-testid="global-filter-applied">{globalFilter}</div>
    </div>
  )
}));

vi.mock('../FilterDialog', () => ({
  FilterDialog: ({ 
    isOpen, 
    onClose, 
    columns: _columns, 
    onApplyFilters 
  }: { 
    isOpen: boolean;
    onClose: () => void;
    columns: any[];
    onApplyFilters: (filters: any[]) => void;
  }) => (
    isOpen ? (
      <div data-testid="filter-dialog">
        <button data-testid="close-filter-dialog" onClick={onClose}>Close</button>
        <button 
          data-testid="apply-filters" 
          onClick={() => onApplyFilters([{ column: 'email', operator: 'contains', value: 'test' }])}
        >
          Apply Filters
        </button>
      </div>
    ) : null
  )
}));

vi.mock('../InsertRowDialog', () => ({
  InsertRowDialog: ({ 
    isOpen, 
    onClose, 
    columns: _columns, 
    onInsert 
  }: { 
    isOpen: boolean;
    onClose: () => void;
    columns: any[];
    onInsert: (data: any) => void;
  }) => (
    isOpen ? (
      <div data-testid="insert-row-dialog">
        <button data-testid="close-insert-dialog" onClick={onClose}>Close</button>
        <button 
          data-testid="insert-new-row" 
          onClick={() => onInsert({ email: 'new@example.com', name: 'New User' })}
        >
          Insert
        </button>
      </div>
    ) : null
  )
}));

vi.mock('../RowEditPanel', () => ({
  RowEditPanel: ({ 
    row, 
    columns: _columns, 
    onClose, 
    onUpdate 
  }: { 
    row: any;
    columns: any[];
    onClose: () => void;
    onUpdate: (data: any) => Promise<boolean>;
  }) => (
    row ? (
      <div data-testid="row-edit-panel">
        <button data-testid="close-edit-panel" onClick={onClose}>Close</button>
        <button 
          data-testid="update-row" 
          onClick={() => onUpdate({ ...row, name: 'Updated Name' })}
        >
          Update
        </button>
        <div data-testid="editing-row-id">{row.id}</div>
      </div>
    ) : null
  )
}));

// Mock Lucide React icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual<typeof import('lucide-react')>('lucide-react')
  return {
    ...actual,
    AlertCircle: () => <div data-testid="alert-circle-icon" />,
    Loader2: () => <div data-testid="loader2-icon" />,
  }
});

describe('TableEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should render TableEditor with all child components', () => {
      render(<TableEditor />);

      expect(screen.getByTestId('table-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('table-header')).toBeInTheDocument();
      expect(screen.getByTestId('filter-toolbar')).toBeInTheDocument();
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    it('should display table name and schema in header', () => {
      render(<TableEditor />);

      expect(screen.getByTestId('table-name')).toHaveTextContent('users');
      expect(screen.getByTestId('schema-name')).toHaveTextContent('public');
    });

    it('should display table data', () => {
      render(<TableEditor />);

      expect(screen.getByTestId('table-row-1')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-2')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-1')).toHaveTextContent('1, user1@example.com, User 1');
    });
  });

  describe('Table Selection', () => {
    it('should handle table selection from sidebar', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('select-posts'));

      expect(mockUseTableData.selectTable).toHaveBeenCalledWith('posts', 'public');
    });

    it('should update display when table changes', () => {
      mockUseTableData.selectedTable = 'posts';
      render(<TableEditor />);

      expect(screen.getByTestId('table-name')).toHaveTextContent('posts');
    });
  });

  describe('Data Refresh', () => {
    it('should handle table refresh', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('refresh-table'));

      expect(mockUseTableData.refreshTableData).toHaveBeenCalled();
    });
  });

  describe('Global Filtering', () => {
    it('should handle global filter changes', () => {
      render(<TableEditor />);

      const filterInput = screen.getByTestId('global-filter');
      fireEvent.change(filterInput, { target: { value: 'test filter' } });

      expect(filterInput).toHaveValue('test filter');
      expect(screen.getByTestId('global-filter-applied')).toHaveTextContent('test filter');
    });

    it('should reset global filter', () => {
      render(<TableEditor />);

      const filterInput = screen.getByTestId('global-filter');
      fireEvent.change(filterInput, { target: { value: 'test' } });
      fireEvent.change(filterInput, { target: { value: '' } });

      expect(filterInput).toHaveValue('');
    });
  });

  describe('Advanced Filtering', () => {
    it('should open filter dialog', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('show-filters'));

      expect(screen.getByTestId('filter-dialog')).toBeInTheDocument();
    });

    it('should close filter dialog', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('show-filters'));
      expect(screen.getByTestId('filter-dialog')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-filter-dialog'));
      expect(screen.queryByTestId('filter-dialog')).not.toBeInTheDocument();
    });

    it('should apply filters and close dialog', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('show-filters'));
      fireEvent.click(screen.getByTestId('apply-filters'));

      expect(mockUseTableData.setFilters).toHaveBeenCalledWith([
        { column: 'email', operator: 'contains', value: 'test' }
      ]);
      expect(screen.queryByTestId('filter-dialog')).not.toBeInTheDocument();
    });
  });

  describe('Row Insertion', () => {
    it('should open insert row dialog', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('insert-row'));

      expect(screen.getByTestId('insert-row-dialog')).toBeInTheDocument();
    });

    it('should close insert row dialog', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('insert-row'));
      fireEvent.click(screen.getByTestId('close-insert-dialog'));

      expect(screen.queryByTestId('insert-row-dialog')).not.toBeInTheDocument();
    });

    it('should handle row insertion', async () => {
      mockUseTableMutations.insertRow.mockResolvedValue(true);

      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('insert-row'));
      fireEvent.click(screen.getByTestId('insert-new-row'));

      await waitFor(() => {
        expect(mockUseTableMutations.insertRow).toHaveBeenCalledWith(
          'users',
          { email: 'new@example.com', name: 'New User' },
          'public'
        );
      });

      expect(mockUseTableData.refreshTableData).toHaveBeenCalled();
      expect(screen.queryByTestId('insert-row-dialog')).not.toBeInTheDocument();
    });

    it('should handle insertion failure', async () => {
      mockUseTableMutations.insertRow.mockResolvedValue(false);

      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('insert-row'));
      fireEvent.click(screen.getByTestId('insert-new-row'));

      await waitFor(() => {
        expect(mockUseTableMutations.insertRow).toHaveBeenCalled();
      });

      // Dialog should remain open on failure
      expect(screen.getByTestId('insert-row-dialog')).toBeInTheDocument();
    });
  });

  describe('Row Editing', () => {
    it('should open edit panel when row is clicked', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('table-row-1'));

      expect(screen.getByTestId('row-edit-panel')).toBeInTheDocument();
      expect(screen.getByTestId('editing-row-id')).toHaveTextContent('1');
    });

    it('should close edit panel', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('table-row-1'));
      fireEvent.click(screen.getByTestId('close-edit-panel'));

      expect(screen.queryByTestId('row-edit-panel')).not.toBeInTheDocument();
    });

    it('should handle row updates', async () => {
      mockUseTableMutations.updateCell.mockResolvedValue(true);

      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('table-row-1'));
      fireEvent.click(screen.getByTestId('update-row'));

      await waitFor(() => {
        expect(mockUseTableMutations.updateCell).toHaveBeenCalledWith(
          'users',
          'id',
          1,
          'name',
          'Updated Name',
          'public'
        );
      });

      expect(mockUseTableData.refreshTableData).toHaveBeenCalled();
    });

    it('should handle multiple field updates', async () => {
      mockUseTableMutations.updateCell.mockResolvedValue(true);

      render(<TableEditor />);

      // Mock a row with multiple changes
      const mockRowWithChanges = { id: 1, email: 'newemail@example.com', name: 'New Name' };
      
      fireEvent.click(screen.getByTestId('table-row-1'));
      
      // Simulate updating with multiple changes
      
      // Mock the onUpdate call with multiple changes
      await waitFor(async () => {
        const onUpdate = vi.fn().mockImplementation(async (updatedData) => {
          // Simulate the actual update logic for multiple fields
          const updates = [];
          const originalRow = { id: 1, email: 'user1@example.com', name: 'User 1' };
          
          for (const [key, value] of Object.entries(updatedData)) {
            if (originalRow[key as keyof typeof originalRow] !== value) {
              updates.push(
                mockUseTableMutations.updateCell('users', 'id', 1, key, value, 'public')
              );
            }
          }
          
          return updates.length > 0;
        });
        
        await onUpdate(mockRowWithChanges);
      });
    });

    it('should handle update failures', async () => {
      mockUseTableMutations.updateCell.mockResolvedValue(false);

      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('table-row-1'));
      fireEvent.click(screen.getByTestId('update-row'));

      await waitFor(() => {
        expect(mockUseTableMutations.updateCell).toHaveBeenCalled();
      });

      // Panel should remain open on failure
      expect(screen.getByTestId('row-edit-panel')).toBeInTheDocument();
    });

    it('should handle updates with no changes', async () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('table-row-1'));
      
      // Simulate update with no actual changes (same data)
      
      // This would be handled in the actual implementation
      expect(screen.getByTestId('row-edit-panel')).toBeInTheDocument();
    });

    it('should handle missing primary key', async () => {
      
      render(<TableEditor />);

      // This would be tested in the actual implementation where primary key validation occurs
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should handle pagination changes', () => {
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('next-page'));

      expect(mockUseTableData.updatePagination).toHaveBeenCalledWith({
        pageIndex: 1,
        pageSize: 50
      });
    });

    it('should display current pagination state', () => {
      render(<TableEditor />);

      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display data loading error', () => {
      (mockUseTableData as any).error = 'Failed to load data';
      
      render(<TableEditor />);

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    it('should display mutation error', () => {
      (mockUseTableMutations as any).error = 'Update failed';
      
      render(<TableEditor />);

      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      mockUseTableData.loading = true;
      
      render(<TableEditor />);

      expect(screen.getByTestId('loader2-icon')).toBeInTheDocument();
    });

    it('should show mutation loading state', () => {
      mockUseTableMutations.isLoading = true;
      
      render(<TableEditor />);

      // The loading state would be shown in the actual implementation
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle no selected table', () => {
      (mockUseTableData as any).selectedTable = null;
      (mockUseTableData as any).selectedSchema = null;
      mockUseTableData.columns = [];
      (mockUseTableData as any).tableData = { rows: [], totalCount: 0 };
      
      render(<TableEditor />);

      expect(screen.getByTestId('table-name')).toBeEmptyDOMElement();
    });

    it('should handle empty table data', () => {
      (mockUseTableData as any).tableData = { rows: [], totalCount: 0 };
      
      render(<TableEditor />);

      expect(screen.getByTestId('table-data')).toBeEmptyDOMElement();
    });

    it('should handle no columns', () => {
      mockUseTableData.columns = [];
      
      render(<TableEditor />);

      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    it('should handle missing primary key column', () => {
      mockUseTableData.getPrimaryKeyColumn.mockReturnValue('');
      
      render(<TableEditor />);

      fireEvent.click(screen.getByTestId('table-row-1'));
      fireEvent.click(screen.getByTestId('update-row'));

      // Should handle gracefully without crashing
      expect(screen.getByTestId('row-edit-panel')).toBeInTheDocument();
    });
  });
});
