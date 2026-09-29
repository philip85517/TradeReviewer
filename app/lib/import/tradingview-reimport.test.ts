import { describe, expect, it } from "vitest";

import type { TradeExecution } from "../trades/types";
import {
  mergeTradingViewReimports,
  reconcileTradingViewReimports,
} from "./tradingview-reimport";

type CurrentExecutionOverrides = Omit<Partial<TradeExecution>, "source"> & {
  source?: Partial<TradeExecution["source"]>;
};

function currentExecution(
  overrides: CurrentExecutionOverrides = {},
): TradeExecution {
  const { source: sourceOverrides, ...executionOverrides } = overrides;
  return {
    id: "tradingview:fp-a:CN-SH:600330:1:3",
    source: {
      platform: "tradingview",
      inputKind: "tradingview",
      tradeNature: "simulation",
      fileName: "回放交易_SSE_600330_2026-09-03.csv",
      fileFingerprint: "fp-a",
      sourceTimestampText: "2021-02-19",
      sourceTimezone: "Asia/Shanghai",
      timePrecision: "date-only",
      row: 3,
      sourceTradeId: "1",
      simulationRole: "entry",
      simulationRunId: "tradingview:fp-a:CN-SH:600330",
      ...sourceOverrides,
    },
    accountId: "tradingview:simulation:default",
    accountLabel: "TradingView · 模拟盘",
    instrument: {
      id: "CN-SH:600330",
      symbol: "600330",
      name: "天通股份",
      market: "CN-SH",
      currency: "CNY",
    },
    side: "buy",
    executedAt: "2021-02-18T16:00:00.000Z",
    quantity: "10000",
    price: "9.55",
    fee: "0",
    ...executionOverrides,
  };
}

function legacyExecution(overrides: Parameters<typeof currentExecution>[0] = {}) {
  const current = currentExecution(overrides);
  const {
    tradeNature: _tradeNature,
    sourceTradeId: _sourceTradeId,
    ...legacySource
  } = current.source;
  return {
    ...current,
    id: current.id === "tradingview:fp-a:CN-SH:600330:1:3"
      ? "tradingview:fp-a:CN-SH:600330:1:entry"
      : current.id,
    source: {
      ...legacySource,
      inputKind: "statement" as const,
      tradingNature: "simulated" as const,
      simulationTradeId:
        current.source.sourceTradeId ?? current.source.simulationTradeId,
      simulationRunId: "fp-a:CN-SH:600330",
    },
    accountId: "tradingview:fp-a:CN-SH:600330",
    accountLabel: "TradingView · 模拟盘 · fp-a",
    executedAt: "2021-02-19T07:00:00.000Z",
  } satisfies TradeExecution;
}

function historicalCurrentParserExecution(
  overrides: Parameters<typeof currentExecution>[0] = {},
): TradeExecution {
  const current = currentExecution(overrides);
  return {
    ...current,
    accountId: "tradingview:fp-a",
    accountLabel: "TradingView · 模拟盘 · legacy",
    source: {
      ...current.source,
      simulationRole: undefined,
    },
  };
}

describe("TradingView reimport compatibility", () => {
  it("keeps the migrated execution and treats the parser shape as a duplicate", () => {
    const existing = legacyExecution();
    const incoming = currentExecution();

    const result = reconcileTradingViewReimports([existing], [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.duplicates).toEqual([
      { kept: existing, skipped: incoming },
    ]);
    expect(mergeTradingViewReimports([existing], [incoming])).toMatchObject({
      merged: [existing],
      reconciliation: result,
    });
  });

  it("recognizes the exact historical row-ID parser shape without a role as a duplicate", () => {
    const existing = historicalCurrentParserExecution();
    const incoming = currentExecution();

    const result = reconcileTradingViewReimports([existing], [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.duplicates).toEqual([{ kept: existing, skipped: incoming }]);
    expect(mergeTradingViewReimports([existing], [incoming]).merged).toEqual([
      existing,
    ]);
  });

  it("blocks a financial conflict in the exact historical row-ID parser shape", () => {
    const existing = historicalCurrentParserExecution({ price: "9" });
    const incoming = currentExecution();

    const result = reconcileTradingViewReimports([existing], [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({ existing: [existing], incoming: [incoming] }),
    ]);
    expect(mergeTradingViewReimports([existing], [incoming]).merged).toBeUndefined();
  });

  it("blocks the same source identity when a financial core field differs", () => {
    const existing = legacyExecution();
    const incoming = currentExecution({ price: "9.56" });

    const result = reconcileTradingViewReimports([existing], [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({
        existing: [existing],
        incoming: [incoming],
      }),
    ]);
    expect(mergeTradingViewReimports([existing], [incoming]).merged).toBeUndefined();
  });

  it("checks currency and settlement amounts when both records provide them", () => {
    const existing = legacyExecution({
      source: {
        settlement: {
          currency: "CNY",
          quantity: "10000",
          grossAmount: "95500",
          netAmount: "95495",
          fees: { commission: "5" },
        },
      },
    });
    const currencyMismatch = currentExecution({
      source: {
        settlement: {
          currency: "USD",
          quantity: "10000",
          grossAmount: "95500",
          netAmount: "95495",
          fees: { commission: "5" },
        },
      },
    });
    const amountMismatch = currentExecution({
      source: {
        settlement: {
          currency: "CNY",
          quantity: "10000",
          grossAmount: "95501",
          netAmount: "95496",
          fees: { commission: "5" },
        },
      },
    });

    expect(reconcileTradingViewReimports([existing], [currencyMismatch]).conflicts)
      .toHaveLength(1);
    expect(reconcileTradingViewReimports([existing], [amountMismatch]).conflicts)
      .toHaveLength(1);
  });

  it("does not deduplicate a different source fingerprint", () => {
    const existing = legacyExecution();
    const incoming = currentExecution({
      id: "tradingview:fp-b:CN-SH:600330:1:3",
      source: {
        fileFingerprint: "fp-b",
        fileName: "另一份导出.csv",
        simulationRunId: "tradingview:fp-b:CN-SH:600330",
      },
    });

    const result = reconcileTradingViewReimports([existing], [incoming]);

    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toEqual([]);
    expect(result.acceptedIncoming).toEqual([incoming]);
    expect(mergeTradingViewReimports([existing], [incoming]).merged).toEqual(
      expect.arrayContaining([existing, incoming]),
    );
  });

  it("reconciles all four sanitized source counts without adding a second run", () => {
    const sourceCounts = [
      ["fp-600330", "CN-SH", "600330", 34],
      ["fp-600869", "CN-SH", "600869", 24],
      ["fp-600737", "CN-SH", "600737", 12],
      ["fp-300857", "CN-SZ", "300857", 12],
    ] as const;
    const existing: TradeExecution[] = [];
    const incoming: TradeExecution[] = [];
    for (const [fingerprint, market, symbol, count] of sourceCounts) {
      for (let index = 0; index < count; index += 1) {
        const role = index % 2 === 0 ? "entry" : "exit";
        const date = `2021-02-${String((index % 27) + 1).padStart(2, "0")}`;
        const instrument = {
          id: `${market}:${symbol}`,
          symbol,
          name: symbol,
          market,
          currency: "CNY",
        };
        const base = currentExecution({
          id: `tradingview:${fingerprint}:${market}:${symbol}:${index}:${index + 2}`,
          source: {
            fileFingerprint: fingerprint,
            fileName: `${symbol}.csv`,
            sourceTimestampText: date,
            sourceTradeId: String(index),
            simulationRole: role,
            simulationRunId: `tradingview:${fingerprint}:${market}:${symbol}`,
            row: index + 2,
          },
          instrument,
          side: role === "entry" ? "buy" : "sell",
          executedAt: `${date}T00:00:00.000Z`,
          quantity: String(index + 1),
          price: String(index + 10),
        });
        const old = legacyExecution({
          ...base,
          id: `tradingview:${fingerprint}:${market}:${symbol}:${index}:${role}`,
          source: {
            fileFingerprint: fingerprint,
            fileName: `${symbol}.csv`,
            sourceTimestampText: date,
            sourceTradeId: undefined,
            simulationTradeId: String(index),
            simulationRole: role,
            simulationRunId: `${fingerprint}:${market}:${symbol}`,
            row: index + 2,
          },
          executedAt: `${date}T07:00:00.000Z`,
        });
        existing.push(old);
        incoming.push(base);
      }
    }

    const result = reconcileTradingViewReimports(existing, incoming);

    expect(existing).toHaveLength(82);
    expect(result.duplicates).toHaveLength(82);
    expect(result.acceptedIncoming).toEqual([]);
    expect(result.conflicts).toEqual([]);
    const merged = mergeTradingViewReimports(existing, incoming).merged;
    expect(merged).toHaveLength(82);
    expect(merged).toEqual(expect.arrayContaining(existing));
  });

  it("blocks ambiguous multiple candidates instead of choosing one", () => {
    const existing = legacyExecution();
    const duplicateExisting = legacyExecution({
      id: "tradingview:fp-a:CN-SH:600330:1:entry:second",
      source: { row: 4 },
    });

    const result = reconcileTradingViewReimports(
      [existing, duplicateExisting],
      [currentExecution()],
    );

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.existing).toEqual([existing, duplicateExisting]);
  });

  it("blocks contradictory explicit simulation nature evidence", () => {
    const existing = currentExecution({
      source: { tradingNature: "live" },
    });
    const incoming = currentExecution();

    const result = reconcileTradingViewReimports([existing], [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({ existing: [existing], incoming: [incoming] }),
    ]);
    expect(mergeTradingViewReimports([existing], [incoming]).merged).toBeUndefined();
  });

  it("blocks contradictory nature on a historical row-ID record without a role", () => {
    const existing = historicalCurrentParserExecution({
      source: { tradingNature: "live" },
    });
    const incoming = currentExecution();

    const result = reconcileTradingViewReimports([existing], [incoming]);

    expect(result.acceptedIncoming).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.conflicts).toEqual([
      expect.objectContaining({ existing: [existing], incoming: [incoming] }),
    ]);
    expect(mergeTradingViewReimports([existing], [incoming]).merged).toBeUndefined();
  });
});
