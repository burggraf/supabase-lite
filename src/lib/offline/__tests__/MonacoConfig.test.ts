import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock monaco-editor and workers
const mockMonaco = {
  languages: {
    register: vi.fn(),
    setMonarchTokensProvider: vi.fn(),
    registerCompletionItemProvider: vi.fn(),
    CompletionItemKind: {
      Keyword: 1
    }
  },
  editor: {
    IStandaloneEditorConstructionOptions: {}
  }
};

vi.mock('monaco-editor', () => mockMonaco);
vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({
  default: class MockEditorWorker {}
}));
vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({
  default: class MockJsonWorker {}
}));
vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({
  default: class MockCssWorker {}
}));
vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({
  default: class MockHtmlWorker {}
}));
vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({
  default: class MockTsWorker {}
}));

describe('MonacoConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset module state
    vi.resetModules();
    
    // Mock global self
    (globalThis as any).self = {
      MonacoEnvironment: undefined
    };
  });

  describe('configureMonacoOffline', () => {
    it('should configure Monaco Editor for offline use', async () => {
      const { configureMonacoOffline, isMonacoConfigured } = await import('../MonacoConfig');
      
      expect(isMonacoConfigured()).toBe(false);
      
      configureMonacoOffline();
      
      expect(isMonacoConfigured()).toBe(true);
      expect((globalThis as any).self.MonacoEnvironment).toBeDefined();
      expect(mockMonaco.languages.register).toHaveBeenCalledWith({ id: 'sql' });
      expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalledWith('sql', expect.any(Object));
      expect(mockMonaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith('sql', expect.any(Object));
    });

    it('should not configure Monaco multiple times', async () => {
      const { configureMonacoOffline } = await import('../MonacoConfig');
      
      configureMonacoOffline();
      configureMonacoOffline(); // Second call
      
      // Should only be called once
      expect(mockMonaco.languages.register).toHaveBeenCalledTimes(1);
    });

    it('should set up correct worker environment', async () => {
      const { configureMonacoOffline } = await import('../MonacoConfig');
      
      configureMonacoOffline();
      
      const monacoEnv = (globalThis as any).self.MonacoEnvironment;
      expect(monacoEnv.getWorker).toBeDefined();
      
      // Test different worker types
      const jsonWorker = monacoEnv.getWorker(null, 'json');
      expect(jsonWorker).toBeDefined();
      
      const cssWorker = monacoEnv.getWorker(null, 'css');
      expect(cssWorker).toBeDefined();
      
      const htmlWorker = monacoEnv.getWorker(null, 'html');
      expect(htmlWorker).toBeDefined();
      
      const tsWorker = monacoEnv.getWorker(null, 'typescript');
      expect(tsWorker).toBeDefined();
      
      const defaultWorker = monacoEnv.getWorker(null, 'unknown');
      expect(defaultWorker).toBeDefined();
    });

    it('should configure SQL language with proper tokenizer', async () => {
      const { configureMonacoOffline } = await import('../MonacoConfig');
      
      configureMonacoOffline();
      
      const sqlTokenizerCall = mockMonaco.languages.setMonarchTokensProvider.mock.calls.find(
        call => call[0] === 'sql'
      );
      
      expect(sqlTokenizerCall).toBeDefined();
      const tokenizerConfig = sqlTokenizerCall![1];
      
      expect(tokenizerConfig.keywords).toContain('SELECT');
      expect(tokenizerConfig.keywords).toContain('FROM');
      expect(tokenizerConfig.keywords).toContain('WHERE');
      expect(tokenizerConfig.operators).toContain('=');
      expect(tokenizerConfig.tokenizer).toBeDefined();
      expect(tokenizerConfig.tokenizer.root).toBeDefined();
    });

    it('should register SQL completion provider', async () => {
      const { configureMonacoOffline } = await import('../MonacoConfig');
      
      configureMonacoOffline();
      
      const completionCall = mockMonaco.languages.registerCompletionItemProvider.mock.calls.find(
        call => call[0] === 'sql'
      );
      
      expect(completionCall).toBeDefined();
      const provider = completionCall![1];
      
      const completions = provider.provideCompletionItems();
      expect(completions.suggestions).toBeDefined();
      expect(completions.suggestions.length).toBeGreaterThan(0);
      
      // Check for expected SQL keywords
      const selectSuggestion = completions.suggestions.find((s: any) => s.label === 'SELECT');
      expect(selectSuggestion).toBeDefined();
      expect(selectSuggestion.kind).toBe(mockMonaco.languages.CompletionItemKind.Keyword);
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

    it('should return true after configuration', async () => {
      const { configureMonacoOffline, isMonacoConfigured } = await import('../MonacoConfig');
      
      configureMonacoOffline();
      
      expect(isMonacoConfigured()).toBe(true);
    });
  });
});