import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from '@/App';
import { DatabaseManager } from '@/lib/database/connection';
import { ProjectManager } from '@/lib/projects/ProjectManager';

// Mock external dependencies
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn()
  }
}));

describe('Table Management Workflow Integration', () => {
  const mockExecuteQuery = vi.fn();
  const mockExecuteScript = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock DatabaseManager
    const mockDbInstance = {
      executeQuery: mockExecuteQuery,
      executeScript: mockExecuteScript,
      initialize: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      getConnectionInfo: vi.fn().mockReturnValue({ database: 'test' }),
      getDatabaseSize: vi.fn().mockResolvedValue('1.2 MB'),
      getTableList: vi.fn().mockResolvedValue([
        { table_name: 'users', table_schema: 'public' },
        { table_name: 'posts', table_schema: 'public' }
      ])
    };

    vi.spyOn(DatabaseManager, 'getInstance').mockReturnValue(mockDbInstance as any);
    
    // Mock ProjectManager
    const mockProjectManager = {
      getCurrentProject: vi.fn().mockReturnValue({
        id: 'test-project',
        name: 'Test Project',
        createdAt: new Date()
      }),
      getAllProjects: vi.fn().mockReturnValue([]),
      createProject: vi.fn(),
      switchToProject: vi.fn()
    };
    vi.spyOn(ProjectManager, 'getInstance').mockReturnValue(mockProjectManager as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Table Management Workflow', () => {
    it('should complete create → view → edit → delete table workflow', async () => {
      const user = userEvent.setup();
      
      // Mock responses for different operations
      mockExecuteQuery
        // Initial table list
        .mockResolvedValueOnce({
          rows: [
            { table_name: 'users', table_schema: 'public' }
          ]
        })
        // Create table
        .mockResolvedValueOnce({ rows: [], success: true })
        // Fetch new table list after creation
        .mockResolvedValueOnce({
          rows: [
            { table_name: 'users', table_schema: 'public' },
            { table_name: 'products', table_schema: 'public' }
          ]
        })
        // Fetch table structure
        .mockResolvedValueOnce({
          rows: [
            {
              column_name: 'id',
              data_type: 'integer',
              is_nullable: 'NO',
              column_default: 'nextval(...)'
            },
            {
              column_name: 'name',
              data_type: 'character varying',
              is_nullable: 'YES',
              column_default: null
            }
          ]
        })
        // Fetch table data
        .mockResolvedValueOnce({
          rows: [],
          totalCount: 0
        })
        // Insert new row
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test Product' }],
          success: true
        })
        // Fetch updated data
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Test Product' }],
          totalCount: 1
        })
        // Update row
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Updated Product' }],
          success: true
        })
        // Delete row
        .mockResolvedValueOnce({
          rows: [],
          success: true
        })
        // Final table list after deletion
        .mockResolvedValueOnce({
          rows: [
            { table_name: 'users', table_schema: 'public' }
          ]
        });

      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Database')).toBeInTheDocument();
      });

      // Step 1: Navigate to Database section
      const databaseNav = screen.getByText('Database');
      await user.click(databaseNav);

      // Step 2: Create new table
      await waitFor(() => {
        expect(screen.getByText('Tables')).toBeInTheDocument();
      });

      const createTableButton = screen.getByText('Create Table');
      await user.click(createTableButton);

      // Fill in table details
      const tableNameInput = screen.getByPlaceholderText('Enter table name');
      await user.type(tableNameInput, 'products');

      // Add columns
      const addColumnButton = screen.getByText('Add Column');
      await user.click(addColumnButton);

      const columnNameInput = screen.getByPlaceholderText('Column name');
      await user.type(columnNameInput, 'name');

      const columnTypeSelect = screen.getByDisplayValue('text');
      await user.click(columnTypeSelect);
      await user.click(screen.getByText('varchar'));

      // Create the table
      const createButton = screen.getByText('Create');
      await user.click(createButton);

      // Step 3: Verify table was created and navigate to it
      await waitFor(() => {
        expect(mockExecuteQuery).toHaveBeenCalledWith(
          expect.stringContaining('CREATE TABLE products')
        );
      });

      // Click on the new table to view its data
      await waitFor(() => {
        expect(screen.getByText('products')).toBeInTheDocument();
      });

      const productsTable = screen.getByText('products');
      await user.click(productsTable);

      // Step 4: Add data to the table
      await waitFor(() => {
        expect(screen.getByText('Insert Row')).toBeInTheDocument();
      });

      const insertButton = screen.getByText('Insert Row');
      await user.click(insertButton);

      // Fill in row data
      const nameField = screen.getByLabelText('name');
      await user.type(nameField, 'Test Product');

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Step 5: Edit the data
      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      const editButton = screen.getByLabelText('Edit row');
      await user.click(editButton);

      const editNameField = screen.getByDisplayValue('Test Product');
      await user.clear(editNameField);
      await user.type(editNameField, 'Updated Product');

      const updateButton = screen.getByText('Update');
      await user.click(updateButton);

      // Step 6: Delete the row
      await waitFor(() => {
        expect(screen.getByText('Updated Product')).toBeInTheDocument();
      });

      const deleteButton = screen.getByLabelText('Delete row');
      await user.click(deleteButton);

      const confirmDelete = screen.getByText('Delete');
      await user.click(confirmDelete);

      // Step 7: Delete the entire table
      const tableOptionsButton = screen.getByLabelText('Table options');
      await user.click(tableOptionsButton);

      const dropTableOption = screen.getByText('Drop Table');
      await user.click(dropTableOption);

      const confirmDropTable = screen.getByText('Drop Table');
      await user.click(confirmDropTable);

      // Verify the workflow completed successfully
      await waitFor(() => {
        // Should no longer see the products table
        expect(screen.queryByText('products')).not.toBeInTheDocument();
      });

      // Verify all database operations were called
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE TABLE products')
      );
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO products')
      );
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE products')
      );
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM products')
      );
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE products')
      );
    });

    it('should handle errors gracefully during workflow', async () => {
      const user = userEvent.setup();
      
      // Mock error responses
      mockExecuteQuery
        .mockResolvedValueOnce({
          rows: [{ table_name: 'users', table_schema: 'public' }]
        })
        .mockRejectedValueOnce(new Error('Table creation failed'));

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Database')).toBeInTheDocument();
      });

      const databaseNav = screen.getByText('Database');
      await user.click(databaseNav);

      // Attempt to create a table that will fail
      const createTableButton = screen.getByText('Create Table');
      await user.click(createTableButton);

      const tableNameInput = screen.getByPlaceholderText('Enter table name');
      await user.type(tableNameInput, 'invalid_table');

      const createButton = screen.getByText('Create');
      await user.click(createButton);

      // Should show error message
      await waitFor(() => {
        // Error handling should prevent crash and show error message
        expect(screen.queryByText('Table creation failed')).not.toBeNull();
      }, { timeout: 3000 });
    });
  });

  describe('Table Editor Integration', () => {
    it('should handle bulk operations', async () => {
      const user = userEvent.setup();
      
      mockExecuteQuery
        .mockResolvedValueOnce({
          rows: [{ table_name: 'users', table_schema: 'public' }]
        })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'User 1', email: 'user1@test.com' },
            { id: 2, name: 'User 2', email: 'user2@test.com' },
            { id: 3, name: 'User 3', email: 'user3@test.com' }
          ],
          totalCount: 3
        })
        .mockResolvedValueOnce({ success: true });

      render(<App />);

      // Navigate to table editor
      const databaseNav = screen.getByText('Database');
      await user.click(databaseNav);

      const usersTable = screen.getByText('users');
      await user.click(usersTable);

      // Select multiple rows
      await waitFor(() => {
        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes.length).toBeGreaterThan(0);
      });

      const selectAllCheckbox = screen.getByLabelText('Select all');
      await user.click(selectAllCheckbox);

      // Perform bulk delete
      const bulkDeleteButton = screen.getByText('Delete Selected');
      await user.click(bulkDeleteButton);

      const confirmBulkDelete = screen.getByText('Delete');
      await user.click(confirmBulkDelete);

      await waitFor(() => {
        expect(mockExecuteQuery).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM users WHERE id IN')
        );
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh data after operations', async () => {
      const user = userEvent.setup();
      
      mockExecuteQuery
        .mockResolvedValueOnce({
          rows: [{ table_name: 'posts', table_schema: 'public' }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Post 1' }],
          totalCount: 1
        })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, title: 'Post 1' },
            { id: 2, title: 'New Post' }
          ],
          totalCount: 2
        });

      render(<App />);

      const databaseNav = screen.getByText('Database');
      await user.click(databaseNav);

      const postsTable = screen.getByText('posts');
      await user.click(postsTable);

      await waitFor(() => {
        expect(screen.getByText('Post 1')).toBeInTheDocument();
      });

      // Add new row
      const insertButton = screen.getByText('Insert Row');
      await user.click(insertButton);

      const titleField = screen.getByLabelText('title');
      await user.type(titleField, 'New Post');

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Should automatically refresh and show new data
      await waitFor(() => {
        expect(screen.getByText('New Post')).toBeInTheDocument();
        expect(mockExecuteQuery).toHaveBeenCalledTimes(4); // Initial load + insert + refresh
      });
    });
  });
});