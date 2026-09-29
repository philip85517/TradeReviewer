import { describe, expect, it } from "vitest";

import {
  hasOpenPosition,
  requiredMarketDataRange,
  requiredRangeExpanded,
} from "./sync-range";
import { CalendarOutOfRangeError, expectedTradingDates } from "./calendar";

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
        open: false,
        market: "US",
        now: new Date("2026-01-05T12:00:00.000Z"),
      },
    );

    expect(
      expectedTradingDates("US", "2025-03-21", range.endDate),
    ).toHaveLength(180);
  });

  it("extends an open market range through the latest completed session", () => {
    const range = requiredMarketDataRange(
      "2024-01-02T15:00:00.000Z",
      "2024-01-02T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2026-01-05T12:00:00.000Z"),
      },
    );

    expect(range.endDate).toBe("2026-01-02");
  });

  it("does not expose the current session before its local close", () => {
    expect(
      requiredMarketDataRange(
        "2026-09-28T15:00:00.000Z",
        "2026-09-28T15:00:00.000Z",
        {
          open: true,
          market: "US",
          now: new Date("2026-09-28T19:59:59.000Z"),
        },
      ).endDate,
    ).toBe("2026-09-25");
  });

  it("uses exchange-local close for the fixed reconciliation cutoff", () => {
    const hkRange = requiredMarketDataRange(
      "2026-09-01T15:00:00.000Z",
      "2026-09-01T15:00:00.000Z",
      {
        open: true,
        market: "HK",
        now: new Date("2026-09-28T15:59:59.000Z"),
      },
    );
    const cnRange = requiredMarketDataRange(
      "2026-09-01T15:00:00.000Z",
      "2026-09-01T15:00:00.000Z",
      {
        open: true,
        market: "CN-SH",
        now: new Date("2026-09-28T15:59:59.000Z"),
      },
    );

    expect(hkRange.endDate).toBe("2026-09-28");
    expect(cnRange.endDate).toBe("2026-09-28");
  });

  it("keeps supported CN sessions usable before the regular close", () => {
    for (const market of ["CN-SH", "CN-SZ"] as const) {
      const beforeClose = requiredMarketDataRange(
        "2026-09-01T15:00:00.000Z",
        "2026-09-01T15:00:00.000Z",
        {
          open: true,
          market,
          now: new Date("2026-09-24T06:59:59.000Z"),
        },
      );
      const atClose = requiredMarketDataRange(
        "2026-09-01T15:00:00.000Z",
        "2026-09-01T15:00:00.000Z",
        {
          open: true,
          market,
          now: new Date("2026-09-24T07:00:00.000Z"),
        },
      );

      expect(beforeClose.endDate).toBe("2026-09-23");
      expect(atClose.endDate).toBe("2026-09-24");
    }
  });

  it("fails closed for historical CN sessions without year-specific hours evidence", () => {
    for (const market of ["CN-SH", "CN-SZ"] as const) {
      expect(() =>
        requiredMarketDataRange(
          "2016-01-01T00:00:00.000Z",
          "2016-01-06T00:00:00.000Z",
          {
            open: true,
            market,
            now: new Date("2016-01-07T05:00:00.000Z"),
          },
        ),
      ).toThrow(CalendarOutOfRangeError);
    }
  });

  it("includes the US session at its exchange-local close", () => {
    const range = requiredMarketDataRange(
      "2026-09-01T15:00:00.000Z",
      "2026-09-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2026-09-28T20:00:00.000Z"),
      },
    );

    expect(range.endDate).toBe("2026-09-28");
  });

  it("uses verified 2026 early closes without inferring other dates", () => {
    const usBeforeClose = requiredMarketDataRange(
      "2026-11-01T15:00:00.000Z",
      "2026-11-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2026-11-27T17:59:59.000Z"),
      },
    );
    const usAtClose = requiredMarketDataRange(
      "2026-11-01T15:00:00.000Z",
      "2026-11-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2026-11-27T18:00:00.000Z"),
      },
    );
    const hkBeforeClose = requiredMarketDataRange(
      "2026-12-01T01:00:00.000Z",
      "2026-12-01T01:00:00.000Z",
      {
        open: true,
        market: "HK",
        now: new Date("2026-12-31T04:09:59.000Z"),
      },
    );
    const hkAtClose = requiredMarketDataRange(
      "2026-12-01T01:00:00.000Z",
      "2026-12-01T01:00:00.000Z",
      {
        open: true,
        market: "HK",
        now: new Date("2026-12-31T04:10:00.000Z"),
      },
    );

    expect(usBeforeClose.endDate).toBe("2026-11-25");
    expect(usAtClose.endDate).toBe("2026-11-27");
    expect(hkBeforeClose.endDate).toBe("2026-12-30");
    expect(hkAtClose.endDate).toBe("2026-12-31");
  });

  it("uses verified NYSE early closes in 2027 and 2028", () => {
    const us2027 = requiredMarketDataRange(
      "2027-11-01T15:00:00.000Z",
      "2027-11-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2027-11-26T18:00:00.000Z"),
      },
    );
    const us2028July = requiredMarketDataRange(
      "2028-07-01T15:00:00.000Z",
      "2028-07-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2028-07-03T17:00:00.000Z"),
      },
    );
    const us2028November = requiredMarketDataRange(
      "2028-11-01T15:00:00.000Z",
      "2028-11-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2028-11-24T18:00:00.000Z"),
      },
    );

    expect(us2027.endDate).toBe("2027-11-26");
    expect(us2028July.endDate).toBe("2028-07-03");
    expect(us2028November.endDate).toBe("2028-11-24");
  });

  it("rejects an unverified early close until the regular safe cutoff", () => {
    expect(() =>
      requiredMarketDataRange(
        "2029-11-01T15:00:00.000Z",
        "2029-11-01T15:00:00.000Z",
        {
          open: true,
          market: "US",
          now: new Date("2029-11-23T18:00:00.000Z"),
        },
      ),
    ).toThrow(CalendarOutOfRangeError);
    const usAfterRegularClose = requiredMarketDataRange(
      "2029-11-01T15:00:00.000Z",
      "2029-11-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2029-11-23T21:00:00.000Z"),
      },
    );
    const usHoliday = requiredMarketDataRange(
      "2029-11-01T15:00:00.000Z",
      "2029-11-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2029-11-22T18:00:00.000Z"),
      },
    );

    expect(usAfterRegularClose.endDate).toBe("2029-11-23");
    expect(usHoliday.endDate).toBe("2029-11-21");
    expect(() =>
      requiredMarketDataRange(
        "2027-12-01T01:00:00.000Z",
        "2027-12-01T01:00:00.000Z",
        {
          open: true,
          market: "HK",
          now: new Date("2027-12-31T04:00:00.000Z"),
        },
      ),
    ).toThrow(CalendarOutOfRangeError);
  });

  it("resolves US close through the daylight-saving transition", () => {
    const beforeClose = requiredMarketDataRange(
      "2026-03-01T15:00:00.000Z",
      "2026-03-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2026-03-09T19:59:59.000Z"),
      },
    );
    const atClose = requiredMarketDataRange(
      "2026-03-01T15:00:00.000Z",
      "2026-03-01T15:00:00.000Z",
      {
        open: true,
        market: "US",
        now: new Date("2026-03-09T20:00:00.000Z"),
      },
    );

    expect(beforeClose.endDate).toBe("2026-03-06");
    expect(atClose.endDate).toBe("2026-03-09");
  });

  it("caps an open range at the latest completed session", () => {
    const range = requiredMarketDataRange(
      "2026-08-31T02:00:00.000Z",
      "2026-08-31T02:00:00.000Z",
      {
        open: true,
        market: "HK",
        now: new Date("2026-09-02T12:00:00.000Z"),
      },
    );

    expect(range.endDate).toBe("2026-09-02");
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
          now: new Date("2025-04-07T21:00:00.000Z"),
        },
      ).endDate,
    ).toBe("2025-04-07");
  });

  it("fails closed when the exchange calendar is not published yet", () => {
    expect(() =>
      requiredMarketDataRange(
        "2026-12-01T00:00:00.000Z",
        "2026-12-20T00:00:00.000Z",
        {
          open: true,
          market: "CN-SH",
          now: new Date("2027-01-06T12:00:00.000Z"),
        },
      ),
    ).toThrow(CalendarOutOfRangeError);
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
