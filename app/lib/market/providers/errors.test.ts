import { afterEach, describe, expect, it, vi } from "vitest";

const NativeDateTimeFormat = Intl.DateTimeFormat;

// Forward every constructor call to real Intl: the observed cost is formatter
// construction, while all timezone conversion and validation remain real.
async function observedConversions() {
  vi.resetModules();
  const constructor = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (locales, options) {
    return new NativeDateTimeFormat(locales, options);
  });
  const conversions = await import("./errors");
  return { ...conversions, constructor };
}

afterEach(() => vi.restoreAllMocks());

describe("market time conversion formatter lifecycle", () => {
  it("lazily constructs each of the three market formatters once across distinct dates and directions", async () => {
    const { constructor, utcIsoToMarketLocal, marketLocalTimestampToIso } = await observedConversions();
    expect(constructor).not.toHaveBeenCalled();
    const examples = [
      ["Asia/Shanghai", "2026-01-05T16:00:00.000Z", "2026-01-06 00:00:00"],
      ["Asia/Shanghai", "2026-06-30T16:30:00.000Z", "2026-07-01 00:30:00"],
      ["Asia/Hong_Kong", "2025-12-31T16:00:00.000Z", "2026-01-01 00:00:00"],
      ["Asia/Hong_Kong", "2026-07-01T15:59:59.000Z", "2026-07-01 23:59:59"],
      ["America/New_York", "2026-01-05T21:00:00.000Z", "2026-01-05 16:00:00"],
      ["America/New_York", "2026-07-01T20:00:00.000Z", "2026-07-01 16:00:00"],
      ["America/New_York", "2026-03-08T06:59:59.000Z", "2026-03-08 01:59:59"],
      ["America/New_York", "2026-03-08T16:00:00.000Z", "2026-03-08 12:00:00"],
      ["America/New_York", "2026-11-01T04:59:59.000Z", "2026-11-01 00:59:59"],
      ["America/New_York", "2026-11-01T17:00:00.000Z", "2026-11-01 12:00:00"],
    ] as const;
    for (const [timeZone, iso, local] of examples) {
      expect(utcIsoToMarketLocal(iso, timeZone)).toBe(local);
      expect(marketLocalTimestampToIso(local, timeZone)).toBe(iso);
    }
    expect(constructor.mock.calls.map(([, options]) => options?.timeZone)).toEqual([
      "Asia/Shanghai", "Asia/Hong_Kong", "America/New_York",
    ]);
  });

  it("constructs arbitrary valid zones and aliases on each conversion without retaining them", async () => {
    const { constructor, utcIsoToMarketLocal } = await observedConversions();
    const examples = [
      ["Europe/London", "2026-01-05T12:00:00Z", "2026-01-05 12:00:00"],
      ["Europe/London", "2026-07-01T12:00:00Z", "2026-07-01 13:00:00"],
      ["UTC", "2026-01-05T12:00:00Z", "2026-01-05 12:00:00"],
      ["UTC", "2026-07-01T12:00:00Z", "2026-07-01 12:00:00"],
      ["US/Eastern", "2026-01-05T21:00:00Z", "2026-01-05 16:00:00"],
      ["US/Eastern", "2026-07-01T20:00:00Z", "2026-07-01 16:00:00"],
    ] as const;
    for (const [timeZone, iso, local] of examples) expect(utcIsoToMarketLocal(iso, timeZone)).toBe(local);
    expect(constructor.mock.calls.map(([, options]) => options?.timeZone)).toEqual([
      "Europe/London", "Europe/London", "UTC", "UTC", "US/Eastern", "US/Eastern",
    ]);
  });

  it("keeps the two correction attempts and existing DST gap/fold semantics", async () => {
    const { constructor, marketLocalTimestampToIso, utcIsoToMarketLocal } = await observedConversions();
    expect(marketLocalTimestampToIso("2026-01-05 16:00", "US/Eastern")).toBe("2026-01-05T21:00:00.000Z");
    expect(constructor).toHaveBeenCalledTimes(2);
    constructor.mockClear();
    expect(() => marketLocalTimestampToIso("2026-03-08 02:30:00", "US/Eastern")).toThrow("行情时间格式已变化");
    expect(constructor).toHaveBeenCalledTimes(2);
    expect(() => marketLocalTimestampToIso("2026-03-08 02:30:00", "America/New_York")).toThrow("行情时间格式已变化");
    // The existing two-attempt solver also fails closed when the second attempt
    // crosses a transition and would need a third confirmation. Preserve it.
    expect(() => marketLocalTimestampToIso("2026-03-08 03:00:00", "America/New_York")).toThrow("行情时间格式已变化");
    expect(() => marketLocalTimestampToIso("2026-11-01 03:00:00", "America/New_York")).toThrow("行情时间格式已变化");
    expect(utcIsoToMarketLocal("2026-03-08T07:00:00Z", "America/New_York")).toBe("2026-03-08 03:00:00");
    expect(utcIsoToMarketLocal("2026-11-01T08:00:00Z", "America/New_York")).toBe("2026-11-01 03:00:00");
    expect(marketLocalTimestampToIso("2026-11-01 01:30:00", "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
    expect(utcIsoToMarketLocal("2026-11-01T05:30:00Z", "America/New_York")).toBe("2026-11-01 01:30:00");
    expect(utcIsoToMarketLocal("2026-11-01T06:30:00Z", "America/New_York")).toBe("2026-11-01 01:30:00");
  });

  it("does not retain invalid timezone errors or suppress later valid conversions", async () => {
    const { constructor, utcIsoToMarketLocal, marketLocalTimestampToIso } = await observedConversions();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(() => utcIsoToMarketLocal("2026-01-05T16:00:00Z", "Not/A_Timezone")).toThrow(RangeError);
      expect(() => marketLocalTimestampToIso("2026-01-06 00:00:00", "Not/A_Timezone")).toThrow(RangeError);
    }
    expect(constructor.mock.calls.map(([, options]) => options?.timeZone)).toEqual(Array(4).fill("Not/A_Timezone"));
    expect(utcIsoToMarketLocal("2026-01-05T16:00:00Z", "Asia/Shanghai")).toBe("2026-01-06 00:00:00");
  });

  it("rejects malformed timestamps before constructing a formatter", async () => {
    const { constructor, utcIsoToMarketLocal, marketLocalTimestampToIso } = await observedConversions();
    expect(() => utcIsoToMarketLocal("not-a-date", "Asia/Shanghai")).toThrow("行情时间格式已变化");
    expect(() => utcIsoToMarketLocal("2026-01-06T25:00:00Z", "Asia/Shanghai")).toThrow("行情时间格式已变化");
    expect(() => marketLocalTimestampToIso("2026-01-06", "Asia/Shanghai")).toThrow("行情时间格式已变化");
    expect(() => marketLocalTimestampToIso("2026-01-06T00:00:00Z", "Asia/Shanghai")).toThrow("行情时间格式已变化");
    expect(constructor).not.toHaveBeenCalled();
  });
});
