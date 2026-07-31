import { describe, expect, it } from "vitest";

import type {
  CoverageSegment,
  IntervalCoverageSegment,
} from "./contracts";
import { coverageStatusForSegments } from "./sync-status";

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
