import { useEffect } from 'react';

/**
 * Custom hook to set the page title dynamically
 * @param title - The page title (e.g., "Dashboard", "Leads List")
 * @param suffix - Optional suffix (defaults to "Corvia Solutions")
 */
export const usePageTitle = (title: string, suffix: string = 'Corvia Solutions') => {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | ${suffix}`;

    // Cleanup: restore previous title when component unmounts
    return () => {
      document.title = previousTitle;
    };
  }, [title, suffix]);
};

export default usePageTitle;
