import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FxSnapshot } from "../../lib/fx/contracts";
import { summarizeLibraryPerformance } from "../../lib/reviews/library-performance";
import type { TradeLibraryEntry, TradeLibraryEpisode } from "../../lib/trades/library";
import type { ReviewQueueItem, ReviewQueueSort } from "../../lib/reviews/review-queue";
import type { Instrument } from "../../lib/trades/types";
import {
  buildTradeLibraryStockGroups,
  LibraryStockRounds,
  type TradeLibraryStockGroup,
} from "./library-stock-rounds";

afterEach(() => cleanup());

const instrument: Instrument = {
  id: "US:ABC",
  symbol: "ABC",
  name: "Alpha Beta",
  market: "US",
  currency: "USD",
};

function item(
  id: string,
  startedAt: string,
  options: {
    nature?: "live" | "simulation" | "unknown";
    runId?: string;
    accountId?: string;
    accountLabel?: string;
    completed?: boolean;
    currency?: string;
    netPnl?: string | null;
    grossExposure?: string;
    status?: "open" | "closed";
    unrealizedPnl?: string | null;
  } = {},
): TradeLibraryEpisode {
  const rowInstrument = { ...instrument, currency: options.currency ?? instrument.currency };
  const status = options.status ?? "closed";
  const netPnl = options.netPnl === undefined ? "1" : options.netPnl;
  const execution = {
    id: `${id}-fill`,
    source: { platform: options.nature === "simulation" ? "tradingview" : "futu", row: 1, tradingNature: options.nature ?? "live", simulationRunId: options.runId },
    accountId: options.accountId ?? "account-a",
    accountLabel: options.accountLabel ?? "共享账户",
    instrument: rowInstrument,
    side: "buy" as const,
    executedAt: startedAt,
    quantity: "1",
    price: "10",
    fee: "0",
  };
  return {
    episode: {
      id,
      instrument: rowInstrument,
      executions: [execution],
      accountId: execution.accountId,
      accountLabel: execution.accountLabel,
      startedAt,
      ...(status === "closed" ? { endedAt: `${startedAt.slice(0, 10)}T16:00:00Z` } : {}),
      status,
      direction: "long",
      tradeNature: options.nature ?? "live",
      ...(options.runId ? { simulationRunId: options.runId } : {}),
      openingQuantity: "1",
      remainingQuantity: status === "closed" ? "0" : "1",
    },
    metrics: {
      buyCount: 1,
      sellCount: 1,
      boughtQuantity: "1",
      soldQuantity: "1",
      grossExposure: options.grossExposure ?? "10",
      fees: "0",
      realizedPnl: netPnl ?? "0",
      unrealizedPnl: options.unrealizedPnl ?? null,
      netPnl: status === "closed" ? netPnl : null,
      returnPercent: status === "closed" && netPnl !== null ? "10" : "99",
      holdingMilliseconds: status === "closed" ? 3_600_000 : null,
    },
    review: options.completed ? { review: { completed: true } } as TradeLibraryEpisode["review"] : undefined,
    reviewStatus: options.completed ? "completed" : "pending",
    confirmedTagIds: [],
    tagDictionaryVersion: 1,
    rMultiple: null,
  } as TradeLibraryEpisode;
}

function entry(items: TradeLibraryEpisode[]): TradeLibraryEntry {
  const executions = items.flatMap((item) => item.episode.executions);
  const first = items[0];
  return {
    groupId: `${first?.episode.instrument.id ?? instrument.id}|live`,
    tradeNature: first?.episode.tradeNature ?? "live",
    instrument: first?.episode.instrument ?? instrument,
    executions,
    episodes: items,
    accountCount: new Set(executions.map((execution) => execution.accountId)).size,
    tradeCount: executions.length,
    episodeCount: items.length,
    firstTradeAt: items[0]?.episode.startedAt ?? "2026-01-01T00:00:00Z",
    lastTradeAt: items.at(-1)?.episode.endedAt ?? items.at(-1)?.episode.startedAt ?? "2026-01-01T00:00:00Z",
    status: "closed",
    netPnl: first?.metrics.netPnl ?? null,
    returnPercent: first?.metrics.returnPercent ?? null,
    reviewedEpisodeCount: items.filter((item) => item.reviewStatus === "completed").length,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

function row(entryValue: TradeLibraryEntry, episode: TradeLibraryEpisode): ReviewQueueItem {
  return { entry: entryValue, item: episode };
}

function fxSnapshot(rates: Partial<FxSnapshot["rates"]> = {}): FxSnapshot {
  return {
    version: 1,
    baseCurrency: "CNY",
    rates: { CNY: 1, HKD: 0.9, USD: 7, ...rates },
    source: {
      id: "frankfurter-ecb",
      label: "fixture",
      url: "https://example.test/fx",
      attributionUrl: "https://example.test/fx/about",
    },
    rateDate: "2026-01-01",
    fetchedAt: "2026-01-01T00:00:00.000Z",
    lastAttemptedAt: "2026-01-01T00:00:00.000Z",
    cacheStatus: "fresh",
  };
}

function performanceFor(rows: ReviewQueueItem[], snapshot?: FxSnapshot | null) {
  return summarizeLibraryPerformance(rows, snapshot ?? undefined);
}

function renderGroups(rows: ReviewQueueItem[], allRows = rows, stocks = [rows[0]!.entry]) {
  const onOpenRound = vi.fn();
  const groups = buildTradeLibraryStockGroups(rows, allRows, stocks);
  function Harness() {
    const [expandedStockIds, setExpandedStockIds] = useState<string[]>([]);
    return <LibraryStockRounds
      groups={groups}
      expandedStockIds={expandedStockIds}
      includeReviewedStockIds={[]}
      reviewStatus="all"
      marketDataStatuses={{}}
      onToggleExpanded={(id) => setExpandedStockIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])}
      onToggleIncludeReviewed={vi.fn()}
      onOpenRound={onOpenRound}
      money={(value) => value ?? "待核对"}
      natureLabel={(nature) => nature === "simulation" ? "模拟盘" : nature === "live" ? "实盘" : "来源未知"}
      marketDataStatusLabel={() => "行情待补齐"}
      reviewTagLabel={(tag) => tag}
    />;
  }
  const rendered = render(<Harness />);
  return { onOpenRound, groups, container: rendered.container };
}

describe("LibraryStockRounds", () => {
  it("groups simulation rounds by run and opens the exact child episode", async () => {
    const live = item("live-episode", "2026-01-01T10:00:00Z");
    const runA = item("run-a-episode", "2026-02-01T10:00:00Z", { nature: "simulation", runId: "tradingview:alpha" });
    const runB = item("run-b-episode", "2026-03-01T10:00:00Z", { nature: "simulation", runId: "tradingview:beta" });
    const liveScope = entry([live]);
    const runAScope = { ...entry([runA]), tradeNature: "simulation" as const, simulationRunId: "tradingview:alpha" };
    const runBScope = { ...entry([runB]), tradeNature: "simulation" as const, simulationRunId: "tradingview:beta" };
    const rows = [row(liveScope, live), row(runAScope, runA), row(runBScope, runB)];
    const { onOpenRound } = renderGroups(rows);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "展开Alpha Beta交易回合" }));
    expect(screen.getAllByText(/模拟运行 · Alpha Beta（ABC） ·/)).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "打开Alpha Beta第1次交易 共享账户" })[1]);
    expect(onOpenRound).toHaveBeenCalledWith(rows[1], ["live-episode", "run-a-episode", "run-b-episode"]);
  });

  it("relaxes review status for one stock and labels the local scope", async () => {
    const pending = item("pending-episode", "2026-01-01T10:00:00Z");
    const completed = item("completed-episode", "2026-02-01T10:00:00Z", { completed: true });
    const stock = entry([pending, completed]);
    const rows = [row(stock, pending)];
    const allRows = [row(stock, pending), row(stock, completed)];
    const onToggleIncludeReviewed = vi.fn();
    const groups = buildTradeLibraryStockGroups(rows, allRows, [stock]);
    const user = userEvent.setup();
    render(
      <LibraryStockRounds
        groups={groups}
        expandedStockIds={[instrument.id]}
        includeReviewedStockIds={[instrument.id]}
        reviewStatus="pending"
        marketDataStatuses={{}}
        onToggleExpanded={vi.fn()}
        onToggleIncludeReviewed={onToggleIncludeReviewed}
        onOpenRound={vi.fn()}
        money={(value) => value ?? "待核对"}
        natureLabel={() => "实盘"}
        marketDataStatusLabel={() => "行情待补齐"}
        reviewTagLabel={(tag) => tag}
      />,
    );

    expect(screen.getByText("仅此标的范围；全局统计与开始复盘不变。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起已复盘回合" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /打开Alpha Beta第2次交易/ })).toBeInTheDocument();
    expect(screen.getByText("局部额外显示 · 不计入当前统计")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "收起已复盘回合" }));
    expect(onToggleIncludeReviewed).toHaveBeenCalledWith(instrument.id);
  });

  it("keeps child ordinals from the source entry when the visible rows are filtered", async () => {
    const newest = item("newest-episode", "2026-03-01T10:00:00Z");
    const middle = item("middle-episode", "2026-02-01T10:00:00Z");
    const oldest = item("oldest-episode", "2026-01-01T10:00:00Z");
    const sourceEntry = entry([newest, middle, oldest]);
    const filteredAggregate = entry([newest, oldest]);
    const rows = [row(sourceEntry, newest), row(sourceEntry, oldest)];
    const { container } = renderGroups(rows, rows, [filteredAggregate]);
    const user = userEvent.setup();

    const view = within(container);
    await user.click(view.getByRole("button", { name: "展开Alpha Beta交易回合" }));
    expect(view.getByRole("button", { name: /打开Alpha Beta第3次交易/ })).toBeInTheDocument();
    expect(view.getByRole("button", { name: /打开Alpha Beta第1次交易/ })).toBeInTheDocument();
  });

  it("uses the new performance model without falling back to legacy stock totals", () => {
    const usdEpisode = item("usd-episode", "2026-04-01T10:00:00Z", {
      currency: "USD",
      netPnl: "-100",
      grossExposure: "1000",
    });
    const stock = {
      ...entry([usdEpisode]),
      netPnl: "999",
      returnPercent: "99",
    };
    const rows = [row(stock, usdEpisode)];
    const performance = performanceFor(rows);

    render(
      <LibraryStockRounds
        groups={buildTradeLibraryStockGroups(rows, rows, [stock])}
        expandedStockIds={[]}
        includeReviewedStockIds={[]}
        reviewStatus="all"
        performanceByInstrument={new Map([[instrument.id, performance]])}
        marketDataStatuses={{}}
        onToggleExpanded={vi.fn()}
        onToggleIncludeReviewed={vi.fn()}
        onOpenRound={vi.fn()}
        money={(value, currency) => value === null ? "不可用" : `${currency} ${value}`}
        natureLabel={() => "实盘"}
        marketDataStatusLabel={() => "行情待补齐"}
        reviewTagLabel={(tag) => tag}
      />,
    );

    expect(screen.getByText("USD -100")).toBeInTheDocument();
    expect(screen.getByText(/人民币暂无法折算/)).toBeInTheDocument();
    expect(screen.queryByText("USD 999")).not.toBeInTheDocument();
    expect(screen.queryByText("99.00%")).not.toBeInTheDocument();
  });

  it("keeps original-currency amounts visible after CNY conversion", () => {
    const usdEpisode = item("converted-usd", "2026-04-01T10:00:00Z", {
      currency: "USD",
      netPnl: "100",
      grossExposure: "1000",
    });
    const stock = entry([usdEpisode]);
    const rows = [row(stock, usdEpisode)];
    const snapshot = fxSnapshot();

    render(
      <LibraryStockRounds
        groups={buildTradeLibraryStockGroups(rows, rows, [stock])}
        expandedStockIds={[]}
        includeReviewedStockIds={[]}
        reviewStatus="all"
        fxSnapshot={snapshot}
        performanceByInstrument={new Map([[instrument.id, performanceFor(rows, snapshot)]])}
        marketDataStatuses={{}}
        onToggleExpanded={vi.fn()}
        onToggleIncludeReviewed={vi.fn()}
        onOpenRound={vi.fn()}
        money={(value, currency) => value === null ? "不可用" : `${currency} ${value}`}
        natureLabel={() => "实盘"}
        marketDataStatusLabel={() => "行情待补齐"}
        reviewTagLabel={(tag) => tag}
      />,
    );

    expect(screen.getByText("CNY 700")).toBeInTheDocument();
    expect(screen.getByText(/原币金额：.*USD/)).toBeInTheDocument();
    expect(screen.getByText(/加权收益率（按开仓金额）：10\.00% · CNY/)).toBeInTheDocument();
  });

  it("shows separate per-run amounts and the multi-run expansion cue", async () => {
    const runAEpisode = item("run-a-episode", "2026-02-01T10:00:00Z", {
      nature: "simulation",
      runId: "run-a",
      currency: "CNY",
      netPnl: "10",
    });
    const runBEpisode = item("run-b-episode", "2026-03-01T10:00:00Z", {
      nature: "simulation",
      runId: "run-b",
      currency: "CNY",
      netPnl: "20",
    });
    const runAEntry = { ...entry([runAEpisode]), tradeNature: "simulation" as const, simulationRunId: "run-a" };
    const runBEntry = { ...entry([runBEpisode]), tradeNature: "simulation" as const, simulationRunId: "run-b" };
    const rows = [row(runAEntry, runAEpisode), row(runBEntry, runBEpisode)];
    const stock = entry([runAEpisode, runBEpisode]);
    const groups = buildTradeLibraryStockGroups(rows, rows, [{ ...stock, instrument: runAEpisode.episode.instrument }]);
    const user = userEvent.setup();

    render(
      <LibraryStockRounds
        groups={groups}
        expandedStockIds={[instrument.id]}
        includeReviewedStockIds={[]}
        reviewStatus="all"
        fxSnapshot={fxSnapshot()}
        performanceByInstrument={new Map([[instrument.id, performanceFor(rows, fxSnapshot())]])}
        marketDataStatuses={{}}
        onToggleExpanded={vi.fn()}
        onToggleIncludeReviewed={vi.fn()}
        onOpenRound={vi.fn()}
        money={(value, currency) => value === null ? "不可用" : `${currency} ${value}`}
        natureLabel={() => "模拟盘"}
        marketDataStatusLabel={() => "行情待补齐"}
        reviewTagLabel={(tag) => tag}
      />,
    );

    expect(screen.getByText("2 个模拟运行 · 展开查看")).toBeInTheDocument();
    expect(screen.getByText(/CNY 10/)).toBeInTheDocument();
    expect(screen.getByText(/CNY 20/)).toBeInTheDocument();
    expect(screen.queryByText(/CNY 30/)).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /打开Alpha Beta第1次交易/ })[0]!);
  });

  it("keeps open children separate and does not label unrealized PnL as final return", () => {
    const openEpisode = item("open-episode", "2026-04-01T10:00:00Z", {
      currency: "USD",
      status: "open",
      unrealizedPnl: "12",
    });
    const stock = entry([openEpisode]);
    const rows = [row(stock, openEpisode)];
    const performance = performanceFor(rows, fxSnapshot());

    render(
      <LibraryStockRounds
        groups={buildTradeLibraryStockGroups(rows, rows, [stock])}
        expandedStockIds={[instrument.id]}
        includeReviewedStockIds={[]}
        reviewStatus="all"
        fxSnapshot={fxSnapshot()}
        performanceByInstrument={new Map([[instrument.id, performance]])}
        performanceByEpisode={new Map([[openEpisode.episode.id, performance]])}
        marketDataStatuses={{}}
        onToggleExpanded={vi.fn()}
        onToggleIncludeReviewed={vi.fn()}
        onOpenRound={vi.fn()}
        money={(value, currency) => value === null ? "不可用" : `${currency} ${value}`}
        natureLabel={() => "实盘"}
        marketDataStatusLabel={() => "行情待补齐"}
        reviewTagLabel={(tag) => tag}
      />,
    );

    expect(screen.getByText(/持仓中 1 个回合/)).toBeInTheDocument();
    expect(screen.getAllByText(/浮盈亏/).length).toBeGreaterThan(0);
    expect(screen.queryByText("99.00%")).not.toBeInTheDocument();
  });

  it("exposes stock sort toggles and disables performance sorts with the gating reason", async () => {
    const live = item("sort-episode", "2026-04-01T10:00:00Z");
    const stock = entry([live]);
    const onSort = vi.fn<(sort: ReviewQueueSort) => void>();
    const user = userEvent.setup();

    render(
      <LibraryStockRounds
        groups={buildTradeLibraryStockGroups([row(stock, live)], [row(stock, live)], [stock])}
        expandedStockIds={[]}
        includeReviewedStockIds={[]}
        reviewStatus="all"
        sort="newest"
        onSort={onSort}
        performanceSortAvailability={{ allowed: false, reason: "请先选择模拟运行" }}
        marketDataStatuses={{}}
        onToggleExpanded={vi.fn()}
        onToggleIncludeReviewed={vi.fn()}
        onOpenRound={vi.fn()}
        money={(value) => value ?? "不可用"}
        natureLabel={() => "实盘"}
        marketDataStatusLabel={() => "行情待补齐"}
        reviewTagLabel={(tag) => tag}
      />,
    );

    const sortGroup = screen.getByRole("group", { name: "股票列表排序" });
    const newestButton = within(sortGroup).getByRole("button", { name: /最近成交.*降序/ });
    expect(newestButton).toHaveAttribute("aria-pressed", "true");
    expect(within(sortGroup).getByRole("button", { name: /净盈亏/ })).toBeDisabled();
    expect(screen.getByText(/绩效排序不可用：请先选择模拟运行/)).toBeInTheDocument();

    await user.click(newestButton);
    expect(onSort).toHaveBeenCalledWith("oldest");
  });

  it("renders one hundred stocks per page and clamps an out-of-range page", () => {
    const groups: TradeLibraryStockGroup[] = Array.from({ length: 101 }, (_, index) => {
      const episode = item(`page-${index}`, `2026-01-${String((index % 28) + 1).padStart(2, "0")}T10:00:00Z`);
      const stock = entry([episode]);
      const stockInstrument = {
        ...stock.instrument,
        id: `US:ABC-${index}`,
        symbol: `ABC-${index}`,
        name: `Alpha Beta ${index}`,
      };
      const stockEntry = { ...stock, instrument: stockInstrument };
      const stockRow = row(stockEntry, episode);
      return { entry: stockEntry, rows: [stockRow], allRows: [stockRow] };
    });
    const onPageChange = vi.fn<(page: number) => void>();

    render(
      <LibraryStockRounds
        groups={groups}
        expandedStockIds={[]}
        includeReviewedStockIds={[]}
        reviewStatus="all"
        page={99}
        onPageChange={onPageChange}
        marketDataStatuses={{}}
        onToggleExpanded={vi.fn()}
        onToggleIncludeReviewed={vi.fn()}
        onOpenRound={vi.fn()}
        money={(value) => value ?? "不可用"}
        natureLabel={() => "实盘"}
        marketDataStatusLabel={() => "行情待补齐"}
        reviewTagLabel={(tag) => tag}
      />,
    );

    expect(screen.getByText("显示 101-101/101")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Beta 0")).not.toBeInTheDocument();
    expect(screen.getByText("Alpha Beta 100")).toBeInTheDocument();
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: "上一页" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
  });
});
