import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import { buildCashSummary, type CashBaselineRecord, type CashInstrumentMetadata } from "./cash-model";

/**
 * Independent Decimal oracle values copied from the acceptance fixture. The
 * execution list is intentionally self-contained so a clean checkout does
 * not depend on the untracked browser fixture database.
 */
const expected = {
  cashTotalsByCurrency: { HKD: "27997", USD: "5272", CNY: "55994" },
  reportCny: "118095.3",
  reportHkd: "131217",
  partialSale: { HKD: "12999" },
};

const instrumentMetadata = new Map<string, CashInstrumentMetadata>([
  ["HK:700", { market: "HK", symbol: "00700", assetType: "stock" }],
  ["US:BABA", { market: "US", symbol: "BABA", assetType: "stock" }],
  ["CN-SH:600036", { market: "CN-SH", symbol: "600036", assetType: "stock" }],
  ["US:QQQ", { market: "US", symbol: "QQQ", assetType: "etf" }],
  ["HK:939", { market: "HK", symbol: "00939", assetType: "stock" }],
  ["CN-SH:600519", { market: "CN-SH", symbol: "600519", assetType: "stock" }],
  ["US:NVDA", { market: "US", symbol: "NVDA", assetType: "stock" }],
  ["CN-SZ:002594", { market: "CN-SZ", symbol: "002594", assetType: "stock" }],
  ["CN-SH:600000", { market: "CN-SH", symbol: "600000", assetType: "stock" }],
  ["US:AAPL", { market: "US", symbol: "AAPL", assetType: "stock" }],
]);

function execution(
  id: string,
  instrumentId: string,
  market: string,
  currency: string,
  date: string,
  side: TradeExecution["side"],
  quantity: string,
  price: string,
): TradeExecution {
  const symbol = instrumentMetadata.get(instrumentId)?.symbol ?? instrumentId.split(":").at(-1) ?? instrumentId;
  return {
    id,
    accountId: "qa-main",
    accountLabel: "B2完整样例",
    instrument: { id: instrumentId, symbol, name: symbol, market, currency },
    side,
    executedAt: `${date}T02:00:00.000Z`,
    quantity,
    price,
    fee: "1",
    source: {
      platform: "fixture",
      row: Number(id.replace("b2r-", "")),
      tradingDate: date,
      marketCalendarDate: date,
      feeStatus: "reported",
      tradeNature: "live",
    },
  };
}

const executions: TradeExecution[] = [
  execution("b2r-1", "HK:700", "HK", "HKD", "2026-01-05", "buy", "200", "300"),
  execution("b2r-2", "US:BABA", "US", "USD", "2026-02-03", "buy", "100", "80"),
  execution("b2r-3", "CN-SH:600036", "CN-SH", "CNY", "2026-03-03", "buy", "1000", "28"),
  execution("b2r-4", "US:QQQ", "US", "USD", "2026-04-01", "buy", "20", "460"),
  execution("b2r-5", "HK:939", "HK", "HKD", "2026-05-04", "buy", "5000", "5"),
  execution("b2r-6", "CN-SH:600519", "CN-SH", "CNY", "2026-06-01", "buy", "10", "1600"),
  execution("b2r-7", "HK:700", "HK", "HKD", "2026-09-25", "sell", "40", "325"),
  execution("b2r-8", "US:NVDA", "US", "USD", "2026-01-08", "buy", "100", "100"),
  execution("b2r-9", "US:NVDA", "US", "USD", "2026-02-03", "sell", "100", "118"),
  execution("b2r-10", "CN-SZ:002594", "CN-SZ", "CNY", "2026-03-02", "buy", "100", "260"),
  execution("b2r-11", "CN-SZ:002594", "CN-SZ", "CNY", "2026-04-08", "sell", "100", "250"),
  execution("b2r-12", "CN-SH:600000", "CN-SH", "CNY", "2026-05-04", "buy", "1000", "10"),
  execution("b2r-13", "CN-SH:600000", "CN-SH", "CNY", "2026-06-08", "sell", "1000", "11"),
  execution("b2r-14", "US:AAPL", "US", "USD", "2026-08-03", "buy", "40", "180"),
  execution("b2r-15", "US:AAPL", "US", "USD", "2026-09-08", "sell", "40", "200"),
  execution("b2r-16", "US:NVDA", "US", "USD", "2026-09-10", "buy", "30", "130"),
  execution("b2r-17", "US:NVDA", "US", "USD", "2026-09-18", "sell", "30", "126"),
];

const baselines: CashBaselineRecord[] = ([
  ["HKD", "100000"],
  ["USD", "20000"],
  ["CNY", "100000"],
] as const).map(([currency, balance]) => ({
  id: `cash:live:qa-main:${currency}`,
  scope: { nature: "live", simulationRunId: null },
  accountId: "qa-main",
  currency,
  balance,
  asOf: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-09-26T00:00:00.000Z",
}));

const fxSnapshot = {
  id: "b2r-synthetic-fx",
  baseCurrency: "CNY" as const,
  asOf: "2026-09-26T03:00:00.000Z",
  source: "BOC",
  status: "complete" as const,
  rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
};

function summary(today: string, targetCurrency: "CNY" | "HKD") {
  return buildCashSummary({
    executions,
    baselines,
    scope: { nature: "live", simulationRunId: null },
    accountIds: ["qa-main"],
    today,
    targetCurrency,
    fxSnapshot,
    instrumentMetadata,
  });
}

describe("cash independent acceptance oracle", () => {
  it("matches the independently calculated multi-currency totals and partial sale", () => {
    const current = summary("2026-09-26", "CNY");
    expect(current.cashTotal.originalByCurrency).toEqual(expected.cashTotalsByCurrency);
    expect(current.cashTotal.converted).toBe(expected.reportCny);
    expect(current.todayProceedsStatus).toBe("zero");
    expect(Object.fromEntries(Object.keys(expected.cashTotalsByCurrency).map((currency) => [currency, current.todayProceeds.originalByCurrency[currency] ?? "0"]))).toEqual({ HKD: "0", USD: "0", CNY: "0" });

    const hkd = summary("2026-09-26", "HKD");
    expect(hkd.cashTotal.converted).toBe(expected.reportHkd);

    const partialSale = summary("2026-09-25", "HKD");
    expect(partialSale.todayProceeds.originalByCurrency).toEqual(expected.partialSale);
    expect(partialSale.todayProceedsStatus).toBe("available");
  });
});
