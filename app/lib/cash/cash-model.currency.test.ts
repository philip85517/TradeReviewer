import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import {
  buildCashSummary,
  type CashBaselineRecord,
  type CashInstrumentMetadata,
} from "./cash-model";

const scope = { nature: "live" as const, simulationRunId: null };
const metadata = new Map<string, CashInstrumentMetadata>([
  ["HK:700", { market: "HK", symbol: "00700", assetType: "stock" }],
  ["US:ETF", { market: "US", symbol: "ETF", assetType: "etf" }],
  ["CN:STOCK", { market: "CN-SH", symbol: "STOCK", assetType: "stock" }],
]);

function execution(
  id: string,
  side: TradeExecution["side"],
  instrumentId: string,
  instrumentCurrency: string,
  executedAt: string,
  options: Partial<TradeExecution["source"]> & {
    quantity?: string;
    price?: string;
    fee?: string;
  } = {},
): TradeExecution {
  const instrument = metadata.get(instrumentId);
  if (!instrument) throw new Error(`missing metadata for ${instrumentId}`);
  return {
    id,
    accountId: "account-a",
    accountLabel: "账户 A",
    instrument: {
      id: instrumentId,
      symbol: instrument.symbol,
      name: instrument.symbol,
      market: instrument.market,
      currency: instrumentCurrency,
    },
    side,
    executedAt,
    quantity: options.quantity ?? "1",
    price: options.price ?? "100",
    fee: options.fee ?? "0",
    source: {
      platform: "fixture",
      row: 1,
      tradeNature: "live",
      tradingDate: executedAt.slice(0, 10),
      feeStatus: "reported",
      ...options,
    },
  };
}

function baseline(currency: "CNY" | "USD" | "HKD", balance = "1000", asOf = "2026-09-01T00:00:00.000Z"): CashBaselineRecord {
  return {
    id: `baseline-${currency}`,
    scope,
    accountId: "account-a",
    currency,
    balance,
    asOf,
    updatedAt: "2026-09-26T00:00:00.000Z",
  };
}

function summary(executions: TradeExecution[], baselines: CashBaselineRecord[]) {
  return buildCashSummary({
    executions,
    baselines,
    scope,
    accountIds: [],
    today: "2026-09-26",
    instrumentMetadata: metadata,
    fxSnapshot: {
      id: "fixture-fx",
      baseCurrency: "CNY",
      asOf: "2026-09-26T00:00:00.000Z",
      source: "fixture",
      status: "complete",
      rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
    },
  });
}

describe("cash settlement currency evidence", () => {
  it("does not use an HK quote as cash when settlement currency is absent", () => {
    const result = summary([
      execution("hk-quote-only", "sell", "HK:700", "HKD", "2026-09-26T03:00:00.000Z", {
        cashChange: "100",
        fee: "0",
      }),
    ], [baseline("HKD")]);

    expect(result.cashTotal.originalByCurrency).toEqual({ HKD: "1000" });
    expect(result.cashTotalStatus).toBe("partial");
    expect(result.todayProceeds.originalByCurrency).toEqual({});
    expect(result.todayProceedsStatus).toBe("unavailable");
    expect(result.missingReasons.some((reason) => reason.includes("结算币种"))).toBe(true);
  });

  it("uses explicit CNY settlement for an HK quoted trade", () => {
    const result = summary([
      execution("connect-cny", "sell", "HK:700", "HKD", "2026-09-26T03:00:00.000Z", {
        settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "100", fees: {} },
      }),
    ], [baseline("CNY")]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "1100" });
    expect(result.cashTotalStatus).toBe("available");
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "100" });
    expect(result.todayProceedsStatus).toBe("available");
  });

  it("accepts explicit USD and HKD settlement evidence independently of quote fallback", () => {
    const result = summary([
      execution("usd-settlement", "sell", "US:ETF", "USD", "2026-09-26T03:00:00.000Z", {
        settlement: { currency: "USD", quantity: "1", grossAmount: "20", netAmount: "20", fees: {} },
      }),
      execution("hkd-settlement", "sell", "HK:700", "HKD", "2026-09-26T03:00:00.000Z", {
        settlement: { currency: "HKD", quantity: "1", grossAmount: "30", netAmount: "30", fees: {} },
      }),
    ], [baseline("USD"), baseline("HKD")]);

    expect(result.cashTotal.originalByCurrency).toEqual({ HKD: "1030", USD: "1020" });
    expect(result.cashTotalStatus).toBe("available");
    expect(result.todayProceeds.originalByCurrency).toEqual({ HKD: "30", USD: "20" });
  });

  it("uses signed net once when it already includes the reported fee", () => {
    const result = summary([
      execution("buy-with-fee", "buy", "CN:STOCK", "CNY", "2026-09-02T03:00:00.000Z", {
        fee: "5",
        settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "-105", fees: { commission: "5" } },
      }),
      execution("sell-with-fee", "sell", "CN:STOCK", "CNY", "2026-09-26T03:00:00.000Z", {
        fee: "5",
        settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "95", fees: { commission: "5" } },
      }),
    ], [baseline("CNY")]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "990" });
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "95" });
  });

  it("keeps a date-only execution ambiguous when it shares the baseline date", () => {
    const result = summary([
      execution("date-only-same-day", "sell", "CN:STOCK", "CNY", "2026-09-26T07:00:00.000Z", {
        sourceTimestampText: "20260926",
        timePrecision: "date-only",
        tradingDate: undefined,
        settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "100", fees: {} },
      }),
    ], [baseline("CNY", "1000", "2026-09-26T02:00:00.000Z")]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "1000" });
    expect(result.cashTotalStatus).toBe("partial");
    expect(result.missingReasons.some((reason) => reason.includes("同一自然日") && reason.includes("先后不明"))).toBe(true);
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "100" });
    expect(result.todayProceedsStatus).toBe("available");
  });

  it("still includes a precise execution after the baseline", () => {
    const result = summary([
      execution("precise-after", "sell", "CN:STOCK", "CNY", "2026-09-26T03:00:00.000Z", {
        timePrecision: "second",
        settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "100", fees: {} },
      }),
    ], [baseline("CNY", "1000", "2026-09-26T02:00:00.000Z")]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "1100" });
    expect(result.cashTotalStatus).toBe("available");
  });
});
