/**
 * Monaco Editor offline configuration
 * Ensures Monaco Editor works without CDN dependencies
 */

// Dynamic imports to handle test environment
let monaco: any;
let workers: any = {};

let isConfigured = false;

/**
 * Initialize Monaco resources
 */
async function initializeMonaco() {
  if (typeof window === 'undefined') {
    // In test environment, use mocks
    return;
  }

  try {
    monaco = await import('monaco-editor');
    
    // Import workers
    const [
      { default: EditorWorker },
      { default: JsonWorker },
      { default: CssWorker },
      { default: HtmlWorker },
      { default: TsWorker }
    ] = await Promise.all([
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('monaco-editor/esm/vs/language/html/html.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker')
    ]);

    workers = {
      editor: EditorWorker,
      json: JsonWorker,
      css: CssWorker,
      html: HtmlWorker,
      typescript: TsWorker
    };
  } catch (error) {
    console.warn('Failed to initialize Monaco resources:', error);
  }
}

/**
 * Configure Monaco Editor for offline use
 * This should be called before any Monaco Editor usage
 */
export async function configureMonacoOffline(): Promise<void> {
  if (isConfigured) {
    return;
  }

  await initializeMonaco();

  if (typeof window === 'undefined') {
    // Test environment - skip worker setup
    isConfigured = true;
    return;
  }

  // Set up worker environment
  (self as any).MonacoEnvironment = {
    getWorker(_, label) {
      switch (label) {
        case 'json':
          return new workers.json();
        case 'css':
        case 'scss':
        case 'less':
          return new workers.css();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new workers.html();
        case 'typescript':
        case 'javascript':
          return new workers.typescript();
        default:
          return new workers.editor();
      }
    },
  };

  if (!monaco) {
    isConfigured = true;
    return;
  }

  // Configure SQL language support
  monaco.languages.register({ id: 'sql' });
  monaco.languages.setMonarchTokensProvider('sql', {
    keywords: [
      'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
      'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
      'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO',
      'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER',
      'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK',
      'DEFAULT', 'NULL', 'NOT', 'AUTO_INCREMENT', 'SERIAL', 'INT', 'INTEGER',
      'BIGINT', 'SMALLINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'DOUBLE',
      'VARCHAR', 'CHAR', 'TEXT', 'BLOB', 'BOOLEAN', 'DATE', 'TIME', 'TIMESTAMP',
      'DATETIME', 'YEAR', 'UUID'
    ],
    operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||', '++', '--', '+', '-', '*', '/', '&', '|', '^', '%', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '&=', '|=', '^=', '%=', '<<=', '>>=', '>>>='],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    tokenizer: {
      root: [
        [/[a-zA-Z_$][\w$]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }],
        [/[0-9]+/, 'number'],
        [/'[^']*'/, 'string'],
        [/"[^"]*"/, 'string'],
        [/--.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/@symbols/, {
          cases: {
            '@operators': 'operator',
            '@default': ''
          }
        }]
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ]
    }
  });

  // Set SQL completion provider
  monaco.languages.registerCompletionItemProvider('sql', {
    provideCompletionItems: () => {
      const suggestions = [
        {
          label: 'SELECT',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'SELECT ',
        },
        {
          label: 'FROM',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'FROM ',
        },
        {
          label: 'WHERE',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'WHERE ',
        },
        {
          label: 'ORDER BY',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'ORDER BY ',
        },
        {
          label: 'GROUP BY',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'GROUP BY ',
        }
      ];

      return { suggestions };
    },
  });

  isConfigured = true;
  console.log('✅ Monaco Editor configured for offline use');
}

/**
 * Check if Monaco Editor is configured for offline use
 */
export function isMonacoConfigured(): boolean {
  return isConfigured;
}

/**
 * Get the default editor options for offline use
 */
export function getOfflineEditorOptions(): any {
  return {
    fontSize: 14,
    lineNumbers: 'on',
    wordWrap: 'on',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    padding: { top: 16, bottom: 16 },
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false
    },
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    renderWhitespace: 'selection',
    renderControlCharacters: false,
    renderLineHighlight: 'line',
    smoothScrolling: true,
    cursorBlinking: 'blink',
    cursorSmoothCaretAnimation: true
  };
}