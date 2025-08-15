import { useState, useCallback, useRef, useEffect } from 'react';
import type { SQLSnippet, TabState } from '@/types';
import { DATABASE_CONFIG, SQL_EDITOR_CONFIG, QUERY_EXAMPLES } from '@/lib/constants';

interface UseSQLSnippetsReturn {
  tabs: TabState[];
  activeTabId: string;
  snippets: SQLSnippet[];
  
  // Tab management
  createTab: (query?: string, name?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabQuery: (tabId: string, query: string) => void;
  updateTabName: (tabId: string, name: string) => void;
  
  // Snippet management
  saveSnippet: (tabId: string) => void;
  loadSnippet: (snippetId: string, tabId?: string) => void;
  deleteSnippet: (snippetId: string) => void;
  renameSnippet: (snippetId: string, newName: string) => void;
  
  // Utility
  getActiveTab: () => TabState | undefined;
}

export function useSQLSnippets(): UseSQLSnippetsReturn {
  // State
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [snippets, setSnippets] = useState<SQLSnippet[]>([]);
  
  // Refs for debouncing
  const saveTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Load snippets from localStorage on mount
  useEffect(() => {
    const savedSnippets = localStorage.getItem(DATABASE_CONFIG.SQL_SNIPPETS_KEY);
    if (savedSnippets) {
      try {
        const parsed = JSON.parse(savedSnippets);
        const snippetsWithDates = parsed.map((snippet: Omit<SQLSnippet, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }) => ({
          ...snippet,
          createdAt: new Date(snippet.createdAt),
          updatedAt: new Date(snippet.updatedAt),
        }));
        setSnippets(snippetsWithDates);
      } catch (error) {
        console.error('Failed to parse saved snippets:', error);
      }
    }
    
    // Create initial tab - use direct ID generation to avoid dependency
    const initialTabId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setTabs([{
      id: initialTabId,
      name: SQL_EDITOR_CONFIG.DEFAULT_SNIPPET_NAME,
      query: QUERY_EXAMPLES[0].query,
      isDirty: false,
      snippetId: undefined,
    }]);
    setActiveTabId(initialTabId);
  }, []); // Empty dependency array is fine since this only runs once
  
  // Save snippets to localStorage whenever snippets change
  useEffect(() => {
    if (snippets.length > 0) {
      localStorage.setItem(DATABASE_CONFIG.SQL_SNIPPETS_KEY, JSON.stringify(snippets));
    }
  }, [snippets]);
  
  // Generate unique ID
  const generateId = useCallback(() => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);
  
  // Generate snippet name from query
  const generateSnippetName = useCallback((query: string): string => {
    if (!query.trim()) return SQL_EDITOR_CONFIG.DEFAULT_SNIPPET_NAME;
    
    // Extract first meaningful line
    const lines = query.trim().split('\n');
    let firstLine = lines[0].trim();
    
    // Remove comments
    firstLine = firstLine.replace(/^--\s*/, '');
    
    // If it's a SQL statement, try to make it readable
    if (firstLine.toLowerCase().startsWith('select')) {
      firstLine = 'Select query';
    } else if (firstLine.toLowerCase().startsWith('insert')) {
      firstLine = 'Insert data';
    } else if (firstLine.toLowerCase().startsWith('update')) {
      firstLine = 'Update data';
    } else if (firstLine.toLowerCase().startsWith('delete')) {
      firstLine = 'Delete data';
    } else if (firstLine.toLowerCase().startsWith('create')) {
      firstLine = 'Create statement';
    }
    
    // Truncate if too long
    if (firstLine.length > SQL_EDITOR_CONFIG.MAX_SNIPPET_NAME_LENGTH) {
      firstLine = firstLine.substring(0, SQL_EDITOR_CONFIG.MAX_SNIPPET_NAME_LENGTH - 3) + '...';
    }
    
    return firstLine || SQL_EDITOR_CONFIG.DEFAULT_SNIPPET_NAME;
  }, []);
  
  // Debounced auto-save
  const debouncedSave = useCallback((tabId: string) => {
    const existingTimeout = saveTimeoutRefs.current.get(tabId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(() => {
      const tab = tabs.find(t => t.id === tabId);
      if (tab && tab.isDirty && tab.snippetId) {
        // Auto-save existing snippet
        setSnippets(prev => prev.map(snippet => 
          snippet.id === tab.snippetId 
            ? { ...snippet, query: tab.query, updatedAt: new Date() }
            : snippet
        ));
        
        // Mark tab as clean
        setTabs(prev => prev.map(t => 
          t.id === tabId ? { ...t, isDirty: false } : t
        ));
      }
      saveTimeoutRefs.current.delete(tabId);
    }, SQL_EDITOR_CONFIG.AUTO_SAVE_DEBOUNCE_MS);
    
    saveTimeoutRefs.current.set(tabId, timeout);
  }, [tabs]);
  
  // Tab management functions
  const createTab = useCallback((query?: string, name?: string): string => {
    if (tabs.length >= SQL_EDITOR_CONFIG.MAX_TABS) {
      alert(`Maximum ${SQL_EDITOR_CONFIG.MAX_TABS} tabs allowed`);
      return activeTabId;
    }
    
    const tabId = generateId();
    const defaultQuery = query || QUERY_EXAMPLES[0].query;
    
    const newTab: TabState = {
      id: tabId,
      name: name || SQL_EDITOR_CONFIG.DEFAULT_SNIPPET_NAME,
      query: defaultQuery,
      isDirty: false,
      snippetId: undefined,
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    
    return tabId;
  }, [tabs.length, activeTabId, generateId]);
  
  const closeTab = useCallback((tabId: string) => {
    if (tabs.length === 1) {
      // Don't close the last tab, just reset it
      setTabs([{
        id: generateId(),
        name: SQL_EDITOR_CONFIG.DEFAULT_SNIPPET_NAME,
        query: QUERY_EXAMPLES[0].query,
        isDirty: false,
        snippetId: undefined,
      }]);
      setActiveTabId(tabs[0].id);
      return;
    }
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;
    
    // Clear any pending save timeout
    const timeout = saveTimeoutRefs.current.get(tabId);
    if (timeout) {
      clearTimeout(timeout);
      saveTimeoutRefs.current.delete(tabId);
    }
    
    // Remove tab
    setTabs(prev => prev.filter(t => t.id !== tabId));
    
    // Update active tab if needed
    if (activeTabId === tabId) {
      const newActiveIndex = Math.max(0, tabIndex - 1);
      const remainingTabs = tabs.filter(t => t.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[newActiveIndex].id);
      }
    }
  }, [tabs, activeTabId, generateId]);
  
  const setActiveTab = useCallback((tabId: string) => {
    if (tabs.some(t => t.id === tabId)) {
      setActiveTabId(tabId);
    }
  }, [tabs]);
  
  const updateTabQuery = useCallback((tabId: string, query: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, query, isDirty: true }
        : tab
    ));
    
    // Trigger debounced save
    debouncedSave(tabId);
  }, [debouncedSave]);
  
  const updateTabName = useCallback((tabId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    
    setTabs(prev => prev.map(tab => 
      tab.id === tabId 
        ? { ...tab, name: trimmedName, isDirty: true }
        : tab
    ));
  }, []);
  
  // Snippet management functions
  const saveSnippet = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    const now = new Date();
    
    if (tab.snippetId) {
      // Update existing snippet
      setSnippets(prev => prev.map(snippet => 
        snippet.id === tab.snippetId 
          ? { ...snippet, name: tab.name, query: tab.query, updatedAt: now }
          : snippet
      ));
    } else {
      // Create new snippet
      const snippetId = generateId();
      const snippetName = tab.name === SQL_EDITOR_CONFIG.DEFAULT_SNIPPET_NAME 
        ? generateSnippetName(tab.query)
        : tab.name;
      
      const newSnippet: SQLSnippet = {
        id: snippetId,
        name: snippetName,
        query: tab.query,
        createdAt: now,
        updatedAt: now,
      };
      
      setSnippets(prev => [...prev, newSnippet]);
      
      // Update tab to reference the snippet
      setTabs(prev => prev.map(t => 
        t.id === tabId 
          ? { ...t, snippetId, name: snippetName, isDirty: false }
          : t
      ));
    }
    
    // Mark tab as clean
    setTabs(prev => prev.map(t => 
      t.id === tabId ? { ...t, isDirty: false } : t
    ));
  }, [tabs, generateId, generateSnippetName]);
  
  const loadSnippet = useCallback((snippetId: string, tabId?: string) => {
    const snippet = snippets.find(s => s.id === snippetId);
    if (!snippet) return;
    
    const targetTabId = tabId || activeTabId;
    
    setTabs(prev => prev.map(tab => 
      tab.id === targetTabId 
        ? { 
            ...tab, 
            name: snippet.name, 
            query: snippet.query, 
            isDirty: false,
            snippetId: snippet.id
          }
        : tab
    ));
  }, [snippets, activeTabId]);
  
  const deleteSnippet = useCallback((snippetId: string) => {
    setSnippets(prev => prev.filter(s => s.id !== snippetId));
    
    // Update any tabs that reference this snippet
    setTabs(prev => prev.map(tab => 
      tab.snippetId === snippetId 
        ? { ...tab, snippetId: undefined, isDirty: true }
        : tab
    ));
  }, []);
  
  const renameSnippet = useCallback((snippetId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    
    setSnippets(prev => prev.map(snippet => 
      snippet.id === snippetId 
        ? { ...snippet, name: trimmedName, updatedAt: new Date() }
        : snippet
    ));
    
    // Update any tabs that reference this snippet
    setTabs(prev => prev.map(tab => 
      tab.snippetId === snippetId 
        ? { ...tab, name: trimmedName }
        : tab
    ));
  }, []);
  
  // Utility functions
  const getActiveTab = useCallback((): TabState | undefined => {
    return tabs.find(t => t.id === activeTabId);
  }, [tabs, activeTabId]);
  
  return {
    tabs,
    activeTabId,
    snippets,
    
    // Tab management
    createTab,
    closeTab,
    setActiveTab,
    updateTabQuery,
    updateTabName,
    
    // Snippet management
    saveSnippet,
    loadSnippet,
    deleteSnippet,
    renameSnippet,
    
    // Utility
    getActiveTab,
  };
}