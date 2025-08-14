import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SQLEditor } from '../SQLEditor'

// Mock the hooks
const mockExecuteQuery = vi.fn()
const mockAddToHistory = vi.fn()

const mockUseDatabase = vi.fn(() => ({
  executeQuery: mockExecuteQuery,
}))

const mockUseQueryHistory = vi.fn(() => ({
  history: [],
  addToHistory: mockAddToHistory,
}))

vi.mock('@/hooks/useDatabase', () => ({
  useDatabase: () => mockUseDatabase(),
  useQueryHistory: () => mockUseQueryHistory(),
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="play-icon" />,
  Save: () => <div data-testid="save-icon" />,
  History: () => <div data-testid="history-icon" />,
}))

describe('SQLEditor', () => {
  const user = userEvent.setup()
  
  // Mock clipboard API in beforeEach to avoid conflicts
  const mockWriteText = vi.fn()
  
  beforeAll(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseDatabase.mockReturnValue({
      executeQuery: mockExecuteQuery,
    })
    mockUseQueryHistory.mockReturnValue({
      history: [],
      addToHistory: mockAddToHistory,
    })
  })

  describe('Initial Render', () => {
    it('should render the SQL Editor interface', () => {
      render(<SQLEditor />)
      
      expect(screen.getByText('SQL Editor')).toBeInTheDocument()
      expect(screen.getByText('Write and execute SQL queries against your local database')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
      expect(screen.getByText('Query History')).toBeInTheDocument()
    })

    it('should display initial query in textarea', () => {
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const value = textarea.getAttribute('value') || (textarea as HTMLTextAreaElement).value
      expect(value).toContain('-- Welcome to Supabase Lite SQL Editor')
      expect(value).toContain('SELECT table_name, table_schema')
    })

    it('should render run button with correct initial state', () => {
      render(<SQLEditor />)
      
      const runButton = screen.getByRole('button', { name: /run/i })
      expect(runButton).not.toBeDisabled()
      expect(runButton).toHaveTextContent('Run')
    })

    it('should show empty results message initially', () => {
      render(<SQLEditor />)
      
      expect(screen.getByText('Run a query to see results')).toBeInTheDocument()
    })
  })

  describe('Query Input', () => {
    it('should update query when typing in textarea', async () => {
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      await user.clear(textarea)
      await user.type(textarea, 'SELECT 1 as test')
      
      expect(textarea).toHaveValue('SELECT 1 as test')
    })

    it('should disable run button when query is empty', async () => {
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      
      expect(runButton).toBeDisabled()
    })

    it('should enable run button when query has content', async () => {
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT 1')
      
      expect(runButton).not.toBeDisabled()
    })
  })

  describe('Query Execution', () => {
    it('should execute query successfully and display results', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }, { id: 2, name: 'test2' }],
        fields: [{ name: 'id' }, { name: 'name' }],
        rowCount: 2,
        command: 'SELECT',
        duration: 15.5,
      }
      mockExecuteQuery.mockResolvedValue(mockResult)
      
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT * FROM users')
      await user.click(runButton)
      
      await waitFor(() => {
        expect(mockExecuteQuery).toHaveBeenCalledWith('SELECT * FROM users')
      })
      
      await waitFor(() => {
        expect(screen.getByText('Results')).toBeInTheDocument()
        expect(screen.getByText('2 rows')).toBeInTheDocument()
        expect(screen.getByText('15.5ms')).toBeInTheDocument()
        expect(screen.getByText('id')).toBeInTheDocument()
        expect(screen.getByText('name')).toBeInTheDocument()
        expect(screen.getByText('test')).toBeInTheDocument()
        expect(screen.getByText('test2')).toBeInTheDocument()
      })
      
      expect(mockAddToHistory).toHaveBeenCalledWith('SELECT * FROM users', 15.5, true)
    })

    it('should handle query execution errors', async () => {
      const mockError = { message: 'Syntax error near SELECT' }
      mockExecuteQuery.mockRejectedValue(mockError)
      
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'INVALID SQL')
      await user.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('Query Error')).toBeInTheDocument()
        expect(screen.getByText('Syntax error near SELECT')).toBeInTheDocument()
      })
      
      expect(mockAddToHistory).toHaveBeenCalledWith(
        'INVALID SQL',
        expect.any(Number),
        false,
        'Syntax error near SELECT'
      )
    })

    it('should show loading state during query execution', async () => {
      let resolveQuery: (value: any) => void
      const queryPromise = new Promise(resolve => {
        resolveQuery = resolve
      })
      mockExecuteQuery.mockReturnValue(queryPromise)
      
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT 1')
      await user.click(runButton)
      
      expect(runButton).toHaveTextContent('Running...')
      expect(runButton).toBeDisabled()
      
      // Resolve the query
      resolveQuery!({
        rows: [],
        fields: [],
        rowCount: 0,
        command: 'SELECT',
        duration: 10,
      })
      
      await waitFor(() => {
        expect(runButton).toHaveTextContent('Run')
        expect(runButton).not.toBeDisabled()
      })
    })

    it('should not execute empty or whitespace-only queries', async () => {
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, '   \n  \t  ')
      await user.click(runButton)
      
      expect(mockExecuteQuery).not.toHaveBeenCalled()
    })
  })

  describe('Query Results Display', () => {
    it('should display table with headers and data', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'John' }],
        fields: [{ name: 'id' }, { name: 'name' }],
        rowCount: 1,
        command: 'SELECT',
        duration: 10,
      }
      mockExecuteQuery.mockResolvedValue(mockResult)
      
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT * FROM users')
      await user.click(runButton)
      
      await waitFor(() => {
        const table = screen.getByRole('table')
        expect(table).toBeInTheDocument()
        
        // Check headers
        expect(screen.getByRole('columnheader', { name: 'id' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'name' })).toBeInTheDocument()
        
        // Check data
        expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument()
        expect(screen.getByRole('cell', { name: 'John' })).toBeInTheDocument()
      })
    })

    it('should display empty results message for queries with no rows', async () => {
      const mockResult = {
        rows: [],
        fields: [{ name: 'id' }],
        rowCount: 0,
        command: 'SELECT',
        duration: 5,
      }
      mockExecuteQuery.mockResolvedValue(mockResult)
      
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT * FROM empty_table')
      await user.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('Query executed successfully but returned no rows.')).toBeInTheDocument()
      })
    })

    it('should format NULL values correctly', async () => {
      const mockResult = {
        rows: [{ id: 1, name: null }],
        fields: [{ name: 'id' }, { name: 'name' }],
        rowCount: 1,
        command: 'SELECT',
        duration: 10,
      }
      mockExecuteQuery.mockResolvedValue(mockResult)
      
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT * FROM users')
      await user.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('NULL')).toBeInTheDocument()
      })
    })

    it('should format object values as JSON', async () => {
      const mockResult = {
        rows: [{ id: 1, metadata: { key: 'value', nested: { data: 123 } } }],
        fields: [{ name: 'id' }, { name: 'metadata' }],
        rowCount: 1,
        command: 'SELECT',
        duration: 10,
      }
      mockExecuteQuery.mockResolvedValue(mockResult)
      
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT * FROM users')
      await user.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('{"key":"value","nested":{"data":123}}')).toBeInTheDocument()
      })
    })
  })

  describe('Save Query', () => {
    it('should copy query to clipboard when save is clicked', async () => {
      render(<SQLEditor />)
      
      const textarea = screen.getByRole('textbox')
      const saveButton = screen.getByRole('button', { name: /save/i })
      
      await user.clear(textarea)
      await user.type(textarea, 'SELECT 1 as test')
      await user.click(saveButton)
      
      expect(mockWriteText).toHaveBeenCalledWith('SELECT 1 as test')
    })
  })

  describe('Query History Panel', () => {
    it('should display empty history message when no queries', () => {
      render(<SQLEditor />)
      
      expect(screen.getByText('No queries executed yet')).toBeInTheDocument()
    })

    it('should display query history items', () => {
      const mockHistory = [
        {
          id: '1',
          query: 'SELECT * FROM users',
          timestamp: new Date('2023-01-01T12:00:00Z'),
          duration: 15.5,
          success: true,
        },
        {
          id: '2',
          query: 'INVALID SQL',
          timestamp: new Date('2023-01-01T11:00:00Z'),
          duration: 8.2,
          success: false,
          error: 'Syntax error',
        },
      ]
      
      mockUseQueryHistory.mockReturnValue({
        history: mockHistory,
        addToHistory: mockAddToHistory,
      })
      
      render(<SQLEditor />)
      
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument()
      expect(screen.getByText('INVALID SQL')).toBeInTheDocument()
      expect(screen.getByText('15.50ms')).toBeInTheDocument()
      expect(screen.getByText('8.20ms')).toBeInTheDocument()
    })

    it('should display truncated query text in history', () => {
      const longQuery = 'SELECT ' + 'a'.repeat(100) + ' FROM users WHERE condition = true'
      const mockHistory = [
        {
          id: '1',
          query: longQuery,
          timestamp: new Date(),
          duration: 10,
          success: true,
        },
      ]
      
      mockUseQueryHistory.mockReturnValue({
        history: mockHistory,
        addToHistory: mockAddToHistory,
      })
      
      render(<SQLEditor />)
      
      // Should show only the first line (truncated)
      expect(screen.getByText(longQuery.split('\n')[0])).toBeInTheDocument()
    })
  })

  describe('Icons', () => {
    it('should render all required icons', () => {
      render(<SQLEditor />)
      
      expect(screen.getByTestId('save-icon')).toBeInTheDocument()
      expect(screen.getAllByTestId('play-icon')).toHaveLength(2) // One in button, one in empty state
      expect(screen.getByTestId('history-icon')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('should have proper layout structure', () => {
      const { container } = render(<SQLEditor />)
      
      // Check main container
      const mainContainer = container.firstChild as HTMLElement
      expect(mainContainer).toHaveClass('flex-1', 'flex', 'flex-col', 'h-full')
    })

    it('should have split view with editor and history panels', () => {
      render(<SQLEditor />)
      
      // Editor panel should be present
      const textarea = screen.getByRole('textbox')
      expect(textarea).toBeInTheDocument()
      
      // History panel should be present
      expect(screen.getByText('Query History')).toBeInTheDocument()
    })
  })
})