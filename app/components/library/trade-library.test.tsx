import { useState } from "react";
import { parseBrokerStatement } from "../../lib/import/dispatcher";
import { fileFor } from "../../lib/import/__fixtures__/tradingview";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { MarketDataSyncStatus } from "../../lib/market/sync-status";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { DEFAULT_TRADE_LIBRARY_BROWSE_STATE } from "./library-browse-state";
import { selectLibraryDisplayMetricRows, TradeLibrary } from "./trade-library";

const xpev: Instrument = {
  id: "US:XPEV",
  symbol: "XPEV",
  name: "小鹏汽车",
  market: "US",
  currency: "USD",
};

const xiaomi: Instrument = {
  id: "HK:1810",
  symbol: "1810",
  name: "小米集团-W",
  market: "HK",
  currency: "HKD",
};

function fill(
  instrument: Instrument,
  side: "buy" | "sell",
  executedAt: string,
  label: string,
): TradeExecution {
  return {
    id: `${instrument.id}-${label}`,
    source: {
      platform: "fixture",
      tradingNature: "live",
      row: 1,
      sourceTimestampText: label,
      sourceTimezone: "Asia/Shanghai",
    },
    accountId: instrument.market === "HK" ? "acct-hk" : "acct-main",
    accountLabel: instrument.market === "HK" ? "港股账户" : "主账户",
    instrument,
    side,
    executedAt,
    quantity: "100",
    price: side === "buy" ? "10" : "12",
    fee: "1",
  };
}

function candle(
  instrumentId: string,
  tradingDate: string,
  close: string,
): DailyCandleRecord {
  return {
    instrumentId,
    tradingDate,
    open: close,
    high: close,
    low: close,
    close,
    volume: "1000",
    currency: instrumentId.startsWith("HK:") ? "HKD" : "USD",
    provider: "tencent",
    providerSymbol: instrumentId,
    adjustmentMode: "raw",
    fetchedAt: "2025-02-01T00:00:00Z",
  };
}

function setup(
  options: {
    reviewed?: boolean;
    marketStatus?: "syncing" | "partial" | "source-unavailable";
    reviewsHydrated?: boolean;
    openDetail?: boolean;
    target?: {
      requestId: number;
      instrumentId: string;
      episodeId: string;
    };
  } = {},
) {
  const candlesByInstrument = {
    "US:XPEV": [
      candle("US:XPEV", "2025-01-02", "10"),
      candle("US:XPEV", "2025-01-03", "12"),
      candle("US:XPEV", "2025-01-05", "11"),
    ],
    "HK:1810": [candle("HK:1810", "2024-12-09", "31")],
  };
  const summaries = buildInstrumentTradeSummaries([
      fill(xpev, "buy", "2025-01-02T14:30:00Z", "旧回合买入"),
      fill(xpev, "sell", "2025-01-03T14:30:00Z", "旧回合卖出"),
      fill(xpev, "buy", "2025-01-05T14:30:00Z", "新回合买入"),
      fill(xiaomi, "buy", "2024-12-08T02:00:00Z", "小米买入"),
      fill(xiaomi, "sell", "2024-12-09T02:00:00Z", "小米卖出"),
    ]);
  const baseEntries = buildTradeLibraryEntries(
    summaries,
    candlesByInstrument,
    {
      "US:XPEV": "complete",
      "HK:1810": "partial",
    },
  );
  const latestXpevEpisode = baseEntries.find(
    (entry) => entry.instrument.id === "US:XPEV",
  )?.episodes[0].episode;
  const review: EpisodeReviewRecord | undefined =
    options.reviewed && latestXpevEpisode
      ? {
          version: 1,
          episodeId: latestXpevEpisode.id,
          instrumentId: "US:XPEV",
          updatedAt: "2025-02-01T00:00:00.000Z",
          plan: {
            thesis: "等待回踩确认",
            expectedPath: "",
            invalidationCondition: "",
            targetRange: "",
            plannedRiskAmount: "99",
            confidence: 4,
          },
          review: {
            decisionQuality: 4,
            executionQuality: 4,
            riskManagement: "",
            psychology: "",
            reusableRule: "",
            completed: true,
          },
          confirmedTagIds: ["pullback"],
        }
      : undefined;
  const entries = buildTradeLibraryEntries(
    summaries,
    candlesByInstrument,
    {
      "US:XPEV": "complete",
      "HK:1810": "partial",
    },
    review ? { [review.episodeId]: review } : {},
  );
  const browseTarget = options.target ?? (options.openDetail && latestXpevEpisode
    ? { requestId: 1, instrumentId: "US:XPEV", episodeId: latestXpevEpisode.id }
    : undefined);
  const onOpenInReview = vi.fn();
  const onSaveReview = vi.fn();
  const onRefreshMarketData = vi.fn();
  const viewProps = {
    entries,
    candlesByInstrument,
    marketDataStatuses: {
      "US:XPEV": options.marketStatus ?? "complete",
      "HK:1810": "partial",
    } satisfies Record<string, MarketDataSyncStatus>,
    timeframe: "1D" as const,
    onTimeframeChange: vi.fn(),
    onOpenInReview,
    onSaveReview,
    onRefreshMarketData,
    reviewsHydrated: options.reviewsHydrated ?? true,
    target: browseTarget,
  };
  const renderResult = render(
    <TradeLibrary
      {...viewProps}
    />,
  );
  return {
    entries,
    rerenderWithEntries: (nextEntries: typeof entries) =>
      renderResult.rerender(<TradeLibrary {...viewProps} entries={nextEntries} />),
    onOpenInReview,
    onSaveReview,
    onRefreshMarketData,
    xpevEpisodeId: latestXpevEpisode?.id,
    olderXpevEpisodeId: baseEntries.find(
      (entry) => entry.instrument.id === "US:XPEV",
    )?.episodes[1].episode.id,
  };
}

describe("TradeLibrary", () => {
  afterEach(() => cleanup());

  it("places the browse tabs directly below the library header and preserves shared filters", async () => {
    const user = userEvent.setup();
    setup();

    const header = screen.getByRole("heading", { name: "交易库" }).closest("header");
    expect(header?.nextElementSibling).toHaveClass("module-tabs");
    expect(header?.nextElementSibling).toHaveAttribute("role", "tablist");
    expect(document.querySelector(".library-view-tabs")).not.toBeInTheDocument();

    const stocksTab = screen.getByRole("tab", { name: "按标的浏览" });
    const queueTab = screen.getByRole("tab", { name: "按回合浏览" });
    expect(stocksTab).toHaveAttribute("aria-selected", "true");
    expect(queueTab).toHaveAttribute("aria-selected", "false");

    await user.type(screen.getByRole("searchbox", { name: "搜索股票" }), "小米");
    await user.selectOptions(screen.getByRole("combobox", { name: "按市场筛选" }), "HK");
    await user.click(queueTab);
    expect(screen.getByRole("searchbox", { name: "搜索复盘回合" })).toHaveValue("小米");
    expect(screen.getByRole("combobox", { name: "按市场筛选" })).toHaveValue("HK");
    expect(screen.getByRole("tab", { name: "按回合浏览" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: "按标的浏览" }));
    expect(screen.getByRole("searchbox", { name: "搜索股票" })).toHaveValue("小米");
    expect(screen.getByRole("tab", { name: "按标的浏览" })).toHaveAttribute("aria-selected", "true");
  });

  it("selects browse tabs with arrow, Home, and End keys", async () => {
    const user = userEvent.setup();
    setup();
    const tabs = screen.getAllByRole("tab");

    tabs[0]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "按回合浏览" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "按回合浏览" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "按标的浏览" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "按回合浏览" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "按标的浏览" })).toHaveFocus();
  });

  it("does not render the browse tabs again in trade detail", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("tab", { name: "按回合浏览" }));
    await user.click(screen.getAllByRole("button", { name: /复盘小鹏汽车/ })[0]);

    expect(screen.queryByRole("tablist", { name: "交易库浏览视图" })).not.toBeInTheDocument();
  });

  it("offers import from an empty library when an import action is provided", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(
      <TradeLibrary
        entries={[]}
        candlesByInstrument={{}}
        marketDataStatuses={{}}
        timeframe="1D"
        onTimeframeChange={() => {}}
        onOpenInReview={() => {}}
        onSaveReview={() => {}}
        onImport={onImport}
        reviewsHydrated
      />,
    );

    expect(screen.getByRole("heading", { name: "交易库" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "交易库浏览视图" })).toBeInTheDocument();
    expect(screen.getByText("还没有导入交易")).toBeInTheDocument();
    expect(screen.queryByLabelText("交易库常用筛选")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("交易库人民币折算")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "当前筛选绩效汇总" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "去导入" }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("使用下方“去导入”添加券商成交记录。")).not.toBeInTheDocument();
  });

  it("offers to clear filters when the library has no matching results", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByRole("searchbox", { name: "搜索股票" }), "不存在的股票");
    expect(screen.getByText("没有符合条件的股票")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清除筛选" }));

    expect(screen.getByText("2 个标的 · 3 个回合")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "搜索股票" })).toHaveValue("");
  });

  it("provides the same applicable empty actions in queue browsing", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(
      <TradeLibrary
        defaultMode="queue"
        entries={[]}
        candlesByInstrument={{}}
        marketDataStatuses={{}}
        timeframe="1D"
        onTimeframeChange={() => {}}
        onOpenInReview={() => {}}
        onSaveReview={() => {}}
        onImport={onImport}
        reviewsHydrated
      />,
    );

    expect(screen.getByRole("heading", { name: "交易库" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "交易库浏览视图" })).toBeInTheDocument();
    expect(screen.getByText("还没有导入交易")).toBeInTheDocument();
    expect(screen.queryByLabelText("交易库常用筛选")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("交易库人民币折算")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "当前筛选绩效汇总" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "去导入" }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("offers to clear filters from an empty queue result", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("tab", { name: "按回合浏览" }));
    await user.type(screen.getByRole("searchbox", { name: "搜索复盘回合" }), "不存在的回合");

    const clearButtons = screen.getAllByRole("button", { name: "清除筛选" });
    expect(clearButtons).toHaveLength(1);
    await user.click(clearButtons[0]!);
    expect(screen.getByRole("searchbox", { name: "搜索复盘回合" })).toHaveValue("");
  });

  it("selects display metrics from the current page and expanded stock rows only", () => {
    const entries = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries([
        fill(xpev, "buy", "2025-01-02T14:30:00Z", "metric-xpev-in"),
        fill(xpev, "sell", "2025-01-03T14:30:00Z", "metric-xpev-out"),
        fill(xiaomi, "buy", "2025-01-04T02:00:00Z", "metric-xiaomi-in"),
        fill(xiaomi, "sell", "2025-01-05T02:00:00Z", "metric-xiaomi-out"),
      ]),
      {},
      {},
    );
    const rows = entries.flatMap(entry => entry.episodes.map(item => ({ entry, item })));
    const groups = entries.map(entry => ({
      entry,
      rows: rows.filter(row => row.entry.instrument.id === entry.instrument.id),
      allRows: rows.filter(row => row.entry.instrument.id === entry.instrument.id),
    }));

    const selected = selectLibraryDisplayMetricRows({
      mode: "stocks",
      queueRows: rows,
      roundPage: 1,
      stockGroups: groups,
      stockPage: 1,
      expandedStockIds: [entries[0]!.instrument.id],
      includeReviewedStockIds: [],
      reviewStatus: "all",
    });

    expect(selected.map(row => row.item.episode.id)).toEqual(
      groups[0]!.rows.map(row => row.item.episode.id),
    );
  });

  it("invalidates a cached range when the entries and review progress change", async () => {
    const user = userEvent.setup();
    const { entries, rerenderWithEntries } = setup();
    const search = screen.getByRole("searchbox", { name: "搜索股票" });

    expect(screen.getByText(/已复盘 0\/3 个/)).toBeVisible();
    await user.type(search, "小鹏");
    await user.clear(search);
    expect(screen.getByText(/已复盘 0\/3 个/)).toBeVisible();

    const reviewedEpisode = entries.find(entry => entry.instrument.id === "US:XPEV")?.episodes[0]?.episode;
    expect(reviewedEpisode).toBeDefined();
    const review = createEmptyEpisodeReviewRecord(
      reviewedEpisode!.id,
      reviewedEpisode!.instrument.id,
      "2025-02-02T00:00:00.000Z",
    );
    review.review.completed = true;
    const updatedEntries = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries(entries.flatMap(entry => entry.executions)),
      {},
      { "US:XPEV": "complete", "HK:1810": "partial" },
      { [review.episodeId]: review },
    );

    rerenderWithEntries(updatedEntries);
    expect(screen.getByText(/已复盘 1\/3 个/)).toBeVisible();
  });

  it("resets persisted list pages when a shared scope filter changes", async () => {
    const user = userEvent.setup();
    const entries = setup().entries;
    const states: Array<{ stockPage: number; roundPage: number }> = [];
    cleanup();
    render(
      <TradeLibrary
        entries={entries}
        candlesByInstrument={{}}
        marketDataStatuses={{}}
        timeframe="1D"
        onTimeframeChange={() => {}}
        onOpenInReview={() => {}}
        onSaveReview={() => {}}
        reviewsHydrated
        initialBrowseState={{ ...DEFAULT_TRADE_LIBRARY_BROWSE_STATE, stockPage: 4, roundPage: 7 }}
        onBrowseStateChange={state => states.push({ stockPage: state.stockPage, roundPage: state.roundPage })}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "按市场筛选" }), "US");
    expect(states.at(-1)).toMatchObject({ stockPage: 1, roundPage: 1 });
  });

  it("completes a queued review then advances inside the selected account", async () => {
    const user = userEvent.setup();
    const { onSaveReview, xpevEpisodeId } = setup();
    await user.click(screen.getByRole("tab", {name:"按回合浏览"}));
    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "主账户" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    await user.click(screen.getByRole("button", {name:/^开始复盘/}));
    await user.type(screen.getByLabelText("下次行动"), "等待确认再行动");
    await user.click(screen.getByRole("button", {name:"完成并下一回合"}));
    expect(onSaveReview).toHaveBeenCalledWith(expect.objectContaining({episodeId:xpevEpisodeId, review:expect.objectContaining({completed:true,reusableRule:"等待确认再行动"})}));
    expect(screen.getByRole("heading", {name:"第 1 次交易"})).toBeInTheDocument();
    expect(screen.getByLabelText("下次行动")).toHaveValue("");
  });

  it("keeps queue detail and navigation within its account and year", async () => {
    const user = userEvent.setup();
    const executions = [
      fill(xpev,"buy","2025-01-02T14:30:00Z","queue-a-2025"),
      fill(xpev,"sell","2025-01-03T14:30:00Z","queue-a-exit"),
      {...fill(xpev,"buy","2026-01-02T14:30:00Z","queue-b"), accountId:"other",accountLabel:"其他账户"},
    ];
    const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions),{},{});
    render(<TradeLibrary defaultMode="queue" entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={()=>{}} onOpenInReview={()=>{}} onSaveReview={async()=>{}} reviewsHydrated />);
    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "主账户" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    await user.click(screen.getByRole("button",{name:/^开始复盘/}));
    expect(within(screen.getByRole("complementary",{name:"交易回合列表"})).getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText(/其他账户/)).not.toBeInTheDocument();
  });

  it("preserves queue scroll position when opening and returning from a review", async () => {
    const user = userEvent.setup();
    const { entries } = setup();
    cleanup();
    let browseState: { scrollTop?: number } | undefined;
    render(
      <TradeLibrary
        defaultMode="queue"
        entries={entries}
        candlesByInstrument={{}}
        marketDataStatuses={{}}
        timeframe="1D"
        onTimeframeChange={() => {}}
        onOpenInReview={() => {}}
        onSaveReview={() => {}}
        reviewsHydrated
        onBrowseStateChange={(state) => { browseState = state; }}
      />,
    );

    const queueSection = screen.getByRole("region", { name: "交易库" });
    queueSection.scrollTop = 241.5;
    fireEvent.scroll(queueSection);
    expect(browseState?.scrollTop).toBe(241.5);

    await user.click(screen.getAllByRole("button", { name: /复盘小鹏汽车/ })[0]);
    await user.click(screen.getByRole("button", { name: "返回股票库" }));
    expect(screen.getByRole("region", { name: "交易库" }).scrollTop).toBe(241.5);
  });

  it("keeps the selected account range when switching to stock browsing", async () => {
    const user=userEvent.setup();
    const { onOpenInReview } = setup();
    await user.click(screen.getByRole("tab",{name:"按回合浏览"}));
    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "港股账户" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    await user.click(screen.getByRole("tab",{name:"按标的浏览"}));
    expect(screen.queryByRole("button",{name:"展开小鹏汽车交易回合"})).not.toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"展开小米集团-W交易回合"}));
    await user.click(screen.getByRole("button",{name:/打开小米集团-W第/}));
    expect(onOpenInReview).toHaveBeenCalledWith("HK:1810", expect.any(String), expect.any(Array));
  });

  it("returns reopened episodes to the next-review candidates", async () => {
    const user=userEvent.setup();
    const summaries=buildInstrumentTradeSummaries([
      fill(xpev,"buy","2025-01-02T14:30:00Z","reopen-old-in"),fill(xpev,"sell","2025-01-03T14:30:00Z","reopen-old-out"),
      fill(xpev,"buy","2025-02-02T14:30:00Z","reopen-new-in"),fill(xpev,"sell","2025-02-03T14:30:00Z","reopen-new-out"),
    ]);
    function Harness() {
      const [reviews,setReviews]=useState<Record<string,EpisodeReviewRecord>>({});
      const entries=buildTradeLibraryEntries(summaries,{},{},reviews);
      return <TradeLibrary defaultMode="queue" entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={()=>{}} onOpenInReview={()=>{}} onSaveReview={async record=>{setReviews(current=>({...current,[record.episodeId]:record}));}} reviewsHydrated />;
    }
    render(<Harness/>);
    await user.selectOptions(screen.getByRole("combobox", { name: "按复盘状态筛选" }), "all");
    await user.click(screen.getByRole("button",{name:/复盘小鹏汽车 2025\/2\/2/}));
    await user.type(screen.getByLabelText("下次行动"),"继续观察");
    await user.click(screen.getByRole("button",{name:"完成并下一回合"}));
    await user.click(screen.getByRole("button",{name:"返回股票库"}));
    await user.click(screen.getByRole("button",{name:/复盘小鹏汽车 2025\/2\/2/}));
    await user.click(screen.getByRole("button",{name:"重新打开复盘"}));
    await user.click(screen.getByRole("button",{name:"返回股票库"}));
    await user.click(screen.getByRole("button",{name:/复盘小鹏汽车 2025\/1\/2/}));
    await user.type(screen.getByLabelText("下次行动"),"维持计划");
    await user.click(screen.getByRole("button",{name:"完成并下一回合"}));
    expect(screen.getByRole("heading",{name:"第 2 次交易"})).toBeInTheDocument();
    expect(screen.getByLabelText("下次行动")).toHaveValue("继续观察");
  });

  it("asks for a new selection when the requested episode no longer exists", async () => {
    const user = userEvent.setup();
    const { onOpenInReview } = setup({ target: { requestId: 1, instrumentId: "US:XPEV", episodeId: "removed-episode" } });
    expect(screen.getByRole("alert")).toHaveTextContent("原股票或交易回合已变化");
    expect(screen.queryByRole("button", { name: "打开统一工作台" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新选择" }));
    expect(screen.getByRole("button", { name: "展开小鹏汽车交易回合" })).toBeInTheDocument();
    expect(onOpenInReview).not.toHaveBeenCalled();
  });

  it.each([
    ["syncing", "正在更新行情", true],
    ["partial", "行情部分可用", false],
    ["source-unavailable", "行情源暂不可用", false],
  ] as const)("keeps the episode visible with market status %s", async (marketStatus, label, disabled) => {
    const user = userEvent.setup();
    setup({ marketStatus, openDetail: true });
    await user.click(screen.getByRole("button", { name: /第 1 次交易/ }));
    expect(screen.getByRole("heading", { name: "第 1 次交易" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(label);
    expect(screen.getByRole("button", { name: "更新当前股票行情" }).hasAttribute("disabled")).toBe(disabled);
  });

  it("updates the selected stock from the library without leaving its episode", async () => {
    const user = userEvent.setup();
    const { onRefreshMarketData } = setup({ openDetail: true });
    await user.click(screen.getByRole("button", { name: /第 1 次交易/ }));
    await user.click(screen.getByRole("button", { name: "更新当前股票行情" }));
    expect(onRefreshMarketData).toHaveBeenCalledWith("US:XPEV");
    expect(screen.getByRole("heading", { name: "第 1 次交易" })).toBeInTheDocument();
  });

  it("filters the stock level and opens a stock's recent-first workbench episode", async () => {
    const user = userEvent.setup();
    const { onOpenInReview } = setup();

    expect(
      screen.getByRole("heading", { name: "交易库" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 个标的 ·/)).toBeInTheDocument();
    expect(screen.getByText("2 个标的 · 3 个回合")).toBeInTheDocument();
    expect(
      screen.getAllByText("累计 R — · 标签待确认").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "高级筛选" })).toBeEnabled();

    await user.type(
      screen.getByRole("searchbox", { name: "搜索股票" }),
      "小米",
    );
    expect(
      screen.queryByRole("button", { name: "展开小鹏汽车交易回合" }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "搜索股票" }));

    await user.click(
      screen.getByRole("button", { name: "展开小鹏汽车交易回合" }),
    );
    await user.click(screen.getAllByRole("button", { name: /打开小鹏汽车第/ })[0]);
    expect(onOpenInReview).toHaveBeenCalledWith("US:XPEV", expect.any(String), expect.any(Array));
    expect(screen.queryByRole("heading", { name: "小鹏汽车（XPEV）" })).not.toBeInTheDocument();
  });

  it("opens a stock card in the shared workbench instead of a library detail page", async () => {
    const user = userEvent.setup();
    const { onOpenInReview, xpevEpisodeId } = setup();

    await user.click(
      screen.getByRole("button", { name: "展开小鹏汽车交易回合" }),
    );
    await user.click(screen.getAllByRole("button", { name: /打开小鹏汽车第/ })[0]);

    expect(onOpenInReview).toHaveBeenCalledWith(
      "US:XPEV",
      xpevEpisodeId,
      expect.any(Array),
    );
    expect(
      screen.queryByRole("heading", { name: "小鹏汽车（XPEV）" }),
    ).not.toBeInTheDocument();
  });

  it("uses market-first tabs to filter the review queue", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("tab", { name: "按回合浏览" }));

    expect(screen.getByRole("combobox", { name: "按市场筛选" })).toHaveValue("all");
    await user.selectOptions(screen.getByRole("combobox", { name: "按市场筛选" }), "HK");
    expect(screen.getByRole("combobox", { name: "按市场筛选" })).toHaveValue("HK");
    expect(screen.queryByRole("button", { name: /复盘小鹏汽车/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /复盘小米集团-W/ })).toBeInTheDocument();
  });

  it("supports broker multi-select and advanced account tags without hiding active constraints", async () => {
    const user = userEvent.setup();
    const records = [
      { ...fill(xpev, "buy", "2025-01-02T14:30:00Z", "futu-in"), accountId: "acct-futu", accountLabel: "账户甲", source: { ...fill(xpev, "buy", "2025-01-02T14:30:00Z", "futu-source").source, platform: "futu" } },
      { ...fill(xpev, "sell", "2025-01-03T14:30:00Z", "futu-out"), accountId: "acct-futu", accountLabel: "账户甲", source: { ...fill(xpev, "sell", "2025-01-03T14:30:00Z", "futu-source").source, platform: "futu" } },
      { ...fill(xpev, "buy", "2025-02-02T14:30:00Z", "tiger-in"), accountId: "acct-tiger", accountLabel: "账户乙", source: { ...fill(xpev, "buy", "2025-02-02T14:30:00Z", "tiger-source").source, platform: "tiger" } },
      { ...fill(xpev, "sell", "2025-02-03T14:30:00Z", "tiger-out"), accountId: "acct-tiger", accountLabel: "账户乙", source: { ...fill(xpev, "sell", "2025-02-03T14:30:00Z", "tiger-source").source, platform: "tiger" } },
    ];
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(records), {}, {});
    render(<TradeLibrary defaultMode="queue" entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={() => {}} onOpenInReview={() => {}} onSaveReview={() => {}} reviewsHydrated />);

    expect(screen.queryByLabelText("队列汇总范围")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前筛选绩效汇总" })).toHaveTextContent("当前统计组：实盘");
    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "富途" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(screen.getByRole("button", { name: "移除来源平台：富途" })).toBeInTheDocument();
    const futuRow = screen.getByRole("button", { name: /复盘小鹏汽车 2025\/1\/2/ });
    expect(futuRow).toBeInTheDocument();
    expect(futuRow.querySelector(".review-queue-window")).not.toHaveTextContent("账户：");
    expect(futuRow.parentElement).toHaveTextContent("账户：账户甲");
    expect(screen.queryByRole("button", { name: /复盘小鹏汽车 2025\/2\/2/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "高级筛选（1）" }));
    await user.click(screen.getByRole("checkbox", { name: "账户乙" }));
    await user.selectOptions(screen.getByLabelText("年份"), "2025");
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(screen.getByRole("button", { name: "移除账户：账户乙" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除年份：2025" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除来源平台：富途" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除账户：账户乙" }));
    expect(screen.queryByRole("button", { name: "移除账户：账户乙" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除年份：2025" }));
    expect(screen.queryByRole("button", { name: "移除年份：2025" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除来源平台：富途" })).toBeInTheDocument();
  });

  it("opens a queue row from the keyboard without changing the captured queue order", async () => {
    const user = userEvent.setup();
    const { onOpenInReview } = setup();
    await user.click(screen.getByRole("tab", { name: "按回合浏览" }));

    const row = screen.getByRole("button", { name: /复盘小米集团-W/ });
    row.focus();
    await user.keyboard("{Enter}");

    expect(onOpenInReview).toHaveBeenCalledWith(
      "HK:1810",
      expect.any(String),
      [expect.any(String), expect.any(String), expect.any(String)],
    );
  });

  it("keeps advanced filters independent, visible when collapsed, and preserves search/account/sort", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("tab", { name: "按回合浏览" }));
    await user.type(screen.getByLabelText("搜索复盘回合"), "XPEV");
    await user.selectOptions(screen.getByLabelText("交易库排序"), "oldest");
    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "主账户" }));
    await user.selectOptions(screen.getByLabelText("年份"), "2025");
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(screen.getByText(/当前筛选：.*个证券.*个回合/)).toBeInTheDocument();
    expect(screen.getByLabelText("搜索复盘回合")).toHaveValue("XPEV");
    expect(screen.getByRole("button", { name: "移除账户：主账户" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "移除年份：2025" })).toBeInTheDocument();
    expect(screen.getByLabelText("交易库排序")).toHaveValue("oldest");

    await user.click(screen.getByRole("button", { name: "移除账户：主账户" }));
    expect(screen.queryByRole("button", { name: "移除账户：主账户" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "高级筛选（1）" }));
    await user.click(screen.getByRole("button", { name: "清除高级条件" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(screen.getByRole("button", { name: "高级筛选" })).toBeInTheDocument();
    expect(screen.getByLabelText("搜索复盘回合")).toHaveValue("XPEV");
    expect(screen.getByLabelText("交易库排序")).toHaveValue("oldest");
  });

  it("preserves controlled queue filters across the account/status/search/sort sequence", async () => {
    const user = userEvent.setup();
    const nvda: Instrument = {
      id: "US:NVDA",
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      market: "US",
      currency: "USD",
    };
    const records = [
      { ...fill(nvda, "buy", "2025-01-02T14:30:00Z", "sequence-old"), accountId: "acct-3", accountLabel: "富途" },
      { ...fill(nvda, "sell", "2025-01-03T14:30:00Z", "sequence-old-out"), accountId: "acct-3", accountLabel: "富途" },
      { ...fill(nvda, "buy", "2025-02-02T14:30:00Z", "sequence-new"), accountId: "acct-3", accountLabel: "富途" },
      { ...fill(nvda, "sell", "2025-02-03T14:30:00Z", "sequence-new-out"), accountId: "acct-3", accountLabel: "富途" },
    ];
    const summaries = buildInstrumentTradeSummaries(records);
    const unreviewedEntries = buildTradeLibraryEntries(summaries, {}, {});
    const reviewedEpisodeId = unreviewedEntries[0]?.episodes[0]?.episode.id;
    const reviewed: EpisodeReviewRecord | undefined = reviewedEpisodeId
      ? createEmptyEpisodeReviewRecord(reviewedEpisodeId, nvda.id)
      : undefined;
    if (reviewed) reviewed.review.completed = true;
    const entries = buildTradeLibraryEntries(
      summaries,
      {},
      {},
      reviewed ? { [reviewedEpisodeId!]: reviewed } : {},
    );
    render(<TradeLibrary defaultMode="queue" entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={() => {}} onOpenInReview={() => {}} onSaveReview={() => {}} reviewsHydrated />);

    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "富途" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "按市场筛选" }), "US");
    await user.selectOptions(screen.getByLabelText("交易库排序"), "return-high");
    await user.selectOptions(screen.getByLabelText("交易库排序"), "return-low");
    await user.selectOptions(screen.getByRole("combobox", { name: "按复盘状态筛选" }), "all");
    await user.click(screen.getByRole("button", { name: "移除账户：富途" }));
    await user.type(screen.getByLabelText("搜索复盘回合"), "NVDA");
    await user.selectOptions(screen.getByLabelText("交易库排序"), "completed-first");

    expect(screen.getByRole("combobox", { name: "按市场筛选" })).toHaveValue("US");
    expect(screen.queryByRole("button", { name: "移除账户：富途" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("搜索复盘回合")).toHaveValue("NVDA");
    expect(screen.getByLabelText("交易库排序")).toHaveValue("completed-first");
    expect(screen.getAllByRole("button", { name: /复盘NVIDIA Corporation/ })).toHaveLength(2);
  });

  it("disambiguates same-label accounts in advanced tags without splitting the aggregate summary", async () => {
    const user = userEvent.setup();
    const first = fill(xpev, "buy", "2025-01-02T14:30:00Z", "same-name-a-in");
    const firstOut = { ...fill(xpev, "sell", "2025-01-03T14:30:00Z", "same-name-a-out"), accountId: "acct-a", accountLabel: "富途" };
    const second = { ...fill(xpev, "buy", "2025-02-02T14:30:00Z", "same-name-z-in"), accountId: "acct-z", accountLabel: "富途" };
    const secondOut = { ...fill(xpev, "sell", "2025-02-03T14:30:00Z", "same-name-z-out"), accountId: "acct-z", accountLabel: "富途", price: "11" };
    const executions = [
      { ...first, accountId: "acct-a", accountLabel: "富途" },
      firstOut,
      second,
      secondOut,
    ].map((execution) => ({
      ...execution,
      source: { ...execution.source, tradingNature: "live" as const },
    }));
    const entries = buildTradeLibraryEntries(buildInstrumentTradeSummaries(executions), {}, {});
    render(<TradeLibrary defaultMode="queue" entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={() => {}} onOpenInReview={() => {}} onSaveReview={() => {}} reviewsHydrated />);

    const summary = screen.getByRole("region", { name: "当前筛选绩效汇总" });
    expect(screen.queryByLabelText("队列汇总范围")).not.toBeInTheDocument();
    expect(summary).toHaveTextContent("当前统计组：实盘");

    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    expect(screen.getByRole("checkbox", { name: "富途（账户1）" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "富途（账户2）" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "富途（账户1）" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(screen.getByRole("button", { name: /复盘小鹏汽车 2025\/1\/2 富途（账户1）/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /复盘小鹏汽车 2025\/2\/2/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除账户：富途（账户1）" }));
    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "富途（账户2）" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(screen.getByRole("button", { name: /复盘小鹏汽车 2025\/2\/2 富途（账户2）/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /复盘小鹏汽车 2025\/1\/2/ })).not.toBeInTheDocument();
  });

  it("starts the first episode in the selected sorted queue order and exposes full names accessibly", async () => {
    const user = userEvent.setup();
    const { onOpenInReview, olderXpevEpisodeId } = setup();
    await user.click(screen.getByRole("tab", { name: "按回合浏览" }));
    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "主账户" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    await user.selectOptions(screen.getByLabelText("交易库排序"), "oldest");
    const firstRow = screen.getAllByRole("button", { name: /复盘小鹏汽车/ })[0];
    expect(firstRow).toHaveAccessibleName(/复盘小鹏汽车 2025\/1\/2/);
    expect(firstRow).toHaveAccessibleName(/原名：小鹏汽车/);
    await user.click(screen.getAllByText("查看完整原名")[0]);
    expect(screen.getAllByText("原名：小鹏汽车")[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^开始复盘/ }));
    expect(onOpenInReview).toHaveBeenCalledWith("US:XPEV", olderXpevEpisodeId, expect.any(Array));
  });

  it("keeps open and untrusted results neutral instead of presenting them as profit", async () => {
    const user = userEvent.setup();
    const unknownBuy = fill(xiaomi, "buy", "2025-01-02T02:00:00Z", "unknown-buy");
    const unknownSell = fill(xiaomi, "sell", "2025-01-03T02:00:00Z", "unknown-sell");
    unknownBuy.source.feeStatus = "unknown";
    unknownSell.source.feeStatus = "unknown";
    const entries = buildTradeLibraryEntries(
      buildInstrumentTradeSummaries([
        fill(xpev, "buy", "2025-01-02T14:30:00Z", "open-buy"),
        unknownBuy,
        unknownSell,
      ]),
      {},
      {},
    );
    render(<TradeLibrary defaultMode="queue" entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={() => {}} onOpenInReview={() => {}} onSaveReview={() => {}} reviewsHydrated />);
    await user.selectOptions(screen.getByRole("combobox", { name: "按复盘状态筛选" }), "all");

    const openRow = screen.getByRole("button", { name: /复盘小鹏汽车/ });
    expect(openRow).toHaveTextContent("持仓中 · 最终盈亏未定");
    expect(openRow.querySelector(".review-queue-result")).toHaveClass("neutral");
    const unknownRow = screen.getByRole("button", { name: /复盘小米集团-W/ });
    expect(unknownRow).toHaveTextContent("没有可信已平仓盈亏");
    expect(unknownRow.querySelector(".review-queue-result")).toHaveClass("neutral");
  });

  it("applies every available stock-level filter", async () => {
    const user = userEvent.setup();
    setup();
    const xpevButton = () =>
      screen.queryByRole("button", { name: "展开小鹏汽车交易回合" });
    const xiaomiButton = () =>
      screen.queryByRole("button", { name: "展开小米集团-W交易回合" });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "按市场筛选" }),
      "US",
    );
    expect(xpevButton()).toBeInTheDocument();
    expect(xiaomiButton()).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "按市场筛选" }),
      "all",
    );

    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "港股账户" }));
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(xpevButton()).not.toBeInTheDocument();
    expect(xiaomiButton()).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除账户：港股账户" }));

    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.selectOptions(screen.getByLabelText("年份"), "2024");
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(xpevButton()).not.toBeInTheDocument();
    expect(xiaomiButton()).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除年份：2024" }));

    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.selectOptions(screen.getByLabelText("持仓状态"), "open");
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(xpevButton()).toBeInTheDocument();
    expect(xiaomiButton()).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除持仓状态：持仓中" }));

    await user.click(screen.getByRole("button", { name: "高级筛选" }));
    await user.selectOptions(screen.getByLabelText("行情状态"), "incomplete");
    await user.click(screen.getByRole("button", { name: "应用筛选" }));
    expect(xpevButton()).not.toBeInTheDocument();
    expect(xiaomiButton()).toBeInTheDocument();
  });

  it("hands the selected stock back to replay without requesting data", async () => {
    const user = userEvent.setup();
    const { onOpenInReview, olderXpevEpisodeId } = setup({ openDetail: true });
    await user.click(
      screen.getByRole("button", { name: /第 1 次交易/ }),
    );
    await user.click(screen.getByRole("button", { name: "打开统一工作台" }));
    expect(onOpenInReview).toHaveBeenLastCalledWith("US:XPEV", olderXpevEpisodeId, expect.arrayContaining([olderXpevEpisodeId]));
  });

  it("shows persisted review facts and saves the selected episode", async () => {
    const user = userEvent.setup();
    const { onSaveReview, xpevEpisodeId } = setup({ reviewed: true, openDetail: true });

    expect(screen.getAllByText("已复盘").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1R").length).toBeGreaterThan(0);
    await user.click(screen.getByText("补充分析 · 原始计划、风险与标签"));
    expect(screen.getByRole("checkbox", { name: "回踩" })).toBeChecked();
    expect(screen.getByLabelText("买入理由")).toHaveValue("等待回踩确认");

    await user.type(screen.getByLabelText("下次行动"), "等待回踩确认");
    await screen.findByText("已自动保存");
    expect(onSaveReview).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: xpevEpisodeId,
        confirmedTagIds: ["pullback"],
      }),
    );
  });

  it("does not open an editable blank review before persistence hydration", async () => {
    setup({ reviewsHydrated: false, openDetail: true });

    expect(
      screen.getByLabelText("正在读取当前回合复盘"),
    ).toHaveTextContent("正在读取本机复盘记录");
    expect(screen.queryByLabelText("买入理由")).not.toBeInTheDocument();
  });

  it("opens the exact stock and episode supplied by an insight target", () => {
    const initial = setup();
    cleanup();

    setup({
      target: {
        requestId: 1,
        instrumentId: "US:XPEV",
        episodeId: initial.olderXpevEpisodeId as string,
      },
    });

    expect(
      screen.getByRole("heading", { name: "第 1 次交易" }),
    ).toBeInTheDocument();
    expect(screen.getByText("旧回合买入")).toBeInTheDocument();
    expect(screen.queryByText("新回合买入")).not.toBeInTheDocument();
  });
});

it("filters simulation groups and opens the selected run in the shared workbench", async () => {
  const user=userEvent.setup();
  const {records}=await parseBrokerStatement(fileFor());
  const live=records.map(r=>({...r,id:'live:'+r.id,source:{platform:'futu',row:r.source.row,tradingNature:'live' as const},accountId:'live'}));
  const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries([...records,...live]),{},{});
  const openReview=vi.fn();
  render(<TradeLibrary entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={()=>{}} onOpenInReview={openReview} onSaveReview={()=>{}} reviewsHydrated={true} />);
  await user.selectOptions(screen.getByLabelText('按交易性质筛选'),'simulation');
  expect(screen.getAllByRole('button',{name:/展开.*交易回合/})).toHaveLength(1);
  await user.click(screen.getByRole('button',{name:/展开.*交易回合/}));
  await user.click(screen.getByRole('button',{name:/打开.*第/}));
  expect(openReview).toHaveBeenCalledWith('CN-SH:600330',entries.find(e=>e.executions[0].source.tradeNature==='simulation')!.episodes[0].episode.id, expect.any(Array));
  expect(screen.queryByText('TradingView 源报告')).not.toBeInTheDocument();
});

it("derives browse rows from shared nature and account scope across rerenders", () => {
  const initial = setup();
  cleanup();
  const simulationEntries = initial.entries.map(entry => ({
    ...entry,
    tradeNature: "simulation" as const,
    simulationRunId: "run-a",
    episodes: entry.episodes.map(item => ({
      ...item,
      episode: {
        ...item.episode,
        tradeNature: "simulation" as const,
        simulationRunId: "run-a",
      },
    })),
  }));
  const props = {
    entries: initial.entries,
    candlesByInstrument: {},
    marketDataStatuses: {},
    timeframe: "1D" as const,
    onTimeframeChange: vi.fn(),
    onOpenInReview: vi.fn(),
    onSaveReview: vi.fn(),
    reviewsHydrated: true,
    sharedScope: { nature: "live" as const, accountIds: ["acct-main"], reportCurrency: "original" as const, simulationRunId: null },
    onSharedScopeChange: vi.fn(),
  };
  const view = render(<TradeLibrary {...props} />);
  expect(screen.getAllByRole("button", { name: /展开.*交易回合/ })).toHaveLength(1);

  view.rerender(<TradeLibrary {...props} entries={simulationEntries} sharedScope={{ ...props.sharedScope, nature: "simulation", simulationRunId: "run-a" }} />);
  expect(screen.getAllByRole("button", { name: /展开.*交易回合/ })).toHaveLength(1);

  view.rerender(<TradeLibrary {...props} entries={simulationEntries} sharedScope={{ ...props.sharedScope, nature: "simulation", accountIds: [], simulationRunId: null }} />);
  expect(screen.getAllByRole("button", { name: /展开.*交易回合/ })).toHaveLength(2);
});
