import { describe, expect, it } from "vitest";

import {
  marketCalendarDateOffset,
  marketTradingDate,
} from "./trading-date";

describe("marketTradingDate", () => {
  it("uses the exchange-local calendar day across UTC midnight", () => {
    expect(marketTradingDate("2025-01-01T01:00:00Z", "US")).toBe(
      "2024-12-31",
    );
    expect(marketTradingDate("2024-12-31T16:30:00Z", "HK")).toBe(
      "2025-01-01",
    );
    expect(marketTradingDate("2024-12-31T16:30:00Z", "CN-SH")).toBe(
      "2025-01-01",
    );
    expect(marketTradingDate("2024-12-31T16:30:00Z", "CN-SZ")).toBe(
      "2025-01-01",
    );
  });
});

describe("marketCalendarDateOffset", () => {
  it("preserves exchange-local wall time across the US daylight-saving boundary", () => {
    expect(
      marketCalendarDateOffset(
        "2025-03-10T13:30:00.000Z",
        "US",
        -7,
      ),
    ).toBe("2025-03-03T14:30:00.000Z");
  });
});
