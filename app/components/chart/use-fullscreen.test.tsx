import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";

import { useFullscreen } from "./use-fullscreen";

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    value: null,
  });
});

describe("useFullscreen", () => {
  it("enters and exits fullscreen while tracking fullscreenchange", async () => {
    const target = document.createElement("section");
    const ref = { current: target };
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: requestFullscreen });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });

    const { result } = renderHook(() => useFullscreen(ref));
    await act(() => result.current.toggleFullscreen());
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: target });
    act(() => document.dispatchEvent(new Event("fullscreenchange")));
    expect(result.current.isFullscreen).toBe(true);

    await act(() => result.current.toggleFullscreen());
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("reports unsupported when the browser fullscreen API is unavailable", () => {
    const target = document.createElement("section");
    const ref = createRef<HTMLElement>();
    Object.assign(ref, { current: target });
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", { configurable: true, value: undefined });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: undefined });

    const { result } = renderHook(() => useFullscreen(ref));

    expect(result.current.supported).toBe(false);
  });
});
