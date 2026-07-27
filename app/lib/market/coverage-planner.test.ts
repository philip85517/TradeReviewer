import { describe, expect, it } from "vitest";

import type { CoverageSegment } from "./contracts";
import { planCoverageGaps } from "./coverage-planner";

describe("planCoverageGaps", () => {
  it("returns no work when complete local coverage contains the required range", () => {
    const coverage: CoverageSegment[] = [
      {
        startDate: "2024-01-01",
        endDate: "2025-03-31",
        status: "complete",
        provider: "tencent",
        fetchedAt: "2025-04-01T00:00:00Z",
        missingTradingDates: [],
      },
    ];

    expect(
      planCoverageGaps(
        { startDate: "2024-03-01", endDate: "2025-03-01" },
        coverage,
      ),
    ).toEqual([]);
  });

  it("requests only the dates before and after cached complete coverage", () => {
    const coverage: CoverageSegment[] = [
      {
        startDate: "2024-02-01",
        endDate: "2024-11-30",
        status: "complete",
        provider: "tencent",
        fetchedAt: "2024-12-01T00:00:00Z",
        missingTradingDates: [],
      },
    ];

    expect(
      planCoverageGaps(
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        coverage,
      ),
    ).toEqual([
      { startDate: "2024-01-01", endDate: "2024-01-31" },
      { startDate: "2024-12-01", endDate: "2024-12-31" },
    ]);
  });

  it("requests only the named missing dates inside partial coverage", () => {
    const coverage: CoverageSegment[] = [
      {
        startDate: "2024-01-01",
        endDate: "2024-12-31",
        status: "partial",
        provider: "tencent",
        missingTradingDates: ["2024-05-02", "2024-05-03"],
      },
    ];

    expect(
      planCoverageGaps(
        { startDate: "2024-01-01", endDate: "2024-12-31" },
        coverage,
      ),
    ).toEqual([{ startDate: "2024-05-02", endDate: "2024-05-03" }]);
  });

  it("splits long gaps into requests of at most 500 natural days", () => {
    expect(
      planCoverageGaps(
        { startDate: "2023-01-01", endDate: "2025-12-31" },
        [],
      ),
    ).toEqual([
      { startDate: "2023-01-01", endDate: "2024-05-14" },
      { startDate: "2024-05-15", endDate: "2025-09-26" },
      { startDate: "2025-09-27", endDate: "2025-12-31" },
    ]);
  });
});
