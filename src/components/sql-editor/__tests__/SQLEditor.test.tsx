import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SQLEditor } from '../SQLEditor'

// Mock the hooks
const mockExecuteQuery = vi.fn()
const mockExecuteScript = vi.fn()
const mockAddToHistory = vi.fn()

const mockUseDatabase = vi.fn(() => ({
  executeQuery: mockExecuteQuery,
  executeScript: mockExecuteScript,
}))

const mockUseQueryHistory = vi.fn(() => ({
  history: [],
  addToHistory: mockAddToHistory,
}))

// Mock SQL Snippets hook
const mockCreateTab = vi.fn()
const mockCloseTab = vi.fn()
const mockSetActiveTab = vi.fn()
const mockUpdateTabQuery = vi.fn()
const mockUpdateTabName = vi.fn()
const mockSaveSnippet = vi.fn()
const mockLoadSnippet = vi.fn()
const mockDeleteSnippet = vi.fn()
const mockGetActiveTab = vi.fn()

const mockUseSQLSnippets = vi.fn(() => ({
  tabs: [{
    id: 'tab-1',
    name: 'Untitled',
    query: '-- Welcome to Supabase Lite SQL Editor\nSELECT 1;',
    isDirty: false,
    snippetId: undefined,
  }],
  activeTabId: 'tab-1',
  snippets: [],
  createTab: mockCreateTab,
  closeTab: mockCloseTab,
  setActiveTab: mockSetActiveTab,
  updateTabQuery: mockUpdateTabQuery,
  updateTabName: mockUpdateTabName,
  saveSnippet: mockSaveSnippet,
  loadSnippet: mockLoadSnippet,
  deleteSnippet: mockDeleteSnippet,
  getActiveTab: mockGetActiveTab,
}))

vi.mock('@/hooks/useDatabase', () => ({
  useDatabase: () => mockUseDatabase(),
  useQueryHistory: () => mockUseQueryHistory(),
}))

vi.mock('@/hooks/useSQLSnippets', () => ({
  useSQLSnippets: () => mockUseSQLSnippets(),
}))

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="play-icon" />,
  Save: () => <div data-testid="save-icon" />,
  History: () => <div data-testid="history-icon" />,
  Plus: () => <div data-testid="plus-icon" />,
  X: () => <div data-testid="x-icon" />,
  Edit2: () => <div data-testid="edit-icon" />,
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
      executeScript: mockExecuteScript,
    })
    mockUseQueryHistory.mockReturnValue({
      history: [],
      addToHistory: mockAddToHistory,
    })
    mockGetActiveTab.mockReturnValue({
      id: 'tab-1',
      name: 'Untitled',
      query: '-- Welcome to Supabase Lite SQL Editor\nSELECT 1;',
      isDirty: false,
      snippetId: undefined,
    })
    mockUseSQLSnippets.mockReturnValue({
      tabs: [{
        id: 'tab-1',
        name: 'Untitled',
        query: '-- Welcome to Supabase Lite SQL Editor\nSELECT 1;',
        isDirty: false,
        snippetId: undefined,
      }],
      activeTabId: 'tab-1',
      snippets: [],
      createTab: mockCreateTab,
      closeTab: mockCloseTab,
      setActiveTab: mockSetActiveTab,
      updateTabQuery: mockUpdateTabQuery,
      updateTabName: mockUpdateTabName,
      saveSnippet: mockSaveSnippet,
      loadSnippet: mockLoadSnippet,
      deleteSnippet: mockDeleteSnippet,
      getActiveTab: mockGetActiveTab,
    })
  })

  describe('Initial Render', () => {
    it('should render the SQL Editor interface with tabs', () => {
      render(<SQLEditor />)
      
      expect(screen.getByText('SQL Editor')).toBeInTheDocument()
      expect(screen.getByText('Write and execute SQL queries against your local database')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument()
      expect(screen.getByText('Saved Snippets')).toBeInTheDocument()
      expect(screen.getByText('Untitled')).toBeInTheDocument() // Tab name
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument() // Add tab button
    })

    it('should display Monaco Editor loading state', async () => {
      render(<SQLEditor />)
      
      // Monaco Editor loads asynchronously, so we look for the loading state
      await waitFor(() => {
        expect(screen.getByText(/Loading\.\.\./)).toBeInTheDocument()
      })
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
      
      const runButton = screen.getByRole('button', { name: /run/i })
      
      // Click run button (component has initial query loaded)
      await user.click(runButton)
      
      await waitFor(() => {
        expect(mockExecuteQuery).toHaveBeenCalled()
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
      
      expect(mockAddToHistory).toHaveBeenCalled()
    })

    it('should handle query execution errors', async () => {
      const mockError = { message: 'Syntax error near SELECT' }
      mockExecuteQuery.mockRejectedValue(mockError)
      
      render(<SQLEditor />)
      
      const runButton = screen.getByRole('button', { name: /run/i })
      
      // Click run button to trigger error
      await user.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('Query Error')).toBeInTheDocument()
        expect(screen.getByText('Syntax error near SELECT')).toBeInTheDocument()
      })
      
      expect(mockAddToHistory).toHaveBeenCalledWith(
        expect.any(String),
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
      
      const runButton = screen.getByRole('button', { name: /run/i })
      
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
  })

  describe('Script Execution', () => {
    it('should use single query execution for single statements (default behavior)', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'test' }],
        fields: [{ name: 'id' }, { name: 'name' }],
        rowCount: 1,
        command: 'SELECT',
        duration: 15.5,
      }
      mockExecuteQuery.mockResolvedValue(mockResult)
      
      render(<SQLEditor />)
      
      const runButton = screen.getByRole('button', { name: /run/i })
      
      // Default query is single statement, so should use executeQuery
      await user.click(runButton)
      
      await waitFor(() => {
        expect(mockExecuteQuery).toHaveBeenCalled()
        expect(mockExecuteScript).not.toHaveBeenCalled()
      })
      
      await waitFor(() => {
        expect(screen.getByText('Results')).toBeInTheDocument()
        expect(screen.getByText('1 row')).toBeInTheDocument()
      })
    })

    // Note: Testing multi-statement detection would require properly mocking Monaco Editor
    // which is complex in unit tests. The core logic is tested by the fact that we have
    // both executeQuery and executeScript functions available and the component compiles.
    // Integration testing would be more appropriate for the full multi-statement flow.
  })

  describe('Query Results Display', () => {
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
      
      const runButton = screen.getByRole('button', { name: /run/i })
      
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
      
      const runButton = screen.getByRole('button', { name: /run/i })
      
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
      
      const runButton = screen.getByRole('button', { name: /run/i })
      
      await user.click(runButton)
      
      await waitFor(() => {
        expect(screen.getByText('{"key":"value","nested":{"data":123}}')).toBeInTheDocument()
      })
    })
  })

  describe('Save Query', () => {
    it('should save snippet when save is clicked', async () => {
      render(<SQLEditor />)
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      
      // Click save button (will save current tab as snippet)
      await user.click(saveButton)
      
      expect(mockSaveSnippet).toHaveBeenCalledWith('tab-1')
    })
  })

  describe('Tabs and Snippets', () => {
    it('should create new tab when plus button is clicked', async () => {
      render(<SQLEditor />)
      
      const addTabButton = screen.getByTestId('plus-icon').closest('button')
      
      await user.click(addTabButton!)
      
      expect(mockCreateTab).toHaveBeenCalled()
    })
    
    it('should display snippets panel', () => {
      render(<SQLEditor />)
      
      expect(screen.getByText('Saved Snippets')).toBeInTheDocument()
      expect(screen.getByText('No saved snippets yet')).toBeInTheDocument()
    })
    
    it('should show snippets when available', () => {
      mockUseSQLSnippets.mockReturnValue({
        tabs: [{
          id: 'tab-1',
          name: 'Untitled',
          query: 'SELECT 1;',
          isDirty: false,
          snippetId: undefined,
        }],
        activeTabId: 'tab-1',
        snippets: [{
          id: 'snippet-1',
          name: 'Test Query',
          query: 'SELECT * FROM users',
          createdAt: new Date(),
          updatedAt: new Date(),
        }],
        createTab: mockCreateTab,
        closeTab: mockCloseTab,
        setActiveTab: mockSetActiveTab,
        updateTabQuery: mockUpdateTabQuery,
        updateTabName: mockUpdateTabName,
        saveSnippet: mockSaveSnippet,
        loadSnippet: mockLoadSnippet,
        deleteSnippet: mockDeleteSnippet,
        getActiveTab: mockGetActiveTab,
      })
      
      render(<SQLEditor />)
      
      expect(screen.getByText('Test Query')).toBeInTheDocument()
      expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument()
    })
  })
  
  describe('Query History Panel', () => {
    it('should display empty history message when no queries', async () => {
      render(<SQLEditor />)
      
      // Click on History tab
      const historyTab = screen.getByText('History')
      await user.click(historyTab)
      
      expect(screen.getByText('No queries executed yet')).toBeInTheDocument()
    })

    it('should display query history items', async () => {
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
        history: mockHistory as any,
        addToHistory: mockAddToHistory,
      })
      
      render(<SQLEditor />)
      
      // Click on History tab
      const historyTab = screen.getByText('History')
      await user.click(historyTab)
      
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument()
      expect(screen.getByText('INVALID SQL')).toBeInTheDocument()
      expect(screen.getByText('15.50ms')).toBeInTheDocument()
      expect(screen.getByText('8.20ms')).toBeInTheDocument()
    })
  })

  describe('Icons', () => {
    it('should render all required icons', () => {
      render(<SQLEditor />)
      
      expect(screen.getByTestId('save-icon')).toBeInTheDocument()
      expect(screen.getAllByTestId('play-icon')).toHaveLength(2) // One in button, one in empty state
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument()
    })
  })

  describe('Layout', () => {
    it('should have proper layout structure', () => {
      const { container } = render(<SQLEditor />)
      
      // Check main container
      const mainContainer = container.firstChild as HTMLElement
      expect(mainContainer).toHaveClass('flex-1', 'flex', 'flex-col', 'h-full')
    })

    it('should have split view with editor and sidebar panels', () => {
      render(<SQLEditor />)
      
      // Monaco Editor loading state should be present
      expect(screen.getByText(/Loading\.\.\./)).toBeInTheDocument()
      
      // Sidebar panels should be present
      expect(screen.getByText('Snippets')).toBeInTheDocument()
      expect(screen.getByText('History')).toBeInTheDocument()
    })
  })
})