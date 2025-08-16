import { useState, useEffect, useCallback } from 'react';
import { getPageFromPath, getPathFromPage } from '@/lib/routes';

export function useRouter() {
  const [currentPage, setCurrentPage] = useState(() => {
    return getPageFromPath(window.location.pathname);
  });

  const navigate = useCallback((page: string) => {
    const path = getPathFromPage(page);
    window.history.pushState(null, '', path);
    setCurrentPage(page);
  }, []);

  const handlePopState = useCallback(() => {
    const page = getPageFromPath(window.location.pathname);
    setCurrentPage(page);
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handlePopState]);

  return {
    currentPage,
    navigate,
  };
}