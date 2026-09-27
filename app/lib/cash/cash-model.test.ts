import { describe, expect, it, vi } from "vitest";

import type { TradeExecution } from "../trades/types";
import {
  CASH_SETTINGS_KEY,
  buildCashSummary,
  emptyCashBaselineState,
  normalizeCashBaselineDraft,
  normalizeCashBaselineState,
  upsertCashBaseline,
  type CashBaselineRecord,
  type CashExecutionContext,
  type CashInstrumentMetadata,
  type CashScope,
} from "./cash-model";

const scope: CashScope = { nature: "live", simulationRunId: null };
const instrumentMetadata = new Map<string, CashInstrumentMetadata>([
  ["CN:STOCK", { market: "CN-SH", symbol: "STOCK", assetType: "stock" }],
  ["US:ETF", { market: "US", symbol: "ETF", assetType: "etf" }],
]);
const fxSnapshot = {
  id: "fx:test",
  baseCurrency: "CNY" as const,
  asOf: "2026-09-26T00:00:00.000Z",
  source: "test",
  status: "complete" as const,
  rates: { "USD/CNY": "7", "HKD/CNY": "0.9" },
};

function execution(
  id: string,
  side: "buy" | "sell",
  executedAt: string,
  amount: string,
  options: Partial<TradeExecution["source"]> & { accountId?: string; currency?: string; assetId?: string; fee?: string } = {},
): TradeExecution {
  const assetId = options.assetId ?? "CN:STOCK";
  const currency = options.currency ?? (assetId === "US:ETF" ? "USD" : "CNY");
  const [assetMarket, symbol] = assetId.split(":");
  const market = assetMarket === "CN" ? "CN-SH" : assetMarket;
  return {
    id,
    accountId: options.accountId ?? "account-a",
    accountLabel: "账户 A",
    instrument: { id: assetId, symbol, name: symbol, market, currency },
    side,
    executedAt,
    quantity: "1",
    price: amount,
    fee: options.fee ?? "0",
    source: {
      platform: "test",
      row: 1,
      tradeNature: "live",
      tradingDate: executedAt.slice(0, 10),
      ...options,
    },
  };
}

function baseline(overrides: Partial<CashBaselineRecord> = {}): CashBaselineRecord {
  return {
    id: "baseline-a-cny",
    scope,
    accountId: "account-a",
    currency: "CNY",
    balance: "100000",
    asOf: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("cash baseline contracts", () => {
  it("allows a signed balance and normalizes a baseline draft", () => {
    expect(normalizeCashBaselineDraft({
      scope,
      accountId: "account-a",
      currency: "CNY",
      balance: "-12.50",
      asOf: "2026-09-01T00:00:00.000Z",
    })).toMatchObject({
      scope,
      accountId: "account-a",
      currency: "CNY",
      balance: "-12.5",
    });
    expect(normalizeCashBaselineDraft({
      scope: { nature: "simulation", simulationRunId: null },
      accountId: "account-a",
      currency: "CNY",
      balance: "1",
      asOf: "2026-09-01T00:00:00.000Z",
    })).toBeNull();
  });

  it("normalizes malformed persisted state without carrying invalid records", () => {
    expect(normalizeCashBaselineState({ version: 1, records: [baseline(), { ...baseline(), balance: "NaN" }] })).toEqual({
      version: 1,
      records: [baseline()],
    });
    expect(emptyCashBaselineState()).toEqual({ version: 1, records: [] });
    expect(CASH_SETTINGS_KEY).toBe("trading-room.cash.v1");
  });

  it("keeps an edit identity stable when the target scope changes and rejects collisions", () => {
    const first = baseline();
    const second = baseline({ id: "baseline-a-usd", currency: "USD", balance: "200" });
    const moved = upsertCashBaseline({ version: 1, records: [first] }, {
      ...first,
      currency: "USD",
      balance: "300",
    }, "2026-09-26T00:00:00.000Z");
    expect(moved.records).toHaveLength(1);
    expect(moved.records[0]).toMatchObject({ id: first.id, currency: "USD", balance: "300" });
    expect(() => upsertCashBaseline({ version: 1, records: [first, second] }, {
      ...first,
      currency: "USD",
    }, "2026-09-26T00:00:00.000Z")).toThrow(/scope already exists/);
  });
});

describe("buildCashSummary", () => {
  const input = (executions: TradeExecution[], baselines: CashBaselineRecord[] = [baseline()]) => buildCashSummary({
    executions,
    baselines,
    scope,
    accountIds: [],
    today: "2026-09-26",
    instrumentMetadata,
    fxSnapshot,
  });

  it("computes baseline plus later stock and ETF cash once", () => {
    const result = input([
      execution("buy", "buy", "2026-09-02T00:00:00.000Z", "30000"),
      execution("sell", "sell", "2026-09-26T03:00:00.000Z", "32000", { assetId: "US:ETF", currency: "USD", fee: "0" }),
    ], [baseline({ currency: "CNY" }), baseline({ id: "baseline-a-usd", currency: "USD", balance: "0" })]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "70000", USD: "32000" });
    expect(result.cashTotalStatus).toBe("available");
    expect(result.todayProceeds.originalByCurrency).toEqual({ USD: "32000" });
    expect(result.todayProceedsStatus).toBe("available");
  });

  it("includes partial sells and charges fees exactly once", () => {
    const result = input([
      execution("buy", "buy", "2026-09-02T00:00:00.000Z", "30000", { fee: "10", feeStatus: "reported" }),
      execution("sell", "sell", "2026-09-26T03:00:00.000Z", "32000", { fee: "12", feeStatus: "reported" }),
    ]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "101978" });
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "31988" });
  });

  it("prefers signed settlement net cash and does not subtract the fee again", () => {
    const result = input([
      execution("buy", "buy", "2026-09-02T00:00:00.000Z", "30000", {
        fee: "10",
        feeStatus: "reported",
        settlement: { currency: "CNY", quantity: "1", grossAmount: "30000", netAmount: "-30010", fees: { commission: "10" } },
      }),
      execution("sell", "sell", "2026-09-26T03:00:00.000Z", "32000", {
        fee: "12",
        feeStatus: "reported",
        settlement: { currency: "CNY", quantity: "1", grossAmount: "32000", netAmount: "31988", fees: { commission: "12" } },
      }),
    ]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "101978" });
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "31988" });
  });

  it("keeps imported fee evidence ahead of an injected future rule resolver", () => {
    const resolver = vi.fn((_context: CashExecutionContext) => ({
      amount: "999",
      currency: "CNY",
      availability: "available" as const,
      source: "rule" as const,
      reason: null,
      ruleId: "future-rule",
      ruleVersion: "v1",
    }));
    const result = buildCashSummary({
      executions: [execution("reported", "sell", "2026-09-26T03:00:00.000Z", "100", { fee: "2", feeStatus: "reported" })],
      baselines: [baseline()],
      scope,
      accountIds: [],
      today: "2026-09-26",
      instrumentMetadata,
      feeResolver: resolver,
    });

    expect(resolver).not.toHaveBeenCalled();
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "98" });
  });

  it("does not flip a signed negative sell net into a positive proceeds amount", () => {
    const result = input([
      execution("bad-sign", "sell", "2026-09-26T03:00:00.000Z", "100", {
        fee: "120",
        feeStatus: "reported",
        settlement: { currency: "CNY", quantity: "1", grossAmount: "100", netAmount: "-20", fees: { commission: "120" } },
      }),
    ]);

    expect(result.todayProceeds.originalByCurrency).toEqual({});
    expect(result.todayProceedsStatus).toBe("unavailable");
    expect(result.missingReasons.some((reason) => reason.includes("方向"))).toBe(true);
  });

  it("uses the source trading date and excludes executions at or before the baseline", () => {
    const result = input([
      execution("before", "buy", "2026-09-01T00:00:00.000Z", "9"),
      execution("equal", "sell", "2026-09-01T00:00:00.000Z", "8"),
      execution("later", "sell", "2026-09-02T00:00:00.000Z", "7", { tradingDate: "2026-09-26" }),
    ]);

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "100007" });
    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "7" });
  });

  it("reports unavailable fees with resolver context instead of treating them as zero", () => {
    const resolver = vi.fn((_context: CashExecutionContext) => ({
      amount: null,
      currency: "CNY",
      availability: "unavailable" as const,
      source: "unknown" as const,
      reason: "没有费用规则",
      ruleId: null,
      ruleVersion: null,
    }));
    const result = buildCashSummary({
      executions: [execution("unknown-fee", "sell", "2026-09-26T03:00:00.000Z", "100", { fee: "", feeStatus: "unknown" })],
      baselines: [baseline()],
      scope,
      accountIds: [],
      today: "2026-09-26",
      instrumentMetadata,
      feeResolver: resolver,
    });

    expect(resolver).toHaveBeenCalledWith(expect.objectContaining({
      id: "unknown-fee",
      side: "sell",
      instrumentId: "CN:STOCK",
      symbol: "STOCK",
      market: "CN-SH",
      quantity: "1",
      quoteCurrency: "CNY",
      settlementCurrency: "CNY",
      platform: "test",
    }));
    expect(result.cashTotalStatus).toBe("partial");
    expect(result.todayProceedsStatus).toBe("unavailable");
    expect(result.missingReasons.some((reason) => reason.includes("没有费用规则"))).toBe(true);
    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "100000" });
  });

  it("keeps a metadata gap visible and does not classify unknown assets as stock", () => {
    const result = input([
      execution("unknown-asset", "sell", "2026-09-26T03:00:00.000Z", "100", { assetId: "CN:UNKNOWN" }),
    ]);

    expect(result.todayProceedsStatus).toBe("unavailable");
    expect(result.cashTotalStatus).toBe("partial");
    expect(result.missingReasons.some(reason => reason.includes("资产类型"))).toBe(true);
  });

  it("does not report zero when a same-day sell is hidden by an asset evidence gap", () => {
    const result = input([
      execution("historical-buy", "buy", "2026-09-02T03:00:00.000Z", "10"),
      execution("today-unknown", "sell", "2026-09-26T03:00:00.000Z", "20", { assetId: "CN:UNKNOWN" }),
    ]);

    expect(result.todayProceeds.originalByCurrency).toEqual({});
    expect(result.todayProceedsStatus).toBe("unavailable");
  });

  it("reports reliable zero proceeds when the selected scope has no sell evidence today", () => {
    const result = input([
      execution("historical-buy", "buy", "2026-09-02T03:00:00.000Z", "10"),
    ]);

    expect(result.todayProceeds.originalByCurrency).toEqual({});
    expect(result.todayProceedsStatus).toBe("zero");
  });

  it("marks a target conversion incomplete while preserving the native proceeds", () => {
    const result = buildCashSummary({
      executions: [execution("hkd-sell", "sell", "2026-09-26T03:00:00.000Z", "20", { currency: "HKD", assetId: "US:ETF" })],
      baselines: [baseline({ currency: "HKD", balance: "100" })],
      scope,
      accountIds: [],
      today: "2026-09-26",
      targetCurrency: "HKD",
      instrumentMetadata: new Map([["US:ETF", { market: "US", symbol: "ETF", assetType: "etf" }]]),
    });

    expect(result.todayProceeds.originalByCurrency).toEqual({ HKD: "20" });
    expect(result.todayProceeds.converted).toBe("20");
    expect(result.todayProceedsStatus).toBe("available");

    const cnyTarget = buildCashSummary({
      executions: [execution("hkd-sell-cny", "sell", "2026-09-26T03:00:00.000Z", "20", { currency: "HKD", assetId: "US:ETF" })],
      baselines: [baseline({ currency: "HKD", balance: "100" })],
      scope,
      accountIds: [],
      today: "2026-09-26",
      targetCurrency: "CNY",
      instrumentMetadata: new Map([["US:ETF", { market: "US", symbol: "ETF", assetType: "etf" }]]),
    });
    expect(cnyTarget.todayProceeds.originalByCurrency).toEqual({ HKD: "20" });
    expect(cnyTarget.todayProceeds.converted).toBeNull();
    expect(cnyTarget.todayProceedsStatus).toBe("partial");
  });

  it("projects baseline aggregation to selected accounts before exposing as-of or totals", () => {
    const result = buildCashSummary({
      executions: [execution("account-a-sell", "sell", "2026-09-26T03:00:00.000Z", "7")],
      baselines: [
        baseline({ asOf: "2026-09-01T00:00:00.000Z", balance: "100" }),
        baseline({ id: "baseline-b-cny", accountId: "account-b", asOf: "2026-09-20T00:00:00.000Z", balance: "900" }),
      ],
      scope,
      accountIds: ["account-a"],
      today: "2026-09-26",
      instrumentMetadata,
      fxSnapshot,
    });

    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "107" });
    expect(result.asOf).toBe("2026-09-01T00:00:00.000Z");
    expect(Object.keys(result.byScope)).toEqual(["live:account-a:CNY"]);
  });

  it("isolates a simulation run from live and from another run", () => {
    const simulation: CashScope = { nature: "simulation", simulationRunId: "run-a" };
    const result = buildCashSummary({
      executions: [
        execution("live", "sell", "2026-09-26T03:00:00.000Z", "5"),
        execution("run-a", "sell", "2026-09-26T03:00:00.000Z", "7", { tradeNature: "simulation", simulationRunId: "run-a" }),
        execution("run-b", "sell", "2026-09-26T03:00:00.000Z", "11", { tradeNature: "simulation", simulationRunId: "run-b" }),
      ],
      baselines: [baseline({ scope: simulation, balance: "100" })],
      scope: simulation,
      accountIds: [],
      today: "2026-09-26",
      instrumentMetadata,
    });

    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "7" });
    expect(result.cashTotal.originalByCurrency).toEqual({ CNY: "107" });
  });

  it("does not let unrelated account or simulation evidence downgrade the selected live scope", () => {
    const result = buildCashSummary({
      executions: [
      execution("live-valid", "sell", "2026-09-26T03:00:00.000Z", "7"),
      execution("other-run", "sell", "2026-09-26T03:00:00.000Z", "11", { tradeNature: "simulation", simulationRunId: "run-b" }),
      execution("other-unknown", "sell", "2026-09-26T03:00:00.000Z", "13", { accountId: "account-b", tradeNature: "unknown" }),
      ],
      baselines: [baseline()],
      scope,
      accountIds: ["account-a"],
      today: "2026-09-26",
      instrumentMetadata,
      fxSnapshot,
    });

    expect(result.todayProceeds.originalByCurrency).toEqual({ CNY: "7" });
    expect(result.todayProceedsStatus).toBe("available");
    expect(result.missingReasons).toEqual([]);
  });
});
