import { describe, expect, it } from "vitest";

import type { DashboardRow } from "../reviews/dashboard";
import type { TradingRoomRow, RoomFxSnapshot, RoomScope } from "../reviews/trading-room-scope";
import type { TradeEpisodeMetrics } from "../trades/episode-metrics";
import type { TradeEpisode, TradeExecution } from "../trades/types";
import {
  buildPrincipalReferenceSummary,
  emptyPrincipalState,
  normalizePrincipalState,
  principalScopeKey,
  type PrincipalState,
} from "./principal-model";

const ranges = {
  month: { preset: "month" as const, startDate: "2026-09-01", endDate: "2026-09-19" },
  custom: { preset: "custom" as const, startDate: "2026-01-01", endDate: "2026-12-31" },
};

const instrument = {
  id: "US:TEST",
  symbol: "TEST",
  name: "测试标的",
  market: "US",
  currency: "USD",
};

function row(input: {
  id: string;
  category?: TradingRoomRow["assetCategory"];
  currency?: string;
  netPnl?: string | null;
  grossExposure?: string;
  accountId?: string;
}): TradingRoomRow {
  const valueInstrument = { ...instrument, id: `${input.currency ?? "USD"}:${input.id}`, currency: input.currency ?? "USD" };
  const buy: TradeExecution = {
    id: `${input.id}:buy`,
    source: { platform: "test", row: 1, feeStatus: "reported" },
    accountId: input.accountId ?? "acct",
    accountLabel: "测试账户",
    instrument: valueInstrument,
    side: "buy",
    executedAt: "2026-09-02T09:00:00Z",
    quantity: "100",
    price: "100",
    fee: "0",
  };
  const sell: TradeExecution = { ...buy, id: `${input.id}:sell`, side: "sell", executedAt: "2026-09-10T09:00:00Z", price: "101" };
  const episode: TradeEpisode = {
    id: input.id,
    accountId: input.accountId ?? "acct",
    accountLabel: "测试账户",
    instrument: valueInstrument,
    direction: "long",
    status: "closed",
    startedAt: buy.executedAt,
    endedAt: sell.executedAt,
    openingQuantity: "100",
    remainingQuantity: "0",
    executions: [buy, sell],
  };
  const metrics: TradeEpisodeMetrics = {
    buyCount: 1,
    sellCount: 1,
    boughtQuantity: "100",
    soldQuantity: "100",
    grossExposure: input.grossExposure ?? "10000",
    fees: "0",
    realizedPnl: input.netPnl ?? "0",
    unrealizedPnl: "0",
    netPnl: input.netPnl ?? null,
    returnPercent: input.netPnl === null ? null : "1",
    holdingMilliseconds: 691_200_000,
  };
  const dashboardRow = {
    entry: { instrument: valueInstrument, episodes: [], executions: [] },
    item: { episode, metrics },
  } as unknown as DashboardRow;
  return {
    row: dashboardRow,
    assetCategory: input.category ?? "us-stock",
    assetType: input.category === "etf" ? "etf" : "stock",
    sourceNature: "live",
    closeDate: "2026-09-10",
    trustedPnl: input.netPnl ?? null,
    exclusionReason: input.netPnl === null ? "missing-pnl" : null,
    assetReason: null,
  };
}

function scope(overrides: Partial<RoomScope> = {}): RoomScope {
  return {
    nature: "live",
    assetCategory: "all",
    period: ranges.month,
    simulationRunId: null,
    accountIds: [],
    instrumentIds: [],
    markets: [],
    currencies: [],
    reviewStatuses: [],
    ...overrides,
  };
}

function state(scopes: PrincipalState["scopes"]): PrincipalState {
  return { version: 1, scopes };
}

const completeFx: RoomFxSnapshot = {
  id: "fx:test",
  baseCurrency: "CNY",
  asOf: "2026-09-19T02:00:00.000Z",
  source: "BOC",
  status: "complete",
  rates: { "USD/CNY": "6.7521", "HKD/CNY": "0.8606" },
};

describe("trading room principal model", () => {
  it("shows 2% principal reference return beside the 1% cost return for two 10,000 trades", () => {
    const rows = [
      row({ id: "first", category: "a-share-stock", currency: "CNY", netPnl: "100" }),
      row({ id: "second", category: "a-share-stock", currency: "CNY", netPnl: "100" }),
    ];
    const result = buildPrincipalReferenceSummary(rows, scope({ assetCategory: "a-share-stock" }), state({
      live: { "a-share-stock": { amount: "10000", currency: "CNY" } },
    }), completeFx);

    expect(result.mode).toBe("principal");
    expect(result.principalReturnPercent).toBe("2");
    expect(result.costReturn.costReturnPercent).toBe("1");
    expect(result.principal.originalByCurrency).toEqual({ CNY: "10000" });
  });

  it("uses all configured active and inactive pools in the overall denominator without averaging categories", () => {
    const rows = [row({ id: "active", category: "a-share-stock", currency: "CNY", netPnl: "200" })];
    const result = buildPrincipalReferenceSummary(rows, scope(), state({
      live: {
        "a-share-stock": { amount: "100000", currency: "CNY" },
        "us-stock": { amount: "100000", currency: "CNY" },
      },
    }));

    expect(result.mode).toBe("principal");
    expect(result.principal.originalByCurrency).toEqual({ CNY: "200000" });
    expect(result.principalReturnPercent).toBe("0.1");
    expect(result.missingCategories).toEqual([]);
  });

  it("falls back to cost return when an active category has no principal", () => {
    const rows = [
      row({ id: "a", category: "a-share-stock", currency: "CNY", netPnl: "100" }),
      row({ id: "us", category: "us-stock", currency: "USD", netPnl: "100" }),
    ];
    const result = buildPrincipalReferenceSummary(rows, scope(), state({
      live: { "a-share-stock": { amount: "10000", currency: "CNY" } },
    }), completeFx);

    expect(result.mode).toBe("cost");
    expect(result.principalReturnPercent).toBeNull();
    expect(result.missingCategories).toEqual(["us-stock"]);
    expect(result.fallbackReason).toContain("美股股票");
    expect(result.costReturn.costReturnPercent).toBe("1");
  });

  it("uses a principal only for a full category or overall scope, then falls back for fine filters", () => {
    const rows = [row({ id: "a", category: "a-share-stock", currency: "CNY", netPnl: "100" })];
    const configured = state({ live: { "a-share-stock": { amount: "10000", currency: "CNY" } } });
    const full = buildPrincipalReferenceSummary(rows, scope({ assetCategory: "a-share-stock" }), configured);
    const narrowed = buildPrincipalReferenceSummary(rows, scope({ assetCategory: "a-share-stock", query: "TEST" }), configured);
    const dateChanged = buildPrincipalReferenceSummary(rows, scope({ assetCategory: "a-share-stock", period: ranges.custom }), configured);

    expect(full.mode).toBe("principal");
    expect(narrowed.mode).toBe("cost");
    expect(narrowed.fallbackReason).toContain("当前筛选无对应本金");
    expect(dateChanged.mode).toBe("principal");
  });

  it("keeps live and simulation-run principal pools independent", () => {
    const rows = [row({ id: "sim", category: "us-stock", currency: "USD", netPnl: "100" })];
    rows[0].sourceNature = "simulation";
    rows[0].row.item.episode.tradeNature = "simulation";
    rows[0].row.item.episode.simulationRunId = "run-1";
    const configured = state({
      live: { "us-stock": { amount: "10000", currency: "USD" } },
      "simulation:run-1": { "us-stock": { amount: "5000", currency: "USD" } },
    });

    const simulation = buildPrincipalReferenceSummary(rows, scope({ nature: "simulation", simulationRunId: "run-1", assetCategory: "us-stock" }), configured, completeFx);
    const otherRun = buildPrincipalReferenceSummary(rows, scope({ nature: "simulation", simulationRunId: "run-2", assetCategory: "us-stock" }), configured, completeFx);

    expect(principalScopeKey({ nature: "live", simulationRunId: null })).toBe("live");
    expect(simulation.principalReturnPercent).toBe("2");
    expect(otherRun.mode).toBe("cost");
  });

  it("keeps mixed-currency principal aggregation on one FX snapshot", () => {
    const rows = [
      row({ id: "cny", category: "a-share-stock", currency: "CNY", netPnl: "100" }),
      row({ id: "usd", category: "us-stock", currency: "USD", netPnl: "100" }),
    ];
    const result = buildPrincipalReferenceSummary(rows, scope(), state({
      live: {
        "a-share-stock": { amount: "10000", currency: "CNY" },
        "us-stock": { amount: "10000", currency: "USD" },
      },
    }), completeFx);

    expect(result.principalReturnPercent).toBe("1");
    expect(result.principal.convertedCny).toBe("77521");
    expect(result.netPnl.convertedCny).toBe("775.21");
  });

  it("excludes unknown and open rows from the principal PnL numerator", () => {
    const unknown = row({ id: "unknown", category: "unknown", currency: "CNY", netPnl: "999" });
    const open = row({ id: "open", category: "a-share-stock", currency: "CNY", netPnl: "999" });
    open.row.item.episode.status = "open";
    const valid = row({ id: "valid", category: "a-share-stock", currency: "CNY", netPnl: "100" });
    const result = buildPrincipalReferenceSummary([unknown, open, valid], scope({ assetCategory: "a-share-stock" }), state({
      live: { "a-share-stock": { amount: "10000", currency: "CNY" } },
    }));

    expect(result.netPnl.originalByCurrency).toEqual({ CNY: "100" });
    expect(result.principalReturnPercent).toBe("1");
  });

  it("calculates same-currency USD principal returns without an FX snapshot", () => {
    const result = buildPrincipalReferenceSummary(
      [row({ id: "usd", category: "us-stock", currency: "USD", netPnl: "100" })],
      scope({ assetCategory: "us-stock" }),
      state({ live: { "us-stock": { amount: "10000", currency: "USD" } } }),
    );

    expect(result.mode).toBe("principal");
    expect(result.principalReturnPercent).toBe("1");
  });

  it("uses a complete set of rates even when the snapshot status is stale or partial", () => {
    const stale = { ...completeFx, status: "partial" as const };
    const result = buildPrincipalReferenceSummary([
      row({ id: "cny", category: "a-share-stock", currency: "CNY", netPnl: "100" }),
      row({ id: "usd", category: "us-stock", currency: "USD", netPnl: "100" }),
    ], scope(), state({
      live: {
        "a-share-stock": { amount: "10000", currency: "CNY" },
        "us-stock": { amount: "10000", currency: "USD" },
      },
    }), stale);

    expect(result.mode).toBe("principal");
    expect(result.principalReturnPercent).toBe("1");
    expect(result.principal.convertedCny).toBe("77521");
  });

  it("does not calculate a principal return from invalid or missing amounts", () => {
    const rows = [row({ id: "a", category: "a-share-stock", currency: "CNY", netPnl: "100" })];
    const result = buildPrincipalReferenceSummary(rows, scope({ assetCategory: "a-share-stock" }), state({
      live: { "a-share-stock": { amount: "0", currency: "CNY" } },
    }));

    expect(result.mode).toBe("cost");
    expect(result.missingCategories).toEqual(["a-share-stock"]);
    expect(emptyPrincipalState()).toEqual({ version: 1, scopes: {} });
  });

  it("normalizes persisted scopes and drops malformed simulation ids and values", () => {
    expect(normalizePrincipalState({
      version: 1,
      scopes: {
        "simulation:": { "a-share-stock": { amount: "100", currency: "CNY" } },
        live: {
          "a-share-stock": { amount: "100", currency: "CNY" },
          etf: { amount: "0", currency: "CNY" },
          unknown: { amount: "100", currency: "CNY" },
        },
      },
    })).toEqual({
      version: 1,
      scopes: { live: { "a-share-stock": { amount: "100", currency: "CNY" } } },
    });
  });
});
