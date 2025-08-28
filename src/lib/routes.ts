export const ROUTES = {
  DASHBOARD: '/',
  SQL_EDITOR: '/sql-editor',
  TABLE_EDITOR: '/table-editor',
  DATABASE: '/database',
  AUTH: '/auth',
  STORAGE: '/storage',
  REALTIME: '/realtime',
  APP_HOSTING: '/app-hosting',
  API: '/api',
} as const;

export const ROUTE_TO_PAGE: Record<string, string> = {
  [ROUTES.DASHBOARD]: 'dashboard',
  [ROUTES.SQL_EDITOR]: 'sql-editor',
  [ROUTES.TABLE_EDITOR]: 'table-editor',
  [ROUTES.DATABASE]: 'database',
  [ROUTES.AUTH]: 'auth',
  [ROUTES.STORAGE]: 'storage',
  [ROUTES.REALTIME]: 'realtime',
  [ROUTES.APP_HOSTING]: 'app-hosting',
  [ROUTES.API]: 'api',
};

export const PAGE_TO_ROUTE: Record<string, string> = {
  'dashboard': ROUTES.DASHBOARD,
  'sql-editor': ROUTES.SQL_EDITOR,
  'table-editor': ROUTES.TABLE_EDITOR,
  'database': ROUTES.DATABASE,
  'auth': ROUTES.AUTH,
  'storage': ROUTES.STORAGE,
  'realtime': ROUTES.REALTIME,
  'app-hosting': ROUTES.APP_HOSTING,
  'api': ROUTES.API,
};

export function getPageFromPath(path: string): string {
  return ROUTE_TO_PAGE[path] || 'dashboard';
}

export function getPathFromPage(page: string): string {
  return PAGE_TO_ROUTE[page] || ROUTES.DASHBOARD;
}