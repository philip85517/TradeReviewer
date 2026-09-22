import { describe, expect, it } from "vitest";

import type { MarketDataJob } from "../storage/market-data-jobs";
import { checkMarketDataRetryJob, retryMarketData } from "./retry-market-data";

function job(overrides: Partial<MarketDataJob> = {}): MarketDataJob {
  return {
    instrumentId: "US:TEST",
    symbol: "TEST",
    market: "US",
    requestedAt: "2026-09-21T00:00:00.000Z",
    status: "partial",
    intervals: [
      { interval: "1D", status: "complete" },
      { interval: "1h", status: "complete" },
    ],
    ...overrides,
  };
}

describe("retry-market-data", () => {
  it("does not accept a missing job as a completed retry", () => {
    expect(checkMarketDataRetryJob(undefined, "holdings")).toMatchObject({ status: "unfinished" });
  });

  it("uses the daily terminal result for holdings and ignores an unrelated 1h failure", async () => {
    const mixed = job({
      intervals: [
        { interval: "1D", status: "complete" },
        { interval: "1h", status: "source-unavailable", message: "小时线源暂不可用" },
      ],
    });

    await expect(retryMarketData({
      dimension: "holdings",
      instrumentIds: ["US:TEST"],
      start: () => true,
      jobFor: () => mixed,
    })).resolves.toBeUndefined();
    await expect(retryMarketData({
      dimension: "historical",
      instrumentIds: ["US:TEST"],
      start: () => true,
      jobFor: () => mixed,
    })).rejects.toThrow("小时线源暂不可用");
  });

  it("does not ignore a job-level storage failure when daily data is complete", async () => {
    const persistedFailure = job({
      status: "storage-error",
      message: "行情状态写入失败",
      intervals: [
        { interval: "1D", status: "complete" },
        { interval: "1h", status: "source-unavailable" },
      ],
    });

    await expect(retryMarketData({
      dimension: "holdings",
      instrumentIds: ["US:TEST"],
      start: () => true,
      jobFor: () => persistedFailure,
    })).rejects.toThrow("行情状态写入失败");
  });

  it("rejects before consulting an old terminal job when the refresh did not start", async () => {
    const old = job({ status: "complete" });
    let jobRead = false;
    await expect(retryMarketData({
      dimension: "holdings",
      instrumentIds: ["US:TEST"],
      start: () => false,
      jobFor: () => {
        jobRead = true;
        return old;
      },
    })).rejects.toThrow("行情更新未开始");
    expect(jobRead).toBe(false);
  });
});
