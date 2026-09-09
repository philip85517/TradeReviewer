import { describe, expect, it } from "vitest";

import {
  hasOpenPosition,
  requiredMarketDataRange,
  requiredRangeExpanded,
} from "./sync-range";
import { expectedTradingDates } from "./calendar";

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

  it("requests 180 market sessions after the last trade when history is available", () => {
    const range = requiredMarketDataRange(
      "2025-03-13T07:07:12.000Z",
      "2025-03-20T15:40:52.000Z",
      {
        market: "US",
        now: new Date("2026-01-05T12:00:00.000Z"),
      },
    );

    expect(
      expectedTradingDates("US", "2025-03-21", range.endDate),
    ).toHaveLength(180);
  });

  it("caps the forward daily request at the latest completed session", () => {
    const range = requiredMarketDataRange(
      "2026-08-31T02:00:00.000Z",
      "2026-08-31T02:00:00.000Z",
      {
        market: "HK",
        now: new Date("2026-09-02T12:00:00.000Z"),
      },
    );

    expect(range.endDate).toBe("2026-09-01");
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
