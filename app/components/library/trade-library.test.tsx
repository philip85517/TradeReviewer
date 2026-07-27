import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailyCandleRecord } from "../../lib/market/contracts";
import type { EpisodeReviewRecord } from "../../lib/reviews/types";
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
  options: { reviewed?: boolean; reviewsHydrated?: boolean } = {},
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
  const onOpenInReview = vi.fn();
  const onSaveReview = vi.fn();
  render(
    <TradeLibrary
      entries={entries}
      candlesByInstrument={candlesByInstrument}
      marketDataStatuses={{
        "US:XPEV": "complete",
        "HK:1810": "partial",
      }}
      timeframe="1D"
      onTimeframeChange={vi.fn()}
      onOpenInReview={onOpenInReview}
      onSaveReview={onSaveReview}
      reviewsHydrated={options.reviewsHydrated ?? true}
    />,
  );
  return {
    onOpenInReview,
    onSaveReview,
    xpevEpisodeId: latestXpevEpisode?.id,
  };
}

describe("TradeLibrary", () => {
  afterEach(() => cleanup());

  it("filters the stock level and opens a stock's recent-first episode detail", async () => {
    const user = userEvent.setup();
    setup();

    expect(
      screen.getByRole("heading", { name: "股票交易库" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 只股票")).toBeInTheDocument();
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

    expect(
      screen.getByRole("heading", { name: "小鹏汽车（XPEV）" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /第 2 次交易/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("新回合买入")).toBeInTheDocument();
    expect(screen.getAllByText("待复盘").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: /第 1 次交易/ }),
    );
    expect(screen.getByText("旧回合买入")).toBeInTheDocument();
    expect(screen.getByText("旧回合卖出")).toBeInTheDocument();
    expect(screen.queryByText("新回合买入")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "返回股票库" }),
    );
    expect(
      screen.getByRole("heading", { name: "股票交易库" }),
    ).toBeInTheDocument();
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
    const { onOpenInReview } = setup();

    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );
    await user.click(
      screen.getByRole("button", { name: "进入逐笔复盘" }),
    );

    expect(onOpenInReview).toHaveBeenCalledWith("US:XPEV");
  });

  it("shows persisted review facts and saves the selected episode", async () => {
    const user = userEvent.setup();
    const { onSaveReview, xpevEpisodeId } = setup({ reviewed: true });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "按标签筛选" }),
      "pullback",
    );
    expect(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "打开小米集团-W交易回合" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );

    expect(screen.getAllByText("已复盘").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1R").length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox", { name: "回踩" })).toBeChecked();
    expect(screen.getByLabelText("买入理由")).toHaveValue("等待回踩确认");

    await user.click(
      screen.getByRole("button", { name: "保存当前回合复盘" }),
    );
    expect(onSaveReview).toHaveBeenCalledWith(
      expect.objectContaining({
        episodeId: xpevEpisodeId,
        confirmedTagIds: ["pullback"],
      }),
    );
  });

  it("does not open an editable blank review before persistence hydration", async () => {
    const user = userEvent.setup();
    setup({ reviewsHydrated: false });

    await user.click(
      screen.getByRole("button", { name: "打开小鹏汽车交易回合" }),
    );

    expect(
      screen.getByLabelText("正在读取当前回合复盘"),
    ).toHaveTextContent("正在读取本机复盘记录");
    expect(screen.queryByLabelText("买入理由")).not.toBeInTheDocument();
  });
});
