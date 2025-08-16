export const APP_NAME = 'Supabase Lite';
export const APP_VERSION = '0.1.0';

export const DATABASE_CONFIG = {
  DEFAULT_DB_NAME: 'supabase_lite_db',
  STORAGE_KEY: 'supabase_lite_storage',
  HISTORY_KEY: 'supabase_lite_query_history',
  SAVED_QUERIES_KEY: 'supabase_lite_saved_queries',
  SQL_SNIPPETS_KEY: 'supabase_lite_sql_snippets',
  TAB_LAYOUT_KEY: 'supabase_lite_tab_layout',
};

export const NAVIGATION_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/',
  },
  {
    id: 'sql-editor',
    label: 'SQL Editor',
    icon: 'FileText',
    path: '/sql-editor',
  },
  {
    id: 'table-editor',
    label: 'Table Editor',
    icon: 'Table',
    path: '/table-editor',
  },
  {
    id: 'database',
    label: 'Database',
    icon: 'Database',
    path: '/database',
  },
  {
    id: 'auth',
    label: 'Authentication',
    icon: 'Shield',
    path: '/auth',
    disabled: true,
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: 'FolderOpen',
    path: '/storage',
    disabled: true,
  },
  {
    id: 'realtime',
    label: 'Realtime',
    icon: 'Zap',
    path: '/realtime',
    disabled: true,
  },
  {
    id: 'edge-functions',
    label: 'Edge Functions',
    icon: 'Code',
    path: '/edge-functions',
    disabled: true,
  },
  {
    id: 'api',
    label: 'API Docs',
    icon: 'BookOpen',
    path: '/api',
    disabled: true,
  },
  {
    id: 'api-test',
    label: 'API Tester',
    icon: 'TestTube',
    path: '/api-test',
  },
];

export const QUERY_EXAMPLES = [
  {
    name: 'Create Table',
    query: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
  },
  {
    name: 'Insert Data',
    query: `INSERT INTO users (email, name) VALUES 
('john@example.com', 'John Doe'),
('jane@example.com', 'Jane Smith');`,
  },
  {
    name: 'Select All',
    query: 'SELECT * FROM users ORDER BY created_at DESC;',
  },
  {
    name: 'Join Query',
    query: `SELECT u.name, u.email, p.title
FROM users u
LEFT JOIN posts p ON u.id = p.user_id;`,
  },
];

export const ROLE_CONFIG = {
  STORAGE_KEY: 'supabase_lite_current_role',
  DEFAULT_ROLE_ID: 'postgres',
};

export const SQL_EDITOR_CONFIG = {
  MAX_TABS: 10,
  AUTO_SAVE_DEBOUNCE_MS: 1000,
  DEFAULT_SNIPPET_NAME: 'Untitled',
  MAX_SNIPPET_NAME_LENGTH: 50,
};