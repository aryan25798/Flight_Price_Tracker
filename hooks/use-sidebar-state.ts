"use client";

import * as React from "react";

const STORAGE_KEY = "aerodrop_sidebar_collapsed";

export function useSidebarState() {
  const [isCollapsed, setIsCollapsedState] = React.useState<boolean>(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
    // Check initial screen width
    const width = window.innerWidth;
    const isTablet = width >= 768 && width < 1024;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      setIsCollapsedState(saved === "true");
    } else if (isTablet) {
      setIsCollapsedState(true);
    }

    // Auto-adapt when screen resizes to tablet
    function handleResize() {
      const w = window.innerWidth;
      if (w >= 768 && w < 1024) {
        setIsCollapsedState(true);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore quota/private mode errors
      }
      return next;
    });
  }, []);

  const setCollapsed = React.useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore
    }
  }, []);

  return {
    isCollapsed: isMounted ? isCollapsed : false,
    toggleSidebar,
    setCollapsed,
  };
}
