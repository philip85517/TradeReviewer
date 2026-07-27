import { describe, expect, it } from "vitest";

import type { ProviderDailyCandle } from "./contracts";
import { validateProviderCandles } from "./validation";

const valid: ProviderDailyCandle[] = [
  {
    tradingDate: "2025-01-02",
    open: "10",
    high: "12",
    low: "9",
    close: "11",
    volume: "100",
  },
  {
    tradingDate: "2025-01-03",
    open: "11",
    high: "13",
    low: "10",
    close: "12",
    volume: "120",
  },
];

describe("validateProviderCandles", () => {
  it("accepts a valid ordered response inside the requested range", () => {
    expect(
      validateProviderCandles(valid, "2025-01-01", "2025-01-31"),
    ).toEqual(valid);
  });

  it.each([
    [[valid[1], valid[0]], "日期必须严格递增"],
    [[valid[0], valid[0]], "日期必须严格递增"],
    [[{ ...valid[0], low: "11.5" }], "价格关系无效"],
    [[{ ...valid[0], volume: "-1" }], "成交量不能为负数"],
    [[{ ...valid[0], tradingDate: "2024-12-31" }], "日期超出请求区间"],
    [[{ ...valid[0], tradingDate: "2025-01-32" }], "交易日期无效"],
    [[{ ...valid[0], open: "NaN" }], "开盘价不是有限数字"],
    [[{ ...valid[0], close: "Infinity" }], "收盘价不是有限数字"],
  ] as const)("rejects an invalid response: %s", (candles, message) => {
    expect(() =>
      validateProviderCandles(
        candles as unknown as ProviderDailyCandle[],
        "2025-01-01",
        "2025-01-31",
      ),
    ).toThrow(message);
  });
});
