import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstrumentTradeSummary } from "../../lib/trades/instruments";
import { ImportedEpisodeReview } from "./imported-episode-review";

const summary: InstrumentTradeSummary = {
  instrument: {
    id: "HK:1810",
    symbol: "1810",
    name: "小米集团-W",
    market: "HK",
    currency: "HKD",
  },
  executions: [],
  tradeCount: 2,
  firstTradeAt: "2025-01-02T02:00:00.000Z",
  lastTradeAt: "2025-01-10T02:00:00.000Z",
};

afterEach(cleanup);

describe("ImportedEpisodeReview", () => {
  it("labels date-only rows without synthesizing a trade time", () => {
    render(
      <ImportedEpisodeReview
        summary={{
          ...summary,
          executions: [
            {
              id: "cms:statement:1",
              source: {
                platform: "china-merchants",
                page: 1,
                row: 8,
                sourceOrder: 1,
                timePrecision: "date-only",
                sourceTimestampText: "20250102",
                sourceTimezone: "Asia/Shanghai",
              },
              accountId: "cms:account",
              accountLabel: "招商证券账户",
              instrument: summary.instrument,
              side: "buy",
              executedAt: "2099-12-31T23:59:59.000Z",
              quantity: "100",
              price: "34.50",
              fee: "5",
            },
          ],
          tradeCount: 1,
        }}
        marketDataStatus="not-requested"
        onUpdateMarketData={vi.fn()}
        timeframe="1D"
        candles={[]}
      />,
    );

    expect(
      screen.getByText(/20250102.*对账单未提供成交时间/),
    ).toHaveTextContent("20250102 · 对账单未提供成交时间");
    expect(screen.queryByText(/2099|23:59:59/)).not.toBeInTheDocument();
  });

  it("shows a cached chart with the stock name, source and coverage dates", () => {
    render(
      <ImportedEpisodeReview
        summary={summary}
        marketDataStatus="complete"
        onUpdateMarketData={vi.fn()}
        timeframe="1D"
        candles={[
          {
            instrumentId: "HK:1810",
            tradingDate: "2025-01-02",
            open: "34.1",
            high: "35",
            low: "33.8",
            close: "34.5",
            volume: "1200",
            currency: "HKD",
            provider: "tencent",
            providerSymbol: "hk01810",
            adjustmentMode: "raw",
            fetchedAt: "2025-02-01T00:00:00.000Z",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "小米集团-W（1810）" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("imported-market-chart")).toBeInTheDocument();
    expect(screen.getByText(/腾讯公开行情/)).toBeInTheDocument();
    expect(screen.getByText(/2025-01-02/)).toBeInTheDocument();
  });
});
