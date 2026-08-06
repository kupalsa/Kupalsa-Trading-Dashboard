import { useCallback, useEffect, useState } from "react";

const KEY = "trading-dashboard-zoom";
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1.4;

function clamp(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/**
 * Page zoom applied via the --ui-zoom custom property. "Fit" measures how far
 * the content overflows the viewport and scales down just enough to remove it.
 */
export function useUiZoom() {
  const [zoom, setZoomState] = useState<number>(() => {
    const stored = Number(localStorage.getItem(KEY));
    return stored >= MIN_ZOOM && stored <= MAX_ZOOM ? stored : 1;
  });

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-zoom", String(zoom));
    localStorage.setItem(KEY, String(zoom));
  }, [zoom]);

  // Leaving the page must not leave the rest of the app scaled.
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--ui-zoom");
    };
  }, []);

  const setZoom = useCallback((z: number) => setZoomState(clamp(z)), []);

  const fit = useCallback(() => {
    // Measure at 1:1, then scale by the overflow ratio.
    document.documentElement.style.setProperty("--ui-zoom", "1");
    requestAnimationFrame(() => {
      const needed = document.documentElement.scrollHeight;
      const available = window.innerHeight;
      setZoomState(needed > available ? clamp((available / needed) * 0.985) : 1);
    });
  }, []);

  return { zoom, setZoom, fit };
}
