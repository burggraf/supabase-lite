import { describe, it, expect } from 'vitest';
import { ROUTES, getPageFromPath, getPathFromPage } from '../routes';

describe('routes', () => {
  describe('getPageFromPath', () => {
    it('should return correct page for valid paths', () => {
      expect(getPageFromPath('/')).toBe('dashboard');
      expect(getPageFromPath('/sql-editor')).toBe('sql-editor');
      expect(getPageFromPath('/table-editor')).toBe('table-editor');
      expect(getPageFromPath('/database')).toBe('database');
    });

    it('should return dashboard for invalid paths', () => {
      expect(getPageFromPath('/invalid')).toBe('dashboard');
      expect(getPageFromPath('/nonexistent')).toBe('dashboard');
      expect(getPageFromPath('')).toBe('dashboard');
    });

    it('should handle future routes', () => {
      expect(getPageFromPath('/auth')).toBe('auth');
      expect(getPageFromPath('/storage')).toBe('storage');
      expect(getPageFromPath('/realtime')).toBe('realtime');
      expect(getPageFromPath('/edge-functions')).toBe('edge-functions');
      expect(getPageFromPath('/api')).toBe('api');
    });
  });

  describe('getPathFromPage', () => {
    it('should return correct path for valid pages', () => {
      expect(getPathFromPage('dashboard')).toBe('/');
      expect(getPathFromPage('sql-editor')).toBe('/sql-editor');
      expect(getPathFromPage('table-editor')).toBe('/table-editor');
      expect(getPathFromPage('database')).toBe('/database');
    });

    it('should return root path for invalid pages', () => {
      expect(getPathFromPage('invalid')).toBe('/');
      expect(getPathFromPage('nonexistent')).toBe('/');
      expect(getPathFromPage('')).toBe('/');
    });

    it('should handle future pages', () => {
      expect(getPathFromPage('auth')).toBe('/auth');
      expect(getPathFromPage('storage')).toBe('/storage');
      expect(getPathFromPage('realtime')).toBe('/realtime');
      expect(getPathFromPage('edge-functions')).toBe('/edge-functions');
      expect(getPathFromPage('api')).toBe('/api');
    });
  });

  describe('ROUTES constants', () => {
    it('should have correct route values', () => {
      expect(ROUTES.DASHBOARD).toBe('/');
      expect(ROUTES.SQL_EDITOR).toBe('/sql-editor');
      expect(ROUTES.TABLE_EDITOR).toBe('/table-editor');
      expect(ROUTES.DATABASE).toBe('/database');
      expect(ROUTES.AUTH).toBe('/auth');
      expect(ROUTES.STORAGE).toBe('/storage');
      expect(ROUTES.REALTIME).toBe('/realtime');
      expect(ROUTES.EDGE_FUNCTIONS).toBe('/edge-functions');
      expect(ROUTES.API).toBe('/api');
    });
  });
});