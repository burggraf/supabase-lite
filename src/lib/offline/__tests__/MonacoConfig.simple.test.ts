import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock console methods
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('MonacoConfig (Simplified)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('configureMonacoOffline', () => {
    it('should configure Monaco Editor in test environment', async () => {
      // Mock window as undefined to simulate test environment
      const originalWindow = global.window;
      delete (global as any).window;

      const { configureMonacoOffline, isMonacoConfigured } = await import('../MonacoConfig');
      
      expect(isMonacoConfigured()).toBe(false);
      
      await configureMonacoOffline();
      
      expect(isMonacoConfigured()).toBe(true);

      // Restore window
      (global as any).window = originalWindow;
    });

    it('should not configure Monaco multiple times', async () => {
      const { configureMonacoOffline, isMonacoConfigured } = await import('../MonacoConfig');
      
      await configureMonacoOffline();
      await configureMonacoOffline(); // Second call
      
      expect(isMonacoConfigured()).toBe(true);
    });
  });

  describe('getOfflineEditorOptions', () => {
    it('should return proper editor options for offline use', async () => {
      const { getOfflineEditorOptions } = await import('../MonacoConfig');
      
      const options = getOfflineEditorOptions();
      
      expect(options).toBeDefined();
      expect(options.fontSize).toBe(14);
      expect(options.lineNumbers).toBe('on');
      expect(options.wordWrap).toBe('on');
      expect(options.automaticLayout).toBe(true);
      expect(options.scrollBeyondLastLine).toBe(false);
      expect(options.minimap?.enabled).toBe(false);
      expect(options.suggestOnTriggerCharacters).toBe(true);
      expect(options.tabSize).toBe(2);
    });

    it('should have proper padding configuration', async () => {
      const { getOfflineEditorOptions } = await import('../MonacoConfig');
      
      const options = getOfflineEditorOptions();
      
      expect(options.padding?.top).toBe(16);
      expect(options.padding?.bottom).toBe(16);
    });

    it('should have proper quick suggestions configuration', async () => {
      const { getOfflineEditorOptions } = await import('../MonacoConfig');
      
      const options = getOfflineEditorOptions();
      
      expect(options.quickSuggestions?.other).toBe(true);
      expect(options.quickSuggestions?.comments).toBe(false);
      expect(options.quickSuggestions?.strings).toBe(false);
    });
  });

  describe('isMonacoConfigured', () => {
    it('should return false initially', async () => {
      const { isMonacoConfigured } = await import('../MonacoConfig');
      
      expect(isMonacoConfigured()).toBe(false);
    });

    it('should return true after configuration in test environment', async () => {
      const { configureMonacoOffline, isMonacoConfigured } = await import('../MonacoConfig');
      
      await configureMonacoOffline();
      
      expect(isMonacoConfigured()).toBe(true);
    });
  });
});