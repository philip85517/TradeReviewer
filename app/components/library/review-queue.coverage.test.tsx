import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { TradeEpisode } from "../../lib/trades/types";
import { buildReviewQueue } from "../../lib/reviews/review-queue";
import { ReviewQueue } from "./review-queue";

afterEach(cleanup);

const instrument = {
  id: "HK:700",
  symbol: "700",
  name: "腾讯控股",
  market: "HK",
  currency: "HKD",
};

function entry(warnings: TradeEpisode["warnings"]): TradeLibraryEntry {
  const episode: TradeEpisode = {
    id: "episode-coverage-gap",
    accountId: "account-1",
    accountLabel: "港股账户",
    instrument,
    direction: "long",
    status: "closed",
    startedAt: "2025-01-06T02:30:00.000Z",
    endedAt: "2025-01-08T02:30:00.000Z",
    openingQuantity: "100",
    remainingQuantity: "0",
    executions: [
      {
        id: "buy-1",
        accountId: "account-1",
        accountLabel: "港股账户",
        instrument,
        side: "buy",
        executedAt: "2025-01-06T02:30:00.000Z",
        quantity: "100",
        price: "10",
        fee: "1",
        source: { platform: "futu", row: 1 },
      },
      {
        id: "sell-1",
        accountId: "account-1",
        accountLabel: "港股账户",
        instrument,
        side: "sell",
        executedAt: "2025-01-08T02:30:00.000Z",
        quantity: "100",
        price: "23",
        fee: "1",
        source: { platform: "futu", row: 2 },
      },
    ],
    ...(warnings === undefined ? {} : { warnings }),
  };

  return {
    instrument,
    executions: episode.executions,
    episodes: [{
      episode,
      metrics: {
        buyCount: 1,
        sellCount: 1,
        boughtQuantity: "100",
        soldQuantity: "100",
        grossExposure: "1000",
        fees: "2",
        realizedPnl: "1300",
        unrealizedPnl: "0",
        netPnl: "1298",
        returnPercent: "129.8",
        holdingMilliseconds: 172800000,
      },
      reviewStatus: "pending",
      confirmedTagIds: [],
      tagDictionaryVersion: 1,
      rMultiple: null,
    }],
    accountCount: 1,
    tradeCount: 2,
    episodeCount: 1,
    firstTradeAt: episode.startedAt,
    lastTradeAt: episode.endedAt ?? episode.startedAt,
    status: "closed",
    netPnl: "1298",
    returnPercent: "129.8",
    reviewedEpisodeCount: 0,
    confirmedTagIds: [],
    cumulativeR: null,
  };
}

function renderQueue(warnings: TradeEpisode["warnings"]) {
  return render(
    <ReviewQueue
      entries={[entry(warnings)]}
      filter={{ status: "all" }}
      onFilter={() => {}}
      onOpen={() => {}}
      onBrowseStocks={() => {}}
    />,
  );
}

function pagedEntries(count: number): TradeLibraryEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const source = entry([]);
    const sourceEpisode = source.episodes[0]!;
    const pagedInstrument = { ...instrument, id: `HK:700-${index}`, symbol: `700-${index}` };
    const executions = sourceEpisode.episode.executions.map((fill) => ({
      ...fill,
      id: `${fill.id}-${index}`,
      instrument: pagedInstrument,
    }));
    const episode = {
      ...sourceEpisode.episode,
      id: `episode-coverage-${index}`,
      instrument: pagedInstrument,
      executions,
    };
    return {
      ...source,
      instrument: pagedInstrument,
      executions,
      episodes: [{ ...sourceEpisode, episode }],
    };
  });
}

function expectRowNetPnl() {
  const row = screen.getByRole("button", { name: /复盘腾讯控股/ });
  expect(within(row).getByText("+HK$1,298.00")).toBeInTheDocument();
}

describe("ReviewQueue coverage warnings", () => {
  it("shows the short coverage warning and its missing-month range without hiding net PnL", () => {
    renderQueue([
      { code: "statement-coverage-gap", from: "2024-02", to: "2024-04" },
    ]);

    const warning = screen.getByText("账单缺月，持仓边界一致");
    expect(warning).toHaveAttribute("title", "账单缺月：2024-02 至 2024-04");
    expect(screen.getByLabelText("账单缺月，持仓边界一致；缺失区间：2024-02 至 2024-04")).toBeInTheDocument();
    expectRowNetPnl();
    expect(screen.getByText("排除").parentElement).toHaveTextContent("0");
  });

  it("does not show a coverage warning for an empty warnings array", () => {
    renderQueue([]);

    expect(screen.queryByText("账单缺月，持仓边界一致")).not.toBeInTheDocument();
    expectRowNetPnl();
  });

  it("exposes date, CNY PnL, and return sort headers with direction", async () => {
    const onFilter = vi.fn();
    render(
      <ReviewQueue
        entries={[entry([])]}
        filter={{ status: "all", sort: "newest" }}
        onFilter={onFilter}
        onOpen={() => {}}
        onBrowseStocks={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "按成交时间排序（降序）" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "按 CNY 净盈亏排序（未排序）" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "按加权收益率排序（未排序）" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "按成交时间排序（降序）" }));
    expect(onFilter).toHaveBeenCalledWith(expect.objectContaining({ sort: "oldest" }));
  });

  it("selects rows independently from navigation and opens the selected review queue", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ReviewQueue entries={[entry([])]} filter={{ status: "all" }} onFilter={() => {}} onOpen={onOpen} onBrowseStocks={() => {}} />);
    await user.click(screen.getByRole("checkbox", { name: /选择复盘回合 腾讯控股/ }));
    expect(screen.getByText("已选 1 个回合")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "加入本次复盘队列" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ episode: expect.objectContaining({ id: "episode-coverage-gap" }) }) }), ["episode-coverage-gap"]);
  });

  it("persists optional column preferences without changing the business row", async () => {
    const user = userEvent.setup();
    window.localStorage.removeItem("tradereview:review-queue-columns:v1");
    renderQueue([]);
    await user.click(screen.getByText("列设置"));
    await user.click(screen.getByRole("checkbox", { name: "费用" }));
    expect(JSON.parse(window.localStorage.getItem("tradereview:review-queue-columns:v1") ?? "{}")).toMatchObject({ fees: true });
    expect(screen.getByRole("button", { name: /复盘腾讯控股/ })).toBeInTheDocument();
  });

  it("renders only one hundred rounds per page while keeping the total and page controls", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const rows = buildReviewQueue(pagedEntries(205), { status: "all", sort: "newest" });
    render(
      <ReviewQueue
        entries={[]}
        rows={rows}
        pendingRows={[]}
        filter={{ status: "all", sort: "newest" }}
        onFilter={() => {}}
        onOpen={() => {}}
        onBrowseStocks={() => {}}
        page={1}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getAllByRole("button", { name: /复盘腾讯控股/ })).toHaveLength(100);
    expect(screen.getByText("显示第 1–100 个，共 205 个回合")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("keeps a selected round available to the batch action after paging", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ReviewQueue entries={pagedEntries(101)} filter={{ status: "all" }} onFilter={() => {}} onOpen={onOpen} onBrowseStocks={() => {}} />);
    await user.click(screen.getAllByRole("checkbox", { name: /选择复盘回合/ })[0]!);
    await user.click(screen.getByRole("button", { name: "下一页" }));
    expect(screen.getByText("已选 1 个回合")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "加入本次复盘队列" }));
    expect(onOpen).toHaveBeenCalledWith(expect.anything(), ["episode-coverage-0"]);
  });
});
