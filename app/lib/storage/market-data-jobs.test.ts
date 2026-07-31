import { beforeEach, describe, expect, it } from "vitest";

import {
  loadMarketDataJobs,
  saveMarketDataJob,
} from "./market-data-jobs";

describe("market data jobs", () => {
  beforeEach(() => window.localStorage.clear());

  it("persists the latest request for each instrument", () => {
    saveMarketDataJob({
      instrumentId: "HK:01810",
      symbol: "01810",
      market: "HK",
      requestedAt: "2025-01-01T00:00:00.000Z",
      status: "syncing",
    });
    saveMarketDataJob({
      instrumentId: "HK:01810",
      symbol: "01810",
      market: "HK",
      requestedAt: "2025-01-01T00:00:01.000Z",
      status: "needs-provider",
      message: "provider not configured",
    });

    expect(loadMarketDataJobs()).toEqual([
      expect.objectContaining({
        instrumentId: "HK:01810",
        status: "needs-provider",
      }),
    ]);
  });

  it("recovers an interrupted syncing job as retryable error", () => {
    saveMarketDataJob({
      instrumentId: "US:NVDA",
      symbol: "NVDA",
      market: "US",
      requestedAt: "2025-01-01T00:00:00.000Z",
      status: "syncing",
    });

    expect(loadMarketDataJobs()[0]).toMatchObject({
      instrumentId: "US:NVDA",
      status: "error",
      intervals: [
        expect.objectContaining({ interval: "1D", status: "error" }),
      ],
    });
  });

  it("migrates a version-1 daily job into its version-2 interval detail", () => {
    window.localStorage.setItem(
      "trade-reviewer:market-data-jobs:v1",
      JSON.stringify({
        version: 1,
        jobs: [
          {
            instrumentId: "HK:01810",
            symbol: "01810",
            market: "HK",
            requestedAt: "2025-01-01T00:00:00.000Z",
            status: "partial",
            message: "one daily segment is missing",
          },
        ],
      }),
    );

    expect(loadMarketDataJobs()).toEqual([
      expect.objectContaining({
        instrumentId: "HK:01810",
        intervals: [
          {
            interval: "1D",
            status: "partial",
            message: "one daily segment is missing",
          },
        ],
      }),
    ]);
  });

  it("persists stock jobs with each native interval's status", () => {
    saveMarketDataJob({
      instrumentId: "US:NVDA",
      symbol: "NVDA",
      market: "US",
      requestedAt: "2025-01-01T00:00:00.000Z",
      status: "partial",
      intervals: [
        {
          interval: "1D",
          status: "complete",
          coverageStart: "2025-01-01T00:00:00.000Z",
          coverageEnd: "2025-01-31T23:59:59.999Z",
        },
        {
          interval: "15m",
          status: "partial",
          message: "provider history is limited",
        },
      ],
    });

    expect(loadMarketDataJobs()[0]).toMatchObject({
      status: "partial",
      intervals: [
        expect.objectContaining({ interval: "1D", status: "complete" }),
        expect.objectContaining({ interval: "15m", status: "partial" }),
      ],
    });
    expect(
      JSON.parse(
        window.localStorage.getItem("trade-reviewer:market-data-jobs:v1") ?? "{}",
      ),
    ).toMatchObject({ version: 2 });
  });
});
