import { describe, expect, it } from "vitest";

import type { CoverageSegment, DailyCandleRecord } from "./contracts";
import { normalizeProviderLatestTails } from "./coverage-tail";

const candle = (tradingDate: string): DailyCandleRecord => ({
  instrumentId: "HK:1810",
  tradingDate,
  open: "34",
  high: "35",
  low: "33",
  close: "34.5",
  volume: "100",
  currency: "HKD",
  provider: "tencent",
  providerSymbol: "hk01810",
  adjustmentMode: "raw",
  fetchedAt: "2026-09-04T00:00:00.000Z",
});

describe("normalizeProviderLatestTails", () => {
  it("classifies a legacy one-session tail using the candles already in storage", () => {
    const coverage: CoverageSegment[] = [{
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      status: "partial",
      missingTradingDates: ["2026-09-04"],
    }];

    expect(
      normalizeProviderLatestTails(
        "HK",
        coverage,
        [candle("2026-09-01"), candle("2026-09-02"), candle("2026-09-03")],
      ),
    ).toEqual([expect.objectContaining({
      reason: "provider-latest-available",
      actualEndDate: "2026-09-03",
      missingTradingDates: ["2026-09-04"],
    })]);
  });

  it("does not classify a middle gap as provider-latest", () => {
    const coverage: CoverageSegment[] = [{
      startDate: "2026-09-01",
      endDate: "2026-09-04",
      status: "partial",
      missingTradingDates: ["2026-09-02", "2026-09-04"],
    }];

    expect(
      normalizeProviderLatestTails(
        "HK",
        coverage,
        [candle("2026-09-01"), candle("2026-09-03")],
      ),
    ).toEqual(coverage);
  });

  it("does not classify a long historical tail as provider-latest", () => {
    const missingTradingDates = [
      "2026-09-04",
      "2026-09-05",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
    ];
    const coverage: CoverageSegment[] = [{
      startDate: "2026-09-01",
      endDate: "2026-09-11",
      status: "partial",
      missingTradingDates,
    }];

    expect(
      normalizeProviderLatestTails(
        "HK",
        coverage,
        [candle("2026-09-01"), candle("2026-09-02"), candle("2026-09-03")],
      ),
    ).toEqual(coverage);
  });
});
