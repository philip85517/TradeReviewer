import { describe, expect, it } from "vitest";

import type { TradeLibraryEntry, TradeLibraryEpisode } from "../trades/library";
import type { TradeExecution, TradeEpisode } from "../trades/types";
import {
  buildDashboardCalendar,
  buildDashboardModel,
  dashboardEpisodeDate,
  dashboardScopeKey,
  filterDashboardRows,
  isHongKongConnectExecution,
  marketFilterMatchesEntry,
  type DashboardRow,
} from "./dashboard";

const baseInstrument = {
  id: "CN-SH:600000",
  symbol: "600000",
  name: "测试标的",
  market: "CN-SH",
  currency: "CNY",
};

function execution(
  id: string,
  side: "buy" | "sell",
  executedAt: string,
  overrides: Partial<TradeExecution> = {},
): TradeExecution {
  return {
    id,
    accountId: "account-1",
    accountLabel: "主账户",
    instrument: baseInstrument,
    side,
    executedAt,
    quantity: "1",
    price: side === "buy" ? "10" : "110",
    fee: "0",
    source: { platform: "futu", row: 1 },
    ...overrides,
  };
}

function episode(
  id: string,
  netPnl: string | null,
  endedAt: string | undefined,
  overrides: Partial<TradeEpisode> = {},
): TradeLibraryEpisode {
  const closed = endedAt !== undefined;
  const item: TradeLibraryEpisode = {
    episode: {
      id,
      accountId: "account-1",
      accountLabel: "主账户",
      instrument: baseInstrument,
      direction: "long",
      status: closed ? "closed" : "open",
      startedAt: `${endedAt?.slice(0, 10) ?? "2026-01-01"}T01:00:00.000Z`,
      ...(endedAt ? { endedAt } : {}),
      openingQuantity: "1",
      remainingQuantity: closed ? "0" : "1",
      executions: [],
      ...overrides,
    },
    metrics: {
      buyCount: 1,
      sellCount: closed ? 1 : 0,
      boughtQuantity: "1",
      soldQuantity: closed ? "1" : "0",
      grossExposure: "100",
      fees: "0",
      realizedPnl: netPnl ?? "0",
      unrealizedPnl: closed ? "0" : null,
      netPnl,
      returnPercent: netPnl === null ? null : "1",
      holdingMilliseconds: closed ? 86_400_000 : null,
    },
    reviewStatus: "pending",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  };
  return item;
}

function row(
  id: string,
  netPnl: string | null,
  endedAt: string | undefined,
  overrides: {
    instrument?: Partial<typeof baseInstrument>;
    episode?: Partial<TradeEpisode>;
    metrics?: Partial<TradeLibraryEpisode["metrics"]>;
    tradeNature?: "live" | "simulation" | "unknown";
    simulationRunId?: string;
  } = {},
): DashboardRow {
  const instrument = { ...baseInstrument, ...overrides.instrument };
  const item = episode(id, netPnl, endedAt, {
    instrument,
    ...(overrides.episode ?? {}),
  });
  item.metrics = { ...item.metrics, ...overrides.metrics };
  const generatedExecutions = [
    execution(`${id}:buy`, "buy", item.episode.startedAt, {
      instrument,
      source: {
        platform: overrides.tradeNature === "simulation" ? "tradingview" : "futu",
        row: 1,
        ...(overrides.tradeNature ? { tradeNature: overrides.tradeNature } : {}),
        ...(overrides.simulationRunId ? { simulationRunId: overrides.simulationRunId } : {}),
      },
    }),
    ...(endedAt
      ? [execution(`${id}:sell`, "sell", endedAt, {
          instrument,
          source: {
            platform: overrides.tradeNature === "simulation" ? "tradingview" : "futu",
            row: 2,
            ...(overrides.tradeNature ? { tradeNature: overrides.tradeNature } : {}),
            ...(overrides.simulationRunId ? { simulationRunId: overrides.simulationRunId } : {}),
          },
        })]
      : []),
  ];
  item.episode.executions = overrides.episode?.executions ?? generatedExecutions;
  const entry: TradeLibraryEntry = {
    groupId: `${instrument.id}|${id}`,
    scopeKey: overrides.tradeNature === "simulation" ? `simulation:${overrides.simulationRunId}` : overrides.tradeNature,
    tradeNature: overrides.tradeNature,
    ...(overrides.simulationRunId ? { simulationRunId: overrides.simulationRunId } : {}),
    instrument,
    executions: item.episode.executions,
    episodes: [item],
    accountCount: 1,
    tradeCount: item.episode.executions.length,
    episodeCount: 1,
    firstTradeAt: item.episode.startedAt,
    lastTradeAt: endedAt ?? item.episode.startedAt,
    status: endedAt ? "closed" : "open",
    netPnl,
    returnPercent: netPnl === null ? null : "1",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
  return { entry, item };
}

function entriesFromRows(rows: DashboardRow[]): TradeLibraryEntry[] {
  return rows.map(({ entry }) => entry);
}

describe("dashboard statistics", () => {
  it("uses hand-calculated average win/loss, payoff, and profit factor", () => {
    const rows = [
      row("win-100", "100", "2026-01-02T02:00:00.000Z"),
      row("win-300", "300", "2026-01-03T02:00:00.000Z"),
      row("loss-100", "-100", "2026-01-04T02:00:00.000Z"),
      row("break-even", "0", "2026-01-05T02:00:00.000Z"),
    ];

    const model = buildDashboardModel(entriesFromRows(rows));

    expect(model.stats).toMatchObject({
      sampleCount: 4,
      trustedClosedCount: 4,
      wins: 2,
      losses: 1,
      breakEven: 1,
      netPnl: "300",
      grossProfit: "400",
      grossLoss: "100",
      averageWin: "200",
      averageLoss: "100",
      payoff: "2",
      profitFactor: "4",
    });
    expect(model.stats.winRate).toEqual({ wins: 2, denominator: 4 });
  });

  it("keeps open, untrusted, and cross-currency episodes out of returns with reasons", () => {
    const rows = [
      row("valid", "100", "2026-01-02T02:00:00.000Z"),
      row("open", null, undefined),
      row("unknown-fees", null, "2026-01-03T02:00:00.000Z", {
        metrics: { pnlAvailable: false },
        episode: {
          executions: [execution("unknown-fees:fill", "buy", "2026-01-03T01:00:00.000Z", {
            source: { platform: "futu", row: 1, feeStatus: "unknown" },
          })],
        },
      }),
      row("currency", null, "2026-01-04T02:00:00.000Z", {
        metrics: { pnlAvailable: false },
        episode: {
          executions: [execution("currency:fill", "buy", "2026-01-04T01:00:00.000Z", {
            instrument: { ...baseInstrument, id: "HK:1810", symbol: "1810", market: "HK", currency: "HKD" },
            source: {
              platform: "china-merchants",
              row: 1,
              settlement: {
                currency: "CNY",
                quantity: "1",
                grossAmount: "10",
                netAmount: "-10",
                fees: {},
              },
            },
          })],
        },
      }),
    ];

    const model = buildDashboardModel(entriesFromRows(rows));
    expect(model.stats.trustedClosedCount).toBe(1);
    expect(model.stats.netPnl).toBe("100");
    expect(model.stats.excludedCount).toBe(3);
    expect(model.stats.exclusionReasons).toMatchObject({
      open: 1,
      "unknown-fees": 1,
      "currency-conversion": 1,
    });
    expect(model.stats.payoff).toBeNull();
    expect(model.stats.payoffReason).toContain("无亏损样本");
  });

  it("groups Shanghai and Shenzhen A shares while isolating currency, nature, and simulation run", () => {
    const rows = [
      row("sh", "100", "2026-01-02T02:00:00.000Z", { instrument: { market: "CN-SH" } }),
      row("sz", "200", "2026-01-03T02:00:00.000Z", { instrument: { market: "CN-SZ" } }),
      row("hkd", "300", "2026-01-04T02:00:00.000Z", { instrument: { market: "HK", currency: "HKD" } }),
      row("sim-a", "400", "2026-01-05T02:00:00.000Z", { tradeNature: "simulation", simulationRunId: "run-a" }),
      row("sim-b", "500", "2026-01-06T02:00:00.000Z", { tradeNature: "simulation", simulationRunId: "run-b" }),
    ];

    const model = buildDashboardModel(entriesFromRows(rows));
    expect(model.groups.map(group => [group.scope.market, group.scope.tradeNature, group.scope.simulationRunId, group.scope.currency]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual([
      ["a-share", "live", null, "CNY"],
      ["HK", "live", null, "HKD"],
      ["a-share", "simulation", "run-a", "CNY"],
      ["a-share", "simulation", "run-b", "CNY"],
    ].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
    const aShare = model.groups.find(group => group.scope.tradeNature === "live" && group.scope.market === "a-share")!;
    expect(aShare.stats.netPnl).toBe("300");
    expect(model.stats.netPnl).toBeNull();
    expect(model.stats.groupReason).toContain("统计范围包含多个币种、市场、交易性质或模拟运行");
  });

  it("uses the default selected group's calendar when several groups are present", () => {
    const rows = [
      row("cny", "100", "2026-01-05T01:00:00.000Z"),
      row("hkd", "200", "2026-01-06T01:00:00.000Z", { instrument: { market: "HK", currency: "HKD" } }),
    ];
    const model = buildDashboardModel(entriesFromRows(rows), {}, "day");
    const selectedGroup = model.groups.find(group => group.scope.id === model.selectedGroupId)!;

    expect(model.calendar).toEqual(buildDashboardCalendar(selectedGroup.rows, "day", selectedGroup.scope.id));
    expect(model.calendar).toHaveLength(1);
    expect(model.calendar[0].state).toBe("positive");
  });

  it("keeps statistics group labels unique when short run IDs collide", () => {
    const model = buildDashboardModel(entriesFromRows([
      row("simulation-a", "100", "2026-01-05T01:00:00.000Z", { tradeNature: "simulation", simulationRunId: "account-4108" }),
      row("simulation-b", "200", "2026-01-06T01:00:00.000Z", { tradeNature: "simulation", simulationRunId: "account-19742" }),
    ]));
    const labels = model.groups.map(group => group.scope.label);

    expect(labels).toHaveLength(2);
    expect(new Set(labels).size).toBe(2);
    expect(labels.every(label => label.includes("#2T9G"))).toBe(true);
  });
});

describe("dashboard market filters and calendar", () => {
  it("identifies HK Connect from source evidence without inventing a persisted market", () => {
    const connect = execution("connect", "buy", "2026-01-02T01:00:00.000Z", {
      instrument: { ...baseInstrument, id: "HK:1810", market: "HK", currency: "HKD" },
      source: {
        platform: "china-merchants",
        row: 1,
        settlement: {
          currency: "CNY",
          quantity: "1",
          grossAmount: "54",
          netAmount: "-54",
          fees: {},
        },
      },
    });
    const ordinary = execution("ordinary", "buy", "2026-01-02T01:00:00.000Z", {
      instrument: { ...baseInstrument, id: "HK:1810", market: "HK", currency: "HKD" },
      source: { platform: "futu", row: 1 },
    });
    expect(isHongKongConnectExecution(connect)).toBe(true);
    expect(isHongKongConnectExecution(ordinary)).toBe(false);

    const connectEntry = entriesFromRows([row("connect", "100", "2026-01-03T02:00:00.000Z", {
      instrument: { id: "HK:1810", symbol: "1810", market: "HK", currency: "HKD" },
      episode: { executions: [connect] },
    })])[0];
    expect(marketFilterMatchesEntry(connectEntry, "hk-connect")).toBe(true);
    expect(marketFilterMatchesEntry(connectEntry, "HK")).toBe(false);
  });

  it("attributes a closed episode once to its closing market date and preserves week/month boundaries", () => {
    const rows = [
      row("monday", "100", "2026-01-05T01:00:00.000Z"),
      row("sunday", "-40", "2026-01-11T01:00:00.000Z"),
      row("february", "20", "2026-02-01T01:00:00.000Z"),
    ];
    const dateCells = buildDashboardCalendar(rows, "day");
    expect(dateCells.map(cell => [cell.key, cell.netPnl, cell.episodeIds])).toEqual([
      ["2026-01-05", "100", ["monday"]],
      ["2026-01-11", "-40", ["sunday"]],
      ["2026-02-01", "20", ["february"]],
    ]);

    const weekCells = buildDashboardCalendar(rows, "week");
    expect(weekCells.map(cell => [cell.key, cell.netPnl, cell.episodeIds])).toEqual([
      ["2026-01-05", "60", ["monday", "sunday"]],
      ["2026-01-26", "20", ["february"]],
    ]);
    const monthCells = buildDashboardCalendar(rows, "month");
    expect(monthCells.map(cell => [cell.key, cell.netPnl, cell.episodeIds])).toEqual([
      ["2026-01", "60", ["monday", "sunday"]],
      ["2026-02", "20", ["february"]],
    ]);
  });

  it("uses the source trading date for a date-only US close with a synthetic timestamp", () => {
    const usInstrument = {
      ...baseInstrument,
      id: "US:TEST",
      symbol: "TEST",
      market: "US",
      currency: "USD",
    };
    const syntheticEndedAt = "2026-02-01T00:00:00.000Z";
    const sourceTradingDate = "2026-02-02";
    const closingExecution = execution("us-date-only:sell", "sell", syntheticEndedAt, {
      instrument: usInstrument,
      source: {
        platform: "futu",
        row: 2,
        timePrecision: "date-only",
        tradingDate: sourceTradingDate,
        marketCalendarDate: sourceTradingDate,
      },
    });
    const usRow = row("us-date-only", "50", syntheticEndedAt, {
      instrument: usInstrument,
      episode: {
        executions: [
          execution("us-date-only:buy", "buy", "2026-01-31T00:00:00.000Z", {
            instrument: usInstrument,
            source: { platform: "futu", row: 1, timePrecision: "date-only", tradingDate: "2026-01-31" },
          }),
          closingExecution,
        ],
      },
    });

    expect(dashboardEpisodeDate(usRow)).toBe(sourceTradingDate);
    expect(buildDashboardCalendar([usRow], "day").map(cell => cell.key)).toEqual([sourceTradingDate]);

    const dateOnlyEpisode = row("us-date-only-date", "50", "2026-02-01", {
      instrument: usInstrument,
      episode: { executions: [closingExecution] },
    });
    expect(dashboardEpisodeDate(dateOnlyEpisode)).toBe(sourceTradingDate);
  });

  it("uses a valid source trading date for a precise overnight US close in calendar and date filters", () => {
    const usInstrument = {
      ...baseInstrument,
      id: "US:TEST",
      symbol: "TEST",
      market: "US",
      currency: "USD",
    };
    const closingExecution = execution("overnight:sell", "sell", "2024-10-01T00:30:00.000Z", {
      instrument: usInstrument,
      source: {
        platform: "futu",
        row: 2,
        timePrecision: "second",
        marketCalendarDate: "2024-09-30",
        tradingDate: "2024-10-01",
      },
    });
    const overnightRow = row("overnight", "50", "2024-10-01T00:30:00.000Z", {
      instrument: usInstrument,
      episode: {
        executions: [
          execution("overnight:buy", "buy", "2024-09-30T23:00:00.000Z", { instrument: usInstrument }),
          closingExecution,
        ],
      },
    });
    const entries = entriesFromRows([overnightRow]);

    expect(dashboardEpisodeDate(overnightRow)).toBe("2024-10-01");
    expect(buildDashboardCalendar([overnightRow], "day").map(cell => cell.key)).toEqual(["2024-10-01"]);
    expect(filterDashboardRows(entries, { startDate: "2024-10-01", endDate: "2024-10-01" })).toHaveLength(1);
  });

  it("keeps open episodes out of the closed-episode calendar", () => {
    const openRow = row("open", null, undefined);
    expect(buildDashboardCalendar([openRow], "day")).toEqual([]);
  });

  it("does not add mixed currencies or runs together when a filter leaves several compatible groups", () => {
    const rows = [
      row("cny", "100", "2026-01-05T01:00:00.000Z"),
      row("hkd", "200", "2026-01-05T02:00:00.000Z", { instrument: { market: "HK", currency: "HKD" } }),
    ];
    const cells = buildDashboardCalendar(rows, "month");
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      key: "2026-01",
      netPnl: null,
      state: "unavailable",
      unavailableReason: expect.stringContaining("币种"),
      episodeIds: [],
      excludedEpisodeIds: ["cny", "hkd"],
    });
  });

  it("filters by the same rows used by dashboard stats", () => {
    const rows = [
      row("sh", "100", "2026-01-05T01:00:00.000Z", { instrument: { market: "CN-SH" } }),
      row("sz", "200", "2026-01-05T02:00:00.000Z", { instrument: { market: "CN-SZ" } }),
    ];
    const entries = entriesFromRows(rows);
    const selected = filterDashboardRows(entries, { market: "a-share" });
    expect(selected.map(value => value.item.episode.id)).toEqual(["sh", "sz"]);
    expect(dashboardScopeKey(selected[0])).toBe(dashboardScopeKey(selected[1]));
  });
});
