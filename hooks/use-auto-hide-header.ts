"use client";

import * as React from "react";

interface AutoHideHeaderOptions {
  threshold?: number;
  topOffset?: number;
  disabled?: boolean;
}

export function useAutoHideHeader(options: AutoHideHeaderOptions = {}) {
  const { threshold = 12, topOffset = 45, disabled = false } = options;
  const [isVisible, setIsVisible] = React.useState(true);
  const lastScrollY = React.useRef(0);
  const ticking = React.useRef(false);

  React.useEffect(() => {
    if (disabled) {
      setIsVisible(true);
      return;
    }

    function updateHeader() {
      const currentScrollY = Math.max(0, window.scrollY);
      const delta = currentScrollY - lastScrollY.current;

      // Always show when near the very top of the page
      if (currentScrollY <= topOffset) {
        setIsVisible(true);
      } else if (Math.abs(delta) >= threshold) {
        // Scrolling down hides header; scrolling up shows header
        if (delta > 0) {
          setIsVisible(false);
        } else {
          setIsVisible(true);
        }
      }

      lastScrollY.current = currentScrollY;
      ticking.current = false;
    }

    function onScroll() {
      if (!ticking.current) {
        window.requestAnimationFrame(updateHeader);
        ticking.current = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold, topOffset, disabled]);

  return isVisible;
}
