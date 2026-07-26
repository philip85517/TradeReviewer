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
    });
  });
});
