import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailyCandleRecord } from "../../lib/market/contracts";
import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import {
  DEFAULT_TRADE_LIBRARY_BROWSE_STATE,
  type TradeLibraryBrowseState,
} from "./library-browse-state";
import { TradeLibrary } from "./trade-library";

const PAGE_FIXTURE_SIZE = 101;
type OpenReview = (instrumentId: string, episodeId: string, queueIds?: string[]) => void;
type OpenReviewMock = ReturnType<typeof vi.fn<OpenReview>>;

function fixtureInstrument(index: number): Instrument {
  return {
    id: `CN-SH:PAGE-${index}`,
    symbol: `PAGE-${index}`,
    name: `分页标的${index}`,
    market: "CN-SH",
    currency: "CNY",
  };
}

function fixtureDate(index: number, close: boolean): string {
  const date = new Date(Date.UTC(2025, 0, 1 + index, close ? 12 : 10, 0));
  return date.toISOString();
}

function fixtureFill(
  instrument: Instrument,
  index: number,
  side: "buy" | "sell",
): TradeExecution {
  return {
    id: `${instrument.id}-${side}`,
    accountId: "account-page",
    accountLabel: "分页账户",
    instrument,
    side,
    executedAt: fixtureDate(index, side === "sell"),
    quantity: "1",
    price: side === "buy" ? "10" : "11",
    fee: "0",
    source: {
      platform: "futu",
      tradingNature: "live",
      row: index * 2 + (side === "buy" ? 1 : 2),
    },
  };
}

function buildPaginationEntries() {
  const executions = Array.from({ length: PAGE_FIXTURE_SIZE }, (_, index) => {
    const instrument = fixtureInstrument(index);
    return [
      fixtureFill(instrument, index, "buy"),
      fixtureFill(instrument, index, "sell"),
    ];
  }).flat();
  return buildTradeLibraryEntries(
    buildInstrumentTradeSummaries(executions),
    {},
    {},
  );
}

function initialState(mode: "stocks" | "queue"): TradeLibraryBrowseState {
  return {
    ...DEFAULT_TRADE_LIBRARY_BROWSE_STATE,
    mode,
    sort: "oldest",
    stockPage: 1,
    roundPage: 1,
  };
}

function renderLibrary(
  entries: ReturnType<typeof buildPaginationEntries>,
  options: {
    mode: "stocks" | "queue";
    initialBrowseState?: TradeLibraryBrowseState;
    onBrowseStateChange?: (state: TradeLibraryBrowseState) => void;
    onOpenInReview?: OpenReviewMock;
  },
) {
  const onOpenInReview = options.onOpenInReview ?? vi.fn<OpenReview>();
  const view = render(
    <TradeLibrary
      defaultMode={options.mode}
      initialBrowseState={options.initialBrowseState ?? initialState(options.mode)}
      onBrowseStateChange={options.onBrowseStateChange}
      entries={entries}
      candlesByInstrument={{} as Record<string, DailyCandleRecord[]>}
      marketDataStatuses={{}}
      timeframe="1D"
      onTimeframeChange={vi.fn()}
      onOpenInReview={onOpenInReview}
      onSaveReview={vi.fn()}
      reviewsHydrated
    />,
  );
  return { ...view, onOpenInReview };
}

function expectFullSetSummary() {
  expect(screen.getByText("101 个标的 · 101 个回合")).toBeInTheDocument();
  expect(screen.getByText("当前筛选：101 个证券 · 101 个回合 · 已复盘 0/101 个")).toBeInTheDocument();
  const summary = screen.getByRole("region", { name: "当前筛选绩效汇总" });
  expect(summary).toHaveTextContent("净盈亏样本 101");
  expect(summary).toHaveTextContent("收益率样本 101");
  expect(summary).toHaveTextContent("+¥101.00");
}

describe("TradeLibrary pagination acceptance", () => {
  afterEach(() => cleanup());

  it("keeps stock counts and metrics global while page two opens the exact child", async () => {
    const user = userEvent.setup();
    const entries = buildPaginationEntries();
    const expectedEntry = entries.find((entry) => entry.instrument.symbol === "PAGE-100");
    const expectedEpisodeId = expectedEntry?.episodes[0]?.episode.id;
    const { onOpenInReview } = renderLibrary(entries, { mode: "stocks" });

    expectFullSetSummary();
    const pagination = screen.getByRole("navigation", { name: "股票列表分页" });
    expect(withinText(pagination, "显示 1-100/101")).toBe(true);
    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(withinText(pagination, "显示 101-101/101")).toBe(true);
    expect(screen.getByRole("button", { name: "展开分页标的100交易回合" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开分页标的0交易回合" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "展开分页标的100交易回合" }));
    await user.click(screen.getByRole("button", { name: "打开分页标的100第1次交易 分页账户" }));
    expect(onOpenInReview).toHaveBeenCalledWith(
      expectedEntry?.instrument.id,
      expectedEpisodeId,
      [expectedEpisodeId],
    );
  });

  it("keeps queue metrics and Start Review global when the visible page is page two", async () => {
    const user = userEvent.setup();
    const entries = buildPaginationEntries();
    const expectedFirst = entries.find((entry) => entry.instrument.symbol === "PAGE-0");
    const expectedFirstEpisodeId = expectedFirst?.episodes[0]?.episode.id;
    const { onOpenInReview } = renderLibrary(entries, { mode: "queue" });

    expectFullSetSummary();
    const pagination = screen.getByRole("navigation", { name: "回合列表分页" });
    expect(withinText(pagination, "显示第 1–100 个，共 101 个回合")).toBe(true);
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(withinText(pagination, "显示第 101–101 个，共 101 个回合")).toBe(true);
    expect(screen.getByRole("button", { name: /复盘分页标的100/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /复盘分页标的0/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^开始复盘/ }));
    expect(onOpenInReview).toHaveBeenCalledWith(
      expectedFirst?.instrument.id,
      expectedFirstEpisodeId,
      expect.any(Array),
    );
    const queueIds = onOpenInReview.mock.calls[0]?.[2] as string[];
    expect(queueIds).toHaveLength(PAGE_FIXTURE_SIZE);
    expect(queueIds[0]).toBe(expectedFirstEpisodeId);
  });

  it("resets both page cursors when scope, sort, or reset changes", async () => {
    const user = userEvent.setup();
    const entries = buildPaginationEntries();
    let latestState: TradeLibraryBrowseState | undefined;
    renderLibrary(entries, {
      mode: "queue",
      onBrowseStateChange: (state) => {
        latestState = state;
      },
    });

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(latestState?.roundPage).toBe(2));
    await user.selectOptions(screen.getByRole("combobox", { name: "按交易性质筛选" }), "all");
    await waitFor(() => expect(latestState?.roundPage).toBe(1));

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await user.click(screen.getByRole("button", { name: "按成交时间排序（升序）" }));
    await waitFor(() => expect(latestState?.roundPage).toBe(1));

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await user.click(screen.getByRole("button", { name: "重置筛选" }));
    await waitFor(() => {
      expect(latestState?.roundPage).toBe(1);
      expect(latestState?.stockPage).toBe(1);
    });
    expect(screen.getByLabelText("交易库排序")).toHaveValue("newest");
    expectFullSetSummary();
  });

  it("keeps page two through review return and parent remount", async () => {
    const user = userEvent.setup();
    const entries = buildPaginationEntries();
    let latestState: TradeLibraryBrowseState | undefined;
    renderLibrary(entries, {
      mode: "queue",
      onBrowseStateChange: (state) => {
        latestState = state;
      },
    });

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(latestState?.roundPage).toBe(2));
    const savedPageTwoState = latestState;
    await user.click(screen.getByRole("button", { name: /复盘分页标的100/ }));
    expect(screen.getByRole("button", { name: "返回股票库" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回股票库" }));
    expect(screen.getByText("显示第 101–101 个，共 101 个回合")).toBeInTheDocument();

    cleanup();
    renderLibrary(entries, {
      mode: "queue",
      initialBrowseState: savedPageTwoState,
    });
    expect(screen.getByText("显示第 101–101 个，共 101 个回合")).toBeInTheDocument();
    expectFullSetSummary();
  });
});

function withinText(element: HTMLElement, text: string): boolean {
  return element.textContent?.includes(text) ?? false;
}
