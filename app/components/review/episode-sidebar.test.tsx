import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import type { InstrumentTradeSummary } from "../../lib/trades/instruments";
import { EpisodeSidebar } from "./episode-sidebar";

afterEach(cleanup);

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
  onUpdateAllMarketData: () => {},
  marketDataRefresh: {
    running: false,
    total: 0,
    completed: 0,
    partial: 0,
    failed: 0,
  },
};

describe("EpisodeSidebar", () => {
  it("finds and selects a stock among 81 entries without refreshing market data", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRefresh = vi.fn();
    const entries = Array.from({ length: 81 }, (_, index) => ({
      ...summaryFor(`HK:${index}`, String(index), `股票${index}`),
      lastTradeAt: index === 80 ? "2026-01-01T00:00:00Z" : "2025-01-01T00:00:00Z",
    }));
    const { rerender } = render(<EpisodeSidebar {...baseProps} showDemo={false} importedInstruments={entries} pendingReviewInstrumentIds={["HK:80"]} onSelectInstrument={onSelect} onUpdateMarketData={onRefresh} />);
    expect(screen.getAllByRole("button", { pressed: false })[0]).toHaveTextContent("股票80");
    await user.type(screen.getByRole("searchbox", { name: "查找复盘股票" }), "不存在");
    expect(screen.getByText("没有符合条件的股票")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "清除筛选" }));
    await user.click(screen.getByRole("checkbox", { name: "仅看待复盘" }));
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(1);
    await user.click(screen.getByRole("button", { pressed: false }));
    expect(onSelect).toHaveBeenCalledWith("HK:80");
    expect(onRefresh).not.toHaveBeenCalled();
    rerender(<EpisodeSidebar {...baseProps} showDemo={false} importedInstruments={entries} pendingReviewInstrumentIds={[]} onSelectInstrument={onSelect} onUpdateMarketData={onRefresh} />);
    expect(screen.getByText("没有符合条件的股票")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

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

  it("offers a one-click refresh for all imported market data", async () => {
    render(
      <EpisodeSidebar
        {...baseProps}
        showDemo={false}
        importedInstruments={[summaryFor("HK:1585", "1585", "雅迪控股")]}
        onUpdateAllMarketData={() => {}}
        marketDataRefresh={{
          running: false,
          total: 1,
          completed: 0,
          partial: 0,
          failed: 0,
        }}
      />,
    );

    await userEvent.click(screen.getByText("行情维护"));
    expect(
      screen
        .getAllByRole("button", { name: "一键更新全部行情" })
        .at(-1),
    ).toBeEnabled();
  });
});
