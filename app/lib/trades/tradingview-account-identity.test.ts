import { describe, expect, it } from "vitest";

import {
  TRADINGVIEW_CANONICAL_ACCOUNT_ID,
  TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
  canonicalizeTradingViewExecution,
  classifyTradingViewExecution,
  isCanonicalTradingViewAccountExecution,
  isCanonicalTradingViewEpisode,
  isCanonicalTradingViewExecution,
  tradingViewEpisodeBusinessScope,
  tradingViewSourceRun,
} from "./tradingview-account-identity";
import { buildTradeEpisodes } from "./episodes";
import type { TradeExecution } from "./types";

type SourceOverrides = Partial<TradeExecution["source"]> & { run?: unknown };

function execution(overrides: SourceOverrides = {}): TradeExecution {
  return {
    id: "fill-1",
    source: {
      platform: "tradingview",
      tradeNature: "simulation",
      simulationRunId: "tradingview:run-1",
      row: 1,
      ...overrides,
    },
    accountId: "tradingview:old-run-1",
    accountLabel: "TradingView · 模拟盘 · old",
    instrument: {
      id: "CN-SH:600330",
      symbol: "600330",
      name: "测试标的",
      market: "CN-SH",
      currency: "CNY",
    },
    side: "buy",
    executedAt: "2026-01-01T01:00:00Z",
    quantity: "10000",
    price: "1.89",
    fee: "0",
  };
}

describe("TradingView account identity", () => {
  it("accepts only explicit simulated TradingView executions with a source run", () => {
    const result = classifyTradingViewExecution(execution());

    expect(result).toEqual({
      eligible: true,
      identity: {
        canonicalAccountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
        canonicalAccountLabel: TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
        tradeNature: "simulation",
      },
      originalAccountId: "tradingview:old-run-1",
      sourceRunId: "tradingview:run-1",
    });
    expect(isCanonicalTradingViewExecution(execution())).toBe(true);
  });

  it.each([
    ["live-execution", { tradingNature: "live" as const, tradeNature: undefined }],
    ["unknown-nature", { tradingNature: "unknown" as const, tradeNature: undefined }],
    ["platform-mismatch", { platform: "futu" }],
    ["missing-source-run", { simulationRunId: "" }],
    ["nature-conflict", { tradingNature: "live" as const }],
  ] as const)("blocks %s without inferring simulation", (code, overrides) => {
    const result = classifyTradingViewExecution(execution(overrides));

    expect(result.eligible).toBe(false);
    if (!result.eligible) expect(result.code).toBe(code);
    expect(isCanonicalTradingViewExecution(execution(overrides))).toBe(false);
  });

  it("rejects a whitespace-only legacy source run when the modern run is missing", () => {
    const result = classifyTradingViewExecution(execution({ simulationRunId: undefined, run: "   " }));

    expect(result).toEqual({ eligible: false, code: "missing-source-run", executionId: "fill-1" });
    expect(isCanonicalTradingViewExecution(execution({ simulationRunId: undefined, run: "   " }))).toBe(false);
    expect(tradingViewSourceRun(execution({ simulationRunId: undefined, run: "   " }))).toBeNull();
  });

  it("creates a canonical shadow without rewriting source provenance", () => {
    const original = execution({
      fileFingerprint: "source-file",
      sourceTradeId: "source-trade",
      sourceReport: { netPnl: "1" } as never,
    });

    const shadow = canonicalizeTradingViewExecution(original);

    expect(shadow).toMatchObject({
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      accountLabel: TRADINGVIEW_CANONICAL_ACCOUNT_LABEL,
      source: {
        simulationRunId: "tradingview:run-1",
        fileFingerprint: "source-file",
        sourceTradeId: "source-trade",
        sourceReport: { netPnl: "1" },
      },
    });
    expect(original).toMatchObject({
      accountId: "tradingview:old-run-1",
      accountLabel: "TradingView · 模拟盘 · old",
    });
    expect(shadow).not.toBe(original);
    expect(shadow?.source).not.toBe(original.source);
  });

  it("does not create a canonical shadow for conflicting identity evidence", () => {
    expect(canonicalizeTradingViewExecution(execution({ tradingNature: "live" }))).toBeNull();
  });

  it("does not treat a canonical account row with conflicting platform or nature as whole-account scope", () => {
    const conflicting = canonicalizeTradingViewExecution(execution())!;
    conflicting.source.platform = "futu";
    expect(isCanonicalTradingViewAccountExecution(conflicting)).toBe(false);
    expect(isCanonicalTradingViewEpisode({
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      tradeNature: "simulation",
      executions: [conflicting],
    })).toBe(false);
  });

  it("exposes null run for a canonical episode instead of inheriting its first source run", () => {
    const entry = execution({ simulationRunId: "run-a", simulationRole: "entry" });
    entry.accountId = "tradingview:source-a";
    entry.source.platform = "tradingview";
    const exit = execution({ simulationRunId: "run-b", simulationRole: "exit" });
    exit.id = "fill-2";
    exit.side = "sell";
    exit.executedAt = "2026-01-02T01:00:00Z";
    exit.accountId = "tradingview:source-b";
    exit.source.platform = "tradingview";
    const [episode] = buildTradeEpisodes([
      canonicalizeTradingViewExecution(entry)!,
      canonicalizeTradingViewExecution(exit)!,
    ]);

    expect(tradingViewEpisodeBusinessScope(episode)).toEqual({
      accountId: TRADINGVIEW_CANONICAL_ACCOUNT_ID,
      tradeNature: "simulation",
      simulationRunId: null,
    });
  });
});
