import { describe, expect, it } from "vitest";

import { CalendarOutOfRangeError, expectedTradingDates } from "./calendar";

describe("expectedTradingDates", () => {
  it("preserves inclusive boundaries, empty ranges, out-of-coverage rejection and caller ownership", () => {
    const dates = expectedTradingDates("US", "2025-01-02", "2025-01-03");
    expect(dates).toEqual(["2025-01-02", "2025-01-03"]);
    dates.length = 0;
    expect(expectedTradingDates("US", "2025-01-02", "2025-01-03")).toEqual(["2025-01-02", "2025-01-03"]);
    expect(expectedTradingDates("US", "2025-01-04", "2025-01-05")).toEqual([]);
    expect(expectedTradingDates("US", "2025-01-03", "2025-01-02")).toEqual([]);
    expect(() => expectedTradingDates("US", "2009-12-31", "2010-01-02")).toThrow(CalendarOutOfRangeError);
    expect(() => expectedTradingDates("CN-SH", "2026-12-31", "2027-01-01")).toThrow(CalendarOutOfRangeError);
  });

  it.each([
    ["US", "2025-01-01", "2025-01-03", ["2025-01-02", "2025-01-03"]],
    ["HK", "2025-01-01", "2025-01-03", ["2025-01-02", "2025-01-03"]],
    [
      "CN-SH",
      "2025-01-27",
      "2025-02-05",
      ["2025-01-27", "2025-02-05"],
    ],
    [
      "CN-SZ",
      "2026-02-13",
      "2026-02-24",
      ["2026-02-13", "2026-02-24"],
    ],
  ] as const)(
    "uses the bundled %s exchange calendar",
    (market, start, end, expected) => {
      expect(expectedTradingDates(market, start, end)).toEqual(expected);
    },
  );
});
