import { describe, expect, it } from "vitest";

import type { MarketDataJob } from "../storage/market-data-jobs";
import {
  summarizeGlobalMarketRefresh,
  summarizePersistedMarketDataJobs,
} from "./refresh-summary";

describe("global market refresh summary", () => {
  it("keeps retryable items separate from mutually exclusive result categories", () => {
    expect(
      summarizeGlobalMarketRefresh({
        running: false,
        total: 236,
        completed: 81,
        processed: 236,
        partial: 151,
        failed: 155,
      }),
    ).toMatchObject({
      total: 236,
      processed: 236,
      completed: 81,
      partial: 151,
      failed: 4,
      retryable: 155,
    });
  });

  it("respects explicit category counts when the queue state is fully typed", () => {
    expect(
      summarizeGlobalMarketRefresh({
        total: 236,
        completed: 81,
        processed: 236,
        partial: 151,
        failed: 4,
        retryable: 155,
      }),
    ).toMatchObject({
      completed: 81,
      partial: 151,
      failed: 4,
      retryable: 155,
    });
  });

  it("summarizes saved per-instrument jobs without inventing a batch", () => {
    const jobs: MarketDataJob[] = [
      {
        instrumentId: "US:OK",
        symbol: "OK",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "complete",
        intervals: [{ interval: "1D", status: "complete" }],
      },
      {
        instrumentId: "US:PARTIAL",
        symbol: "PARTIAL",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "partial",
        intervals: [
          { interval: "1D", status: "complete" },
          {
            interval: "1h",
            status: "source-unavailable",
            message: "小时线暂不可用",
            coverageStart: "2026-09-14T01:00:00.000Z",
            coverageEnd: "2026-09-15T01:00:00.000Z",
            error: {
              code: "source-unavailable",
              message: "小时线暂不可用",
            },
          },
        ],
      },
      {
        instrumentId: "US:FAILED",
        symbol: "FAILED",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "source-forbidden",
        intervals: [
          {
            interval: "1D",
            status: "source-forbidden",
            message: "日线被拒绝",
          },
        ],
      },
    ];

    expect(
      summarizePersistedMarketDataJobs(jobs, [
        "US:OK",
        "US:PARTIAL",
        "US:FAILED",
        "US:MISSING",
      ]),
    ).toMatchObject({
      total: 4,
      processed: 3,
      completed: 1,
      partial: 1,
      failed: 1,
      retryable: 2,
      unfinished: 1,
      unfinishedInstrumentIds: ["US:MISSING"],
      retryableInstrumentIds: ["US:PARTIAL", "US:FAILED"],
      unfinishedDetails: [
        {
          instrumentId: "US:MISSING",
          symbol: "MISSING",
          market: "US",
          requestedAt: "",
          status: "not-requested",
          reason: "尚未记录行情更新任务",
        },
      ],
      failureDetails: [
        {
          instrumentId: "US:PARTIAL",
          intervals: [
            expect.objectContaining({
              interval: "1h",
              status: "source-unavailable",
              reason: "小时线暂不可用",
              coverageStart: "2026-09-14T01:00:00.000Z",
              coverageEnd: "2026-09-15T01:00:00.000Z",
            }),
          ],
          requestedAt: "2026-09-15T00:00:00.000Z",
        },
        {
          instrumentId: "US:FAILED",
          intervals: [
            expect.objectContaining({
              interval: "1D",
              status: "source-forbidden",
              reason: "日线被拒绝",
            }),
          ],
        },
      ],
    });
  });

  it("keeps latest-available partial, hard failures, and unfinished jobs distinct", () => {
    const jobs: MarketDataJob[] = [
      {
        instrumentId: "US:LATEST",
        symbol: "LATEST",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "latest-available",
        intervals: [{ interval: "1D", status: "latest-available" }],
      },
      {
        instrumentId: "US:INCOMPLETE",
        symbol: "INCOMPLETE",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "syncing",
        intervals: [{ interval: "1D", status: "syncing" }],
      },
      {
        instrumentId: "US:MIXED",
        symbol: "MIXED",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "complete",
        intervals: [
          { interval: "1D", status: "complete" },
          { interval: "1h", status: "source-unavailable" },
        ],
      },
      {
        instrumentId: "US:UNKNOWN",
        symbol: "UNKNOWN",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "error",
        intervals: [],
      },
      {
        instrumentId: "US:EMPTY",
        symbol: "EMPTY",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "not-requested",
        intervals: [{ interval: "1D", status: "not-requested" }],
      },
    ];

    const summary = summarizePersistedMarketDataJobs(jobs);
    expect(summary).toMatchObject({
      total: 5,
      processed: 3,
      completed: 0,
      partial: 2,
      failed: 1,
      retryable: 2,
      unfinished: 2,
      unfinishedInstrumentIds: ["US:INCOMPLETE", "US:EMPTY"],
      retryableInstrumentIds: ["US:MIXED", "US:UNKNOWN"],
    });
    expect(summary.unfinishedDetails).toEqual([
      expect.objectContaining({
        instrumentId: "US:INCOMPLETE",
        status: "syncing",
        reason: "上次未结束，可重新尝试",
      }),
      expect.objectContaining({
        instrumentId: "US:EMPTY",
        status: "not-requested",
        reason: "尚未开始行情更新",
      }),
    ]);
    expect(summary.failureDetails.at(-1)).toMatchObject({
      instrumentId: "US:UNKNOWN",
      intervals: [
        {
          interval: "overall",
          status: "error",
          reason: "该标的行情更新未完成",
        },
      ],
    });
  });

  it("does not use saved jobs when the caller explicitly supplies an empty inventory", () => {
    const summary = summarizePersistedMarketDataJobs(
      [{
        instrumentId: "US:OLD",
        symbol: "OLD",
        market: "US",
        requestedAt: "2026-09-15T00:00:00.000Z",
        status: "complete",
        intervals: [{ interval: "1D", status: "complete" }],
      }],
      [],
    );
    expect(summary).toMatchObject({
      total: 0,
      processed: 0,
      completed: 0,
      partial: 0,
      failed: 0,
      retryable: 0,
      unfinished: 0,
    });
  });
});
