import { describe, expect, it, vi } from "vitest";

import { createHomeMarketReadScheduler } from "./home-market-read-scheduler";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("createHomeMarketReadScheduler", () => {
  it("deduplicates concurrent reads with the same semantic key", async () => {
    const scheduler = createHomeMarketReadScheduler({ concurrency: 2 });
    const release = deferred<string>();
    const read = vi.fn(async () => release.promise);

    const first = scheduler.read("US:XPEV:daily:2025-01-01:2025-01-31", read);
    const second = scheduler.read("US:XPEV:daily:2025-01-01:2025-01-31", read);

    expect(read).toHaveBeenCalledOnce();
    release.resolve("cached");
    await expect(Promise.all([first, second])).resolves.toEqual(["cached", "cached"]);
    expect(read).toHaveBeenCalledOnce();
  });

  it("does not abort the underlying read after the last subscriber succeeds", async () => {
    const scheduler = createHomeMarketReadScheduler({ concurrency: 1 });
    let receivedSignal: AbortSignal | undefined;

    await expect(
      scheduler.read("US:XPEV:daily", (signal) => {
        receivedSignal = signal;
        return Promise.resolve("cached");
      }),
    ).resolves.toBe("cached");

    expect(receivedSignal?.aborted).toBe(false);
  });

  it("keeps active reads within the configured concurrency while continuing after a local failure", async () => {
    const scheduler = createHomeMarketReadScheduler({ concurrency: 2 });
    let active = 0;
    let maximumActive = 0;
    const read = vi.fn(async (key: string) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, key === "bad" ? 1 : 5));
      active -= 1;
      if (key === "bad") throw new Error("local cache unavailable");
      return key;
    });

    const results = await Promise.allSettled(
      ["one", "bad", "two", "three"].map((key) => scheduler.read(key, () => read(key))),
    );

    expect(maximumActive).toBe(2);
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
    ]);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it("cancels an abandoned subscriber without allowing a stale result to update its caller", async () => {
    const scheduler = createHomeMarketReadScheduler({ concurrency: 1 });
    const release = deferred<string>();
    let receivedSignal: AbortSignal | undefined;
    const read = vi.fn(async (signal: AbortSignal) => {
      receivedSignal = signal;
      return release.promise;
    });
    const controller = new AbortController();
    const pending = scheduler.read("US:XPEV:intraday:1h", read, controller.signal);

    controller.abort(new DOMException("stale", "AbortError"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(receivedSignal?.aborted).toBe(true);

    release.resolve("late");
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("aborts and rejects a read at the local cache budget", async () => {
    const scheduler = createHomeMarketReadScheduler({ concurrency: 1, timeoutMs: 5 });
    let receivedSignal: AbortSignal | undefined;
    const pending = scheduler.read("US:XPEV:daily", (signal) => {
      receivedSignal = signal;
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });

    await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("keeps an active slot occupied when a timed out read ignores abort", async () => {
    vi.useFakeTimers();
    try {
      const scheduler = createHomeMarketReadScheduler({ concurrency: 1, timeoutMs: 5 });
      const release = deferred<string>();
      let receivedSignal: AbortSignal | undefined;
      const timedOut = scheduler.read("ignores-abort", (signal) => {
        receivedSignal = signal;
        return release.promise;
      });
      let queuedStarted = false;
      const queued = scheduler.read("waits-for-ignored-abort", async () => {
        queuedStarted = true;
        return "queued";
      });
      const timedOutResult = expect(timedOut).rejects.toMatchObject({ name: "TimeoutError" });

      await vi.advanceTimersByTimeAsync(5);
      await timedOutResult;
      expect(receivedSignal?.aborted).toBe(true);
      expect(queuedStarted).toBe(false);

      release.resolve("late");
      await expect(queued).resolves.toBe("queued");
      expect(queuedStarted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the active concurrency bound while settling a finite queued batch", async () => {
    vi.useFakeTimers();
    try {
      const scheduler = createHomeMarketReadScheduler({
        concurrency: 4,
        interactiveReserve: 1,
        timeoutMs: 10,
      });
      let active = 0;
      let maximumActive = 0;
      const pending = Array.from({ length: 20 }, (_, index) => scheduler.read(
        `queued-${index}`,
        async () => {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          await new Promise(resolve => setTimeout(resolve, 1));
          active -= 1;
          return index;
        },
      ));

      await vi.advanceTimersByTimeAsync(100);

      await expect(Promise.all(pending)).resolves.toEqual(
        Array.from({ length: 20 }, (_, index) => index),
      );
      expect(maximumActive).toBeLessThanOrEqual(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not spend the active timeout while a read waits in the queue", async () => {
    vi.useFakeTimers();
    try {
      const scheduler = createHomeMarketReadScheduler({ concurrency: 1, timeoutMs: 10 });
      const starts: number[] = [];
      const pending = Array.from({ length: 4 }, (_, index) => scheduler.read(
        `queued-over-budget-${index}`,
        async () => {
          starts.push(index);
          await new Promise(resolve => setTimeout(resolve, 4));
          return index;
        },
      ));

      await vi.advanceTimersByTimeAsync(20);

      await expect(Promise.all(pending)).resolves.toEqual([0, 1, 2, 3]);
      expect(starts).toEqual([0, 1, 2, 3]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a queued read without starting its task", async () => {
    const scheduler = createHomeMarketReadScheduler({ concurrency: 1 });
    const release = deferred<string>();
    const started: string[] = [];
    const first = scheduler.read("active", () => release.promise);
    const controller = new AbortController();
    const queued = scheduler.read("queued-cancelled", async () => {
      started.push("queued-cancelled");
      return "unexpected";
    }, controller.signal);

    controller.abort(new DOMException("queued stale", "AbortError"));
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toEqual([]);

    release.resolve("active");
    await expect(first).resolves.toBe("active");
  });

  it("settles an active subscriber when the scheduler is disposed", async () => {
    const scheduler = createHomeMarketReadScheduler({ concurrency: 1 });
    const release = deferred<string>();
    const pending = scheduler.read("US:XPEV:daily", () => release.promise);

    scheduler.dispose();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    release.resolve("late");
  });

  it("keeps one reserved slot for interactive replay reads and prioritizes them", async () => {
    const scheduler = createHomeMarketReadScheduler({
      concurrency: 4,
      interactiveReserve: 1,
    });
    const started: string[] = [];
    const releases = new Map<string, ReturnType<typeof deferred<string>>>();
    const read = vi.fn(async (key: string) => {
      started.push(key);
      const pending = deferred<string>();
      releases.set(key, pending);
      return pending.promise;
    });

    const background = ["background-1", "background-2", "background-3", "background-4"]
      .map((key) => scheduler.read(key, () => read(key)));
    await Promise.resolve();
    expect(started).toEqual(["background-1", "background-2", "background-3"]);

    const interactive = scheduler.read(
      "replay",
      () => read("replay"),
      undefined,
      "interactive",
    );
    await Promise.resolve();
    expect(started).toEqual(["background-1", "background-2", "background-3", "replay"]);

    releases.get("background-1")!.resolve("one");
    releases.get("replay")!.resolve("replay");
    releases.get("background-2")!.resolve("two");
    releases.get("background-3")!.resolve("three");
    await new Promise((resolve) => setTimeout(resolve, 10));
    releases.get("background-4")!.resolve("four");
    await expect(interactive).resolves.toBe("replay");
    await expect(Promise.all(background)).resolves.toEqual([
      "one",
      "two",
      "three",
      "four",
    ]);
    expect(started).toEqual([
      "background-1",
      "background-2",
      "background-3",
      "replay",
      "background-4",
    ]);
  });

  it("promotes a queued background read into the reserved slot when it becomes interactive", async () => {
    const scheduler = createHomeMarketReadScheduler({
      concurrency: 4,
      interactiveReserve: 1,
    });
    const started: string[] = [];
    const releases = new Map<string, ReturnType<typeof deferred<string>>>();
    const read = vi.fn(async (key: string) => {
      started.push(key);
      const pending = deferred<string>();
      releases.set(key, pending);
      return pending.promise;
    });

    const background = ["background-1", "background-2", "background-3", "queued"].map((key) =>
      scheduler.read(key, () => read(key)),
    );
    await Promise.resolve();
    expect(started).toEqual(["background-1", "background-2", "background-3"]);

    const interactive = scheduler.read("queued", () => read("queued"), undefined, "interactive");
    await Promise.resolve();
    expect(started).toEqual(["background-1", "background-2", "background-3", "queued"]);

    for (const key of started) releases.get(key)!.resolve(key);
    await expect(interactive).resolves.toBe("queued");
    await expect(Promise.all(background)).resolves.toEqual([
      "background-1",
      "background-2",
      "background-3",
      "queued",
    ]);
  });
});
