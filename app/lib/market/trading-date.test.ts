import { describe, expect, it, vi } from "vitest";

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

  it("reuses one formatter per resolved market time zone", async () => {
    vi.resetModules();
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    function DateTimeFormatMock(
      this: unknown,
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ) {
      return new OriginalDateTimeFormat(locales, options);
    }
    const dateTimeFormatSpy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(DateTimeFormatMock as typeof Intl.DateTimeFormat);
    try {
      const { marketTradingDate: freshMarketTradingDate } = await import(
        "./trading-date"
      );

      expect(
        freshMarketTradingDate("2025-01-01T01:00:00Z", "US"),
      ).toBe("2024-12-31");
      expect(
        freshMarketTradingDate("2025-01-02T01:00:00Z", "US"),
      ).toBe("2025-01-01");
      expect(
        freshMarketTradingDate("2024-12-31T16:30:00Z", "HK"),
      ).toBe("2025-01-01");
      expect(
        freshMarketTradingDate("2024-12-31T16:30:00Z", "CN-SH"),
      ).toBe("2025-01-01");
      expect(
        freshMarketTradingDate("2024-12-31T16:30:00Z", "CN-SZ"),
      ).toBe("2025-01-01");

      expect(
        dateTimeFormatSpy.mock.calls.map(([, options]) => options?.timeZone),
      ).toEqual(["America/New_York", "Asia/Hong_Kong", "Asia/Shanghai"]);
    } finally {
      dateTimeFormatSpy.mockRestore();
    }
  });

  it("keeps date-only and invalid timestamp semantics", () => {
    expect(marketTradingDate("2025-01-01", "US")).toBe("2025-01-01");
    expect(() => marketTradingDate("not-a-timestamp", "US")).toThrow(
      RangeError,
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
