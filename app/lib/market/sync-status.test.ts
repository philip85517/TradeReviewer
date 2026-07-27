import { describe, expect, it } from "vitest";

import type { CoverageSegment } from "./contracts";
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
});
