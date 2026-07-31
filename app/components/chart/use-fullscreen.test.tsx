import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRef } from "react";

import { useFullscreen } from "./use-fullscreen";

type Equal<Left, Right> = (
  <Value>() => Value extends Left ? 1 : 2
) extends <Value>() => Value extends Right ? 1 : 2
  ? true
  : false;

type ToggleReturn = ReturnType<ReturnType<typeof useFullscreen>["toggleFullscreen"]>;
const toggleReturnsPromiseVoid: Equal<ToggleReturn, Promise<void>> = true;
void toggleReturnsPromiseVoid;

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

  it("reports a rejected fullscreen request without rejecting the toggle promise", async () => {
    const target = document.createElement("section");
    const ref = { current: target };
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("denied")),
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });

    const { result } = renderHook(() => useFullscreen(ref));

    await expect(act(() => result.current.toggleFullscreen())).resolves.toBeUndefined();
    expect(result.current.error).toBe("无法进入全屏");
  });

  it("reports a rejected fullscreen exit and starts synchronized when already fullscreen", async () => {
    const target = document.createElement("section");
    const ref = { current: target };
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: target });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error("denied")),
    });

    const { result } = renderHook(() => useFullscreen(ref));
    expect(result.current.isFullscreen).toBe(true);

    await expect(act(() => result.current.toggleFullscreen())).resolves.toBeUndefined();
    expect(result.current.error).toBe("无法退出全屏");
  });
});
