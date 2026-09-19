import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GLOBAL_MARKET_REFRESH_LOCK_NAME,
  withGlobalMarketRefreshLock,
} from "./refresh-lock";

const originalLocks = Object.getOwnPropertyDescriptor(navigator, "locks");

afterEach(() => {
  if (originalLocks) {
    Object.defineProperty(navigator, "locks", originalLocks);
  } else {
    Reflect.deleteProperty(navigator, "locks");
  }
});

describe("withGlobalMarketRefreshLock", () => {
  it("runs directly when Web Locks is unavailable", async () => {
    Reflect.deleteProperty(navigator, "locks");
    const operation = vi.fn().mockResolvedValue("done");

    await expect(withGlobalMarketRefreshLock(operation)).resolves.toBe("done");
    expect(operation).toHaveBeenCalledOnce();
  });

  it("does not start work when another same-origin tab owns the lock", async () => {
    const operation = vi.fn().mockResolvedValue("should-not-run");
    const onUnavailable = vi.fn();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(async (_name: string, _options: unknown, callback: (lock: null) => unknown) =>
          callback(null)),
      },
    });

    await expect(
      withGlobalMarketRefreshLock(operation, onUnavailable),
    ).resolves.toBeUndefined();
    expect(operation).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it("holds the exclusive lock across the whole operation", async () => {
    const operation = vi.fn().mockResolvedValue("done");
    const request = vi.fn(async (
      name: string,
      options: unknown,
      callback: (lock: object) => Promise<string>,
    ) => {
      expect(name).toBe(GLOBAL_MARKET_REFRESH_LOCK_NAME);
      expect(options).toEqual({ mode: "exclusive", ifAvailable: true });
      return callback({});
    });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });

    await expect(withGlobalMarketRefreshLock(operation)).resolves.toBe("done");
    expect(request).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledOnce();
  });
});
