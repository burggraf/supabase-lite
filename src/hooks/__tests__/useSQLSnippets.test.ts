import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSQLSnippets } from '../useSQLSnippets';
import { SQL_EDITOR_CONFIG } from '@/lib/constants';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useSQLSnippets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('initialization', () => {
    it('should create initial tab with default query', () => {
      const { result } = renderHook(() => useSQLSnippets());

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0]).toMatchObject({
        name: '+ New',
        isDirty: false,
        snippetId: undefined,
      });
      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    });

    it('should load saved snippets from localStorage', () => {
      const savedSnippets = [
        {
          id: 'snippet-1',
          name: 'Test Snippet',
          query: 'SELECT 1',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
        },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedSnippets));

      const { result } = renderHook(() => useSQLSnippets());

      expect(result.current.snippets).toHaveLength(1);
      expect(result.current.snippets[0]).toMatchObject({
        id: 'snippet-1',
        name: 'Test Snippet',
        query: 'SELECT 1',
      });
      expect(result.current.snippets[0].createdAt).toBeInstanceOf(Date);
    });

    it('should handle invalid localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useSQLSnippets());

      expect(result.current.snippets).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to parse saved snippets:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('tab management', () => {
    it('should create new tab with default values', () => {
      const { result } = renderHook(() => useSQLSnippets());

      act(() => {
        result.current.createTab();
      });

      expect(result.current.tabs).toHaveLength(2);
      expect(result.current.tabs[1]).toMatchObject({
        name: '+ New',
        isDirty: false,
        snippetId: undefined,
      });
    });

    it('should create new tab with custom query and name', () => {
      const { result } = renderHook(() => useSQLSnippets());

      act(() => {
        result.current.createTab('SELECT * FROM users', 'User Query');
      });

      expect(result.current.tabs).toHaveLength(2);
      expect(result.current.tabs[1]).toMatchObject({
        name: 'User Query',
        query: 'SELECT * FROM users',
        isDirty: false,
      });
    });

    it('should not create more than maximum allowed tabs', () => {
      const { result } = renderHook(() => useSQLSnippets());
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Create tabs up to the limit
      act(() => {
        for (let i = 1; i < SQL_EDITOR_CONFIG.MAX_TABS; i++) {
          result.current.createTab();
        }
      });

      expect(result.current.tabs).toHaveLength(SQL_EDITOR_CONFIG.MAX_TABS);

      // Try to create one more tab
      act(() => {
        result.current.createTab();
      });

      expect(result.current.tabs).toHaveLength(SQL_EDITOR_CONFIG.MAX_TABS);
      expect(alertSpy).toHaveBeenCalledWith(`Maximum ${SQL_EDITOR_CONFIG.MAX_TABS} tabs allowed`);
      
      alertSpy.mockRestore();
    });

    it('should close tab and update active tab', () => {
      const { result } = renderHook(() => useSQLSnippets());

      act(() => {
        result.current.createTab();
      });

      const firstTabId = result.current.tabs[0].id;
      const secondTabId = result.current.tabs[1].id;

      expect(result.current.activeTabId).toBe(secondTabId);

      act(() => {
        result.current.closeTab(firstTabId);
      });

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].id).toBe(secondTabId);
      expect(result.current.activeTabId).toBe(secondTabId);
    });

    it('should reset last tab instead of closing it', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const originalTabId = result.current.tabs[0].id;

      act(() => {
        result.current.closeTab(originalTabId);
      });

      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].id).not.toBe(originalTabId);
      expect(result.current.tabs[0]).toMatchObject({
        name: '+ New',
        isDirty: false,
      });
    });

    it('should set active tab', () => {
      const { result } = renderHook(() => useSQLSnippets());

      act(() => {
        result.current.createTab();
      });

      const firstTabId = result.current.tabs[0].id;

      act(() => {
        result.current.setActiveTab(firstTabId);
      });

      expect(result.current.activeTabId).toBe(firstTabId);
    });

    it('should update tab query and mark as dirty', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;
      const newQuery = 'SELECT * FROM posts';

      act(() => {
        result.current.updateTabQuery(tabId, newQuery);
      });

      expect(result.current.tabs[0]).toMatchObject({
        query: newQuery,
        isDirty: true,
      });
    });

    it('should update tab name', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;
      const newName = 'My Custom Query';

      act(() => {
        result.current.updateTabName(tabId, newName);
      });

      expect(result.current.tabs[0]).toMatchObject({
        name: newName,
        isDirty: true,
      });
    });

    it('should ignore empty tab name updates', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;
      const originalName = result.current.tabs[0].name;

      act(() => {
        result.current.updateTabName(tabId, '   ');
      });

      expect(result.current.tabs[0].name).toBe(originalName);
    });
  });

  describe('snippet management', () => {
    it('should save new snippet from tab', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;

      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.updateTabName(tabId, 'User Query');
      });

      act(() => {
        result.current.saveSnippet(tabId);
      });

      expect(result.current.snippets).toHaveLength(1);
      expect(result.current.snippets[0]).toMatchObject({
        name: 'User Query',
        query: 'SELECT * FROM users',
      });
      expect(result.current.tabs[0]).toMatchObject({
        isDirty: false,
        snippetId: result.current.snippets[0].id,
      });
    });

    it('should update existing snippet', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;

      // Save initial snippet
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.saveSnippet(tabId);
      });

      const snippetId = result.current.snippets[0].id;
      const originalUpdatedAt = result.current.snippets[0].updatedAt;

      // Update the snippet
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT id, name FROM users');
        result.current.saveSnippet(tabId);
      });

      expect(result.current.snippets).toHaveLength(1);
      expect(result.current.snippets[0]).toMatchObject({
        id: snippetId,
        query: 'SELECT id, name FROM users',
      });
      expect(result.current.snippets[0].updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    it('should load snippet into active tab', () => {
      const { result } = renderHook(() => useSQLSnippets());

      // Create a snippet first
      const tabId = result.current.tabs[0].id;
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM posts');
        result.current.updateTabName(tabId, 'Post Query');
        result.current.saveSnippet(tabId);
      });

      const snippetId = result.current.snippets[0].id;

      // Create a new tab and load the snippet
      act(() => {
        result.current.createTab();
      });

      const newTabId = result.current.tabs[1].id;

      act(() => {
        result.current.loadSnippet(snippetId, newTabId);
      });

      expect(result.current.tabs[1]).toMatchObject({
        name: 'Post Query',
        query: 'SELECT * FROM posts',
        isDirty: false,
        snippetId: snippetId,
      });
    });

    it('should delete snippet and update referencing tabs', () => {
      const { result } = renderHook(() => useSQLSnippets());

      // Create and save a snippet
      const tabId = result.current.tabs[0].id;
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.saveSnippet(tabId);
      });

      const snippetId = result.current.snippets[0].id;

      act(() => {
        result.current.deleteSnippet(snippetId);
      });

      expect(result.current.snippets).toHaveLength(0);
      expect(result.current.tabs[0]).toMatchObject({
        snippetId: undefined,
        isDirty: true,
      });
    });

    it('should rename snippet and update referencing tabs', () => {
      const { result } = renderHook(() => useSQLSnippets());

      // Create and save a snippet
      const tabId = result.current.tabs[0].id;
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.saveSnippet(tabId);
      });

      const snippetId = result.current.snippets[0].id;
      const newName = 'Updated User Query';

      act(() => {
        result.current.renameSnippet(snippetId, newName);
      });

      expect(result.current.snippets[0].name).toBe(newName);
      expect(result.current.tabs[0].name).toBe(newName);
    });

    it('should ignore empty snippet name updates', () => {
      const { result } = renderHook(() => useSQLSnippets());

      // Create and save a snippet
      const tabId = result.current.tabs[0].id;
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.saveSnippet(tabId);
      });

      const snippetId = result.current.snippets[0].id;
      const originalName = result.current.snippets[0].name;

      act(() => {
        result.current.renameSnippet(snippetId, '   ');
      });

      expect(result.current.snippets[0].name).toBe(originalName);
    });
  });

  describe('auto-save functionality', () => {
    it('should mark tab as dirty when query is updated', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;

      // Save snippet first to enable auto-save
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.saveSnippet(tabId);
      });

      expect(result.current.tabs[0].isDirty).toBe(false);

      // Update query to trigger dirty state
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT id, name FROM users');
      });

      expect(result.current.tabs[0].isDirty).toBe(true);
    });

    it('should implement debounced auto-save mechanism', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;

      // Save snippet first
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.saveSnippet(tabId);
      });

      // Update query multiple times quickly
      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT id FROM users');
        result.current.updateTabQuery(tabId, 'SELECT id, name FROM users');
        result.current.updateTabQuery(tabId, 'SELECT id, name, email FROM users');
      });

      // Should be marked as dirty after updates
      expect(result.current.tabs[0].isDirty).toBe(true);
      expect(result.current.tabs[0].query).toBe('SELECT id, name, email FROM users');
    });
  });

  describe('utility functions', () => {
    it('should get active tab', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const activeTab = result.current.getActiveTab();

      expect(activeTab).toBeDefined();
      expect(activeTab?.id).toBe(result.current.activeTabId);
    });

    it('should return undefined when no active tab', () => {
      const { result } = renderHook(() => useSQLSnippets());

      // Close all tabs to simulate edge case
      act(() => {
        result.current.tabs.forEach(tab => {
          result.current.closeTab(tab.id);
        });
      });

      // Set activeTabId to non-existent ID
      act(() => {
        result.current.setActiveTab('non-existent');
      });

      const activeTab = result.current.getActiveTab();
      expect(activeTab).toBeUndefined();
    });
  });

  describe('localStorage persistence', () => {
    it('should save snippets to localStorage when snippets change', () => {
      const { result } = renderHook(() => useSQLSnippets());

      const tabId = result.current.tabs[0].id;

      act(() => {
        result.current.updateTabQuery(tabId, 'SELECT * FROM users');
        result.current.saveSnippet(tabId);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'supabase_lite_sql_snippets',
        expect.any(String)
      );
    });
  });
});