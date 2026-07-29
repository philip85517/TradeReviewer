"use client";

import { useEffect, useState, type RefObject } from "react";

export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>,
): {
  supported: boolean;
  isFullscreen: boolean;
  error: string | null;
  toggleFullscreen: () => Promise<void>;
} {
  const supported =
    typeof document !== "undefined" &&
    typeof document.exitFullscreen === "function" &&
    typeof HTMLElement !== "undefined" &&
    typeof HTMLElement.prototype.requestFullscreen === "function";
  // eslint-disable-next-line react-hooks/refs -- native fullscreen state must be accurate on the first mounted frame.
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== "undefined" && document.fullscreenElement === targetRef.current);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === targetRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, [targetRef]);

  return {
    supported,
    isFullscreen,
    error,
    toggleFullscreen: async () => {
      const target = targetRef.current;
      if (!supported || !target) return;
      setError(null);
      try {
        if (document.fullscreenElement === target) {
          await document.exitFullscreen();
        } else {
          await target.requestFullscreen();
        }
      } catch {
        setError(document.fullscreenElement === target ? "无法退出全屏" : "无法进入全屏");
      }
    },
  };
}
