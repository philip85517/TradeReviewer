import { useState } from "react";
import { parseBrokerStatement } from "../../lib/import/dispatcher";
import { fileFor } from "../../lib/import/__fixtures__/tradingview";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
import { createEmptyEpisodeReviewRecord } from "../../lib/reviews/review-metrics";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { TradeLibrary } from "./trade-library";

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
  render(
    <TradeLibrary
      entries={entries}
      candlesByInstrument={candlesByInstrument}
      marketDataStatuses={{
        "US:XPEV": options.marketStatus ?? "complete",
        "HK:1810": "partial",
      }}
      timeframe="1D"
      onTimeframeChange={vi.fn()}
      onOpenInReview={onOpenInReview}
      onSaveReview={onSaveReview}
      onRefreshMarketData={onRefreshMarketData}
      reviewsHydrated={options.reviewsHydrated ?? true}
      target={browseTarget}
    />,
  );
  return {
    entries,
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

  it("completes a queued review then advances inside the selected account", async () => {
    const user = userEvent.setup();
    const { onSaveReview, xpevEpisodeId } = setup();
    await user.click(screen.getByRole("button", {name:"回合待复盘"}));
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 主账户" }));
    await user.click(screen.getByRole("button", {name:"开始复盘"}));
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
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 主账户" }));
    await user.click(screen.getByRole("button",{name:"开始复盘"}));
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

  it("opens a stock review within that stock instead of an unrelated saved queue", async () => {
    const user=userEvent.setup();
    const { onOpenInReview } = setup();
    await user.click(screen.getByRole("button",{name:"回合待复盘"}));
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 港股账户" }));
    await user.click(screen.getByRole("button",{name:"按标的浏览"}));
    await user.click(screen.getByRole("button",{name:"打开小鹏汽车交易回合"}));
    expect(onOpenInReview).toHaveBeenCalledWith("US:XPEV", expect.any(String), expect.any(Array));
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
    await user.click(screen.getByRole("button",{name:"全部回合"}));
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
    expect(screen.getByRole("button", { name: "打开小鹏汽车交易回合" })).toBeInTheDocument();
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
      screen.getByRole("heading", { name: "股票交易库" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 个标的")).toBeInTheDocument();
    expect(screen.getByText(/2 个回合/)).toBeInTheDocument();
    expect(
      screen.getAllByText("累计 R — · 标签待确认").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("combobox", { name: "按标签筛选" }),
    ).toBeEnabled();

    await user.type(
      screen.getByRole("searchbox", { name: "搜索股票" }),
      "小米",
    );
    expect(
      screen.queryByRole("button", { name: "打开小鹏汽车交易回合" }),
    ).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "搜索股票" }));

    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );
    expect(onOpenInReview).toHaveBeenCalledWith("US:XPEV", expect.any(String), expect.any(Array));
    expect(screen.queryByRole("heading", { name: "小鹏汽车（XPEV）" })).not.toBeInTheDocument();
  });

  it("opens a stock card in the shared workbench instead of a library detail page", async () => {
    const user = userEvent.setup();
    const { onOpenInReview, xpevEpisodeId } = setup();

    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );

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

    await user.click(screen.getByRole("button", { name: "回合待复盘" }));

    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "港股" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "美股" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "港股" }));

    expect(screen.getByRole("button", { name: "港股" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
    expect(screen.getByRole("region", { name: "当前筛选汇总" })).toHaveTextContent("美股 · 实盘 · USD");
    expect(screen.getByRole("button", { name: "富途" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Tiger" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "富途" }));
    expect(screen.getByRole("button", { name: "富途" })).toHaveAttribute("aria-pressed", "true");
    const futuRow = screen.getByRole("button", { name: /复盘小鹏汽车 2025\/1\/2/ });
    expect(futuRow).toBeInTheDocument();
    expect(futuRow.querySelector(".review-queue-window")).not.toHaveTextContent("账户：");
    expect(futuRow.parentElement).toHaveTextContent("账户：账户甲");
    expect(screen.queryByRole("button", { name: /复盘小鹏汽车 2025\/2\/2/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    const advancedFilters = screen.getByRole("group", { name: "高级筛选" });
    const accountRow = advancedFilters.querySelector<HTMLElement>(".review-queue-accounts-row");
    expect(accountRow).not.toBeNull();
    expect(accountRow).toContainElement(screen.getByRole("group", { name: "账户标签" }));
    expect(accountRow).toContainElement(screen.getByRole("button", { name: "清除账户标签" }));
    const accountTag = screen.getByRole("checkbox", { name: "账户筛选 账户乙" });
    await user.click(accountTag);
    await user.selectOptions(screen.getByLabelText("复盘年份"), "2025");
    await user.click(screen.getByRole("button", { name: "清除账户标签" }));
    expect(screen.getByRole("checkbox", { name: "账户筛选 账户乙" })).not.toBeChecked();
    expect(screen.getByLabelText("复盘年份")).toHaveValue("2025");
    expect(screen.getByRole("button", { name: "富途" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /更多筛选（1）/ }));
    expect(screen.queryByRole("button", { name: "移除账户筛选 账户乙" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "富途" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /更多筛选（1）/ }));
    await user.click(screen.getByRole("button", { name: "清除高级条件" }));
    expect(screen.getByLabelText("复盘年份")).toHaveValue("all");
    expect(screen.getByRole("button", { name: "富途" })).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a queue row from the keyboard without changing the captured queue order", async () => {
    const user = userEvent.setup();
    const { onOpenInReview } = setup();
    await user.click(screen.getByRole("button", { name: "回合待复盘" }));

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
    await user.click(screen.getByRole("button", { name: "回合待复盘" }));
    await user.type(screen.getByLabelText("搜索复盘回合"), "XPEV");
    await user.selectOptions(screen.getByLabelText("回合排序"), "oldest");
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 主账户" }));
    await user.selectOptions(screen.getByLabelText("复盘年份"), "2025");
    expect(screen.getByText(/按入选完整回合统计；净盈亏已扣已知费用；年份筛选仅筛选回合/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更多筛选（2）" }));

    expect(screen.queryByLabelText("复盘年份")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多筛选（2）" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("搜索复盘回合")).toHaveValue("XPEV");
    expect(screen.getByRole("button", { name: "移除账户筛选 主账户" })).toBeInTheDocument();
    expect(screen.getByLabelText("回合排序")).toHaveValue("oldest");

    await user.click(screen.getByRole("button", { name: "更多筛选（2）" }));
    await user.click(screen.getByRole("button", { name: "清除账户标签" }));
    expect(screen.getByLabelText("复盘年份")).toHaveValue("2025");
    expect(screen.queryByRole("button", { name: "移除账户筛选 主账户" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "清除高级条件" }));
    expect(screen.getByLabelText("复盘年份")).toHaveValue("all");
    expect(screen.getByLabelText("搜索复盘回合")).toHaveValue("XPEV");
    expect(screen.getByLabelText("回合排序")).toHaveValue("oldest");
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

    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 富途" }));
    await user.click(screen.getByRole("button", { name: "美股" }));
    await user.selectOptions(screen.getByLabelText("回合排序"), "return-high");
    await user.selectOptions(screen.getByLabelText("回合排序"), "return-low");
    await user.click(screen.getByRole("button", { name: "全部回合" }));
    await user.click(screen.getByRole("button", { name: "移除账户筛选 富途" }));
    await user.type(screen.getByLabelText("搜索复盘回合"), "NVDA");
    await user.selectOptions(screen.getByLabelText("回合排序"), "completed-first");

    expect(screen.getByRole("button", { name: "美股" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "移除账户筛选 富途" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("搜索复盘回合")).toHaveValue("NVDA");
    expect(screen.getByLabelText("回合排序")).toHaveValue("completed-first");
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

    const summary = screen.getByRole("region", { name: "当前筛选汇总" });
    expect(screen.queryByLabelText("队列汇总范围")).not.toBeInTheDocument();
    expect(summary).toHaveTextContent("美股 · 实盘 · USD");

    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    expect(screen.getByRole("checkbox", { name: "账户筛选 富途（账户1）" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "账户筛选 富途（账户2）" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 富途（账户1）" }));
    expect(screen.getByRole("button", { name: /复盘小鹏汽车 2025\/1\/2 富途（账户1）/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /复盘小鹏汽车 2025\/2\/2/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "移除账户筛选 富途（账户1）" }));
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 富途（账户2）" }));
    expect(screen.getByRole("button", { name: /复盘小鹏汽车 2025\/2\/2 富途（账户2）/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /复盘小鹏汽车 2025\/1\/2/ })).not.toBeInTheDocument();
  });

  it("starts the first episode in the selected sorted queue order and exposes full names accessibly", async () => {
    const user = userEvent.setup();
    const { onOpenInReview, olderXpevEpisodeId } = setup();
    await user.click(screen.getByRole("button", { name: "回合待复盘" }));
    await user.click(screen.getByRole("button", { name: "更多筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "账户筛选 主账户" }));
    await user.selectOptions(screen.getByLabelText("回合排序"), "oldest");
    const firstRow = screen.getAllByRole("button", { name: /复盘小鹏汽车/ })[0];
    expect(firstRow).toHaveAccessibleName(/复盘小鹏汽车 2025\/1\/2/);
    expect(firstRow).toHaveAccessibleName(/原名：小鹏汽车/);
    await user.click(screen.getAllByText("查看完整原名")[0]);
    expect(screen.getAllByText("原名：小鹏汽车")[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: "开始复盘" }));
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
    await user.click(screen.getByRole("button", { name: "全部回合" }));

    const openRow = screen.getByRole("button", { name: /复盘小鹏汽车/ });
    expect(openRow).toHaveTextContent("持仓中 · 最终盈亏未定");
    expect(openRow.querySelector(".review-queue-result")).toHaveClass("neutral");
    const unknownRow = screen.getByRole("button", { name: /复盘小米集团-W/ });
    expect(unknownRow).toHaveTextContent("盈亏待核对");
    expect(unknownRow.querySelector(".review-queue-result")).toHaveClass("neutral");
  });

  it("applies every available stock-level filter", async () => {
    const user = userEvent.setup();
    setup();
    const xpevButton = () =>
      screen.queryByRole("button", { name: "打开小鹏汽车交易回合" });
    const xiaomiButton = () =>
      screen.queryByRole("button", { name: "打开小米集团-W交易回合" });

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

    await user.selectOptions(
      screen.getByRole("combobox", { name: "按账户筛选" }),
      "acct-hk",
    );
    expect(xpevButton()).not.toBeInTheDocument();
    expect(xiaomiButton()).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "按账户筛选" }),
      "all",
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "按年份筛选" }),
      "2024",
    );
    expect(xpevButton()).not.toBeInTheDocument();
    expect(xiaomiButton()).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "按年份筛选" }),
      "all",
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "按持仓状态筛选" }),
      "open",
    );
    expect(xpevButton()).toBeInTheDocument();
    expect(xiaomiButton()).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "按持仓状态筛选" }),
      "all",
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "按行情完整性筛选" }),
      "incomplete",
    );
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
    const user = userEvent.setup();
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
  const live=records.map(r=>({...r,id:'live:'+r.id,source:{platform:'futu',row:r.source.row},accountId:'live'}));
  const entries=buildTradeLibraryEntries(buildInstrumentTradeSummaries([...records,...live]),{},{});
  const openReview=vi.fn();
  render(<TradeLibrary entries={entries} candlesByInstrument={{}} marketDataStatuses={{}} timeframe="1D" onTimeframeChange={()=>{}} onOpenInReview={openReview} onSaveReview={()=>{}} reviewsHydrated={true} />);
  await user.selectOptions(screen.getByLabelText('按交易性质筛选'),'simulation');
  expect(screen.getAllByRole('button',{name:/打开.*交易回合/})).toHaveLength(1);
  await user.click(screen.getByRole('button',{name:/打开.*交易回合/}));
  expect(openReview).toHaveBeenCalledWith('CN-SH:600330',entries.find(e=>e.executions[0].source.tradeNature==='simulation')!.episodes[0].episode.id, expect.any(Array));
  expect(screen.queryByText('TradingView 源报告')).not.toBeInTheDocument();
});
