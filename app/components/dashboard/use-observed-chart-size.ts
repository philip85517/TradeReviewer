import { useCallback, useRef, useState } from "react";

export type ObservedChartSize = { width: number; height: number };

/** Keep SVG coordinates in the same units as the plot's rendered CSS box. */
export function useObservedChartSize<T extends Element>(initialSize: ObservedChartSize) {
  const [size, setSize] = useState(initialSize);
  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSize(current => current.width === rect.width && current.height === rect.height
        ? current
        : { width: rect.width, height: rect.height });
    };

    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observerRef.current = observer;
    observer.observe(element);
  }, []);

  return [elementRef, size] as const;
}
