import { describe, expect, it } from "vitest";

import { runRefreshQueue } from "./refresh-queue";

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
});
