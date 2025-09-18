export const ROUTES = {
  DASHBOARD: '/',
  SQL_EDITOR: '/sql-editor',
  TABLE_EDITOR: '/table-editor',
  DATABASE: '/database',
  AUTH: '/auth',
  STORAGE: '/storage',
  REALTIME: '/realtime',
  APPLICATION_SERVER: '/application-server',
  API: '/api',
  EDGE_FUNCTIONS: '/edge-functions',
  EDGE_FUNCTIONS_SECRETS: '/edge-functions/secrets',
} as const;

export const ROUTE_TO_PAGE: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'dashboard',
  [ROUTES.SQL_EDITOR]: 'sql-editor',
  [ROUTES.TABLE_EDITOR]: 'table-editor',
  [ROUTES.DATABASE]: 'database',
  [ROUTES.AUTH]: 'auth',
  [ROUTES.STORAGE]: 'storage',
  [ROUTES.REALTIME]: 'realtime',
  [ROUTES.APPLICATION_SERVER]: 'application-server',
  [ROUTES.API]: 'api',
  [ROUTES.EDGE_FUNCTIONS]: 'edge-functions',
  [ROUTES.EDGE_FUNCTIONS_SECRETS]: 'edge-functions-secrets',
};

export const PAGE_TO_ROUTE: Record<string, string> = {
  'dashboard': ROUTES.DASHBOARD,
  'sql-editor': ROUTES.SQL_EDITOR,
  'table-editor': ROUTES.TABLE_EDITOR,
  'database': ROUTES.DATABASE,
  'auth': ROUTES.AUTH,
  'storage': ROUTES.STORAGE,
  'realtime': ROUTES.REALTIME,
  'application-server': ROUTES.APPLICATION_SERVER,
  'api': ROUTES.API,
  'edge-functions': ROUTES.EDGE_FUNCTIONS,
  'edge-functions-secrets': ROUTES.EDGE_FUNCTIONS_SECRETS,
};

export function getPageFromPath(path: string): string {
  // Handle exact matches first
  if (ROUTE_TO_PAGE[path]) {
    return ROUTE_TO_PAGE[path];
  }
  
  // Handle dynamic routes
  if (path.startsWith('/edge-functions/')) {
    const segments = path.split('/');
    if (segments[2] === 'secrets') {
      return 'edge-functions-secrets';
    }
    // If it's not secrets, it's a function editor route
    return 'edge-functions-editor';
  }
  
  return 'dashboard';
}

export function getPathFromPage(page: string): string {
  return PAGE_TO_ROUTE[page] || ROUTES.DASHBOARD;
}

// Helper functions for dynamic routes
export function getFunctionNameFromPath(path: string): string | null {
  if (path.startsWith('/edge-functions/')) {
    const segments = path.split('/');
    if (segments[2] && segments[2] !== 'secrets') {
      return segments[2];
    }
  }
  return null;
}

export function buildFunctionEditorPath(functionName: string): string {
  return `/edge-functions/${functionName}`;
}

export function buildFunctionEditorUrl(functionName: string): string {
  return buildFunctionEditorPath(functionName);
}

