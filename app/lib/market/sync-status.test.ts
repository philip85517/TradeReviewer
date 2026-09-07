import { describe, expect, it } from "vitest";

import type {
  CoverageSegment,
  IntervalCoverageSegment,
} from "./contracts";
import {
  combinedMarketDataStatus,
  coverageStatusForSegments,
  coverageStatusForDateRange,
  coverageStatusForTimeRanges,
  displayMarketDataStatus,
} from "./sync-status";

describe("coverageStatusForSegments", () => {
  it("does not report a whole instrument complete while any segment is partial", () => {
    const segments: CoverageSegment[] = [
      {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        status: "partial",
        missingTradingDates: ["2024-05-02"],
      },
      {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
        status: "complete",
        missingTradingDates: [],
      },
    ];

    expect(coverageStatusForSegments(segments)).toBe("partial");
  });

  it("reports partial when cached 15m coverage is provider-limited", () => {
    const segments: IntervalCoverageSegment[] = [
      {
        interval: "15m",
        requestedStart: "2025-01-01T00:00:00.000Z",
        requestedEnd: "2025-01-31T23:59:59.999Z",
        status: "partial",
        reason: "provider-history-limit",
      },
    ];

    expect(coverageStatusForSegments(segments)).toBe("partial");
  });
});

describe("coverageStatusForDateRange", () => {
  it("reports a complete historical segment as stale when the required tail is missing", () => {
    expect(
      coverageStatusForDateRange(
        { startDate: "2026-01-01", endDate: "2026-09-01" },
        [
          {
            startDate: "2026-01-01",
            endDate: "2026-04-01",
            status: "complete",
            missingTradingDates: [],
          },
        ],
      ),
    ).toBe("stale");
  });

  it("ignores an old partial segment outside the requested range", () => {
    expect(
      coverageStatusForDateRange(
        { startDate: "2026-05-01", endDate: "2026-09-01" },
        [
          {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
            status: "partial",
            missingTradingDates: ["2025-06-03"],
          },
          {
            startDate: "2026-05-01",
            endDate: "2026-09-01",
            status: "complete",
            missingTradingDates: [],
          },
        ],
      ),
    ).toBe("complete");
  });

  it("reports a contiguous provider-latest tail separately from a real partial gap", () => {
    expect(
      coverageStatusForDateRange(
        { startDate: "2026-01-01", endDate: "2026-01-04" },
        [
          {
            startDate: "2026-01-01",
            endDate: "2026-01-04",
            status: "partial",
            actualEndDate: "2026-01-03",
            missingTradingDates: ["2026-01-04"],
            reason: "provider-latest-available",
          },
        ],
      ),
    ).toBe("latest-available");

    expect(
      coverageStatusForDateRange(
        { startDate: "2026-01-01", endDate: "2026-01-04" },
        [
          {
            startDate: "2026-01-01",
            endDate: "2026-01-04",
            status: "partial",
            actualEndDate: "2026-01-03",
            missingTradingDates: ["2026-01-02", "2026-01-04"],
            reason: "provider-latest-available",
          },
        ],
      ),
    ).toBe("partial");
  });

  it("reports an hourly tail as stale when a complete segment covers only its prefix", () => {
    expect(
      coverageStatusForTimeRanges(
        [{
          startTime: "2026-01-02T00:00:00.000Z",
          endTime: "2026-01-02T23:59:59.999Z",
        }],
        [{
          requestedStart: "2026-01-02T10:00:00.000Z",
          requestedEnd: "2026-01-02T10:00:00.000Z",
          status: "complete",
        }],
      ),
    ).toBe("stale");
  });
});

describe("combinedMarketDataStatus", () => {
  it("does not report partial when the required intraday interval was never requested", () => {
    expect(combinedMarketDataStatus("partial", "not-requested")).toBe(
      "not-requested",
    );
  });

  it("surfaces an intraday source failure above usable daily coverage", () => {
    expect(
      combinedMarketDataStatus("partial", "source-unavailable"),
    ).toBe("source-unavailable");
  });
});

describe("displayMarketDataStatus", () => {
  it("keeps an available hourly cache visible when daily data is not requested", () => {
    expect(
      displayMarketDataStatus("not-requested", "complete", {
        hasDailyData: false,
        hasIntradayData: true,
      }),
    ).toBe("complete");
  });

  it("uses the persisted interval failure when no hourly cache exists", () => {
    expect(
      displayMarketDataStatus("not-requested", "not-requested", {
        hasDailyData: false,
        hasIntradayData: false,
        intradayJobStatus: "source-unavailable",
      }),
    ).toBe("source-unavailable");
  });

  it("keeps hourly data usable when the daily task failed without daily cache", () => {
    expect(
      displayMarketDataStatus("source-unavailable", "complete", {
        hasDailyData: false,
        hasIntradayData: true,
      }),
    ).toBe("partial");
  });
});
