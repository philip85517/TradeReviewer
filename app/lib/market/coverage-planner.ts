import type { CoverageSegment } from "./contracts";

export type DateRange = {
  startDate: string;
  endDate: string;
};

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function mergeCoverageRanges(
  coverage: CoverageSegment[],
  statuses: CoverageSegment["status"][],
) {
  const sorted = coverage
    .filter((segment) => statuses.includes(segment.status))
    .map(({ startDate, endDate }) => ({ startDate, endDate }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const merged: DateRange[] = [];
  for (const segment of sorted) {
    const previous = merged.at(-1);
    if (
      previous &&
      segment.startDate <= shiftDate(previous.endDate, 1)
    ) {
      if (segment.endDate > previous.endDate) {
        previous.endDate = segment.endDate;
      }
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

export function planCoverageGaps(
  required: DateRange,
  coverage: CoverageSegment[],
) {
  let gaps: DateRange[] = [{ ...required }];

  for (const cached of mergeCoverageRanges(coverage, ["complete", "partial"])) {
    gaps = gaps.flatMap((gap) => {
      if (
        cached.endDate < gap.startDate ||
        cached.startDate > gap.endDate
      ) {
        return [gap];
      }
      const remaining: DateRange[] = [];
      if (cached.startDate > gap.startDate) {
        remaining.push({
          startDate: gap.startDate,
          endDate: shiftDate(cached.startDate, -1),
        });
      }
      if (cached.endDate < gap.endDate) {
        remaining.push({
          startDate: shiftDate(cached.endDate, 1),
          endDate: gap.endDate,
        });
      }
      return remaining;
    });
  }

  const completeCoverage = mergeCoverageRanges(coverage, ["complete"]);
  const namedMissingDates = coverage
    .filter((segment) => segment.status === "partial")
    .flatMap((segment) => segment.missingTradingDates)
    .filter(
      (date) =>
        date >= required.startDate &&
        date <= required.endDate &&
        !completeCoverage.some(
          (segment) =>
            date >= segment.startDate && date <= segment.endDate,
        ),
    )
    .map((date) => ({ startDate: date, endDate: date }));

  const mergedGaps: DateRange[] = [];
  for (const gap of [...gaps, ...namedMissingDates].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  )) {
    const previous = mergedGaps.at(-1);
    if (previous && gap.startDate <= shiftDate(previous.endDate, 1)) {
      if (gap.endDate > previous.endDate) previous.endDate = gap.endDate;
    } else {
      mergedGaps.push({ ...gap });
    }
  }

  return mergedGaps.flatMap((gap) => {
    const chunks: DateRange[] = [];
    let startDate = gap.startDate;
    while (startDate <= gap.endDate) {
      const endDate = [
        shiftDate(startDate, 499),
        gap.endDate,
      ].sort()[0];
      chunks.push({ startDate, endDate });
      startDate = shiftDate(endDate, 1);
    }
    return chunks;
  });
}
