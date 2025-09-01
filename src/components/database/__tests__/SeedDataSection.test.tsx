import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeedDataSection } from '../SeedDataSection';
import { useDatabase } from '@/hooks/useDatabase';

// Mock the useDatabase hook
vi.mock('@/hooks/useDatabase');
const mockUseDatabase = vi.mocked(useDatabase);

// Mock the Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn()
  }
}));

describe('SeedDataSection Component', () => {
  const mockExecuteQuery = vi.fn();
  const mockExecuteScript = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDatabase.mockReturnValue({
      executeQuery: mockExecuteQuery,
      executeScript: mockExecuteScript,
      isConnected: true,
      connectionInfo: { database: 'test_db' },
      error: null
    } as any);
  });

  describe('Rendering', () => {
    it('should render seed data section with title and description', () => {
      render(<SeedDataSection />);
      
      expect(screen.getByText('Sample Data')).toBeInTheDocument();
      expect(screen.getByText(/Populate your database with sample data/)).toBeInTheDocument();
    });

    it('should render all sample data options', () => {
      render(<SeedDataSection />);
      
      // Check for sample data buttons
      expect(screen.getByText('E-commerce')).toBeInTheDocument();
      expect(screen.getByText('Blog Posts')).toBeInTheDocument();
      expect(screen.getByText('User Profiles')).toBeInTheDocument();
      expect(screen.getByText('Todo List')).toBeInTheDocument();
    });

    it('should render custom SQL textarea', () => {
      render(<SeedDataSection />);
      
      expect(screen.getByPlaceholderText(/INSERT INTO/)).toBeInTheDocument();
      expect(screen.getByText('Run Custom SQL')).toBeInTheDocument();
    });

    it('should show clear data section', () => {
      render(<SeedDataSection />);
      
      expect(screen.getByText('Clear Data')).toBeInTheDocument();
      expect(screen.getByText('Clear All Tables')).toBeInTheDocument();
    });
  });

  describe('Sample Data Loading', () => {
    it('should load e-commerce sample data', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockResolvedValue({ success: true });
      
      render(<SeedDataSection />);
      
      const ecommerceButton = screen.getByText('E-commerce');
      await user.click(ecommerceButton);
      
      await waitFor(() => {
        expect(mockExecuteScript).toHaveBeenCalled();
      });
    });

    it('should load blog posts sample data', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockResolvedValue({ success: true });
      
      render(<SeedDataSection />);
      
      const blogButton = screen.getByText('Blog Posts');
      await user.click(blogButton);
      
      await waitFor(() => {
        expect(mockExecuteScript).toHaveBeenCalled();
      });
    });

    it('should handle sample data loading errors', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockRejectedValue(new Error('Failed to load sample data'));
      
      render(<SeedDataSection />);
      
      const ecommerceButton = screen.getByText('E-commerce');
      await user.click(ecommerceButton);
      
      await waitFor(() => {
        expect(mockExecuteScript).toHaveBeenCalled();
      });
    });

    it('should disable buttons while loading', async () => {
      const user = userEvent.setup();
      // Mock a delayed response
      mockExecuteScript.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<SeedDataSection />);
      
      const ecommerceButton = screen.getByText('E-commerce');
      await user.click(ecommerceButton);
      
      // Button should be disabled during loading
      expect(ecommerceButton).toBeDisabled();
    });
  });

  describe('Custom SQL Execution', () => {
    it('should execute custom SQL', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockResolvedValue({ success: true });
      
      render(<SeedDataSection />);
      
      const textarea = screen.getByPlaceholderText(/INSERT INTO/);
      const runButton = screen.getByText('Run Custom SQL');
      
      await user.type(textarea, 'INSERT INTO users (name) VALUES (\'Test User\');');
      await user.click(runButton);
      
      await waitFor(() => {
        expect(mockExecuteScript).toHaveBeenCalledWith('INSERT INTO users (name) VALUES (\'Test User\');');
      });
    });

    it('should not execute empty SQL', async () => {
      const user = userEvent.setup();
      
      render(<SeedDataSection />);
      
      const runButton = screen.getByText('Run Custom SQL');
      await user.click(runButton);
      
      expect(mockExecuteScript).not.toHaveBeenCalled();
    });

    it('should handle SQL execution errors', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockRejectedValue(new Error('SQL syntax error'));
      
      render(<SeedDataSection />);
      
      const textarea = screen.getByPlaceholderText(/INSERT INTO/);
      const runButton = screen.getByText('Run Custom SQL');
      
      await user.type(textarea, 'INVALID SQL;');
      await user.click(runButton);
      
      await waitFor(() => {
        expect(mockExecuteScript).toHaveBeenCalledWith('INVALID SQL;');
      });
    });

    it('should clear textarea after successful execution', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockResolvedValue({ success: true });
      
      render(<SeedDataSection />);
      
      const textarea = screen.getByPlaceholderText(/INSERT INTO/);
      const runButton = screen.getByText('Run Custom SQL');
      
      await user.type(textarea, 'INSERT INTO test VALUES (1);');
      await user.click(runButton);
      
      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });

  describe('Clear Data Functionality', () => {
    it('should clear all tables', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockResolvedValue({ success: true });
      
      render(<SeedDataSection />);
      
      const clearButton = screen.getByText('Clear All Tables');
      await user.click(clearButton);
      
      await waitFor(() => {
        expect(mockExecuteScript).toHaveBeenCalled();
      });
    });

    it('should handle clear data errors', async () => {
      const user = userEvent.setup();
      mockExecuteScript.mockRejectedValue(new Error('Failed to clear data'));
      
      render(<SeedDataSection />);
      
      const clearButton = screen.getByText('Clear All Tables');
      await user.click(clearButton);
      
      await waitFor(() => {
        expect(mockExecuteScript).toHaveBeenCalled();
      });
    });
  });

  describe('Database Connection States', () => {
    it('should disable actions when database is not connected', () => {
      mockUseDatabase.mockReturnValue({
        executeQuery: mockExecuteQuery,
        executeScript: mockExecuteScript,
        isConnected: false,
        connectionInfo: null,
        error: null
      } as any);
      
      render(<SeedDataSection />);
      
      expect(screen.getByText('E-commerce')).toBeDisabled();
      expect(screen.getByText('Blog Posts')).toBeDisabled();
      expect(screen.getByText('Run Custom SQL')).toBeDisabled();
      expect(screen.getByText('Clear All Tables')).toBeDisabled();
    });

    it('should show error state when database has error', () => {
      mockUseDatabase.mockReturnValue({
        executeQuery: mockExecuteQuery,
        executeScript: mockExecuteScript,
        isConnected: false,
        connectionInfo: null,
        error: 'Connection failed'
      } as any);
      
      render(<SeedDataSection />);
      
      // Should disable all actions when there's an error
      expect(screen.getByText('E-commerce')).toBeDisabled();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during operations', async () => {
      const user = userEvent.setup();
      // Create a promise that we can control
      let resolvePromise: (value: any) => void;
      const controlledPromise = new Promise(resolve => { resolvePromise = resolve; });
      mockExecuteScript.mockReturnValue(controlledPromise);
      
      render(<SeedDataSection />);
      
      const ecommerceButton = screen.getByText('E-commerce');
      await user.click(ecommerceButton);
      
      // Should show loading state
      expect(ecommerceButton).toBeDisabled();
      
      // Resolve the promise
      resolvePromise!({ success: true });
      
      await waitFor(() => {
        expect(ecommerceButton).not.toBeDisabled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<SeedDataSection />);
      
      // Check for proper heading structure
      const heading = screen.getByRole('heading', { name: 'Sample Data' });
      expect(heading).toBeInTheDocument();
      
      // Check for proper button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Check textarea accessibility
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<SeedDataSection />);
      
      // Tab through buttons
      await user.tab();
      expect(screen.getByText('E-commerce')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Blog Posts')).toHaveFocus();
    });
  });
});