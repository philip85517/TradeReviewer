import { describe, expect, it } from "vitest";

import { failedRefreshItems, runRefreshQueue } from "./refresh-queue";
import { RefreshCancellationService } from "./refresh-cancellation";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

type RefreshOutcome = {
  status: "complete" | "partial" | "source-unavailable";
  retryable: boolean;
};

describe("market refresh orchestration", () => {
  it("runs more than two snapshot batches with bounded concurrency and one active run", async () => {
    const service = new RefreshCancellationService();
    const handle = service.begin("all");
    const duplicate = service.begin("all");
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.controller).toBe(handle.controller);

    let active = 0;
    let maximumActive = 0;
    const started: number[] = [];
    const result = await runRefreshQueue(
      [1, 2, 3, 4, 5, 6, 7, 8],
      async (item) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        started.push(item);
        await new Promise((resolve) => setTimeout(resolve, 0));
        active -= 1;
        return item * 10;
      },
      { concurrency: 3, signal: handle.signal },
    );

    service.finish("all", handle.controller);

    expect(maximumActive).toBe(3);
    expect(started).toHaveLength(8);
    expect(result.every((item) => item.status === "fulfilled")).toBe(true);
    expect(
      result.map((item) => item.status === "fulfilled" && item.value),
    ).toEqual([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(service.isRunning("all")).toBe(false);
  });

  it("keeps a persisted result when cancellation arrives after save and cancels the rest", async () => {
    const controller = new AbortController();
    const first = deferred<void>();
    const cache = new Map<string, string>([["inflight", "old"]]);
    const run = runRefreshQueue(
      ["saved", "inflight", "queued"],
      async (item, _index, signal) => {
        if (item === "saved") {
          cache.set(item, "new");
          await first.promise;
          return {
            status: "complete",
            retryable: false,
          } satisfies RefreshOutcome;
        }
        await first.promise;
        if (signal?.aborted) throw signal.reason;
        cache.set(item, "new");
        return {
          status: "complete",
          retryable: false,
        } satisfies RefreshOutcome;
      },
      { concurrency: 2, signal: controller.signal },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort(new DOMException("用户取消", "AbortError"));
    first.resolve();
    const result = await run;

    expect(result.map((item) => item.status)).toEqual([
      "fulfilled",
      "cancelled",
      "cancelled",
    ]);
    expect(cache.get("saved")).toBe("new");
    expect(cache.get("inflight")).toBe("old");
    expect(cache.has("queued")).toBe(false);
  });

  it("retries thrown and hard interval failures while retaining partial usable results", async () => {
    const calls: string[] = [];
    const firstRun = await runRefreshQueue<string, RefreshOutcome>(
      ["complete", "partial", "hard", "thrown"],
      async (item) => {
        calls.push(item);
        if (item === "thrown") throw new Error("provider unavailable");
        if (item === "hard") {
          return { status: "source-unavailable", retryable: true };
        }
        if (item === "partial") {
          return { status: "partial", retryable: true };
        }
        return { status: "complete", retryable: false };
      },
      { concurrency: 3 },
    );

    const retryIds = failedRefreshItems(
      firstRun,
      (outcome) => outcome.retryable || outcome.status === "source-unavailable",
    );
    expect(retryIds).toEqual(["partial", "hard", "thrown"]);

    const retried = await runRefreshQueue(
      retryIds,
      async (item) => {
        calls.push(`retry:${item}`);
        return {
          status: "complete",
          retryable: false,
        } satisfies RefreshOutcome;
      },
      { concurrency: 2 },
    );

    expect(retried.every((item) => item.status === "fulfilled")).toBe(true);
    expect(calls).toEqual([
      "complete",
      "partial",
      "hard",
      "thrown",
      "retry:partial",
      "retry:hard",
      "retry:thrown",
    ]);
  });
});
