import { describe, expect, it } from "vitest";

import {
  hasOpenPosition,
  requiredMarketDataRange,
  requiredRangeExpanded,
} from "./sync-range";

describe("requiredMarketDataRange", () => {
  it("requests 400 calendar days before the first trade and 35 after the last", () => {
    expect(
      requiredMarketDataRange(
        "2025-03-13T07:07:12.000Z",
        "2025-03-20T01:40:52.000Z",
      ),
    ).toEqual({
      startDate: "2024-02-07",
      endDate: "2025-04-24",
    });
  });
});

describe("hasOpenPosition", () => {
  it("returns true when any account remains non-zero", () => {
    expect(
      hasOpenPosition([
        { accountId: "a", side: "buy", quantity: "100" },
        { accountId: "a", side: "sell", quantity: "40" },
      ]),
    ).toBe(true);
    expect(
      hasOpenPosition([
        { accountId: "a", side: "buy", quantity: "100" },
        { accountId: "a", side: "sell", quantity: "100" },
      ]),
    ).toBe(false);
  });

  it("extends an open position to the latest completed exchange session", () => {
    expect(
      requiredMarketDataRange(
        "2025-03-13T07:07:12.000Z",
        "2025-03-20T01:40:52.000Z",
        {
          open: true,
          market: "US",
          now: new Date("2025-04-07T12:00:00.000Z"),
        },
      ).endDate,
    ).toBe("2025-04-04");
  });

  it("falls back safely when a future exchange calendar is not published yet", () => {
    expect(
      requiredMarketDataRange(
        "2026-12-01T00:00:00.000Z",
        "2026-12-20T00:00:00.000Z",
        {
          open: true,
          market: "CN-SH",
          now: new Date("2027-01-06T12:00:00.000Z"),
        },
      ).endDate,
    ).toBe("2027-01-05");
  });
});

describe("requiredRangeExpanded", () => {
  it("only returns true for a new instrument or an expanded range", () => {
    const current = { startDate: "2024-01-01", endDate: "2025-01-01" };
    expect(requiredRangeExpanded(undefined, current)).toBe(true);
    expect(requiredRangeExpanded(current, current)).toBe(false);
    expect(
      requiredRangeExpanded(current, {
        startDate: "2023-12-31",
        endDate: "2025-01-01",
      }),
    ).toBe(true);
  });
});
