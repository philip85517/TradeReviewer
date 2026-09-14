import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TradeLibraryEntry } from "../../lib/trades/library";
import type { TradeEpisode } from "../../lib/trades/types";
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
});
