import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildInstrumentTradeSummaries } from "../../lib/trades/instruments";
import { buildTradeLibraryEntries } from "../../lib/trades/library";
import type { Instrument, TradeExecution } from "../../lib/trades/types";
import { TradingRoomGlobalTools, type TradingRoomGlobalToolsProps } from "./trading-room-global-tools";

afterEach(cleanup);

const instrument: Instrument = {
  id: "HK:0005",
  symbol: "0005",
  name: "汇丰控股",
  market: "HK",
  currency: "HKD",
};

function importedEntries() {
  const execution: TradeExecution = {
    id: "global-tools:buy",
    accountId: "account-1",
    accountLabel: "主账户",
    instrument,
    side: "buy",
    executedAt: "2026-01-04T00:00:00.000Z",
    quantity: "1",
    price: "10",
    fee: "0",
    source: { platform: "fixture", row: 1, tradeNature: "live" },
  };
  return buildTradeLibraryEntries(buildInstrumentTradeSummaries([execution]), {}, {});
}

function props(overrides: Partial<TradingRoomGlobalToolsProps> = {}): TradingRoomGlobalToolsProps {
  return {
    entries: [],
    scope: { nature: "live", accountIds: [], simulationRunId: null },
    status: "ready",
    onOpenSearchResult: vi.fn(),
    onOpenNotification: vi.fn(),
    onOpenAccountAndCurrency: vi.fn(),
    ...overrides,
  };
}

describe("TradingRoomGlobalTools", () => {
  it("gates search and avoids a fake zero count while identity data is loading or failing", () => {
    const initial = props({ status: "loading" });
    const view = render(<TradingRoomGlobalTools {...initial} />);
    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(initial.onOpenSearchResult).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "打开待处理事项" }));
    const dialog = screen.getByRole("dialog", { name: "待处理事项" });
    expect(dialog).toHaveTextContent("读取中");
    expect(screen.queryByLabelText(/条待处理事项/)).not.toBeInTheDocument();

    view.rerender(<TradingRoomGlobalTools {...initial} status="error" />);
    expect(screen.getByRole("dialog", { name: "待处理事项" })).toHaveTextContent("读取失败");
    expect(screen.queryByLabelText(/条待处理事项/)).not.toBeInTheDocument();
  });

  it("revalidates a stale search result and notification against the latest identity", () => {
    const entries = importedEntries();
    const initial = props({ entries, marketDataStatuses: { [instrument.id]: "partial" } });
    const view = render(<TradingRoomGlobalTools {...initial} />);
    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    const result = screen.getByRole("option", { name: /汇丰控股/ });
    entries.splice(0);
    view.rerender(<TradingRoomGlobalTools {...initial} />);
    fireEvent.click(result);
    expect(initial.onOpenSearchResult).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("当前身份下的标的已变化");

    entries.push(...importedEntries());
    view.rerender(<TradingRoomGlobalTools {...initial} />);
    fireEvent.click(screen.getByRole("button", { name: "打开待处理事项" }));
    const notification = screen.getByRole("button", { name: /行情问题/ });
    entries.splice(0);
    view.rerender(<TradingRoomGlobalTools {...initial} />);
    fireEvent.click(notification);
    expect(initial.onOpenNotification).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("当前范围下的事项已变化");
  });

  it("closes search, notifications, and the user menu with Escape and restores trigger focus", async () => {
    const initial = props({ entries: importedEntries(), marketDataStatuses: { [instrument.id]: "partial" } });
    render(<TradingRoomGlobalTools {...initial} />);
    const user = userEvent.setup();

    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    const result = screen.getByRole("option", { name: /汇丰控股/ });
    result.focus();
    expect(document.activeElement).toBe(result);
    result.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: /汇丰控股/ })).not.toBeInTheDocument();
      expect(document.activeElement).toBe(search);
    });

    const notificationTrigger = screen.getByRole("button", { name: "打开待处理事项" });
    fireEvent.click(notificationTrigger);
    const notification = screen.getByRole("button", { name: /行情问题/ });
    notification.focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "待处理事项" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(notificationTrigger);

    const userTrigger = screen.getByRole("button", { name: "打开本地用户菜单" });
    fireEvent.click(userTrigger);
    expect(screen.getByRole("menu", { name: "本地用户菜单" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "本地用户菜单" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(userTrigger);
  });

  it("returns focus to the notification trigger when its close button is activated", () => {
    const initial = props({ entries: importedEntries(), marketDataStatuses: { [instrument.id]: "partial" } });
    render(<TradingRoomGlobalTools {...initial} />);
    const trigger = screen.getByRole("button", { name: "打开待处理事项" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "关闭待处理事项" }));
    expect(screen.queryByRole("dialog", { name: "待处理事项" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("restores the original trigger when an outside pointer closes a popover", () => {
    const initial = props({ entries: importedEntries(), marketDataStatuses: { [instrument.id]: "partial" } });
    render(<TradingRoomGlobalTools {...initial} />);

    const search = screen.getByRole("searchbox", { name: "搜索已导入标的" });
    fireEvent.change(search, { target: { value: "汇丰控股" } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox", { name: "标的搜索结果" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(search);

    const notificationTrigger = screen.getByRole("button", { name: "打开待处理事项" });
    fireEvent.click(notificationTrigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog", { name: "待处理事项" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(notificationTrigger);

    const userTrigger = screen.getByRole("button", { name: "打开本地用户菜单" });
    fireEvent.click(userTrigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "本地用户菜单" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(userTrigger);
  });
});
