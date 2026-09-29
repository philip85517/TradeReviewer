import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { TradingRoomGlobalSearch, TradingRoomGlobalUtilities } from "./trading-room-global-tools";

afterEach(cleanup);

const instrument: Instrument = { id: "HK:0005", symbol: "0005", name: "汇丰控股", market: "HK", currency: "HKD" };
const scope = { nature: "live" as const, accountIds: [], simulationRunId: null };

function entries() {
  const execution: TradeExecution = {
    id: "slot-test:buy", accountId: "account-1", accountLabel: "主账户", instrument,
    side: "buy", executedAt: "2026-01-04T00:00:00.000Z", quantity: "1", price: "10", fee: "0",
    source: { platform: "fixture", row: 1, tradeNature: "live" },
  };
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries([execution]), {}, {});
}

describe("split global header slots", () => {
  it("keeps the result list closed after Escape focuses the search input", () => {
    const view = render(<TradingRoomGlobalSearch entries={entries()} scope={scope} onOpenSearchResult={vi.fn()} />);
    const input = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(input, { target: { value: "汇丰" } });
    const result = screen.getByRole("option", { name: /汇丰控股/ });
    result.focus();
    fireEvent.keyDown(result, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "标的搜索结果" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(input);
    view.unmount();
  });

  it("keeps a stale result notice when the input receives focus", () => {
    const source = entries();
    const view = render(<TradingRoomGlobalSearch entries={source} scope={scope} onOpenSearchResult={vi.fn()} />);
    const input = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(input, { target: { value: "汇丰" } });
    const result = screen.getByRole("option", { name: /汇丰控股/ });
    source.splice(0);
    view.rerender(<TradingRoomGlobalSearch entries={source} scope={scope} onOpenSearchResult={vi.fn()} />);
    fireEvent.click(result);
    fireEvent.blur(input);
    fireEvent.focus(input);
    expect(screen.getByRole("status")).toHaveTextContent("当前身份下的标的已变化");
  });

  it("closes an open search popover and restores focus on outside pointer", () => {
    render(<TradingRoomGlobalSearch entries={entries()} scope={scope} onOpenSearchResult={vi.fn()} />);
    const input = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(input, { target: { value: "汇丰" } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox", { name: "标的搜索结果" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(input);
  });

  it("shows loading state without a misleading zero notification count", () => {
    render(<TradingRoomGlobalUtilities entries={[]} scope={scope} status="loading" onOpenNotification={vi.fn()} onOpenAccountAndCurrency={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "打开待处理事项" }));
    const dialog = screen.getByRole("dialog", { name: "待处理事项" });
    expect(dialog).toHaveTextContent("读取中");
    expect(dialog).not.toHaveTextContent("0 项");
  });
});
