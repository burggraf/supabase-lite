import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRouter } from '../useRouter';

const mockPushState = vi.fn();
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

// Mock window.history and location
Object.defineProperty(window, 'history', {
  value: {
    pushState: mockPushState,
  },
  writable: true,
});

Object.defineProperty(window, 'location', {
  value: {
    pathname: '/',
  },
  writable: true,
});

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
  writable: true,
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true,
});

describe('useRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.pathname = '/';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with current page from URL', () => {
    window.location.pathname = '/sql-editor';
    const { result } = renderHook(() => useRouter());
    
    expect(result.current.currentPage).toBe('sql-editor');
  });

  it('should default to dashboard for root path', () => {
    window.location.pathname = '/';
    const { result } = renderHook(() => useRouter());
    
    expect(result.current.currentPage).toBe('dashboard');
  });

  it('should navigate to new page and update URL', () => {
    const { result } = renderHook(() => useRouter());
    
    act(() => {
      result.current.navigate('sql-editor');
    });
    
    expect(result.current.currentPage).toBe('sql-editor');
    expect(mockPushState).toHaveBeenCalledWith(null, '', '/sql-editor');
  });

  it('should navigate to dashboard page and update URL to root', () => {
    const { result } = renderHook(() => useRouter());
    
    act(() => {
      result.current.navigate('dashboard');
    });
    
    expect(result.current.currentPage).toBe('dashboard');
    expect(mockPushState).toHaveBeenCalledWith(null, '', '/');
  });

  it('should handle multiple navigation calls', () => {
    const { result } = renderHook(() => useRouter());
    
    act(() => {
      result.current.navigate('sql-editor');
    });
    
    act(() => {
      result.current.navigate('table-editor');
    });
    
    act(() => {
      result.current.navigate('database');
    });
    
    expect(result.current.currentPage).toBe('database');
    expect(mockPushState).toHaveBeenCalledTimes(3);
    expect(mockPushState).toHaveBeenLastCalledWith(null, '', '/database');
  });

  it('should add popstate event listener on mount', () => {
    renderHook(() => useRouter());
    
    expect(mockAddEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('should remove popstate event listener on unmount', () => {
    const { unmount } = renderHook(() => useRouter());
    
    unmount();
    
    expect(mockRemoveEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('should handle browser back/forward navigation', () => {
    window.location.pathname = '/sql-editor';
    const { result } = renderHook(() => useRouter());
    
    // Simulate browser navigation changing the URL
    window.location.pathname = '/table-editor';
    
    // Get the popstate handler that was registered
    const popstateHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'popstate'
    )?.[1];
    
    expect(popstateHandler).toBeDefined();
    
    // Simulate popstate event
    act(() => {
      popstateHandler();
    });
    
    expect(result.current.currentPage).toBe('table-editor');
  });
});