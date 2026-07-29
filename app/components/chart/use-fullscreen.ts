"use client";

import { useEffect, useState, type RefObject } from "react";

export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>,
): {
  supported: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => Promise<void>;
} {
  const supported =
    typeof document !== "undefined" &&
    typeof document.exitFullscreen === "function" &&
    typeof HTMLElement !== "undefined" &&
    typeof HTMLElement.prototype.requestFullscreen === "function";
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === targetRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, [targetRef]);

  return {
    supported,
    isFullscreen,
    toggleFullscreen: async () => {
      const target = targetRef.current;
      if (!supported || !target) return;
      if (document.fullscreenElement === target) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    },
  };
}
