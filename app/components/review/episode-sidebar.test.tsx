import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { InstrumentTradeSummary } from "../../lib/trades/instruments";
import { EpisodeSidebar } from "./episode-sidebar";

function summaryFor(
  id: string,
  symbol: string,
  name: string,
): InstrumentTradeSummary {
  return {
    instrument: {
      id,
      symbol,
      name,
      market: "HK",
      currency: "HKD",
    },
    executions: [],
    tradeCount: 2,
    firstTradeAt: "2021-05-28T06:40:12.000Z",
    lastTradeAt: "2021-06-07T06:40:12.000Z",
  };
}

const baseProps = {
  importedInstruments: [],
  importing: false,
  importError: null,
  onImport: () => {},
  onScreenshotImport: () => {},
  onOpenHistory: () => {},
  revealedDemoExecutions: [],
  selectedInstrumentId: "",
  onSelectInstrument: () => {},
  marketDataStatuses: {},
  onUpdateMarketData: () => {},
};

describe("EpisodeSidebar", () => {
  it("hides the bundled demo and reports zero stocks when demo is disabled", () => {
    render(
      <EpisodeSidebar
        {...baseProps}
        showDemo={false}
      />,
    );

    expect(screen.queryByText("小鹏汽车")).not.toBeInTheDocument();
    expect(screen.getByText("0 只股票")).toBeInTheDocument();
    expect(
      screen.getByText("暂无导入股票，请先导入交易记录。"),
    ).toBeInTheDocument();
  });

  it("renders imported stocks without adding the bundled demo", () => {
    render(
      <EpisodeSidebar
        {...baseProps}
        showDemo={false}
        importedInstruments={[summaryFor("HK:1585", "1585", "雅迪控股")]}
      />,
    );

    expect(screen.getByText("雅迪控股")).toBeInTheDocument();
    expect(screen.queryByText("小鹏汽车")).not.toBeInTheDocument();
    expect(screen.getByText("1 只股票")).toBeInTheDocument();
  });
});
