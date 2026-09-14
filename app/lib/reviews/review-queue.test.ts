import { describe, expect, it } from "vitest";
import { buildTradeLibraryEntries } from "../trades/library";
import { buildInstrumentTradeSummaries } from "../trades/instruments";
import type { TradeExecution } from "../trades/types";
import type { TradeLibraryEntry } from "../trades/library";
import { createEmptyEpisodeReviewRecord } from "./review-metrics";
import {
  buildReviewQueue,
  reviewQueueBrokerOptions,
  reviewQueueBrokerTags,
  reviewQueueMarketLabel,
  reviewState,
  stableAccountDisplayLabels,
  type ReviewQueueSort,
} from "./review-queue";
import { buildReviewQueueSummary } from "./review-queue-summary";

const instrument = {id:"CN-SH:TEST",name:"测试ETF",symbol:"TEST",market:"CN-SH",currency:"CNY"};
function pair(accountId: string, date: string): TradeExecution[] {
  return (["buy", "sell"] as const).map((side,i) => ({id:`${accountId}-${date}-${side}`,accountId,accountLabel:accountId,instrument,side,executedAt:`${date}T0${i+1}:00:00Z`,quantity:"100",price:i ? "11" : "10",fee:"1",source:{platform:"china-merchants",row:i}}));
}
export function queueFixtures() {
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries([...pair("A","2025-01-02"), ...pair("B","2026-01-02"), ...pair("A","2026-02-02")]),{},{});
}

describe("review queue", () => {
  it.each([
    ["HK", "港股"],
    ["US", "美股"],
    ["CN-SH", "CN-SH"],
    ["", "未知市场"],
  ])("labels market %s without dropping fallback identity", (market, expected) => {
    expect(reviewQueueMarketLabel(market)).toBe(expected);
  });

  it("derives broker provenance from the episode executions and keeps options stable", () => {
    const entry = queueFixtures()[0];
    const sourceEpisode = entry.episodes.find(({ episode }) => episode.accountId === "A")!;
    const taggedEpisode = {
      ...sourceEpisode,
      episode: {
        ...sourceEpisode.episode,
        executions: sourceEpisode.episode.executions.map((execution, index) => ({
          ...execution,
          source: {
            ...execution.source,
            platform: index === 0 ? "futu" : "tiger",
          },
        })),
      },
    };
    const row = { entry, item: taggedEpisode };

    expect(reviewQueueBrokerTags(row)).toEqual([
      { id: "futu", label: "富途" },
      { id: "tiger", label: "Tiger" },
    ]);
    expect(reviewQueueBrokerTags({
      entry,
      item: {
        ...taggedEpisode,
        episode: {
          ...taggedEpisode.episode,
          executions: [{
            ...taggedEpisode.episode.executions[0],
            source: { ...taggedEpisode.episode.executions[0].source, platform: "" },
          }],
        },
      },
    })).toEqual([{ id: "unknown", label: "来源未知" }]);

    const options = reviewQueueBrokerOptions([{
      ...entry,
      executions: [
        ...entry.executions,
        { ...entry.executions[0], source: { ...entry.executions[0].source, platform: "tiger" } },
        { ...entry.executions[0], source: { ...entry.executions[0].source, platform: "futu" } },
      ],
    }]);
    expect(options).toEqual([
      { id: "china-merchants", label: "china-merchants" },
      { id: "futu", label: "富途" },
      { id: "tiger", label: "Tiger" },
    ]);

    expect(buildReviewQueue([{
      ...entry,
      episodes: [taggedEpisode],
    }], { status: "all", brokers: ["china-merchants"] })).toHaveLength(0);
  });

  it("disambiguates duplicate account labels with stable private ordinals", () => {
    const labels = stableAccountDisplayLabels([
      { id: "acct-z", label: "富途" },
      { id: "acct-a", label: "富途" },
      { id: "acct-other", label: "其他账户" },
    ]);
    expect(labels.get("acct-a")).toBe("富途（账户1）");
    expect(labels.get("acct-z")).toBe("富途（账户2）");
    expect([...labels.values()]).not.toContain("acct-a");
    expect([...labels.values()]).not.toContain("acct-z");
  });

  it("accepts legacy account display labels without making accounts part of summary identity", () => {
    const records = [
      ...pair("acct-a", "2026-01-02").map((record) => ({ ...record, accountLabel: "富途" })),
      ...pair("acct-z", "2026-02-02").map((record) => ({ ...record, accountLabel: "富途" })),
    ];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(records), {}, {});
    const accountDisplayLabels = stableAccountDisplayLabels([
      { id: "acct-a", label: "富途" },
      { id: "acct-z", label: "富途" },
    ]);
    const summary = buildReviewQueueSummary(
      buildReviewQueue(entries, { status: "all" }),
      { accountDisplayLabels },
    );
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]).toMatchObject({
      label: "CN-SH · 实盘 · CNY",
      sampleCount: 2,
    });
    expect(summary.groups[0]).not.toHaveProperty("accountId");
    expect(summary.groups[0]).not.toHaveProperty("accountLabel");
  });

  it("filters actual episodes by account and year instead of leaking sibling episodes", () => {
    const queue = buildReviewQueue(queueFixtures(), {account:"A", year:"2026", status:"all"});
    expect(queue).toHaveLength(1);
    expect(queue[0].item.episode.startedAt).toBe("2026-02-02T01:00:00Z");
  });

  it("uses account arrays with OR semantics and combines them with broker AND semantics", () => {
    const base = queueFixtures()[0];
    const entries = base.episodes.slice(0, 3).map((item, index) => {
      const accountId = ["A", "B", "C"][index];
      const platform = ["futu", "tiger", "china-merchants"][index];
      const executions = item.episode.executions.map((execution) => ({
        ...execution,
        accountId,
        accountLabel: accountId,
        source: { ...execution.source, platform },
      }));
      return {
        ...base,
        executions,
        episodes: [{
          ...item,
          episode: { ...item.episode, accountId, accountLabel: accountId, executions },
        }],
      };
    });

    expect(buildReviewQueue(entries, {
      status: "all",
      accounts: ["A", "B"],
      brokers: ["futu", "tiger"],
    }).map(({ item }) => item.episode.accountId)).toEqual(["A", "B"]);
    expect(buildReviewQueue(entries, {
      status: "all",
      accounts: ["A", "B"],
      brokers: ["tiger"],
    }).map(({ item }) => item.episode.accountId)).toEqual(["B"]);
  });

  it("lets an explicit empty account selection clear the legacy account filter", () => {
    const entries = queueFixtures();
    expect(buildReviewQueue(entries, { account: "A", status: "all" })).toHaveLength(2);
    expect(buildReviewQueue(entries, { account: "A", accounts: ["A"], status: "all" })).toHaveLength(2);
    expect(buildReviewQueue(entries, { account: "A", accounts: [], status: "all" })).toHaveLength(3);
  });

  it("matches literal all IDs in arrays without losing legacy scalar wildcard compatibility", () => {
    const base = queueFixtures()[0];
    const entries = base.episodes.slice(0, 2).map((item, index) => {
      const accountId = index === 0 ? "all" : "B";
      const platform = index === 0 ? "all" : "tiger";
      const instrument = { ...base.instrument, market: "HK", currency: "HKD" };
      const executions = item.episode.executions.map((execution) => ({
        ...execution,
        accountId,
        accountLabel: accountId,
        instrument,
        source: { ...execution.source, platform },
      }));
      const scopedItem = {
        ...item,
        episode: {
          ...item.episode,
          accountId,
          accountLabel: accountId,
          instrument,
          status: "closed" as const,
          executions,
        },
        metrics: { ...item.metrics, netPnl: index === 0 ? "1" : "5", pnlAvailable: undefined },
      };
      return { ...base, instrument, executions, episodes: [scopedItem], tradeNature: "live" as const };
    });

    expect(buildReviewQueue(entries, { status: "all", accounts: ["all"] })
      .map(({ item }) => item.episode.accountId)).toEqual(["all"]);
    expect(buildReviewQueue(entries, { status: "all", brokers: ["all"] })
      .map(({ item }) => item.episode.accountId)).toEqual(["all"]);
    expect(buildReviewQueue(entries, { status: "all", account: "all" })).toHaveLength(2);
    expect(buildReviewQueueSummary(buildReviewQueue(entries, { status: "all", accounts: ["all"], brokers: ["all"] })))
      .toMatchObject({ sampleCount: 1, netPnl: "1", winRate: { wins: 1, denominator: 1 } });
  });

  it("aggregates same-market accounts while separating currency, nature, and simulation run", () => {
    const base = queueFixtures()[0];
    const makeRow = (
      itemIndex: number,
      overrides: {
        accountId: string;
        market: string;
        currency: string;
        nature: "live" | "simulation";
        run?: string;
        netPnl: string;
      },
    ) => {
      const item = base.episodes[itemIndex];
      const scopedInstrument = {
        ...base.instrument,
        market: overrides.market,
        currency: overrides.currency,
      };
      const executions = item.episode.executions.map((execution) => ({
        ...execution,
        accountId: overrides.accountId,
        accountLabel: overrides.accountId,
        instrument: scopedInstrument,
        source: {
          ...execution.source,
          platform: overrides.nature === "simulation" ? "tradingview" : "futu",
          ...(overrides.run ? { simulationRunId: overrides.run } : {}),
          tradeNature: overrides.nature,
        },
      }));
      const scopedItem = {
        ...item,
        episode: {
          ...item.episode,
          accountId: overrides.accountId,
          accountLabel: overrides.accountId,
          instrument: scopedInstrument,
          tradeNature: overrides.nature,
          ...(overrides.run ? { simulationRunId: overrides.run } : {}),
          executions,
        },
        metrics: {
          ...item.metrics,
          netPnl: overrides.netPnl,
          pnlAvailable: undefined,
        },
      };
      return {
        entry: {
          ...base,
          instrument: scopedInstrument,
          executions,
          episodes: [scopedItem],
          tradeNature: overrides.nature,
          ...(overrides.run ? { simulationRunId: overrides.run } : {}),
        },
        item: scopedItem,
      };
    };

    const rows = [
      makeRow(0, { accountId: "acct-a", market: "HK", currency: "HKD", nature: "live", netPnl: "100" }),
      makeRow(1, { accountId: "acct-b", market: "HK", currency: "HKD", nature: "live", netPnl: "-40" }),
      makeRow(2, { accountId: "acct-c", market: "HK", currency: "USD", nature: "live", netPnl: "7" }),
      makeRow(0, { accountId: "sim-a", market: "HK", currency: "HKD", nature: "simulation", run: "run-a", netPnl: "5" }),
      makeRow(1, { accountId: "sim-b", market: "HK", currency: "HKD", nature: "simulation", run: "run-b", netPnl: "6" }),
    ];

    const summary = buildReviewQueueSummary(rows);
    expect(summary.groups.map(({ label, sampleCount, netPnl }) => ({ label, sampleCount, netPnl }))).toEqual([
      { label: "港股 · 模拟盘 · run-a · HKD", sampleCount: 1, netPnl: "5" },
      { label: "港股 · 模拟盘 · run-b · HKD", sampleCount: 1, netPnl: "6" },
      { label: "港股 · 实盘 · HKD", sampleCount: 2, netPnl: "60" },
      { label: "港股 · 实盘 · USD", sampleCount: 1, netPnl: "7" },
    ]);
    expect(summary.sampleCount).toBe(5);
    expect(summary.netPnl).toBeNull();
    expect(summary.winRate).toBeNull();
    expect(summary.groups[0]).not.toHaveProperty("accountId");
    expect(summary.groups[0]).not.toHaveProperty("accountLabel");

    const filteredSummary = buildReviewQueueSummary(rows.slice(0, 2));
    expect(filteredSummary).toMatchObject({
      sampleCount: 2,
      trustedClosedCount: 2,
      netPnl: "60",
      winRate: { wins: 1, denominator: 2 },
    });
  });
  it("keeps completion and deferral distinct and orders pending episodes newest first", () => {
    const entries = queueFixtures();
    const all = entries.flatMap(entry => entry.episodes);
    const old = all.find(item => item.episode.startedAt.startsWith("2025"))!;
    old.review = createEmptyEpisodeReviewRecord(old.episode.id, instrument.id);
    old.review.review.completed = true;
    const deferred = all.find(item => item.episode.accountId === "B")!;
    deferred.review = createEmptyEpisodeReviewRecord(deferred.episode.id, instrument.id);
    deferred.review.review.deferredReason = "等待补充资料";
    expect(buildReviewQueue(entries, {status:"pending"}).map(row => row.item.episode.startedAt)).toEqual(["2026-02-02T01:00:00Z"]);
    expect(buildReviewQueue(entries, {status:"completed"})).toHaveLength(1);
    expect(buildReviewQueue(entries, {status:"all"})).toHaveLength(3);
  });

  it.each([
    ["pending-first", ["pending", "deferred", "completed"]],
    ["completed-first", ["completed", "pending", "deferred"]],
  ] as const)("sorts review states independently of the status filter (%s)", (sort, expectedStates) => {
    const entries = queueFixtures();
    const all = entries.flatMap(entry => entry.episodes);
    all[0].review = createEmptyEpisodeReviewRecord(all[0].episode.id, instrument.id);
    all[0].review.review.completed = true;
    all[1].review = createEmptyEpisodeReviewRecord(all[1].episode.id, instrument.id);
    all[1].review.review.deferredReason = "等待资料";

    expect(buildReviewQueue(entries, {status: "all", sort}).map(row => reviewState(row.item)))
      .toEqual(expectedStates);
  });

  it.each([
    ["net-profit", ["100", null, "-50"]],
    ["net-loss", ["100", null, "-50"]],
    ["return-high", ["100", "-50", null]],
    ["return-low", ["-50", "100", null]],
  ] as const)("puts unavailable values last for %s", (sort, expected) => {
    const base = queueFixtures()[0];
    const entries = base.episodes.map((item, index) => ({
      ...base,
      instrument: {
        ...base.instrument,
        currency: index === 1 ? "USD" : "HKD",
      },
      episodes: [{
        ...item,
        episode: {
          ...item.episode,
          status: index === 2 ? "open" as const : "closed" as const,
          accountId: "same-account",
          accountLabel: "同一账户",
          instrument: {
            ...item.episode.instrument,
            currency: index === 1 ? "USD" : "HKD",
          },
        },
        metrics: {
          ...item.metrics,
          netPnl: index === 2 ? null : index === 0 ? "100" : "-50",
          returnPercent: index === 2 ? null : index === 0 ? "10" : "-5",
          pnlAvailable: index === 2 ? undefined : item.metrics.pnlAvailable,
        },
      }],
    }));

    const rows = buildReviewQueue(entries, {status: "all", sort: sort as ReviewQueueSort});
    expect(rows.map(row => row.item.metrics.netPnl)).toEqual(expected);
  });

  it("keeps amount sorting inside explicit currency groups and breaks ties stably", () => {
    const base = queueFixtures()[0];
    const entries = base.episodes.map((item, index) => ({
      ...base,
      instrument: { ...base.instrument, currency: index === 1 ? "USD" : "HKD" },
      episodes: [{
        ...item,
        episode: {
          ...item.episode,
          startedAt: "2026-01-01T01:00:00Z",
          accountId: "same-account",
          accountLabel: "同一账户",
          instrument: { ...item.episode.instrument, currency: index === 1 ? "USD" : "HKD" },
        },
        metrics: { ...item.metrics, netPnl: "10", returnPercent: "1" },
      }],
    }));
    const expectedTieIds = entries.flatMap(entry => entry.episodes.map(item => item.episode.id)).sort();
    const rows = buildReviewQueue(entries, {status: "all", sort: "net-profit"});

    expect(rows.map(row => row.entry.instrument.currency)).toEqual(["HKD", "HKD", "USD"]);
    expect(rows.slice(0, 2).map(row => row.item.episode.id)).toEqual(expectedTieIds.slice(0, 2));
  });

  it("summarizes exactly the filtered rows without counting open or untrusted PnL", () => {
    const base = queueFixtures()[0];
    const entries: TradeLibraryEntry[] = base.episodes.slice(0, 3).map((item, index) => ({
      ...base,
      episodes: [{
      ...item,
        episode: { ...item.episode, status: "closed" as const, accountId: "same-account", accountLabel: "同一账户" },
        review: index === 0 ? {
          ...createEmptyEpisodeReviewRecord(item.episode.id, instrument.id),
          review: { ...createEmptyEpisodeReviewRecord(item.episode.id, instrument.id).review, completed: true },
        } : undefined,
        metrics: {
          ...item.metrics,
          netPnl: ["100", "-50", "0"][index],
          returnPercent: ["10", "-5", "0"][index],
          pnlAvailable: undefined,
        },
      }],
    }));
    entries.push({
      ...base,
      episodes: [{
        ...base.episodes[0],
        episode: { ...base.episodes[0].episode, id: "open-episode", status: "open" as const, accountId: "same-account", accountLabel: "同一账户" },
        metrics: { ...base.episodes[0].metrics, netPnl: null, returnPercent: null, pnlAvailable: undefined },
      }],
    });
    entries.push({
      ...base,
      episodes: [{
        ...base.episodes[0],
        episode: { ...base.episodes[0].episode, id: "untrusted-episode", status: "closed" as const, accountId: "same-account", accountLabel: "同一账户" },
        metrics: { ...base.episodes[0].metrics, netPnl: null, returnPercent: null, pnlAvailable: false },
      }],
    });

    const summary = buildReviewQueueSummary(buildReviewQueue(entries, {status: "all"}));
    expect(summary).toMatchObject({
      sampleCount: 5,
      reviewedCount: 1,
      trustedClosedCount: 3,
      netPnl: "50",
      wins: 1,
      breakEven: 1,
      excludedCount: 2,
      winRate: { wins: 1, denominator: 3 },
    });
    expect(summary.sharpe).toEqual({
      available: false,
      reason: "缺少资金净值与周期收益序列",
    });
  });
});
