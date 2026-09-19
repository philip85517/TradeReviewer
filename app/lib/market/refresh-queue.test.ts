import { describe, expect, it } from "vitest";

import { failedRefreshItems, runRefreshQueue } from "./refresh-queue";
import { RefreshCancellationService } from "./refresh-cancellation";

describe("runRefreshQueue", () => {
  it("keeps active refreshes within the configured concurrency and preserves order", async () => {
    let active = 0;
    let maximumActive = 0;
    const result = await runRefreshQueue(
      [1, 2, 3, 4, 5],
      async (value) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setTimeout(resolve, value === 1 ? 10 : 1));
        active -= 1;
        return value * 2;
      },
      { concurrency: 2 },
    );

    expect(maximumActive).toBe(2);
    expect(result).toEqual([
      { item: 1, status: "fulfilled", value: 2 },
      { item: 2, status: "fulfilled", value: 4 },
      { item: 3, status: "fulfilled", value: 6 },
      { item: 4, status: "fulfilled", value: 8 },
      { item: 5, status: "fulfilled", value: 10 },
    ]);
  });

  it("records a failed item and continues the remaining refreshes", async () => {
    const result = await runRefreshQueue(
      ["ok-1", "bad", "ok-2"],
      async (item) => {
        if (item === "bad") throw new Error("provider unavailable");
        return item;
      },
      { concurrency: 1 },
    );

    expect(result[1]).toMatchObject({
      item: "bad",
      status: "rejected",
      reason: expect.objectContaining({ message: "provider unavailable" }),
    });
    expect(result[2]).toEqual({
      item: "ok-2",
      status: "fulfilled",
      value: "ok-2",
    });
  });

  it("keeps thrown and hard-status items retryable while excluding cancellations", () => {
    const results = [
      { item: "thrown", status: "rejected", reason: new Error("offline") },
      { item: "hard-status", status: "fulfilled", value: "source-unavailable" },
      { item: "partial", status: "fulfilled", value: "partial" },
      { item: "cancelled", status: "cancelled", reason: new DOMException("cancelled", "AbortError") },
    ] as const;

    expect(
      failedRefreshItems(results, (status) => status === "source-unavailable"),
    ).toEqual(["thrown", "hard-status"]);
  });

  it("cancels queued items and passes the signal to active workers", async () => {
    const controller = new AbortController();
    let releaseFirst!: () => void;
    const firstFinished = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const started: number[] = [];
    const settled: string[] = [];
    const run = runRefreshQueue(
      [1, 2, 3, 4, 5],
      async (item, _index, signal) => {
        started.push(item);
        expect(signal).toBe(controller.signal);
        if (item <= 2) {
          await firstFinished;
          if (signal?.aborted) throw signal.reason;
        }
        return item;
      },
      {
        concurrency: 2,
        signal: controller.signal,
        onItemSettled: ({ result }) => settled.push(`${result.item}:${result.status}`),
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    releaseFirst();

    const result = await run;
    expect(started).toEqual([1, 2]);
    expect(result.map((item) => item.status)).toEqual([
      "cancelled",
      "cancelled",
      "cancelled",
      "cancelled",
      "cancelled",
    ]);
    expect(settled).toHaveLength(5);
  });

  it("does not let a late completion remove a newer cancellation run", () => {
    const service = new RefreshCancellationService();
    const first = service.begin("all");
    const duplicate = service.begin("all");
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.controller).toBe(first.controller);

    expect(service.cancel("all")).toBe(true);
    const second = service.begin("all");
    expect(second.duplicate).toBe(false);
    expect(second.controller).not.toBe(first.controller);
    expect(service.finish("all", first.controller)).toBe(false);
    expect(service.isRunning("all")).toBe(true);
    expect(service.finish("all", second.controller)).toBe(true);
    expect(service.isRunning("all")).toBe(false);
  });
});
