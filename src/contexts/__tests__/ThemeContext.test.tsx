import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { useState } from 'react';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
  value: mockMatchMedia,
  writable: true,
});

// Test component that uses the theme context
function TestComponent() {
  const { theme, setTheme, actualTheme, monacoTheme } = useTheme();
  const [testState, setTestState] = useState('ready');

  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="actual-theme">{actualTheme}</div>
      <div data-testid="monaco-theme">{monacoTheme}</div>
      <div data-testid="test-state">{testState}</div>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Light
      </button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Dark
      </button>
      <button onClick={() => setTheme('system')} data-testid="set-system">
        System
      </button>
      <button onClick={() => setTestState('updated')} data-testid="update-state">
        Update State
      </button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Setup default localStorage behavior
    mockLocalStorage.getItem.mockReturnValue(null);
    
    // Setup default matchMedia behavior (light mode)
    const mockMediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    mockMatchMedia.mockReturnValue(mockMediaQuery);
    
    // Reset document classes
    document.documentElement.className = '';
  });

  afterEach(() => {
    document.documentElement.className = '';
  });

  it('should provide default theme context values', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('actual-theme')).toHaveTextContent('light');
    expect(screen.getByTestId('monaco-theme')).toHaveTextContent('vs-light');
  });

  it('should apply light theme when set to light', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await act(async () => {
      screen.getByTestId('set-light').click();
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('actual-theme')).toHaveTextContent('light');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('supabase-lite-theme', 'light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should apply dark theme when set to dark', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await act(async () => {
      screen.getByTestId('set-dark').click();
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('actual-theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('monaco-theme')).toHaveTextContent('vs-dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('supabase-lite-theme', 'dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should follow system preference when set to system', async () => {
    // Mock system dark mode
    const mockMediaQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    mockMatchMedia.mockReturnValue(mockMediaQuery);

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    await act(async () => {
      screen.getByTestId('set-system').click();
    });

    expect(screen.getByTestId('theme')).toHaveTextContent('system');
    expect(screen.getByTestId('actual-theme')).toHaveTextContent('dark');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('supabase-lite-theme', 'system');
  });

  it('should load theme from localStorage on initialization', () => {
    mockLocalStorage.getItem.mockReturnValue('dark');

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('actual-theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should throw error when useTheme is used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');
    
    consoleSpy.mockRestore();
  });

  it('should respond to system theme changes', async () => {
    const mockMediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    mockMatchMedia.mockReturnValue(mockMediaQuery);

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    // Initially should be light (system default)
    expect(screen.getByTestId('actual-theme')).toHaveTextContent('light');

    // Simulate system theme change to dark
    await act(async () => {
      const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1];
      changeHandler({ matches: true });
    });

    expect(screen.getByTestId('actual-theme')).toHaveTextContent('dark');
  });
});